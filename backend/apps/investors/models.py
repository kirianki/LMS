from django.db import models
from django.conf import settings
from simple_history.models import HistoricalRecords
from decimal import Decimal
import uuid
import random
import string


class Investor(models.Model):
    """External capital providers."""
    
    class InvestorType(models.TextChoices):
        INDIVIDUAL = 'individual', 'Individual'
        COMPANY = 'company', 'Company'
        INSTITUTION = 'institution', 'Institution'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    investor_number = models.CharField(max_length=20, unique=True, blank=True)
    
    name = models.CharField(max_length=200)
    investor_type = models.CharField(max_length=20, choices=InvestorType.choices, default=InvestorType.INDIVIDUAL)
    
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    
    id_number = models.CharField(max_length=50, blank=True, help_text="National ID or Company Reg")
    kra_pin = models.CharField(max_length=20, blank=True)
    
    bank_name = models.CharField(max_length=100, blank=True)
    bank_account = models.CharField(max_length=50, blank=True)
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    branch = models.ForeignKey('branches.Branch', on_delete=models.SET_NULL, null=True, blank=True, related_name='investors')
    
    history = HistoricalRecords()
    
    def save(self, *args, **kwargs):
        if not self.investor_number:
            import datetime
            prefix = "INV"
            year = datetime.date.today().strftime('%Y')
            seq_id = ''.join(random.choices(string.digits, k=4))
            self.investor_number = f"{prefix}-{year}-{seq_id}"
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.investor_number} - {self.name}"
    
    class Meta:
        ordering = ['name']


class Investment(models.Model):
    """Investor capital placements."""
    
    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        MATURED = 'matured', 'Matured'
        WITHDRAWN = 'withdrawn', 'Withdrawn'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    investment_number = models.CharField(max_length=20, unique=True, blank=True)
    
    investor = models.ForeignKey(Investor, on_delete=models.CASCADE, related_name='investments')
    
    principal_amount = models.DecimalField(max_digits=14, decimal_places=2)
    expected_return_rate = models.DecimalField(max_digits=5, decimal_places=2, help_text="Annual return rate %")
    
    investment_date = models.DateField()
    maturity_date = models.DateField()
    term_months = models.PositiveIntegerField()
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    
    # Calculated/tracking fields
    total_expected_return = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    total_paid_out = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    
    notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    
    history = HistoricalRecords()
    
    def save(self, *args, **kwargs):
        if not self.investment_number:
            import datetime
            prefix = "INV"
            seq_id = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
            self.investment_number = f"INV-{seq_id}"
        
        # Calculate expected return
        if not self.total_expected_return:
            rate = self.expected_return_rate / Decimal('100')
            years = Decimal(self.term_months) / Decimal('12')
            self.total_expected_return = self.principal_amount * rate * years
        
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.investment_number} - {self.investor.name} ({self.principal_amount})"
    
    class Meta:
        ordering = ['-created_at']


class InvestorPayout(models.Model):
    """Payouts to investors."""
    
    class PayoutType(models.TextChoices):
        INTEREST = 'interest', 'Interest Payment'
        PRINCIPAL = 'principal', 'Principal Return'
        BONUS = 'bonus', 'Bonus'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    investment = models.ForeignKey(Investment, on_delete=models.CASCADE, related_name='payouts')
    
    payout_type = models.CharField(max_length=20, choices=PayoutType.choices)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    payout_date = models.DateField()
    reference = models.CharField(max_length=100, blank=True)
    
    payment_method = models.CharField(max_length=20, default='bank_transfer')
    notes = models.TextField(blank=True)
    
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    history = HistoricalRecords()
    
    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Update investment total paid out
        self.investment.total_paid_out = sum(
            p.amount for p in self.investment.payouts.all()
        )
        self.investment.save()
    
    def __str__(self):
        return f"{self.investment.investment_number} - {self.get_payout_type_display()} ({self.amount})"
    
    class Meta:
        ordering = ['-payout_date']
