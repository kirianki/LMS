from django.db import models
from django.conf import settings
from simple_history.models import HistoricalRecords
import uuid
import random
import string

class Customer(models.Model):
    class IDType(models.TextChoices):
        NATIONAL_ID = 'national_id', 'National ID'
        PASSPORT = 'passport', 'Passport'
        DRIVING_LICENSE = 'driving_license', 'Driving License'
        ALIEN_ID = 'alien_id', 'Alien ID'

    class EmploymentStatus(models.TextChoices):
        EMPLOYED = 'employed', 'Employed'
        SELF_EMPLOYED = 'self_employed', 'Self-Employed'
        UNEMPLOYED = 'unemployed', 'Unemployed'
        RETIRED = 'retired', 'Retired'
        STUDENT = 'student', 'Student'

    class VerificationStatus(models.TextChoices):
        UNVERIFIED = 'unverified', 'Unverified'
        PENDING = 'pending', 'Pending Verification'
        VERIFIED = 'verified', 'Verified'
        FAILED = 'failed', 'Verification Failed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer_number = models.CharField(max_length=20, unique=True, blank=True, db_index=True)
    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    email = models.EmailField(unique=True, blank=True, null=True)
    phone_number = models.CharField(max_length=15, unique=True)
    
    id_type = models.CharField(
        max_length=20, 
        choices=IDType.choices, 
        default=IDType.NATIONAL_ID
    )
    id_number = models.CharField(max_length=50, unique=True)
    id_document = models.FileField(upload_to='customer_ids/', blank=True, null=True)
    
    date_of_birth = models.DateField()
    
    # Address details
    physical_address = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    county = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, default='Kenya')
    
    employment_status = models.CharField(
        max_length=20,
        choices=EmploymentStatus.choices,
        default=EmploymentStatus.EMPLOYED
    )
    monthly_income = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    
    # Scoring Fields
    crb_score = models.IntegerField(null=True, blank=True)
    internal_score = models.IntegerField(default=0)
    hybrid_score = models.IntegerField(null=True, blank=True)
    last_crb_check = models.DateTimeField(null=True, blank=True)

    # Verification Fields
    verification_status = models.CharField(
        max_length=20,
        choices=VerificationStatus.choices,
        default=VerificationStatus.UNVERIFIED
    )
    is_verified = models.BooleanField(default=False)  # Legacy support, will sync with status
    verification_notes = models.TextField(blank=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_customers'
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    
    # Portfolio Management
    loan_officer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_customers',
        help_text="Loan officer responsible for this customer's portfolio"
    )
    assigned_at = models.DateTimeField(null=True, blank=True, help_text="When customer was assigned to current officer")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()
    
    def save(self, *args, **kwargs):
        if not self.customer_number:
            self.customer_number = self._generate_customer_number()
        super().save(*args, **kwargs)
    
    def _generate_customer_number(self):
        """
        Generate unique customer number: CUS-YYYYMM-XXXX-CC
        Format: Prefix + YearMonth + Sequential + Checksum
        Example: CUS-202601-0042-7K
        """
        import datetime
        prefix = "CUS"
        year_month = datetime.date.today().strftime('%Y%m')
        
        # Get highest sequential for this month
        last = Customer.objects.filter(
            customer_number__startswith=f"{prefix}-{year_month}-"
        ).order_by('-customer_number').first()
        
        if last and last.customer_number:
            try:
                seq_part = last.customer_number.split('-')[2]
                seq = int(seq_part) + 1
            except (IndexError, ValueError):
                seq = 1
        else:
            seq = 1
        
        # Generate checksum (2 chars from phone + random)
        check_base = (self.phone_number[-2:] if self.phone_number else '00') + str(seq)
        checksum = ''.join(random.choices(string.ascii_uppercase + string.digits, k=2))
        
        return f"{prefix}-{year_month}-{seq:04d}-{checksum}"

    def __str__(self):
        return f"{self.customer_number} - {self.first_name} {self.last_name}"

    class Meta:
        ordering = ['-created_at']

class CRBReport(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='crb_reports')
    raw_data = models.JSONField()
    score = models.IntegerField()
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='performed_crb_checks'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "CRB Report"
        verbose_name_plural = "CRB Reports"
