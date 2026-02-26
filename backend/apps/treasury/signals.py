"""
Cross-app signals to automate treasury transactions.
Links Loans, Repayments, Investments, and Expenses to Treasury.

All money events are routed through the integrity service to ensure
both Treasury and Accounting (GL) are updated atomically.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
import logging

from apps.loans.models import Loan, LoanRepayment
from apps.investors.models import Investment, InvestorPayout
from apps.treasury.models import Transaction, CashAccount

logger = logging.getLogger(__name__)

from .services.integrity import record_money_event, sync_treasury_coa_balance

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
    """Log new investment via integrity service (Treasury + GL)."""
    if created:
        try:
            record_money_event('investment_received', instance)
        except Exception as e:
            logger.error(f"Investment sync error: {e}", exc_info=True)

@receiver(post_save, sender=InvestorPayout)
def log_investor_payout(sender, instance, created, **kwargs):
    """Log investor payout via integrity service (Treasury + GL)."""
    if created:
        try:
            record_money_event('investor_payout', instance)
        except Exception as e:
            logger.error(f"Payout sync error: {e}", exc_info=True)

@receiver(post_save, sender=Transaction)
def sync_coa_after_transaction(sender, instance, created, **kwargs):
    """
    After every Treasury transaction, sync the linked COA account balance.
    This is the safety net that keeps Treasury and COA in lockstep.
    """
    if created and instance.account:
        try:
            sync_treasury_coa_balance(instance.account)
        except Exception as e:
            logger.error(f"COA sync error after transaction {instance.id}: {e}", exc_info=True)
