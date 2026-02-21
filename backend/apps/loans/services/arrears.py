from django.db.models import Sum, Count, Q
from django.utils import timezone
from datetime import date, datetime
from decimal import Decimal
from dateutil.relativedelta import relativedelta
from apps.loans.models import Loan, RepaymentSchedule


def calculate_loan_arrears_status(loan):
    """
    Calculate and update the current arrears status of a loan.
    Returns a dictionary with arrears information.
    """
    today = date.today()
    
    # 1. Find the earliest unpaid or partially paid schedule entry with due_date < today
    overdue_entries = RepaymentSchedule.objects.filter(
        loan=loan,
        due_date__lt=today,
        status__in=['pending', 'partial', 'overdue']
    ).order_by('due_date')
    
    if not overdue_entries.exists():
        # Loan is currently up to date
        loan.days_in_arrears = 0
        loan.arrears_category = 'current'
        loan.save(update_fields=['days_in_arrears', 'arrears_category'])
        return {
            'is_in_arrears': False,
            'days_in_arrears': 0,
            'arrears_amount': Decimal('0.00'),
            'category': 'current'
        }
    
    earliest_overdue = overdue_entries.first()
    days_overdue = (today - earliest_overdue.due_date).days
    
    # 2. Calculate total overdue amount (total_due + penalties - paid_amount)
    total_overdue = overdue_entries.aggregate(
        total=Sum('total_due') + Sum('penalty_due') - Sum('paid_amount')
    )['total'] or Decimal('0.00')
    
    # 3. Determine category
    category = 'current'
    if 1 <= days_overdue <= 30:
        category = '1-30'
    elif 31 <= days_overdue <= 60:
        category = '31-60'
    elif 61 <= days_overdue <= 90:
        category = '61-90'
    elif days_overdue > 90:
        category = '90+'
        
    # 4. Update loan model
    loan.days_in_arrears = days_overdue
    loan.arrears_category = category
    
    # Auto-escalate status if significantly overdue
    if days_overdue > 30 and loan.status == 'active':
        loan.status = 'defaulted'
        
    loan.save(update_fields=['days_in_arrears', 'arrears_category', 'status'])
    
    return {
        'is_in_arrears': True,
        'days_in_arrears': days_overdue,
        'arrears_amount': total_overdue,
        'category': category
    }


def get_arrears_aging_report():
    """
    Generate the Arrears Aging Report for the current tenant.
    Categorizes all active and defaulted loans into buckets.
    """
    today = date.today()
    
    # Categories: Current, 1-30, 31-60, 61-90, 90+
    buckets = {
        'current': {'count': 0, 'balance': Decimal('0.00'), 'arrears_amount': Decimal('0.00')},
        '1-30': {'count': 0, 'balance': Decimal('0.00'), 'arrears_amount': Decimal('0.00')},
        '31-60': {'count': 0, 'balance': Decimal('0.00'), 'arrears_amount': Decimal('0.00')},
        '61-90': {'count': 0, 'balance': Decimal('0.00'), 'arrears_amount': Decimal('0.00')},
        '90+': {'count': 0, 'balance': Decimal('0.00'), 'arrears_amount': Decimal('0.00')},
    }
    
    active_loans = Loan.objects.filter(status__in=['active', 'defaulted'])
    
    for loan in active_loans:
        # Optimization: We use the already stored fields if they are recently updated
        # In a real batch task, we'd update them first.
        category = loan.arrears_category
        
        # Calculate current arrears amount for this loan
        arrears_amount = RepaymentSchedule.objects.filter(
            loan=loan,
            due_date__lt=today,
            status__in=['pending', 'partial', 'overdue']
        ).aggregate(
            amt=Sum('total_due') + Sum('penalty_due') - Sum('paid_amount')
        )['amt'] or Decimal('0.00')
        
        if category in buckets:
            buckets[category]['count'] += 1
            buckets[category]['balance'] += loan.outstanding_balance
            buckets[category]['arrears_amount'] += arrears_amount
            
    return buckets


def calculate_par_metrics():
    """
    Calculate Portfolio at Risk (PAR) metrics.
    PAR X = (Outstanding balance of all loans with arrears > X days) / Total GL Portfolio
    """
    active_loans = Loan.objects.filter(status__in=['active', 'defaulted'])
    total_portfolio = active_loans.aggregate(total=Sum('outstanding_balance'))['total'] or Decimal('1.00') # Avoid div by zero
    
    par30_balance = active_loans.filter(days_in_arrears__gt=30).aggregate(total=Sum('outstanding_balance'))['total'] or Decimal('0.00')
    par60_balance = active_loans.filter(days_in_arrears__gt=60).aggregate(total=Sum('outstanding_balance'))['total'] or Decimal('0.00')
    par90_balance = active_loans.filter(days_in_arrears__gt=90).aggregate(total=Sum('outstanding_balance'))['total'] or Decimal('0.00')
    
    return {
        'total_portfolio': total_portfolio,
        'par30_amount': par30_balance,
        'par30_percent': (par30_balance / total_portfolio) * 100,
        'par60_amount': par60_balance,
        'par60_percent': (par60_balance / total_portfolio) * 100,
        'par90_amount': par90_balance,
        'par90_percent': (par90_balance / total_portfolio) * 100,
    }


def get_collections_forecast():
    """
    Calculate expected vs actual collections for the current month and next 11 months (total 12).
    """
    today = date.today()
    forecast = []
    
    # We'll look at current month + next 11 months
    for i in range(0, 12):
        target_date = today + relativedelta(months=i)
        month_start = target_date.replace(day=1)
        month_end = month_start + relativedelta(months=1) - relativedelta(days=1)
        
        # Expected collections (scheduled items in this month)
        # We also include any overdue amounts from BEFORE this month if it's the current month (i=0)
        if i == 0:
            scheduled = RepaymentSchedule.objects.filter(
                due_date__lte=month_end,
                loan__isnull=False
            )
        else:
            scheduled = RepaymentSchedule.objects.filter(
                due_date__gte=month_start,
                due_date__lte=month_end,
                loan__isnull=False
            )
            
        data = scheduled.aggregate(
            expected=Sum('total_due') + Sum('penalty_due'),
            actual=Sum('paid_amount')
        )
        
        expected = data['expected'] or Decimal('0.00')
        actual = data['actual'] or Decimal('0.00')
        rate = (actual / expected * 100) if expected > 0 else 0
        
        forecast.append({
            'month': month_start.strftime('%b %Y'),
            'expected': float(expected),
            'actual': float(actual),
            'rate': float(rate)
        })
        
    return forecast


def get_collections_breakdown(month_str):
    """
    Get detailed breakdown of expected collections for a specific month.
    month_str: e.g. "Feb 2026"
    """
    try:
        dt = datetime.strptime(month_str, '%b %Y')
        month_start = dt.date()
        month_end = month_start + relativedelta(months=1) - relativedelta(days=1)
    except ValueError:
        return []

    # Get today for "overdue" logic in current month
    today = date.today()
    is_current_month = month_start.month == today.month and month_start.year == today.year

    # Query for items due in this period that aren't fully paid
    # MUST filter for loan__isnull=False to avoid provisional schedules
    if is_current_month:
        scheduled = RepaymentSchedule.objects.filter(
            loan__isnull=False,
            due_date__lte=month_end,
            status__in=['pending', 'partial', 'overdue']
        )
    else:
        scheduled = RepaymentSchedule.objects.filter(
            loan__isnull=False,
            due_date__gte=month_start,
            due_date__lte=month_end,
            status__in=['pending', 'partial', 'overdue']
        )

    breakdown = []
    # select_related to avoid N+1 issues when fetching borrower name
    for s in scheduled.select_related('loan', 'loan__borrower').order_by('due_date'):
        breakdown.append({
            'id': str(s.id),
            'loan_id': str(s.loan.id),
            'loan_number': s.loan.loan_number,
            'borrower': str(s.loan.borrower),
            'due_date': s.due_date.strftime('%Y-%m-%d'),
            'amount_due': float(s.total_due + s.penalty_due - s.paid_amount),
            'status': s.status
        })

    return breakdown
