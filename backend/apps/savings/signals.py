from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import SavingsTransaction
from apps.accounting.services import post_savings_deposit, post_savings_withdrawal, post_savings_interest
import logging

logger = logging.getLogger(__name__)

@receiver(post_save, sender=SavingsTransaction)
def trigger_savings_accounting_posting(sender, instance, created, **kwargs):
    """
    Signal to trigger GL posting when a savings transaction is recorded.
    """
    if created:
        try:
            if instance.transaction_type == SavingsTransaction.TransactionType.DEPOSIT:
                post_savings_deposit(instance)
            elif instance.transaction_type == SavingsTransaction.TransactionType.WITHDRAWAL:
                post_savings_withdrawal(instance)
            elif instance.transaction_type == SavingsTransaction.TransactionType.INTEREST:
                post_savings_interest(instance)
            
            logger.info(f"Successfully posted {instance.transaction_type} accounting entry for {instance.account.account_number}")
        except Exception as e:
            logger.error(f"Failed to post accounting entry for savings transaction {instance.id}: {e}")
            # In a production system, we might want to flag this for manual retry
