from django.db import models
from django.conf import settings
from simple_history.models import HistoricalRecords
from decimal import Decimal
import uuid

class SavingsProduct(models.Model):
    class InterestMethod(models.TextChoices):
        DAILY_MIN = 'daily_min', 'Daily Minimum Balance'
        AVG_DAILY = 'avg_daily', 'Average Daily Balance'

    class CompoundingPeriod(models.TextChoices):
        DAILY = 'daily', 'Daily'
        MONTHLY = 'monthly', 'Monthly'
        YEARLY = 'yearly', 'Yearly'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField(blank=True)
    
    interest_rate = models.DecimalField(max_digits=5, decimal_places=2, help_text="Annual Interest Rate Percentage")
    minimum_balance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    interest_method = models.CharField(max_length=20, choices=InterestMethod.choices, default=InterestMethod.DAILY_MIN)
    compounding_period = models.CharField(max_length=20, choices=CompoundingPeriod.choices, default=CompoundingPeriod.MONTHLY)
    
    withdrawal_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    maintenance_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()

    def __str__(self):
        return f"{self.name} ({self.code})"

class SavingsAccount(models.Model):
    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        DORMANT = 'dormant', 'Dormant'
        CLOSED = 'closed', 'Closed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    account_number = models.CharField(max_length=20, unique=True, blank=True)
    borrower = models.ForeignKey('customers.Borrower', on_delete=models.CASCADE, related_name='savings_accounts')
    product = models.ForeignKey(SavingsProduct, on_delete=models.PROTECT, related_name='accounts')
    branch = models.ForeignKey('branches.Branch', on_delete=models.SET_NULL, null=True, blank=True, related_name='savings_accounts')
    
    current_balance = models.DecimalField(max_digits=16, decimal_places=2, default=Decimal('0.00'))
    accrued_interest = models.DecimalField(max_digits=16, decimal_places=6, default=Decimal('0.00'))
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    opened_date = models.DateField(auto_now_add=True)
    last_transaction_date = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()

    def save(self, *args, **kwargs):
        if not self.account_number:
            import datetime
            prefix = "SAV"
            year = datetime.date.today().year
            last = SavingsAccount.objects.filter(account_number__startswith=f"{prefix}{year}").order_by('-account_number').first()
            if last:
                num = int(last.account_number[-6:]) + 1
            else:
                num = 1
            self.account_number = f"{prefix}{year}{num:06d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.account_number} - {self.borrower}"

class SavingsTransaction(models.Model):
    class TransactionType(models.TextChoices):
        DEPOSIT = 'deposit', 'Deposit'
        WITHDRAWAL = 'withdrawal', 'Withdrawal'
        INTEREST = 'interest', 'Interest Posting'
        FEE = 'fee', 'Service Fee'
        ADJUSTMENT = 'adjustment', 'Adjustment'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    account = models.ForeignKey(SavingsAccount, on_delete=models.CASCADE, related_name='transactions')
    transaction_type = models.CharField(max_length=20, choices=TransactionType.choices)
    amount = models.DecimalField(max_digits=16, decimal_places=2)
    balance_after = models.DecimalField(max_digits=16, decimal_places=2)
    
    transaction_date = models.DateTimeField(auto_now_add=True)
    reference = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    
    performed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    
    history = HistoricalRecords()

    class Meta:
        ordering = ['-transaction_date']

    def __str__(self):
        return f"{self.transaction_type.upper()} {self.amount} - {self.account.account_number}"
