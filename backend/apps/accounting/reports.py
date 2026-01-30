import logging
from django.db.models import Sum
from .models import ChartOfAccount, LedgerEntry
from decimal import Decimal

logger = logging.getLogger(__name__)

def generate_trial_balance(date=None):
    """Generate a Trial Balance report."""
    accounts = ChartOfAccount.objects.filter(is_active=True).order_by('code')
    report = []
    total_debit = Decimal('0.00')
    total_credit = Decimal('0.00')

    for acc in accounts:
        # For Trial Balance, we show total debits and credits per account
        entries = LedgerEntry.objects.filter(account=acc, is_posted=True)
        if date:
            entries = entries.filter(journal_entry__date__lte=date)
            
        debit = entries.filter(entry_type='debit').aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')
        credit = entries.filter(entry_type='credit').aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')

        if debit > 0 or credit > 0:
            report.append({
                'code': acc.code,
                'name': acc.name,
                'debit': debit,
                'credit': credit
            })
            total_debit += debit
            total_credit += credit

    return {
        'report': report,
        'total_debit': total_debit,
        'total_credit': total_credit,
        'is_balanced': total_debit == total_credit
    }

def generate_balance_sheet(date=None):
    """Generate Balance Sheet: Assets = Liabilities + Equity."""
    
    def get_account_balance(account, date=None, depth=0):
        """Recursively calculate balance for an account and its children with cycle protection."""
        if depth > 10:
            logger.warning(f"Max depth reached for account balance aggregation at {account.code}")
            return account.balance
            
        # 1. Start with the account's own balance
        total = account.balance
        
        # 2. Add balances of all children recursively
        for child in account.children.all():
            total += get_account_balance(child, date, depth + 1)
            
        return total

    def get_category_data(acc_type, date=None):
        # Top-level accounts for this type
        root_accounts = ChartOfAccount.objects.filter(account_type=acc_type, parent=None, is_active=True)
        total = Decimal('0.00')
        details = []
        
        for acc in root_accounts:
            balance = get_account_balance(acc, date)
            if balance != 0:
                details.append({'name': acc.name, 'balance': balance})
                total += balance
                
        return total, details

    assets_total, assets_list = get_category_data('asset', date)
    liabilities_total, liabilities_list = get_category_data('liability', date)
    equity_total, equity_list = get_category_data('equity', date)

    return {
        'assets': {'total': assets_total, 'details': assets_list},
        'liabilities': {'total': liabilities_total, 'details': liabilities_list},
        'equity': {'total': equity_total, 'details': equity_list},
        'is_balanced': assets_total == (liabilities_total + equity_total)
    }

def generate_profit_loss(start_date, end_date):
    """Generate Profit & Loss: Income - Expenses."""
    income_accs = ChartOfAccount.objects.filter(account_type='income')
    expense_accs = ChartOfAccount.objects.filter(account_type='expense')
    
    def get_period_total(accounts):
        total = Decimal('0.00')
        details = []
        for acc in accounts:
            entries = LedgerEntry.objects.filter(
                account=acc, 
                is_posted=True, 
                journal_entry__date__range=[start_date, end_date]
            )
            # Normal balance logic for P&L
            debits = entries.filter(entry_type='debit').aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')
            credits = entries.filter(entry_type='credit').aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')
            
            if acc.account_type == 'income':
                balance = credits - debits
            else:
                balance = debits - credits
                
            if balance != 0:
                details.append({'name': acc.name, 'balance': balance})
                total += balance
        return total, details

    income_total, income_list = get_period_total(income_accs)
    expense_total, expense_list = get_period_total(expense_accs)
    net_profit = income_total - expense_total

    return {
        'income': {'total': income_total, 'details': income_list},
        'expenses': {'total': expense_total, 'details': expense_list},
        'net_profit': net_profit
    }

def generate_general_ledger(account_id, start_date=None, end_date=None):
    """Detailed transaction history for a specific account."""
    account = ChartOfAccount.objects.get(id=account_id)
    entries = LedgerEntry.objects.filter(account=account, is_posted=True).order_by('journal_entry__date', 'journal_entry__created_at')
    
    if start_date:
        entries = entries.filter(journal_entry__date__gte=start_date)
    if end_date:
        entries = entries.filter(journal_entry__date__lte=end_date)
        
    history = []
    running_balance = Decimal('0.00')
    
    # Needs logic for opening balance if start_date is provided
    if start_date:
        prior_entries = LedgerEntry.objects.filter(account=account, is_posted=True, journal_entry__date__lt=start_date)
        # Normal balance logic
        p_debits = prior_entries.filter(entry_type='debit').aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')
        p_credits = prior_entries.filter(entry_type='credit').aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')
        
        if account.account_type in ['asset', 'expense']:
            running_balance = p_debits - p_credits
        else:
            running_balance = p_credits - p_debits

    for entry in entries:
        if entry.entry_type == 'debit':
            if account.account_type in ['asset', 'expense']:
                running_balance += entry.amount
            else:
                running_balance -= entry.amount
        else: # credit
            if account.account_type in ['asset', 'expense']:
                running_balance -= entry.amount
            else:
                running_balance += entry.amount
                
        history.append({
            'id': str(entry.id),
            'date': entry.journal_entry.date,
            'description': entry.journal_entry.description,
            'reference': entry.journal_entry.reference,
            'debit': entry.amount if entry.entry_type == 'debit' else Decimal('0.00'),
            'credit': entry.amount if entry.entry_type == 'credit' else Decimal('0.00'),
            'balance': running_balance
        })
        
    return {
        'account_name': account.name,
        'account_code': account.code,
        'opening_balance': running_balance - (sum(e['debit'] for e in history) - sum(e['credit'] for e in history)) if account.account_type in ['asset', 'expense'] else running_balance - (sum(e['credit'] for e in history) - sum(e['debit'] for e in history)),
        'history': history,
        'closing_balance': running_balance
    }

def generate_cash_flow_statement(start_date, end_date):
    """
    Simplified Cash Flow Statement (Direct Method).
    Focuses on movements in Cash/Bank/M-Pesa accounts.
    """
    cash_accounts = ChartOfAccount.objects.filter(code__startswith='11') # Cash & Cash Equivalents
    
    inflow = []
    outflow = []
    
    entries = LedgerEntry.objects.filter(
        account__in=cash_accounts,
        is_posted=True,
        journal_entry__date__range=[start_date, end_date]
    ).select_related('journal_entry')
    
    operating_in = Decimal('0.00')
    operating_out = Decimal('0.00')
    
    for entry in entries:
        # Debits to Cash are Inflows, Credits are Outflows
        if entry.entry_type == 'debit':
            operating_in += entry.amount
            inflow.append({
                'date': entry.journal_entry.date,
                'description': entry.journal_entry.description,
                'amount': entry.amount
            })
        else:
            operating_out += entry.amount
            outflow.append({
                'date': entry.journal_entry.date,
                'description': entry.journal_entry.description,
                'amount': entry.amount
            })
            
    return {
        'operating_activities': {
            'inflow': inflow,
            'outflow': outflow,
            'net_cash_operating': operating_in - operating_out
        },
        'net_increase_in_cash': operating_in - operating_out
    }

def generate_disbursements_report(start_date, end_date):
    """Detailed report for all loan disbursements."""
    from apps.loans.models import Loan
    disbursements = Loan.objects.filter(
        disbursement_date__range=[start_date, end_date]
    ).select_related('borrower', 'product').order_by('disbursement_date')
    
    report = []
    total_amount = Decimal('0.00')
    
    for loan in disbursements:
        report.append({
            'loan_number': loan.loan_number,
            'borrower': f"{loan.borrower.first_name} {loan.borrower.last_name}",
            'product': loan.product.name,
            'amount': loan.principal_amount,
            'date': loan.disbursement_date,
            'method': loan.disbursement_method,
            'reference': loan.disbursement_reference
        })
        total_amount += loan.principal_amount
        
    return {
        'data': report,
        'summary': {
            'total_amount': total_amount,
            'count': len(report),
            'avg_loan_size': total_amount / len(report) if report else 0
        }
    }

def generate_collections_report(start_date, end_date):
    """Summary of all loan repayments received."""
    from apps.loans.models import LoanRepayment
    payments = LoanRepayment.objects.filter(
        payment_date__range=[start_date, end_date]
    ).select_related('loan', 'loan__borrower').order_by('payment_date')
    
    report = []
    summary = {
        'total_principal': Decimal('0.00'),
        'total_interest': Decimal('0.00'),
        'total_fees': Decimal('0.00'),
        'total_penalties': Decimal('0.00'),
        'total_collected': Decimal('0.00'),
    }
    
    for p in payments:
        report.append({
            'date': p.payment_date,
            'loan': p.loan.loan_number,
            'borrower': f"{p.loan.borrower.first_name} {p.loan.borrower.last_name}",
            'amount': p.amount,
            'method': p.get_payment_method_display(),
            'principal': p.principal_paid,
            'interest': p.interest_paid,
            'fees': p.fee_paid,
            'penalties': p.penalty_paid
        })
        summary['total_principal'] += p.principal_paid
        summary['total_interest'] += p.interest_paid
        summary['total_fees'] += p.fee_paid
        summary['total_penalties'] += p.penalty_paid
        summary['total_collected'] += p.amount
        
    return {
        'data': report,
        'summary': summary
    }

def generate_portfolio_performance():
    """High-level summary of loan product performance."""
    from apps.loans.models import LoanProduct, Loan
    from apps.loans.services.arrears import calculate_par_metrics
    
    products = LoanProduct.objects.filter(is_active=True)
    par_metrics = calculate_par_metrics()
    
    product_stats = []
    for p in products:
        loans = Loan.objects.filter(product=p, status='active')
        total_outstanding = loans.aggregate(Sum('outstanding_balance'))['outstanding_balance__sum'] or Decimal('0.00')
        product_stats.append({
            'name': p.name,
            'active_loans': loans.count(),
            'outstanding_balance': total_outstanding
        })
        
    return {
        'products': product_stats,
        'par_metrics': par_metrics,
        'risk_level': 'High' if par_metrics['par30_percent'] > 10 else 'Moderate' if par_metrics['par30_percent'] > 5 else 'Low'
    }
