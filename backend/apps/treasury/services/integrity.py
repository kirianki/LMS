"""
Unified financial integrity service.
Ensures Treasury and Accounting remain perfectly synchronized and atomic.
"""
from django.db import transaction
import logging
from apps.treasury.models import Transaction as TreasuryTransaction, CashAccount
from apps.accounting.services import post_loan_disbursement, post_loan_repayment, post_external_expense
from apps.accounting.models import JournalEntry

logger = logging.getLogger(__name__)

def record_money_event(event_type, instance):
    """
    Main entry point for recording money movements.
    Wraps both Treasury and Accounting in a single atomic transaction.
    """
    with transaction.atomic():
        try:
            if event_type == 'loan_disbursement':
                _handle_loan_disbursement(instance)
            elif event_type == 'loan_repayment':
                _handle_loan_repayment(instance)
            elif event_type == 'expense_paid':
                _handle_expense_paid(instance)
            # Add others as needed
        except Exception as e:
            logger.error(f"Financial sync error for {event_type} on {instance}: {str(e)}")
            # In a robust system, we might re-raise to fail the whole event
            # or use a background task for re-tries.
            raise e

def _handle_loan_disbursement(loan):
    """Synchronize Treasury and GL for disbursement."""
    # Treasury
    account_type = CashAccount.AccountType.MOBILE_MONEY if loan.disbursement_method == 'mpesa' else CashAccount.AccountType.BANK
    account, _ = CashAccount.objects.get_or_create(
        account_type=account_type,
        defaults={'name': f'Default {account_type.capitalize()} Account'}
    )
    
    # Idempotency check
    if not TreasuryTransaction.objects.filter(related_loan=loan, category=TreasuryTransaction.Category.LOAN_DISBURSEMENT).exists():
        TreasuryTransaction.objects.create(
            account=account,
            transaction_type=TreasuryTransaction.TransactionType.DEBIT,
            category=TreasuryTransaction.Category.LOAN_DISBURSEMENT,
            amount=loan.disbursed_amount,
            description=f"Disbursement of loan {loan.loan_number} to {loan.customer}",
            reference=loan.disbursement_reference or loan.loan_number,
            related_loan=loan
        )
        
    # Accounting (GL)
    if not JournalEntry.objects.filter(reference=loan.loan_number).exists():
        post_loan_disbursement(loan)

def _handle_loan_repayment(repayment):
    """Synchronize Treasury and GL for repayment."""
    # Treasury
    account_type = CashAccount.AccountType.MOBILE_MONEY if repayment.payment_method == 'mpesa' else CashAccount.AccountType.BANK
    account, _ = CashAccount.objects.get_or_create(
        account_type=account_type,
        defaults={'name': f'Default {account_type.capitalize()} Account'}
    )
    
    if not TreasuryTransaction.objects.filter(reference=repayment.reference_number).exists():
        TreasuryTransaction.objects.create(
            account=account,
            transaction_type=TreasuryTransaction.TransactionType.CREDIT,
            category=TreasuryTransaction.Category.LOAN_REPAYMENT,
            amount=repayment.amount,
            description=f"Repayment for loan {repayment.loan.loan_number} from {repayment.loan.customer}",
            reference=repayment.reference_number,
            related_loan=repayment.loan
        )
        
    # Accounting (GL)
    if not JournalEntry.objects.filter(reference=repayment.reference_number).exists():
        post_loan_repayment(repayment)

def _handle_expense_paid(expense):
    """Synchronize Treasury and GL for expenses."""
    # Treasury
    account, _ = CashAccount.objects.get_or_create(
        account_type=CashAccount.AccountType.CASH,
        defaults={'name': 'Default Cash Account'}
    )
    
    if not TreasuryTransaction.objects.filter(related_expense=expense).exists():
        TreasuryTransaction.objects.create(
            account=account,
            transaction_type=TreasuryTransaction.TransactionType.DEBIT,
            category=TreasuryTransaction.Category.EXPENSE,
            amount=expense.amount,
            description=f"Expense payment: {expense.description}",
            reference=expense.payment_reference or expense.expense_number,
            related_expense=expense
        )
        
    # Accounting (GL)
    if not JournalEntry.objects.filter(reference=expense.expense_number).exists():
        post_external_expense(expense)
