from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db.models.signals import post_save
from django.dispatch import receiver
from simple_history.models import HistoricalRecords
import uuid

class Role(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    approval_limit = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    
    # New Fields for Advanced RBAC
    permissions = models.ManyToManyField('auth.Permission', blank=True, related_name='custom_roles')
    is_system_role = models.BooleanField(default=False, help_text="System roles cannot be deleted")
    
    history = HistoricalRecords()

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
    nhif_number = models.CharField(max_length=20, blank=True)
    
    # Track changes
    history = HistoricalRecords()

    def __str__(self):
        return f"Profile for {self.user.email}"

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    if not hasattr(instance, 'profile'):
        Profile.objects.create(user=instance)
    instance.profile.save()


class StaffContract(models.Model):
    """Stores employment details and salary structure for staff."""
    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        SUSPENDED = 'suspended', 'Suspended'
        TERMINATED = 'terminated', 'Terminated'
        COMPLETED = 'completed', 'Completed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='contracts')
    
    # Salary Structure
    basic_salary = models.DecimalField(max_digits=12, decimal_places=2)
    housing_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    transport_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    other_allowances = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Dates
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()

    def __str__(self):
        return f"Contract for {self.user.email} ({self.status})"

class PayrollRecord(models.Model):
    """Monthly payroll records for staff."""
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        APPROVED = 'approved', 'Approved'
        PAID = 'paid', 'Paid'
        VOID = 'void', 'Void'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='payroll_records')
    contract = models.ForeignKey(StaffContract, on_delete=models.PROTECT, related_name='payroll_records')
    
    month = models.PositiveSmallIntegerField() # 1-12
    year = models.PositiveIntegerField()
    
    # Breakdown
    gross_pay = models.DecimalField(max_digits=12, decimal_places=2)
    
    # Statutory Deductions (Kenya)
    nssf = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    nhif = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    paye = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    housing_levy = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    other_deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    net_pay = models.DecimalField(max_digits=12, decimal_places=2)
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    
    payment_date = models.DateField(null=True, blank=True)
    reference = models.CharField(max_length=100, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    processed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='processed_payrolls')
    
    history = HistoricalRecords()

    class Meta:
        unique_together = ('user', 'month', 'year')
        ordering = ['-year', '-month']

    def __str__(self):
        return f"Payroll {self.month}/{self.year} - {self.user.email}"
