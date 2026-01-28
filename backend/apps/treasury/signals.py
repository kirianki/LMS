"""
Cross-app signals to automate treasury transactions.
Links Loans, Repayments, Investments, and Expenses to Treasury.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction
import logging

import logging
from apps.loans.models import Loan, LoanRepayment, LoanFee
from apps.investors.models import Investment, InvestorPayout
from apps.expenses.models import Expense, Payroll
from apps.treasury.models import Transaction, CashAccount

logger = logging.getLogger(__name__)

def get_default_account(account_type):
    """Helper to get or create a default account for the tenant."""
    account, _ = CashAccount.objects.get_or_create(
        account_type=account_type,
        defaults={'name': f'Default {account_type.capitalize()} Account'}
    )
    return account

from .services.integrity import record_money_event

@receiver(post_save, sender=Loan)
def log_loan_disbursement(sender, instance, created, **kwargs):
    """Log loan disbursement atomically."""
    if created:
        record_money_event('loan_disbursement', instance)

@receiver(post_save, sender=LoanRepayment)
def log_loan_repayment(sender, instance, created, **kwargs):
    """Log loan repayment atomically."""
    if created:
        record_money_event('loan_repayment', instance)

@receiver(post_save, sender=Investment)
def log_investment_received(sender, instance, created, **kwargs):
    """Log new investment as a Credit in Treasury."""
    if created:
        try:
            account = get_default_account(CashAccount.AccountType.BANK)
            if not Transaction.objects.filter(reference=instance.investment_number).exists():
                Transaction.objects.create(
                    account=account,
                    transaction_type=Transaction.TransactionType.CREDIT,
                    category=Transaction.Category.INVESTMENT_RECEIVED,
                    amount=instance.principal_amount,
                    description=f"Investment received from {instance.investor.name}",
                    reference=instance.investment_number,
                    related_investment=instance
                )
        except Exception as e:
            logger.error(f"Investment log error: {e}")

@receiver(post_save, sender=InvestorPayout)
def log_investor_payout(sender, instance, created, **kwargs):
    """Log investor payout as a Debit in Treasury."""
    if created:
        try:
            account = get_default_account(CashAccount.AccountType.BANK)
            if not Transaction.objects.filter(reference=instance.reference).exists():
                Transaction.objects.create(
                    account=account,
                    transaction_type=Transaction.TransactionType.DEBIT,
                    category=Transaction.Category.INVESTOR_PAYOUT,
                    amount=instance.amount,
                    description=f"{instance.get_payout_type_display()} payout for investment {instance.investment.investment_number}",
                    reference=instance.reference,
                    related_investment=instance.investment
                )
        except Exception as e:
            logger.error(f"Payout log error: {e}")

@receiver(post_save, sender=Expense)
def log_expense_payment(sender, instance, **kwargs):
    """Log approved expense atomically."""
    if instance.status == 'paid':
        record_money_event('expense_paid', instance)

@receiver(post_save, sender=Payroll)
def log_payroll_payment(sender, instance, **kwargs):
    """Log payroll as Debit when status changes to PAID."""
    if instance.status == 'paid':
        try:
            if not Transaction.objects.filter(description__contains=f"Payroll: {instance.staff.employee_number}", reference=instance.payment_reference).exists():
                account = get_default_account(CashAccount.AccountType.BANK)
                Transaction.objects.create(
                    account=account,
                    transaction_type=Transaction.TransactionType.DEBIT,
                    category=Transaction.Category.PAYROLL,
                    amount=instance.net_pay,
                    description=f"Payroll: {instance.staff.employee_number} for {instance.period}",
                    reference=instance.payment_reference,
                )
        except Exception as e:
            logger.error(f"Payroll log error: {e}")
