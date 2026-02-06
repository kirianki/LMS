from django.db import models
from django.conf import settings
from simple_history.models import HistoricalRecords
import uuid

class Collateral(models.Model):
    class CollateralType(models.TextChoices):
        MOTOR_VEHICLE = 'motor_vehicle', 'Motor Vehicle'
        LAND_PROPERTY = 'land_property', 'Land/Property'
        BUSINESS_ASSET = 'business_asset', 'Business Asset'
        CHATTELS = 'chattels', 'Household/Office Chattels'
        SHARES = 'shares', 'Shares/Stocks'
        FIXED_DEPOSIT = 'fixed_deposit', 'Fixed Deposit'
        OTHER = 'other', 'Other'

    class CollateralStatus(models.TextChoices):
        AVAILABLE = 'available', 'Available'
        PLEDGED = 'pledged', 'Pledged'
        DISCHARGED = 'discharged', 'Discharged'
        AUCTIONED = 'auctioned', 'Auctioned'

    class TenureType(models.TextChoices):
        FREEHOLD = 'freehold', 'Freehold'
        LEASEHOLD = 'leasehold', 'Leasehold'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    borrower = models.ForeignKey(
        'customers.Borrower', 
        on_delete=models.CASCADE, 
        related_name='collaterals'
    )
    
    collateral_type = models.CharField(
        max_length=30,
        choices=CollateralType.choices,
        default=CollateralType.OTHER
    )
    status = models.CharField(
        max_length=20,
        choices=CollateralStatus.choices,
        default=CollateralStatus.AVAILABLE
    )

    # Common Valuation Fields
    market_value = models.DecimalField(max_digits=12, decimal_places=2)
    forced_sale_value = models.DecimalField(max_digits=12, decimal_places=2)
    valuation_date = models.DateField()
    valuer = models.ForeignKey(
        'collateral.Valuer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='collaterals'
    )
    document_upload = models.FileField(upload_to='collateral_docs/', blank=True, null=True)
    is_charged = models.BooleanField(default=False, help_text="Has the Security Deed been verified?")
    liquidation_date = models.DateField(null=True, blank=True)
    liquidation_value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    description = models.TextField(blank=True)
    
    # Insurance Details
    insurance_start_date = models.DateField(null=True, blank=True)
    insurance_expiry_date = models.DateField(null=True, blank=True, help_text="Date when current insurance cover expires")

    # --- Asset-Specific Fields ---
    
    # Motor Vehicle details
    make = models.CharField(max_length=50, blank=True)
    model = models.CharField(max_length=50, blank=True)
    body_type = models.CharField(max_length=50, blank=True)
    reg_number = models.CharField(max_length=20, blank=True)
    chassis_number = models.CharField(max_length=50, blank=True)
    engine_number = models.CharField(max_length=50, blank=True)
    year_of_manufacture = models.PositiveIntegerField(null=True, blank=True)
    logbook_number = models.CharField(max_length=50, blank=True)
    
    # Tracker Details
    tracker_installed = models.BooleanField(default=False)
    tracker_company = models.CharField(max_length=100, blank=True)
    tracker_device_id = models.CharField(max_length=100, blank=True)
    tracker_installation_date = models.DateField(null=True, blank=True)

    # Land/Property details
    lr_number = models.CharField(max_length=100, blank=True, verbose_name="LR/Parcel Number")
    location = models.CharField(max_length=200, blank=True)
    property_size = models.CharField(max_length=50, blank=True)
    tenure_type = models.CharField(
        max_length=20,
        choices=TenureType.choices,
        blank=True,
        null=True
    )

    # Business details
    business_name = models.CharField(max_length=100, blank=True)
    registration_number = models.CharField(max_length=50, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    branch = models.ForeignKey('branches.Branch', on_delete=models.SET_NULL, null=True, blank=True, related_name='collaterals')
    
    history = HistoricalRecords()

    def __str__(self):
        identifier = self.reg_number or self.lr_number or self.id
        return f"{self.get_collateral_type_display()} - {identifier}"

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = "Collateral"

class Valuer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    email = models.EmailField()
    phone = models.CharField(max_length=20, blank=True)
    valuation_types = models.JSONField(default=list, help_text="List of collateral types this valuer handles")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class ValuationRequest(models.Model):
    class RequestStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        SENT = 'sent', 'Sent'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    collateral = models.ForeignKey(Collateral, on_delete=models.CASCADE, related_name='valuation_requests')
    valuer = models.ForeignKey(Valuer, on_delete=models.CASCADE, related_name='requests')
    status = models.CharField(max_length=20, choices=RequestStatus.choices, default=RequestStatus.PENDING)
    request_token = models.UUIDField(default=uuid.uuid4, unique=True, help_text="Token for tracking replies")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Request for {self.collateral} to {self.valuer}"


class ValuationReport(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    collateral = models.ForeignKey(Collateral, on_delete=models.CASCADE, related_name='valuation_reports')
    valuation_request = models.OneToOneField(ValuationRequest, on_delete=models.SET_NULL, null=True, blank=True, related_name='report')
    valuer_company = models.CharField(max_length=100)
    market_value = models.DecimalField(max_digits=12, decimal_places=2)
    forced_sale_value = models.DecimalField(max_digits=12, decimal_places=2)
    valuation_date = models.DateField()
    report_file = models.FileField(upload_to='valuation_reports/', blank=True, null=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    history = HistoricalRecords()

    class Meta:
        ordering = ['-created_at']
