import logging
import datetime
from django.db.models import Sum
from .models import ChartOfAccount, LedgerEntry
from decimal import Decimal

logger = logging.getLogger(__name__)

def generate_trial_balance(date=None, organization=None):
    """Generate a Trial Balance report."""
    accounts = ChartOfAccount.objects.filter(is_active=True).order_by('code')
    if organization:
        accounts = accounts.filter(organization=organization)
    report = []
    total_debit = Decimal('0.00')
    total_credit = Decimal('0.00')

    for acc in accounts:
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

def generate_balance_sheet(date=None, organization=None):
    """Generate Balance Sheet: Assets = Liabilities + Equity."""
    
    def get_account_balance(account, depth=0):
        """Recursively calculate balance for an account and its children.
        Only leaf accounts hold balances; parent accounts act as headers."""
        if depth > 10:
            logger.warning(f"Max depth reached for account balance aggregation at {account.code}")
            return Decimal('0.00')
        
        children = list(account.children.filter(is_active=True))
        children = list(account.children.filter(is_active=True))
        # Sum children balances recursively
        total = Decimal('0.00')
        for child in children:
            total += get_account_balance(child, depth + 1)
            
        # Add this account's own balance (allows direct posting to headers if needed)
        return total + account.balance

    def get_category_data(acc_type):
        org_filter = {'organization': organization} if organization else {}
        
        # Get all leaf accounts of this type with non-zero balances
        # and all potential parent accounts
        all_accounts = ChartOfAccount.objects.filter(
            account_type=acc_type, is_active=True, **org_filter
        )
        
        details = []
        total = Decimal('0.00')
        
        for acc in all_accounts:
            # For the details list, we only show the direct balance of the account
            # to avoid double counting in the UI list.
            if acc.balance != 0:
                details.append({'name': f"{acc.code} - {acc.name}", 'balance': acc.balance})

        # The total must be the aggregate of all roots
        total = Decimal('0.00')
        roots = all_accounts.filter(parent__isnull=True)
        for root in roots:
            total += get_account_balance(root)
                
        return total, details
                
        return total, details

    assets_total, assets_list = get_category_data('asset')
    liabilities_total, liabilities_list = get_category_data('liability')
    equity_total, equity_list = get_category_data('equity')

    # Add Net Profit (Current Year) to Equity
    # This is essential for the balance sheet to balance before year-end closing
    from .reports import generate_profit_loss
    pl_data = generate_profit_loss(
        start_date=datetime.date(datetime.date.today().year, 1, 1),
        end_date=date or datetime.date.today(),
        organization=organization
    )
    net_profit = pl_data['net_profit']
    
    if net_profit != 0:
        equity_list.append({'name': 'Net Profit (Current Period)', 'balance': net_profit})
        equity_total += net_profit

    return {
        'assets': {'total': assets_total, 'details': assets_list},
        'liabilities': {'total': liabilities_total, 'details': liabilities_list},
        'equity': {'total': equity_total, 'details': equity_list},
        'is_balanced': assets_total == (liabilities_total + equity_total)
    }

def generate_profit_loss(start_date, end_date, organization=None):
    """Generate Profit & Loss: Income - Expenses."""
    org_filter = {'organization': organization} if organization else {}
    
    def get_report_balance(account, depth=0):
        """Recursively calculate period balance (Income/Expense focus)."""
        if depth > 10:
            return Decimal('0.00')
        
        children = list(account.children.filter(is_active=True))
        # Start with this account's own entries
        entries = LedgerEntry.objects.filter(
            account=account,
            is_posted=True,
            journal_entry__date__range=[start_date, end_date]
        )
        debits = entries.filter(entry_type='debit').aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')
        credits = entries.filter(entry_type='credit').aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')

        if account.account_type == 'income':
            current_acc_balance = credits - debits
        else: # expense/asset/liability
            current_acc_balance = debits - credits

        # Recursively add children
        total = Decimal('0.00')
        for child in children:
            total += get_report_balance(child, depth + 1)
            
        return total + current_acc_balance

    def get_category_data(acc_type):
        # To show a breakdown, we look at all accounts of this type for the org
        all_accounts = ChartOfAccount.objects.filter(
            account_type=acc_type, is_active=True, **org_filter
        )
        
        details = []
        total = Decimal('0.00')
        
        for acc in all_accounts:
            # We want to show the contribution of THIS account only in the breakdown
            # to avoid double counting parent+child in the UI.
            entries = LedgerEntry.objects.filter(
                account=acc,
                is_posted=True,
                journal_entry__date__range=[start_date, end_date]
            )
            debits = entries.filter(entry_type='debit').aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')
            credits = entries.filter(entry_type='credit').aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')

            if acc.account_type == 'income':
                direct_balance = credits - debits
            else:
                direct_balance = debits - credits
            
            if direct_balance != 0:
                details.append({
                    'code': acc.code,
                    'name': f"{acc.code} - {acc.name}",
                    'amount': direct_balance
                })
        
        # The total must be the aggregate of all roots
        total = Decimal('0.00')
        roots = all_accounts.filter(parent__isnull=True)
        for root in roots:
            total += get_report_balance(root)
            
        return total, sorted(details, key=lambda x: x['code'])
                    
        return total, sorted(details, key=lambda x: x['code'])

    income_total, income_list = get_category_data('income')
    expense_total, expense_list = get_category_data('expense')
    net_profit = income_total - expense_total

    return {
        'income': {'total': income_total, 'details': income_list},
        'expenses': {'total': expense_total, 'details': expense_list},
        'net_profit': net_profit
    }

def generate_general_ledger(account_id=None, start_date=None, end_date=None, organization=None):
    """Detailed transaction history for specific account(s)."""
    
    def get_single_account_ledger(account):
        entries = LedgerEntry.objects.filter(account=account, is_posted=True).order_by('journal_entry__date', 'journal_entry__created_at')
        
        if start_date:
            entries = entries.filter(journal_entry__date__gte=start_date)
        if end_date:
            entries = entries.filter(journal_entry__date__lte=end_date)
            
        history = []
        running_balance = Decimal('0.00')
        
        if start_date:
            prior_entries = LedgerEntry.objects.filter(account=account, is_posted=True, journal_entry__date__lt=start_date)
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
            'account_id': str(account.id),
            'account_name': account.name,
            'account_code': account.code,
            'account_type': account.account_type,
            'opening_balance': running_balance - (sum(e['debit'] for e in history) - sum(e['credit'] for e in history)) if account.account_type in ['asset', 'expense'] else running_balance - (sum(e['credit'] for e in history) - sum(e['debit'] for e in history)),
            'history': history,
            'closing_balance': running_balance
        }

    if account_id and account_id != 'all':
        account = ChartOfAccount.objects.get(id=account_id)
        return get_single_account_ledger(account)
    
    # Bulk mode: All accounts
    accounts = ChartOfAccount.objects.filter(is_active=True).order_by('code')
    if organization:
        accounts = accounts.filter(organization=organization)
    all_ledgers = []
    total_opening = Decimal('0.00')
    total_closing = Decimal('0.00')
    
    for acc in accounts:
        # Only include if has transactions or non-zero balance
        if LedgerEntry.objects.filter(account=acc).exists() or acc.balance != 0:
            ledger = get_single_account_ledger(acc)
            all_ledgers.append(ledger)
            # Note: Totals might not be meaningful across different account types 
            # without proper sign conversions, but we return them for summary
            total_opening += ledger['opening_balance']
            total_closing += ledger['closing_balance']
            
    return {
        'is_bulk': True,
        'accounts': all_ledgers,
        'total_opening': total_opening,
        'total_closing': total_closing
    }

def generate_cash_flow_statement(start_date, end_date, organization=None):
    """
    Simplified Cash Flow Statement (Direct Method).
    Focuses on movements in Cash/Bank/M-Pesa accounts.
    """
    cash_accounts = ChartOfAccount.objects.filter(code__startswith='11')
    if organization:
        cash_accounts = cash_accounts.filter(organization=organization)
    
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

def generate_disbursements_report(start_date, end_date, organization=None):
    """Detailed report for all loan disbursements."""
    from apps.loans.models import Loan
    qs = Loan.objects.filter(
        disbursement_date__range=[start_date, end_date]
    )
    if organization:
        qs = qs.filter(organization=organization)
    disbursements = qs.select_related('borrower', 'product').order_by('disbursement_date')
    
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

def generate_collections_report(start_date, end_date, organization=None):
    """Summary of all loan repayments received."""
    from apps.loans.models import LoanRepayment
    qs = LoanRepayment.objects.filter(
        payment_date__range=[start_date, end_date]
    )
    if organization:
        qs = qs.filter(loan__organization=organization)
    payments = qs.select_related('loan', 'loan__borrower').order_by('payment_date')
    
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

def generate_portfolio_performance(organization=None):
    """High-level summary of loan product performance."""
    from apps.loans.models import LoanProduct, Loan
    from apps.loans.services.arrears import calculate_par_metrics
    
    products = LoanProduct.objects.filter(is_active=True)
    if organization:
        products = products.filter(organization=organization)
    par_metrics = calculate_par_metrics(organization=organization)
    
    product_stats = []
    for p in products:
        loans = Loan.objects.filter(product=p, status='active')
        if organization:
            loans = loans.filter(organization=organization)
        total_outstanding = loans.aggregate(Sum('outstanding_balance'))['outstanding_balance__sum'] or Decimal('0.00')
        product_stats.append({
            'name': p.name,
            'active_loans': loans.count(),
            'outstanding_balance': total_outstanding
        })
        
    par30_pct = par_metrics.get('par_30_plus_percent', par_metrics.get('par30_percent', 0))
    return {
        'products': product_stats,
        'par_metrics': par_metrics,
        'risk_level': 'High' if par30_pct > 10 else 'Moderate' if par30_pct > 5 else 'Low'
    }
