from django.db import models
from django_tenants.models import TenantMixin, DomainMixin
from simple_history.models import HistoricalRecords
import uuid

class Tenant(TenantMixin):
    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        SUSPENDED = 'suspended', 'Suspended'
        PENDING = 'pending', 'Pending'

    name = models.CharField(max_length=255)
    kra_pin = models.CharField(max_length=20, blank=True, null=True)
    status = models.CharField(
        max_length=20, 
        choices=Status.choices, 
        default=Status.PENDING
    )
    created_on = models.DateTimeField(auto_now_add=True)
    
    # Disable user DB constraint because in a multi-tenant setup, 
    # the user might exist in a tenant schema while this model is in public,
    # causing FK violations during inserts.
    history = HistoricalRecords(user_db_constraint=False)

    # default true, schema will be automatically created and synced when it is saved
    auto_create_schema = True

    def __str__(self):
        return self.name

class Domain(DomainMixin):
    pass

class Module(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    
    history = HistoricalRecords()

    def __str__(self):
        return self.name

class Subscription(models.Model):
    class Plan(models.TextChoices):
        BASIC = 'basic', 'Basic'
        PREMIUM = 'premium', 'Premium'
        ENTERPRISE = 'enterprise', 'Enterprise'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='subscriptions')
    plan = models.CharField(max_length=20, choices=Plan.choices, default=Plan.BASIC)
    start_date = models.DateField(auto_now_add=True)
    expiry_date = models.DateField()
    is_active = models.BooleanField(default=True)
    
    history = HistoricalRecords()

    def __str__(self):
        return f"{self.tenant.name} - {self.plan}"

class TenantModule(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='enabled_modules')
    module = models.ForeignKey(Module, on_delete=models.CASCADE)
    is_enabled = models.BooleanField(default=True)
    
    history = HistoricalRecords()

    class Meta:
        unique_together = ('tenant', 'module')

    def __str__(self):
        return f"{self.tenant.name} - {self.module.name}"

class TenantSettings(models.Model):
    tenant = models.OneToOneField(Tenant, on_delete=models.CASCADE, related_name='settings')
    is_ai_enabled = models.BooleanField(default=False)
    is_automation_enabled = models.BooleanField(default=False)
    max_valuers_limit = models.IntegerField(default=5)
    
    # M-Pesa Configuration
    mpesa_environment = models.CharField(max_length=20, default='sandbox', help_text='sandbox or production')
    mpesa_consumer_key = models.CharField(max_length=255, blank=True)
    mpesa_consumer_secret = models.CharField(max_length=255, blank=True)
    mpesa_shortcode = models.CharField(max_length=20, blank=True)
    mpesa_passkey = models.CharField(max_length=255, blank=True)
    mpesa_initiator_name = models.CharField(max_length=100, blank=True)
    mpesa_initiator_password = models.CharField(max_length=255, blank=True)
    mpesa_callback_url = models.URLField(blank=True)
    
    # SMS Gateway Configuration
    sms_provider = models.CharField(max_length=50, blank=True, help_text='africas_talking, infobip, etc.')
    sms_api_key = models.CharField(max_length=255, blank=True)
    sms_api_secret = models.CharField(max_length=255, blank=True)
    sms_sender_id = models.CharField(max_length=20, blank=True)
    
    # Reminder Settings
    reminder_days_before = models.IntegerField(default=3, help_text='Days before due date to send reminder')
    reminder_enabled = models.BooleanField(default=True)
    overdue_reminder_enabled = models.BooleanField(default=True)
    
    # Branding & Company Information
    company_name = models.CharField(max_length=255, blank=True, help_text='Official registered company name')
    company_tagline = models.CharField(max_length=255, blank=True, help_text='Slogan or motto for reports')
    registration_number = models.CharField(max_length=100, blank=True, help_text='Business registration number')
    tax_identification = models.CharField(max_length=50, blank=True, help_text='TIN/VAT number')
    website = models.URLField(blank=True)
    
    # Contact Information
    company_address = models.TextField(blank=True, help_text='Physical address')
    company_postal_address = models.CharField(max_length=255, blank=True, help_text='P.O. Box address')
    company_city = models.CharField(max_length=100, blank=True, default='Nairobi')
    company_country = models.CharField(max_length=100, blank=True, default='Kenya')
    company_phone = models.CharField(max_length=20, blank=True)
    company_email = models.EmailField(blank=True)
    
    # Branding Assets
    logo = models.ImageField(upload_to='tenant_logos/', blank=True, null=True, help_text='Company logo (PNG/JPG, max 2MB)')
    primary_color = models.CharField(max_length=7, blank=True, default='#1E3A8A', help_text='Primary brand color (hex code)')
    secondary_color = models.CharField(max_length=7, blank=True, default='#3B82F6', help_text='Secondary brand color (hex code)')
    report_footer_text = models.TextField(blank=True, help_text='Standard footer text for all reports')

    # Email Configuration (SMTP)
    smtp_host = models.CharField(max_length=255, blank=True)
    smtp_port = models.IntegerField(default=587)
    smtp_use_tls = models.BooleanField(default=True)
    smtp_username = models.CharField(max_length=255, blank=True)
    smtp_password = models.CharField(max_length=255, blank=True)
    smtp_from_email = models.EmailField(blank=True)

    # Integrations: CRB & Identity
    crb_enabled = models.BooleanField(default=False)
    crb_provider = models.CharField(max_length=50, blank=True, default='metropol', help_text='metropol, transunion')
    crb_api_key = models.CharField(max_length=255, blank=True)
    crb_api_secret = models.CharField(max_length=255, blank=True)

    identity_enabled = models.BooleanField(default=False)
    identity_provider = models.CharField(max_length=50, blank=True, default='smile_identity')
    identity_api_key = models.CharField(max_length=255, blank=True)
    
    # Disable user DB constraint for history to prevent cross-schema FK issues
    history = HistoricalRecords(user_db_constraint=False)

    class Meta:
        verbose_name_plural = "Tenant Settings"

    def __str__(self):
        return f"Settings for {self.tenant.name}"
