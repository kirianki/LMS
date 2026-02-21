from django.db import models
from django.conf import settings
import uuid

class Notification(models.Model):
    class NotificationType(models.TextChoices):
        LOAN_STATUS = 'loan_status', 'Loan Status'
        REPAYMENT = 'repayment', 'Repayment'
        SYSTEM = 'system', 'System'
        TASK = 'task', 'Task'
        ACCOUNTING = 'accounting', 'Accounting'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    notification_type = models.CharField(
        max_length=20,
        choices=NotificationType.choices,
        default=NotificationType.SYSTEM
    )
    link = models.CharField(max_length=500, null=True, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.title}"


class CommunicationLog(models.Model):
    """Log of all external communications (SMS, Email)."""
    
    class MessageType(models.TextChoices):
        SMS = 'sms', 'SMS'
        EMAIL = 'email', 'Email'
        WHATSAPP = 'whatsapp', 'WhatsApp'
    
    class Status(models.TextChoices):
        QUEUED = 'queued', 'Queued'
        SENT = 'sent', 'Sent'
        FAILED = 'failed', 'Failed'
        DELIVERED = 'delivered', 'Delivered'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.CharField(max_length=255, help_text="Phone number or Email address")
    message_type = models.CharField(max_length=20, choices=MessageType.choices, default=MessageType.SMS)
    content = models.TextField()
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)
    provider = models.CharField(max_length=50, blank=True, help_text="e.g. Africa's Talking, Infobip")
    provider_response = models.JSONField(null=True, blank=True)
    
    # Optional links
    related_loan = models.ForeignKey(
        'loans.Loan', on_delete=models.SET_NULL, null=True, blank=True, related_name='communications'
    )
    related_borrower = models.ForeignKey(
        'customers.Borrower', on_delete=models.SET_NULL, null=True, blank=True, related_name='communications'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        
    def __str__(self):
        return f"{self.message_type.upper()} to {self.recipient}: {self.status}"
