from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from .models import ChartOfAccount, JournalEntry, LedgerEntry

def create_double_entry(date, description, reference, debits, credits, created_by=None, organization=None):
    """
    Helper to create a balanced journal entry.
    debits/credits: list of tuples (account_code, amount)
    """
    with transaction.atomic():
        # 1. Create Journal Entry
        journal = JournalEntry.objects.create(
            date=date,
            description=description,
            reference=reference,
            created_by=created_by,
            organization=organization,
            status=JournalEntry.Status.POSTED # Auto-post for system events
        )
        
        # Build COA lookup filter
        if not organization:
            raise ValueError(f"Organization is required for double entry: {description}")
        
        coa_filter = {'organization': organization}
        
        # 2. Add Debit Entries
        for code, amount in debits:
            account = ChartOfAccount.objects.get(code=code, **coa_filter)
            LedgerEntry.objects.create(
                journal_entry=journal,
                account=account,
                entry_type=LedgerEntry.EntryType.DEBIT,
                amount=Decimal(str(amount))
            )
            
        # 3. Add Credit Entries
        for code, amount in credits:
            account = ChartOfAccount.objects.get(code=code, **coa_filter)
            LedgerEntry.objects.create(
                journal_entry=journal,
                account=account,
                entry_type=LedgerEntry.EntryType.CREDIT,
                amount=Decimal(str(amount))
            )
        
        # 4. Final balance check
        if not journal.is_balanced():
            raise ValueError(f"Journal Entry is not balanced: {description}")
            
        return journal

# Specialized Posting Functions

def post_loan_disbursement(loan, cash_account_code='1110', payoff_details=None):
    """
    Loan Disbursement:
    Debit: Loan Portfolio - Principal (Asset - 1210)
    Credit: Old Loan Portfolio (if refinancing - 1210, 4100, 4300 etc)
    Credit: Cash/Bank Account (Asset - Net amount)
    """
    description = f"Loan Disbursement: {loan.loan_number} to {loan.borrower}"
    credits = []
    total_payoff = Decimal('0.00')
    
    if payoff_details:
        old_loan_num = payoff_details.get('old_loan_number')
        description = f"Refinancing: {loan.loan_number} pays off {old_loan_num}"
        
        p_amt = payoff_details.get('principal', Decimal('0.00'))
        i_amt = payoff_details.get('interest', Decimal('0.00'))
        pen_amt = payoff_details.get('penalties', Decimal('0.00'))
        
        if p_amt > 0: credits.append(('1210', p_amt))
        if i_amt > 0: credits.append(('4100', i_amt))
        if pen_amt > 0: credits.append(('4300', pen_amt))
        
        total_payoff = p_amt + i_amt + pen_amt
    
    net_cash = loan.principal_amount - total_payoff
    credits.append((cash_account_code, net_cash))
    
    create_double_entry(
        date=loan.disbursement_date or timezone.now().date(),
        description=description,
        reference=loan.loan_number,
        debits=[('1210', loan.principal_amount)],
        credits=credits,
        organization=loan.organization
    )

def post_fee_income(loan, deductions_breakdown, cash_account_code='1110'):
    """
    Fee Income (Withheld from disbursement):
    Debit: Cash/Bank Account (Asset)
    Credit: Grouped credit accounts (4200, 2210, etc.)
    
    deductions_breakdown: List of {'coa_code': str, 'amount': Decimal}
    """
    total_amount = sum(d['amount'] for d in deductions_breakdown)
    if total_amount <= 0:
        return None

    credits = []
    for d in deductions_breakdown:
        if d['amount'] > 0:
            credits.append((d['coa_code'], d['amount']))

    return create_double_entry(
        date=loan.disbursement_date or timezone.now().date(),
        description=f"Deductions (Withheld): {loan.loan_number} from {loan.borrower}",
        reference=f"FEE-{loan.loan_number}",
        debits=[(cash_account_code, total_amount)],
        credits=credits,
        organization=loan.organization
    )

def post_loan_repayment(repayment, cash_account_code='1110'):
    """
    Loan Repayment:
    Debit: Cash/Bank Account (Asset)
    Credit: Loan Portfolio - Principal (Asset - 1210)
    Credit: Interest Income (Income - 4100)
    Credit: Fee/Penalty Income (Income)
    """
    credits = []
    if repayment.principal_paid > 0:
        credits.append(('1210', repayment.principal_paid))
    if repayment.interest_paid > 0:
        credits.append(('4100', repayment.interest_paid))
    if repayment.penalty_paid > 0:
        credits.append(('4300', repayment.penalty_paid))
    if repayment.fee_paid > 0:
        credits.append(('4200', repayment.fee_paid))
    if repayment.overpayment > 0:
        credits.append(('2140', repayment.overpayment))
        
    if not credits:
        # Avoid creating unbalanced entries if allocation is missing
        return None
        
    # Real-time Accrual Sync: 
    # When interest is paid, we must reduce the Receivable (1220) 
    # while recognizing the Income (4100).
    # Since 4100 is credited, we must add a DEBIT to 1220 to offset the accrual.
    debits = [(cash_account_code, sum(amount for _, amount in credits))]
    if repayment.interest_paid > 0:
        debits.append(('1220', -repayment.interest_paid)) 
        # Wait, if 1220 is an asset, a debit increases it. 
        # But we already credited 1210 (Asset - reduces it).
        # Actually, if we want to reduce 1220 (Asset), we must CREDIT it.
        # But wait, the interest paid IS interest income.
        
        # Proper Accrual Accounting during payment:
        # Debit: Cash (1110)
        # Credit: Interest Receivable (1220)  <-- This reduces the "Expected" interest
        # (The Income 4100 was already credited during DAILY ACCRUAL or should be now)
        
        # If we use the "Daily Accrual" model (1220 Debit, 4100 Credit),
        # Then the payment should be:
        # Debit: Cash (1110)
        # Credit: Interest Receivable (1220)
        
        # Let's check my accrue_daily_interest task:
        # It does: Debit 1220, Credit 4100 for the ENTIRE OUTSTANDING.
        
        # If we want REAL TIME:
        # 1. Payment: Debit Cash, Credit 1210 (Prin), Credit 1220 (Int Receivable)
        # 2. Daily Sync: Adjust 1220 to match dashboard.
        
        # BUT the user sees 4100 as Income. If we credit 1220, where does the 4100 come from?
        # The 4100 came from the ACCRUAL.
        
    # Let's simplify and make it robust:
    # We will CREDIT 1220 for interest paid instead of 4100.
    # Because 4100 already received the amount during Accrual.
    
    final_credits = []
    for code, amount in credits:
        if code == '4100': # Interest Income
            final_credits.append(('1220', amount)) # Redirect to Clear Receivable
        else:
            final_credits.append((code, amount))

    create_double_entry(
        date=repayment.payment_date,
        description=f"Loan Repayment: {repayment.loan.loan_number} from {repayment.loan.borrower}",
        reference=repayment.reference_number,
        debits=[(cash_account_code, sum(amount for _, amount in credits))],
        credits=final_credits,
        organization=repayment.loan.organization
    )

def post_external_expense(expense, cash_account_code):
    """
    Expense Payment:
    Debit: Linked Expense Account (e.g. 5100, 5210)
    Credit: Selected Treasury COA (Asset)
    """
    if not expense.account:
        raise ValueError(f"Expense {expense.expense_number} has no account linked.")
        
    create_double_entry(
        date=expense.date,
        description=f"Expense Payment: {expense.description}",
        reference=expense.expense_number,
        debits=[(expense.account.code, expense.amount)],
        credits=[(cash_account_code, expense.amount)],
        organization=expense.organization
    )

def post_savings_deposit(transaction):
    """
    Savings Deposit:
    Debit: Bank/Mpesa (Asset)
    Credit: Savings Deposits (Liability - 2110)
    """
    debit_acc = '1110'
    if transaction.reference.lower().startswith('mpesa') or 'mpesa' in transaction.description.lower():
        debit_acc = '1130'
        
    create_double_entry(
        date=transaction.transaction_date.date(),
        description=f"Savings Deposit: {transaction.account.account_number}",
        reference=transaction.reference,
        debits=[(debit_acc, transaction.amount)],
        credits=[('2110', transaction.amount)],
        organization=transaction.account.organization
    )

def post_savings_withdrawal(transaction):
    """
    Savings Withdrawal:
    Debit: Savings Deposits (Liability - 2110)
    Credit: Bank/Mpesa (Asset)
    """
    credit_acc = '1110'
    
    create_double_entry(
        date=transaction.transaction_date.date(),
        description=f"Savings Withdrawal: {transaction.account.account_number}",
        reference=transaction.reference,
        debits=[('2110', transaction.amount)],
        credits=[(credit_acc, transaction.amount)],
        organization=transaction.account.organization
    )

def post_savings_interest(transaction):
    """
    Interest Posting:
    Debit: Savings Interest Expense (Expense - 5200)
    Credit: Savings Deposits (Liability - 2110)
    """
    create_double_entry(
        date=transaction.transaction_date.date(),
        description=f"Interest Posting: {transaction.account.account_number}",
        reference=transaction.reference,
        debits=[('5210', transaction.amount)],
        credits=[('2110', transaction.amount)],
        organization=transaction.account.organization
    )


def post_investment_received(investment, cash_account_code='1110'):
    """
    Investment Received:
    Debit: Cash/Bank Account (Asset)
    Credit: Investor Capital / Long-term Liabilities (Liability - 2200)
    """
    create_double_entry(
        date=investment.investment_date,
        description=f"Investment received from {investment.investor.name}: {investment.investment_number}",
        reference=investment.investment_number,
        debits=[(cash_account_code, investment.principal_amount)],
        credits=[('2200', investment.principal_amount)],
        organization=investment.investor.organization
    )


def post_investor_payout(payout, cash_account_code='1110'):
    """
    Investor Payout:
    - Principal return: Debit Investor Capital (2200), Credit Cash
    - Interest/Bonus: Debit Interest Expense (5210), Credit Cash
    """
    if payout.payout_type == 'principal':
        debit_code = '2200'  # Reduce liability
        desc = f"Principal return to {payout.investment.investor.name}"
    else:
        debit_code = '5210'  # Interest/bonus expense
        desc = f"{payout.get_payout_type_display()} to {payout.investment.investor.name}"

    create_double_entry(
        date=payout.payout_date,
        description=desc,
        reference=payout.reference or f"PAYOUT-{payout.id}",
        debits=[(debit_code, payout.amount)],
        credits=[(cash_account_code, payout.amount)],
        organization=payout.investment.investor.organization
    )


def post_loan_write_off(loan, amount):
    """
    Loan Write-Off:
    Debit: Loan Loss Expense (Expense - 5300)
    Credit: Loan Portfolio (Asset - 1210)
    """
    create_double_entry(
        date=timezone.now().date(),
        description=f"Loan Write-off: {loan.loan_number} from {loan.borrower}",
        reference=f"WO-{loan.loan_number}",
        debits=[('5300', amount)],
        credits=[('1210', amount)],
        organization=loan.organization
    )
