from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from apps.treasury.models import Transaction, CashAccount

def record_loan_disbursement(loan, cash_account_id=None, user=None):
    """
    Record a loan disbursement in the treasury ledger.
    """
    if not cash_account_id:
        # Default to the first active bank account
        account = CashAccount.objects.filter(
            account_type=CashAccount.AccountType.BANK, 
            is_active=True
        ).first()
        if not account:
            # Fallback to any active account
            account = CashAccount.objects.filter(is_active=True).first()
    else:
        account = CashAccount.objects.get(id=cash_account_id)

    if not account:
        raise ValueError("No active cash account found for disbursement.")

    with transaction.atomic():
        # 1. Record the Main Disbursement (Money Out)
        Transaction.objects.create(
            account=account,
            transaction_type=Transaction.TransactionType.DEBIT,
            category=Transaction.Category.LOAN_DISBURSEMENT,
            amount=loan.disbursed_amount,
            description=f"Disbursement of Loan {loan.loan_number} to {loan.customer}",
            reference=loan.disbursement_reference or loan.loan_number,
            related_loan=loan,
            created_by=user,
            created_at=timezone.now()
        )

        # 2. Record Withheld Deductions as Fee Income (Internal Transfer)
        # These are technically "Money In" to the institution from the principal
        total_fees = sum(d.calculated_amount for d in loan.application.deductions.filter(is_withheld=True))
        
        if total_fees > 0:
            Transaction.objects.create(
                account=account,
                transaction_type=Transaction.TransactionType.CREDIT,
                category=Transaction.Category.FEE_INCOME,
                amount=total_fees,
                description=f"Withheld fees from Loan {loan.loan_number}",
                reference=loan.loan_number,
                related_loan=loan,
                created_by=user,
                created_at=timezone.now()
            )

    return True
