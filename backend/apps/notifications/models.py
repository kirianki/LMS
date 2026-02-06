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
