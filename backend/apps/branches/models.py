from django.db import models
from django.conf import settings
from simple_history.models import HistoricalRecords
import uuid

class Branch(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey('accounts.Organization', on_delete=models.CASCADE, related_name='branches', null=True, blank=True)
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()

    class Meta:
        verbose_name_plural = "Branches"
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.code})"

class BranchAssignment(models.Model):
    """
    Links a User to a specific Branch within a tenant schema.
    This model exists only in tenant schemas, avoiding schema violations
    when the User model is shared.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='branch_assignment')
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='assignments')
    assigned_at = models.DateTimeField(auto_now_add=True)
    assigned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='made_assignments')

    history = HistoricalRecords()

    class Meta:
        verbose_name = "Branch Assignment"
        verbose_name_plural = "Branch Assignments"

    def __str__(self):
        return f"{self.user.email if self.user else 'Unknown'} -> {self.branch.name if self.branch else 'Unknown'}"
