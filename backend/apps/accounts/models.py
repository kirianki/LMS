from django.db import models
from simple_history.models import HistoricalRecords
import uuid

class Organization(models.Model):
    is_ai_enabled = models.BooleanField(default=False)
    is_automation_enabled = models.BooleanField(default=False)
    is_branches_enabled = models.BooleanField(default=True)
    max_branches_limit = models.IntegerField(default=10)
    max_valuers_limit = models.IntegerField(default=5)
    
    # M-Pesa Configuration
    mpesa_environment = models.CharField(max_length=20, default='sandbox', help_text='sandbox or production')
    mpesa_consumer_key = models.CharField(max_length=255, blank=True)
    mpesa_consumer_secret = models.CharField(max_length=255, blank=True)
    mpesa_shortcode = models.CharField(max_length=20, blank=True)
    mpesa_passkey = models.CharField(max_length=255, blank=True)
    mpesa_initiator_name = models.CharField(max_length=100, blank=True)
    mpesa_initiator_password = models.CharField(max_length=255, blank=True)
    mpesa_security_credential = models.TextField(blank=True, help_text='Encrypted security credential for B2C/disbursements')
    mpesa_callback_url = models.URLField(blank=True)
    
    # Bank API Configuration (for automated disbursements)
    bank_api_enabled = models.BooleanField(default=False, help_text='Enable automated bank transfers')
    bank_api_provider = models.CharField(max_length=50, blank=True, help_text='e.g., pesalink, ipay, jenga_api')
    bank_api_key = models.CharField(max_length=255, blank=True)
    bank_api_secret = models.CharField(max_length=255, blank=True)
    bank_api_account_number = models.CharField(max_length=50, blank=True, help_text='Source account for transfers')
    
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
    logo = models.ImageField(upload_to='account_logos/', blank=True, null=True, help_text='Company logo (PNG/JPG, max 2MB)')
    primary_color = models.CharField(max_length=7, blank=True, default='#2EAD8F', help_text='Primary brand color (hex code)')
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
    
    history = HistoricalRecords()

    class Meta:
        verbose_name_plural = "Organizations"

    def __str__(self):
        return f"System Settings: {self.company_name or 'Default'}"

class DocumentTemplate(models.Model):
    class TemplateType(models.TextChoices):
        OFFER_LETTER = 'offer_letter', 'Offer Letter'
        DISBURSEMENT_LETTER = 'disbursement_letter', 'Disbursement Letter'
        LOAN_STATEMENT = 'loan_statement', 'Loan Statement'
        OTHER = 'other', 'Other'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    template_type = models.CharField(
        max_length=50, 
        choices=TemplateType.choices, 
        default=TemplateType.OFFER_LETTER
    )
    content = models.TextField(help_text="HTML content with Jinja2 placeholders. Available context: application, borrower, product, account, today")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()

    class Meta:
        unique_together = ('template_type', 'name')

    def __str__(self):
        return f"{self.name} ({self.get_template_type_display()})"
