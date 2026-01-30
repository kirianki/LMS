from django.db import models
from django.conf import settings
from simple_history.models import HistoricalRecords
import uuid
import random
import string

class Borrower(models.Model):
    class BorrowerType(models.TextChoices):
        INDIVIDUAL = 'individual', 'Individual'
        COMPANY = 'company', 'Company'
        INSTITUTION = 'institution', 'Institution'
        GROUP = 'group', 'Group'

    class IDType(models.TextChoices):
        NATIONAL_ID = 'national_id', 'National ID'
        PASSPORT = 'passport', 'Passport'
        DRIVING_LICENSE = 'driving_license', 'Driving License'
        ALIEN_ID = 'alien_id', 'Alien ID'
        REGISTRATION_CERT = 'registration_cert', 'Registration Certificate'
        INCORPORATION_CERT = 'incorporation_cert', 'Certificate of Incorporation'

    class EmploymentStatus(models.TextChoices):
        EMPLOYED = 'employed', 'Employed'
        SELF_EMPLOYED = 'self_employed', 'Self-Employed'
        UNEMPLOYED = 'unemployed', 'Unemployed'
        RETIRED = 'retired', 'Retired'
        STUDENT = 'student', 'Student' # For individuals
        BUSINESS_OWNER = 'business_owner', 'Business Owner' # For individuals
        OPERATION = 'operational', 'Operational' # For companies

    class VerificationStatus(models.TextChoices):
        UNVERIFIED = 'unverified', 'Unverified'
        PENDING = 'pending', 'Pending Verification'
        VERIFIED = 'verified', 'Verified'
        FAILED = 'failed', 'Verification Failed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    borrower_number = models.CharField(max_length=20, unique=True, blank=True, db_index=True)
    borrower_type = models.CharField(
        max_length=20,
        choices=BorrowerType.choices,
        default=BorrowerType.INDIVIDUAL
    )
    
    # Individual Fields
    first_name = models.CharField(max_length=50, blank=True, null=True)
    last_name = models.CharField(max_length=50, blank=True, null=True)
    
    # Entity Fields (Company/Institution)
    business_name = models.CharField(max_length=150, blank=True, null=True, help_text="For companies and institutions")
    
    email = models.EmailField(unique=True, blank=True, null=True)
    phone_number = models.CharField(max_length=15, unique=True)
    
    id_type = models.CharField(
        max_length=20, 
        choices=IDType.choices, 
        default=IDType.NATIONAL_ID
    )
    id_number = models.CharField(max_length=50, unique=True, help_text="National ID or Registration Number")
    tax_id = models.CharField(max_length=50, blank=True, null=True, help_text="KRA PIN or Tax ID")
    
    id_document = models.FileField(upload_to='borrower_ids/', blank=True, null=True)
    
    date_of_birth = models.DateField(null=True, blank=True, help_text="DOB for individuals")
    incorporation_date = models.DateField(null=True, blank=True, help_text="Date of registration/incorporation for entities")
    
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
    monthly_income = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, help_text="Monthly Income or Revenue")
    
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
        related_name='verified_borrowers'
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    
    # Portfolio Management
    loan_officer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_borrowers',
        help_text="Loan officer responsible for this borrower's portfolio"
    )
    assigned_at = models.DateTimeField(null=True, blank=True, help_text="When borrower was assigned to current officer")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()
    
    def save(self, *args, **kwargs):
        if not self.borrower_number:
            self.borrower_number = self._generate_borrower_number()
        super().save(*args, **kwargs)
    
    def _generate_borrower_number(self):
        """
        Generate unique borrower number: BRW-YYYYMM-XXXX-CC
        """
        import datetime
        prefix = "BRW"
        year_month = datetime.date.today().strftime('%Y%m')
        
        # Get highest sequential for this month
        last = Borrower.objects.filter(
            borrower_number__startswith=f"{prefix}-{year_month}-"
        ).order_by('-borrower_number').first()
        
        if last and last.borrower_number:
            try:
                seq_part = last.borrower_number.split('-')[2]
                seq = int(seq_part) + 1
            except (IndexError, ValueError):
                seq = 1
        else:
            seq = 1
        
        # Generate checksum (2 chars from phone + random)
        check_base = (self.phone_number[-2:] if self.phone_number else '00') + str(seq)
        checksum = ''.join(random.choices(string.ascii_uppercase + string.digits, k=2))
        
        return f"{prefix}-{year_month}-{seq:04d}-{checksum}"

    @property
    def name(self):
        if self.borrower_type in [self.BorrowerType.COMPANY, self.BorrowerType.INSTITUTION] and self.business_name:
            return self.business_name
        return f"{self.first_name} {self.last_name}"

    def __str__(self):
        return f"{self.borrower_number} - {self.name}"

    class Meta:
        ordering = ['-created_at']

class BorrowerContact(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    borrower = models.ForeignKey(Borrower, on_delete=models.CASCADE, related_name='contacts')
    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    phone_number = models.CharField(max_length=15)
    email = models.EmailField(blank=True, null=True)
    designation = models.CharField(max_length=100, blank=True, null=True, help_text="e.g. Director, Secretary, Manager")
    is_primary = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.designation or 'Contact'})"

    class Meta:
        ordering = ['-is_primary', 'first_name']

class CRBReport(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    borrower = models.ForeignKey(Borrower, on_delete=models.CASCADE, related_name='crb_reports')
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
