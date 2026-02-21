from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.loans.models import Loan, LoanRepayment
from .models import Notification

@receiver(post_save, sender=Loan)
def notify_loan_disbursement(sender, instance, created, **kwargs):
    """Notify relevant user when a loan is disbursed."""
    # For now, notify the borrower's creator/LO or specific group
    # In a real MVP, we might notify the borrower (if they have a user) 
    # and the Loan Officer.
    if instance.status == 'active' and instance.disbursement_date:
        recipient = instance.application.created_by or getattr(instance.borrower, 'loan_officer', None)
        if recipient:
            Notification.objects.create(
                user=recipient,
            title="Loan Disbursed",
            message=f"Loan {instance.loan_number} for {instance.borrower.name} has been successfully disbursed.",
            notification_type=Notification.NotificationType.LOAN_STATUS,
            link=f"/loans/{instance.id}"
        )

@receiver(post_save, sender=LoanRepayment)
def notify_repayment_received(sender, instance, created, **kwargs):
    """Notify when a payment is recorded."""
    if created:
        recipient = instance.loan.application.created_by or getattr(instance.loan.borrower, 'loan_officer', None)
        if recipient:
            Notification.objects.create(
                user=recipient,
            title="Repayment Received",
            message=f"Payment of KES {instance.amount:,.2f} received for loan {instance.loan.loan_number}.",
            notification_type=Notification.NotificationType.REPAYMENT,
            link=f"/loans/{instance.loan.id}"
        )
