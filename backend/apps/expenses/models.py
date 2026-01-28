from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator
from simple_history.models import HistoricalRecords
from decimal import Decimal
import uuid
import random
import string


class ExpenseCategory(models.Model):
    """Categories for expenses."""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_payroll = models.BooleanField(default=False, help_text="Is this a payroll category?")
    is_active = models.BooleanField(default=True)
    
    history = HistoricalRecords()
    
    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name_plural = "Expense Categories"
        ordering = ['name']


class Expense(models.Model):
    """Operational expenses."""
    
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending Approval'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
        PAID = 'paid', 'Paid'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    expense_number = models.CharField(max_length=20, unique=True, blank=True)
    
    category = models.ForeignKey(ExpenseCategory, on_delete=models.PROTECT, related_name='expenses')
    
    amount = models.DecimalField(
        max_digits=12, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    description = models.TextField()
    date = models.DateField()
    
    vendor = models.CharField(max_length=200, blank=True)
    receipt = models.FileField(upload_to='expense_receipts/', blank=True, null=True)
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_expenses'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    
    paid_date = models.DateField(null=True, blank=True)
    payment_reference = models.CharField(max_length=100, blank=True)
    
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='created_expenses')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()
    
    def save(self, *args, **kwargs):
        if not self.expense_number:
            import datetime
            prefix = "EXP"
            year_month = datetime.date.today().strftime('%Y%m')
            seq_id = ''.join(random.choices(string.digits, k=4))
            self.expense_number = f"{prefix}-{year_month}-{seq_id}"
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.expense_number} - {self.description[:50]}"
    
    class Meta:
        ordering = ['-date']


class Staff(models.Model):
    """Staff members for payroll."""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee_number = models.CharField(max_length=20, unique=True, blank=True)
    
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='staff_profile')
    
    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    email = models.EmailField()
    phone = models.CharField(max_length=20, blank=True)
    
    id_number = models.CharField(max_length=50)
    kra_pin = models.CharField(max_length=20, blank=True)
    nssf_number = models.CharField(max_length=20, blank=True)
    nhif_number = models.CharField(max_length=20, blank=True)
    
    department = models.CharField(max_length=100, blank=True)
    position = models.CharField(max_length=100)
    hire_date = models.DateField()
    
    basic_salary = models.DecimalField(
        max_digits=12, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    bank_name = models.CharField(max_length=100, blank=True)
    bank_account = models.CharField(max_length=50, blank=True)
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()
    
    def save(self, *args, **kwargs):
        if not self.employee_number:
            import datetime
            prefix = "EMP"
            seq_id = ''.join(random.choices(string.digits, k=4))
            self.employee_number = f"{prefix}-{seq_id}"
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.employee_number} - {self.first_name} {self.last_name}"
    
    class Meta:
        verbose_name_plural = "Staff"
        ordering = ['first_name', 'last_name']


class StaffAllowance(models.Model):
    """Recurring allowances for a staff member."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, related_name='allowances')
    name = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    is_active = models.BooleanField(default=True)
    
    history = HistoricalRecords()

    def __str__(self):
        return f"{self.staff.first_name} - {self.name}: {self.amount}"


class StaffDeduction(models.Model):
    """Recurring deductions for a staff member."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, related_name='deductions')
    name = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    is_active = models.BooleanField(default=True)
    
    history = HistoricalRecords()

    def __str__(self):
        return f"{self.staff.first_name} - {self.name}: {self.amount}"


class Payroll(models.Model):
    """Monthly payroll records."""
    
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        APPROVED = 'approved', 'Approved'
        PAID = 'paid', 'Paid'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, related_name='payrolls')
    
    period = models.CharField(max_length=7, help_text="YYYY-MM format")
    
    basic_pay = models.DecimalField(max_digits=12, decimal_places=2)
    total_allowances = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_deductions = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    
    gross_pay = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    net_pay = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_payrolls'
    )
    payment_date = models.DateField(null=True, blank=True)
    payment_reference = models.CharField(max_length=100, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()
    
    def calculate_totals(self):
        """Calculate totals from items."""
        allowances = sum(item.amount for item in self.items.filter(item_type='allowance'))
        deductions = sum(item.amount for item in self.items.filter(item_type='deduction'))
        
        self.total_allowances = allowances
        self.total_deductions = deductions
        self.gross_pay = self.basic_pay + allowances
        self.net_pay = self.gross_pay - deductions
    
    def __str__(self):
        return f"{self.staff.employee_number} - {self.period}"
    
    class Meta:
        unique_together = ['staff', 'period']
        ordering = ['-period', 'staff__first_name']


class PayrollItem(models.Model):
    """Individual payroll line items."""
    
    class ItemType(models.TextChoices):
        ALLOWANCE = 'allowance', 'Allowance'
        DEDUCTION = 'deduction', 'Deduction'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payroll = models.ForeignKey(Payroll, on_delete=models.CASCADE, related_name='items')
    
    item_type = models.CharField(max_length=20, choices=ItemType.choices)
    name = models.CharField(max_length=100)
    amount = models.DecimalField(
        max_digits=12, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    
    def __str__(self):
        return f"{self.name}: {self.amount}"
