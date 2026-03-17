from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver
from simple_history.models import HistoricalRecords
import uuid
import logging

logger = logging.getLogger(__name__)

class Role(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    approval_limit = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    
    # New Fields for Advanced RBAC
    permissions = models.ManyToManyField('auth.Permission', blank=True, related_name='custom_roles')
    is_system_role = models.BooleanField(default=False, help_text="System roles cannot be deleted")
    
    history = HistoricalRecords()

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)

class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    
    # Multi-Organization Scoping
    organization = models.ForeignKey('accounts.Organization', on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    
    # RBAC
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    
    # Status
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    
    # Tracking
    date_joined = models.DateTimeField(auto_now_add=True)
    
    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']
    
    history = HistoricalRecords()

    class Meta:
        ordering = ['-date_joined']

    def get_full_name(self):
        full_name = f"{self.first_name} {self.last_name}".strip()
        return full_name if full_name else self.email

    def __str__(self):
        return self.email

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    employee_id = models.CharField(max_length=50, blank=True, unique=True, null=True)
    phone_number = models.CharField(max_length=20, blank=True)
    bio = models.TextField(max_length=500, blank=True)
    job_title = models.CharField(max_length=100, blank=True)
    location = models.CharField(max_length=100, blank=True)
    
    # Payroll Details
    kra_pin = models.CharField(max_length=20, blank=True)
    nssf_number = models.CharField(max_length=20, blank=True)
    shif_number = models.CharField(max_length=20, blank=True)
    
    # Track changes
    history = HistoricalRecords()

    def save(self, *args, **kwargs):
        if not self.employee_id:
            last_profile = Profile.objects.filter(employee_id__startswith='STF-').order_by('-employee_id').first()
            if last_profile and last_profile.employee_id:
                try:
                    last_num = int(last_profile.employee_id.split('-')[1])
                    new_num = last_num + 1
                except (IndexError, ValueError):
                    new_num = 1
            else:
                new_num = 1
            self.employee_id = f"STF-{new_num:03d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Profile for {self.user.email} ({self.employee_id})"

@receiver(post_save, sender=User)
def ensure_user_profile(sender, instance, created, **kwargs):
    """Ensure every User has a Profile. Only create it if missing; never force-save."""
    if created:
        Profile.objects.get_or_create(user=instance)
    elif not hasattr(instance, 'profile'):
        Profile.objects.get_or_create(user=instance)


class StaffDocument(models.Model):
    """Stores various documents for staff members."""
    class Category(models.TextChoices):
        NATIONAL_ID = 'national_id', 'National ID'
        CONTRACT = 'contract', 'Contract Agreement'
        KRA_CERT = 'kra_cert', 'KRA Certificate'
        ACADEMIC = 'academic', 'Academic Papers'
        OTHER = 'other', 'Other'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey('accounts.Organization', on_delete=models.CASCADE, related_name='staff_documents', null=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='documents')
    category = models.CharField(max_length=20, choices=Category.choices)
    file = models.FileField(upload_to='staff_documents/')
    name = models.CharField(max_length=255, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.get_category_display()} - {self.user.email}"

class StaffContract(models.Model):
    """Stores employment details and salary structure for staff."""
    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        SUSPENDED = 'suspended', 'Suspended'
        TERMINATED = 'terminated', 'Terminated'
        COMPLETED = 'completed', 'Completed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey('accounts.Organization', on_delete=models.CASCADE, related_name='staff_contracts', null=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='contracts')
    
    # Salary Structure
    basic_salary = models.DecimalField(max_digits=12, decimal_places=2)
    housing_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    transport_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    other_allowances = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Bank Details
    bank_name = models.CharField(max_length=100, blank=True)
    bank_account = models.CharField(max_length=50, blank=True)
    
    # Dates
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    
    created_at = models.DateTimeField(auto_now_add=True)
    history = HistoricalRecords()

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Contract for {self.user.email} ({self.status})"

class StaffAllowance(models.Model):
    class CalculationType(models.TextChoices):
        FIXED = 'fixed', 'Fixed Amount'
        PERCENTAGE = 'percentage', 'Percentage'

    class PercentageBasis(models.TextChoices):
        BASIC = 'basic', 'Basic Salary'
        GROSS = 'gross', 'Gross Salary'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contract = models.ForeignKey(StaffContract, on_delete=models.CASCADE, related_name='allowances')
    name = models.CharField(max_length=100)
    calculation_type = models.CharField(max_length=20, choices=CalculationType.choices, default=CalculationType.FIXED)
    amount = models.DecimalField(max_digits=12, decimal_places=2)  # Amount or Percentage value
    percentage_basis = models.CharField(max_length=20, choices=PercentageBasis.choices, default=PercentageBasis.BASIC, blank=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} for {self.contract.user.email}"

class StaffDeduction(models.Model):
    class CalculationType(models.TextChoices):
        FIXED = 'fixed', 'Fixed Amount'
        PERCENTAGE = 'percentage', 'Percentage'

    class PercentageBasis(models.TextChoices):
        BASIC = 'basic', 'Basic Salary'
        GROSS = 'gross', 'Gross Salary'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contract = models.ForeignKey(StaffContract, on_delete=models.CASCADE, related_name='deductions')
    name = models.CharField(max_length=100)
    calculation_type = models.CharField(max_length=20, choices=CalculationType.choices, default=CalculationType.FIXED)
    amount = models.DecimalField(max_digits=12, decimal_places=2)  # Amount or Percentage value
    percentage_basis = models.CharField(max_length=20, choices=PercentageBasis.choices, default=PercentageBasis.BASIC, blank=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} for {self.contract.user.email}"

class PayrollRecord(models.Model):
    """Monthly payroll records for staff."""
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        APPROVED = 'approved', 'Approved'
        PAID = 'paid', 'Paid'
        VOID = 'void', 'Void'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey('accounts.Organization', on_delete=models.CASCADE, related_name='payroll_records', null=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='payroll_records')
    contract = models.ForeignKey(StaffContract, on_delete=models.PROTECT, related_name='payroll_records')
    
    month = models.PositiveSmallIntegerField() # 1-12
    year = models.PositiveIntegerField()
    
    # Breakdown
    gross_pay = models.DecimalField(max_digits=12, decimal_places=2)
    
    # Statutory Deductions (Kenya)
    nssf = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    shif = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    paye = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    housing_levy = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    other_deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    net_pay = models.DecimalField(max_digits=12, decimal_places=2)
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    
    payment_date = models.DateField(null=True, blank=True)
    reference = models.CharField(max_length=100, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    processed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='processed_payrolls')
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_payroll_records')
    approved_at = models.DateTimeField(null=True, blank=True)
    
    history = HistoricalRecords()

    class Meta:
        unique_together = ('user', 'month', 'year')
        ordering = ['-year', '-month']

    def __str__(self):
        return f"Payroll {self.month}/{self.year} - {self.user.email}"
