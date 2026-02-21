from django.db import models
from django.conf import settings
import uuid

class AgentLog(models.Model):
    """
    Tracks AI agent interactions and their outcomes.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey('accounts.Organization', on_delete=models.CASCADE, related_name='agent_logs', null=True, blank=True)
    agent_name = models.CharField(max_length=100)
    action = models.CharField(max_length=255)
    input_data = models.JSONField(null=True, blank=True)
    output_data = models.JSONField(null=True, blank=True)
    status = models.CharField(max_length=50) # success, failure
    error_message = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.agent_name} - {self.action} - {self.status}"
