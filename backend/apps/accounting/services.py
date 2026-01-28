from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from .models import ChartOfAccount, JournalEntry, LedgerEntry

def create_double_entry(date, description, reference, debits, credits, created_by=None):
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
            status=JournalEntry.Status.POSTED # Auto-post for system events
        )
        
        # 2. Add Debit Entries
        for code, amount in debits:
            account = ChartOfAccount.objects.get(code=code)
            LedgerEntry.objects.create(
                journal_entry=journal,
                account=account,
                entry_type=LedgerEntry.EntryType.DEBIT,
                amount=Decimal(str(amount))
            )
            
        # 3. Add Credit Entries
        for code, amount in credits:
            account = ChartOfAccount.objects.get(code=code)
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

def post_loan_disbursement(loan):
    """
    Loan Disbursement:
    Debit: Loan Portfolio - Principal (Asset)
    Credit: Cash/Bank Account (Asset)
    """
    # Mapping account based on method
    credit_acc = '1110' # Default Bank
    if loan.disbursement_method == 'mpesa':
        credit_acc = '1130'
    
    create_double_entry(
        date=loan.disbursement_date,
        description=f"Loan Disbursement: {loan.loan_number} to {loan.customer}",
        reference=loan.loan_number,
        debits=[('1210', loan.principal_amount)],
        credits=[(credit_acc, loan.principal_amount)]
    )

def post_loan_repayment(repayment):
    """
    Loan Repayment:
    Debit: Cash/Bank Account (Asset)
    Credit: Loan Portfolio - Principal (Asset)
    Credit: Interest Income (Income)
    Credit: Fee/Penalty Income (Income)
    """
    # Mapping account based on method
    debit_acc = '1110'
    if repayment.payment_method == 'mpesa':
        debit_acc = '1130'
    
    credits = []
    if repayment.principal_paid > 0:
        credits.append(('1210', repayment.principal_paid))
    if repayment.interest_paid > 0:
        credits.append(('4100', repayment.interest_paid))
    if repayment.penalty_paid > 0:
        credits.append(('4300', repayment.penalty_paid))
    if repayment.fee_paid > 0:
        credits.append(('4200', repayment.fee_paid))
        
    create_double_entry(
        date=repayment.payment_date,
        description=f"Loan Repayment: {repayment.loan.loan_number} from {repayment.loan.customer}",
        reference=repayment.reference_number,
        debits=[(debit_acc, repayment.amount)],
        credits=credits
    )

def post_external_expense(expense):
    """
    Expense Payment:
    Debit: Operating Expenses (Expense)
    Credit: Cash/Bank (Asset)
    """
    create_double_entry(
        date=expense.date,
        description=f"Expense Payment: {expense.description}",
        reference=expense.expense_number,
        debits=[('5100', expense.amount)],
        credits=[('1120', expense.amount)] # Default Petty Cash
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
        credits=[('2110', transaction.amount)]
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
        credits=[(credit_acc, transaction.amount)]
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
        debits=[('5200', transaction.amount)],
        credits=[('2110', transaction.amount)]
    )
