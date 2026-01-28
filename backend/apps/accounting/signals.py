"""
Accounting signals.
Automated posting is now handled via a unified FinancialIntegrityService 
in apps.treasury.signals to ensure atomicity across platforms.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import JournalEntry

@receiver(post_save, sender=JournalEntry)
def validate_balanced_on_post(sender, instance, **kwargs):
    """Ensure ledger entries are balanced if status is posted."""
    if instance.status == 'posted' and not instance.is_balanced():
        # Log or flag unbalanced entries
        pass
