from celery import shared_task
from django.utils import timezone
from django.db.models import Sum, Q
from .models import CashAccount, DailySnapshot, Transaction
from apps.loans.models import Loan, RepaymentSchedule
from apps.investors.models import Investment, InvestorPayout
from apps.expenses.models import Expense
import logging

logger = logging.getLogger(__name__)


@shared_task
def create_daily_financial_snapshots():
    """Create daily financial snapshots for the system."""
    today = timezone.now().date()
    
    try:
        # 1. Total Cash across all accounts
        total_cash = CashAccount.objects.filter(is_active=True).aggregate(
            total=Sum('current_balance'))['total'] or 0
        
        # 2. Loan metrics
        loan_metrics = Loan.objects.filter(status='active').aggregate(
            principal=Sum('outstanding_principal'),
            interest=Sum('outstanding_interest')
        )
        
        # 3. Daily activity
        daily_activity = Transaction.objects.filter(created_at__date=today).aggregate(
            disbursed=Sum('amount', filter=Q(transaction_type=Transaction.TransactionType.DEBIT)),
            received=Sum('amount', filter=Q(transaction_type=Transaction.TransactionType.CREDIT))
        )
        
        # 4. Projections (expected next 30 days)
        from datetime import timedelta
        future_30d = today + timedelta(days=30)
        expected_collections = RepaymentSchedule.objects.filter(
            due_date__range=[today, future_30d],
            status__in=['pending', 'partial']
        ).aggregate(total=Sum('principal_due') + Sum('interest_due'))['total'] or 0
        
        # Create or update snapshot
        DailySnapshot.objects.update_or_create(
            date=today,
            defaults={
                'total_cash': total_cash,
                'outstanding_principal': loan_metrics['principal'] or 0,
                'outstanding_interest': loan_metrics['interest'] or 0,
                'total_disbursed': daily_activity['disbursed'] or 0,
                'total_received': daily_activity['received'] or 0,
                'expected_collections_30d': expected_collections,
            }
        )
        
        logger.info(f"Financial snapshot created for {today}")
        
    except Exception as e:
        logger.error(f"Error creating financial snapshot: {str(e)}")
