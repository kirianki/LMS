from django.db.models import Sum
from .models import ChartOfAccount, LedgerEntry
from decimal import Decimal

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
    accounts = ChartOfAccount.objects.filter(is_active=True)
    
    def get_total(acc_type):
        subset = accounts.filter(account_type=acc_type, parent=None)
        total = Decimal('0.00')
        details = []
        for acc in subset:
            # Recursive balance calculation would be better, but for now simple sum
            balance = acc.balance # Model updates this on post
            details.append({'name': acc.name, 'balance': balance})
            total += balance
        return total, details

    assets_total, assets_list = get_total('asset')
    liabilities_total, liabilities_list = get_total('liability')
    equity_total, equity_list = get_total('equity')

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
