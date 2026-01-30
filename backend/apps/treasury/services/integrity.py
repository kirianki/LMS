import logging
from django.db import transaction
from django.utils import timezone
from apps.treasury.models import Transaction as TreasuryTransaction, CashAccount
from apps.accounting.services import post_loan_disbursement, post_loan_repayment, post_external_expense, post_fee_income
from apps.accounting.models import JournalEntry

logger = logging.getLogger(__name__)

def record_money_event(event_type, instance, cash_account_id=None, user=None):
    """
    Main entry point for recording money movements.
    Wraps both Treasury and Accounting in a single atomic transaction.
    """
    with transaction.atomic():
        try:
            if event_type == 'loan_disbursement':
                _handle_loan_disbursement(instance, cash_account_id, user)
            elif event_type == 'loan_repayment':
                _handle_loan_repayment(instance, cash_account_id, user)
            elif event_type == 'expense_paid':
                _handle_expense_paid(instance, cash_account_id, user)
            elif event_type == 'payroll_paid':
                _handle_payroll_paid(instance, cash_account_id, user)
            # Add others as needed
        except Exception as e:
            logger.error(f"Financial sync error for {event_type} on {instance}: {str(e)}", exc_info=True)
            raise e

def _get_account(instance, cash_account_id=None, default_type=CashAccount.AccountType.BANK):
    """Refined account selection logic."""
    if cash_account_id:
        return CashAccount.objects.get(id=cash_account_id)
    
    # Try to match based on method (M-Pesa etc.)
    method = getattr(instance, 'disbursement_method', getattr(instance, 'payment_method', None))
    if method == 'mpesa':
        account = CashAccount.objects.filter(account_type=CashAccount.AccountType.MOBILE_MONEY, is_active=True).first()
        if account: return account
        
    # Default to first active account of preferred type
    account = CashAccount.objects.filter(account_type=default_type, is_active=True).first()
    if not account:
        # Final fallback
        account = CashAccount.objects.filter(is_active=True).first()
        
    if not account:
        raise ValueError("No active cash account found for transaction.")
    return account

def _handle_loan_disbursement(loan, cash_account_id=None, user=None):
    """Synchronize Treasury and GL for disbursement, including withheld fees."""
    account = _get_account(loan, cash_account_id)
    
    # 1. Treasury Recording (Net Disbursed Amount)
    if not TreasuryTransaction.objects.filter(
        related_loan=loan, 
        category=TreasuryTransaction.Category.LOAN_DISBURSEMENT
    ).exists():
        # Destination info
        details = loan.disbursement_details or {}
        dest_info = ""
        if loan.disbursement_method == 'mpesa':
            dest_info = f" to {details.get('phone_number', 'Unknown')}"
        elif loan.disbursement_method == 'bank_transfer':
            dest_info = f" to {details.get('bank_name', '')} {details.get('account_number', '')}"

        TreasuryTransaction.objects.create(
            account=account,
            transaction_type=TreasuryTransaction.TransactionType.DEBIT,
            category=TreasuryTransaction.Category.LOAN_DISBURSEMENT,
            amount=loan.disbursed_amount,
            description=f"Disbursement of loan {loan.loan_number} to {loan.borrower}{dest_info}",
            reference=loan.disbursement_reference or loan.loan_number,
            related_loan=loan,
            created_by=user,
            created_at=timezone.now()
        )

    # 2. Record Withheld Deductions as Fee Income
    total_fees = sum(d.calculated_amount for d in loan.application.deductions.filter(is_withheld=True))
    if total_fees > 0 and not TreasuryTransaction.objects.filter(
        related_loan=loan, 
        category=TreasuryTransaction.Category.FEE_INCOME
    ).exists():
        TreasuryTransaction.objects.create(
            account=account,
            transaction_type=TreasuryTransaction.TransactionType.CREDIT,
            category=TreasuryTransaction.Category.FEE_INCOME,
            amount=total_fees,
            description=f"Withheld fees from Loan {loan.loan_number}",
            reference=loan.loan_number,
            related_loan=loan,
            created_by=user,
            created_at=timezone.now()
        )

    # 3. Accounting (GL Sync)
    # Mapping for GL
    gl_code = '1130' if account.account_type == CashAccount.AccountType.MOBILE_MONEY else '1110'
    
    if not JournalEntry.objects.filter(reference=loan.loan_number).exists():
        post_loan_disbursement(loan, cash_account_code=gl_code)
        
    if total_fees > 0 and not JournalEntry.objects.filter(reference=f"FEE-{loan.loan_number}").exists():
        post_fee_income(loan, total_fees, cash_account_code=gl_code)

def _handle_loan_repayment(repayment, cash_account_id=None, user=None):
    """Synchronize Treasury and GL for repayment."""
    account = _get_account(repayment, cash_account_id)
    
    if not TreasuryTransaction.objects.filter(reference=repayment.reference_number).exists():
        TreasuryTransaction.objects.create(
            account=account,
            transaction_type=TreasuryTransaction.TransactionType.CREDIT,
            category=TreasuryTransaction.Category.LOAN_REPAYMENT,
            amount=repayment.amount,
            description=f"Repayment for loan {repayment.loan.loan_number} from {repayment.loan.borrower}",
            reference=repayment.reference_number,
            related_loan=repayment.loan,
            created_by=user,
            created_at=timezone.now()
        )
        
    # Accounting (GL)
    gl_code = '1130' if account.account_type == CashAccount.AccountType.MOBILE_MONEY else '1110'
    if not JournalEntry.objects.filter(reference=repayment.reference_number).exists():
        post_loan_repayment(repayment, cash_account_code=gl_code)

def _handle_expense_paid(expense, cash_account_id=None, user=None):
    """Synchronize Treasury and GL for expenses."""
    account = _get_account(expense, cash_account_id, default_type=CashAccount.AccountType.CASH)
    
    if not TreasuryTransaction.objects.filter(related_expense=expense).exists():
        TreasuryTransaction.objects.create(
            account=account,
            transaction_type=TreasuryTransaction.TransactionType.DEBIT,
            category=TreasuryTransaction.Category.EXPENSE,
            amount=expense.amount,
            description=f"Expense payment: {expense.description}",
            reference=expense.payment_reference or expense.expense_number,
            related_expense=expense,
            created_by=user,
            created_at=timezone.now()
        )
        
    # Accounting (GL)
    gl_code = '1120' if account.account_type == CashAccount.AccountType.CASH else '1110'
    if not JournalEntry.objects.filter(reference=expense.expense_number).exists():
        post_external_expense(expense, cash_account_code=gl_code)

def _handle_payroll_paid(payroll, cash_account_id=None, user=None):
    """Synchronize Treasury and GL for payroll payments."""
    account = _get_account(payroll, cash_account_id)
    
    # 1. Treasury Recording
    desc = f"Payroll payment: {payroll.staff.employee_number} for {payroll.period}"
    if not TreasuryTransaction.objects.filter(
        reference=payroll.payment_reference,
        category=TreasuryTransaction.Category.PAYROLL
    ).exists():
        TreasuryTransaction.objects.create(
            account=account,
            transaction_type=TreasuryTransaction.TransactionType.DEBIT,
            category=TreasuryTransaction.Category.PAYROLL,
            amount=payroll.net_pay,
            description=desc,
            reference=payroll.payment_reference,
            created_by=user,
            created_at=timezone.now()
        )
        
    # 2. Accounting (GL)
    # Debit: Payroll Expense (5200)
    # Credit: Cash/Bank (1110)
    gl_code = '1120' if account.account_type == CashAccount.AccountType.CASH else '1110'
    if not JournalEntry.objects.filter(reference=payroll.payment_reference).exists():
        from apps.accounting.services import create_double_entry
        create_double_entry(
            date=payroll.payment_date or timezone.now().date(),
            description=desc,
            reference=payroll.payment_reference,
            debits=[('5200', payroll.net_pay)],
            credits=[(gl_code, payroll.net_pay)]
        )
