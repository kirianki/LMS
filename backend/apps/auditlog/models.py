from django.db import models
from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from django.utils import timezone
import uuid


class ActivityLog(models.Model):
    """System-wide activity logging for tenant administrators."""
    
    class Action(models.TextChoices):
        CREATE = 'create', 'Created'
        UPDATE = 'update', 'Updated'
        DELETE = 'delete', 'Deleted'
        APPROVE = 'approve', 'Approved'
        REJECT = 'reject', 'Rejected'
        DISBURSE = 'disburse', 'Disbursed'
        REPAY = 'repay', 'Repayment Recorded'
        LOGIN = 'login', 'User Login'
        CONFIG = 'config', 'Configuration Changed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey('accounts.Organization', on_delete=models.CASCADE, related_name='activity_logs', null=True, blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='activity_logs'
    )
    
    action = models.CharField(max_length=20, choices=Action.choices)
    module = models.CharField(max_length=50, help_text="Module area, e.g., 'Loans', 'Customers', 'Settings'")
    description = models.TextField()
    
    # Generic relation to target object
    content_type = models.ForeignKey(ContentType, on_delete=models.SET_NULL, null=True, blank=True)
    object_id = models.CharField(max_length=255, null=True, blank=True)
    content_object = GenericForeignKey('content_type', 'object_id')
    
    data = models.JSONField(default=dict, blank=True, help_text="Metadata or before/after states")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    
    timestamp = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['module', 'action']),
            models.Index(fields=['timestamp']),
        ]

    def __str__(self):
        return f"{self.user} - {self.action} on {self.module} ({self.timestamp})"
