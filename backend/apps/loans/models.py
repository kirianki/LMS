from django.db import models
from django.utils import timezone
from django.conf import settings
from django.core.validators import MinValueValidator
from simple_history.models import HistoricalRecords
from decimal import Decimal
import uuid


class LoanProduct(models.Model):
    """Configurable loan products per tenant."""
    
    class InterestType(models.TextChoices):
        FLAT = 'flat', 'Flat Rate'
        REDUCING_BALANCE = 'reducing_balance', 'Reducing Balance'
    
    class TermUnit(models.TextChoices):
        DAYS = 'days', 'Days'
        WEEKS = 'weeks', 'Weeks'
        MONTHS = 'months', 'Months'
    
    class FeeType(models.TextChoices):
        FIXED = 'fixed', 'Fixed Amount'
        PERCENTAGE = 'percentage', 'Percentage of Principal'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField(blank=True)
    
    # Amount limits
    min_amount = models.DecimalField(max_digits=12, decimal_places=2)
    max_amount = models.DecimalField(max_digits=12, decimal_places=2)
    
    # Suggested defaults (not enforced - configured per loan)
    suggested_interest_rate = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text="Suggested annual interest rate (%) - can be overridden per loan"
    )
    suggested_processing_fee_percent = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text="Suggested processing fee percentage - can be overridden per loan"
    )
    suggested_interest_period = models.CharField(
        max_length=20,
        choices=[
            ('per_month', 'Per Month'),
            ('per_day', 'Per Day'),
            ('per_year', 'Per Annum'),
        ],
        default='per_year',
        help_text="Default interest calculation period"
    )
    
    # Term
    default_term = models.PositiveIntegerField(default=12, help_text="Default loan period")
    term_unit = models.CharField(max_length=10, choices=TermUnit.choices, default=TermUnit.MONTHS)
    min_term = models.PositiveIntegerField(default=1)
    max_term = models.PositiveIntegerField(default=12)
    
    # Requirements
    requires_collateral = models.BooleanField(default=False)
    requires_guarantor = models.BooleanField(default=False)
    min_credit_score = models.IntegerField(
        null=True, blank=True,
        help_text="Minimum credit score required for this product"
    )
    min_collateral_value = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        help_text="Minimum collateral value required if collateral is mandatory"
    )
    max_ltv_ratio = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        null=True, 
        blank=True,
        help_text="Maximum Loan-to-Value ratio (%) if collateral required"
    )
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()
    
    def __str__(self):
        return f"{self.name} ({self.code})"


class LoanApplication(models.Model):
    """Loan application lifecycle management."""
    
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        SUBMITTED = 'submitted', 'Submitted'
        UNDER_REVIEW = 'under_review', 'Under Review'
        APPROVED = 'approved', 'Approved (Pending Offer)'
        OFFER_SENT = 'offer_sent', 'Offer Sent'
        OFFER_ACCEPTED = 'offer_accepted', 'Offer Accepted'
        REJECTED = 'rejected', 'Rejected'
        DISBURSED = 'disbursed', 'Disbursed'
        CANCELLED = 'cancelled', 'Cancelled'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application_number = models.CharField(max_length=50, unique=True, blank=True)
    
    customer = models.ForeignKey('customers.Customer', on_delete=models.CASCADE, related_name='loan_applications')
    product = models.ForeignKey(LoanProduct, on_delete=models.PROTECT, related_name='applications')
    
    # Requested amounts
    requested_amount = models.DecimalField(
        max_digits=12, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    requested_term = models.PositiveIntegerField()
    
    purpose = models.TextField(blank=True, help_text="Purpose of the loan")
    
    # Review
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_applications')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True)
    
    # Legacy fields for admin compatibility
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_applications')
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_applications')
    rejected_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='rejected_applications')
    rejected_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    
    # Approved values (may differ from requested)
    approved_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    approved_term = models.PositiveIntegerField(null=True, blank=True)
    
    # Interest Configuration (set during approval per customer risk)
    approved_interest_rate = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text="Annual interest rate (%) approved for this specific loan"
    )
    approved_interest_method = models.CharField(
        max_length=20,
        choices=[
            ('flat', 'Flat Rate'),
            ('reducing_balance', 'Reducing Balance'),
            ('interest_only', 'Interest Only'),
        ],
        null=True, blank=True,
        help_text="Method used to calculate interest"
    )
    approved_interest_period = models.CharField(
        max_length=20,
        choices=[
            ('per_month', 'Per Month'),
            ('per_day', 'Per Day'),
            ('per_year', 'Per Annum'),
        ],
        null=True, blank=True,
        help_text="Period for interest calculation"
    )
    
    # Fee Configuration (calculated or fixed)
    processing_fee_basis = models.CharField(
        max_length=20,
        choices=[
            ('fixed', 'Fixed Amount'),
            ('percentage', 'Percentage of Principal'),
        ],
        default='fixed',
        help_text="How processing fee is calculated"
    )
    processing_fee_percent = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text="Processing fee percentage if basis is 'percentage'"
    )
    insurance_fee = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    legal_fee = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    other_fees = models.JSONField(default=dict, blank=True, help_text="Additional flexible fees")
    
    # Risk Assessment
    credit_score_at_application = models.IntegerField(
        null=True, blank=True,
        help_text="Customer's credit score at time of application"
    )
    risk_category = models.CharField(
        max_length=20,
        choices=[
            ('low', 'Low Risk'),
            ('medium', 'Medium Risk'),
            ('high', 'High Risk'),
        ],
        null=True, blank=True
    )
    
    # Calculated values (legacy - kept for compatibility)
    calculated_interest = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    processing_fee = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    valuation_fee = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    discharge_fee = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    
    # Documents
    offer_letter_file = models.FileField(upload_to='loan_offers/', null=True, blank=True)
    signed_offer_letter = models.FileField(upload_to='signed_offers/', null=True, blank=True)
    disbursement_letter_file = models.FileField(upload_to='disbursement_letters/', null=True, blank=True)

    # Collateral
    collateral = models.ForeignKey(
        'collateral.Collateral', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='loan_applications'
    )
    
    # Timestamps
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    disbursed_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()
    
    def save(self, *args, **kwargs):
        if not self.application_number:
            import datetime
            prefix = datetime.date.today().strftime('%Y%m')
            last = LoanApplication.objects.filter(application_number__startswith=f"APP{prefix}").order_by('-application_number').first()
            if last:
                num = int(last.application_number[-4:]) + 1
            else:
                num = 1
            self.application_number = f"APP{prefix}{num:04d}"
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.application_number} - {self.customer}"


class Loan(models.Model):
    """Active/Closed loans after disbursement."""
    
    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        PAID_OFF = 'paid_off', 'Paid Off'
        WRITTEN_OFF = 'written_off', 'Written Off'
        DEFAULTED = 'defaulted', 'Defaulted'
    
    class ArrearsCategory(models.TextChoices):
        CURRENT = 'current', 'Current'
        DAYS_1_30 = '1-30', '1-30 Days'
        DAYS_31_60 = '31-60', '31-60 Days'
        DAYS_61_90 = '61-90', '61-90 Days'
        DAYS_90_PLUS = '90+', '90+ Days'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    loan_number = models.CharField(max_length=50, unique=True, blank=True)
    
    application = models.OneToOneField(LoanApplication, on_delete=models.PROTECT, related_name='loan')
    customer = models.ForeignKey('customers.Customer', on_delete=models.CASCADE, related_name='loans')
    product = models.ForeignKey(LoanProduct, on_delete=models.PROTECT, related_name='loans')
    
    # Principal and calculated amounts
    principal_amount = models.DecimalField(max_digits=12, decimal_places=2)
    total_interest = models.DecimalField(max_digits=12, decimal_places=2)
    total_fees = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    
    # Disbursement
    disbursed_amount = models.DecimalField(max_digits=12, decimal_places=2)
    disbursement_date = models.DateField()
    disbursement_method = models.CharField(max_length=20, default='mpesa')
    disbursement_reference = models.CharField(max_length=100, blank=True)
    
    # Term
    term = models.PositiveIntegerField()
    maturity_date = models.DateField()
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    
    # Outstanding balances (updated on each payment)
    outstanding_balance = models.DecimalField(max_digits=12, decimal_places=2)
    outstanding_principal = models.DecimalField(max_digits=12, decimal_places=2)
    outstanding_interest = models.DecimalField(max_digits=12, decimal_places=2)
    outstanding_penalties = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    
    # Arrears tracking (NEW)
    days_in_arrears = models.IntegerField(default=0, help_text="Current days overdue")
    arrears_category = models.CharField(
        max_length=20,
        choices=ArrearsCategory.choices,
        default=ArrearsCategory.CURRENT,
        help_text="Arrears aging bucket"
    )
    
    last_payment_date = models.DateField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    
    # Collateral link (copied from application for direct access)
    collateral = models.ForeignKey(
        'collateral.Collateral', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='loans'
    )
    ltv_ratio = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        null=True, 
        blank=True,
        help_text="Loan-to-Value ratio at disbursement (%)"
    )
    
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()
    
    def save(self, *args, **kwargs):
        if not self.loan_number:
            import datetime
            prefix = datetime.date.today().strftime('%Y%m')
            last = Loan.objects.filter(loan_number__startswith=f"LN{prefix}").order_by('-loan_number').first()
            if last:
                num = int(last.loan_number[-4:]) + 1
            else:
                num = 1
            self.loan_number = f"LN{prefix}{num:04d}"
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.loan_number} - {self.customer}"


class RepaymentSchedule(models.Model):
    """Amortization schedule entries."""
    
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        PARTIAL = 'partial', 'Partially Paid'
        PAID = 'paid', 'Paid'
        OVERDUE = 'overdue', 'Overdue'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    loan = models.ForeignKey(Loan, on_delete=models.CASCADE, related_name='schedules')
    
    installment_number = models.PositiveIntegerField(default=1)
    due_date = models.DateField()
    
    principal_due = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    interest_due = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    fees_due = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_due = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    penalty_due = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    
    created_at = models.DateTimeField(default=timezone.now)
    
    history = HistoricalRecords()
    
    def __str__(self):
        return f"{self.loan.loan_number} - Installment {self.installment_number}"
    
    class Meta:
        ordering = ['due_date']


class LoanRepayment(models.Model):
    """Individual loan payments."""
    
    class PaymentMethod(models.TextChoices):
        CASH = 'cash', 'Cash'
        MPESA = 'mpesa', 'M-Pesa'
        BANK_TRANSFER = 'bank_transfer', 'Bank Transfer'
        CHEQUE = 'cheque', 'Cheque'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    loan = models.ForeignKey(Loan, on_delete=models.CASCADE, related_name='repayments')
    
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_date = models.DateField()
    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices)
    reference_number = models.CharField(max_length=100, blank=True)
    
    # Allocation breakdown
    principal_paid = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    interest_paid = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    penalty_paid = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    fee_paid = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    
    received_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(default=timezone.now)
    
    history = HistoricalRecords()
    
    def __str__(self):
        return f"{self.loan.loan_number} - {self.amount} on {self.payment_date}"
    
    class Meta:
        ordering = ['-payment_date', '-created_at']


class LoanFee(models.Model):
    """Additional fees applied to loans."""
    
    class FeeType(models.TextChoices):
        PROCESSING = 'processing', 'Processing Fee'
        INSURANCE = 'insurance', 'Insurance'
        LEGAL = 'legal', 'Legal Fee'
        COLLATERAL_DISCHARGE = 'collateral_discharge', 'Collateral Discharge Fee'
        VALUATION = 'valuation', 'Valuation Fee'
        LATE_PENALTY = 'late_penalty', 'Late Penalty'
        OTHER = 'other', 'Other'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    loan = models.ForeignKey(Loan, on_delete=models.CASCADE, related_name='fees')
    
    fee_type = models.CharField(max_length=20, choices=FeeType.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.CharField(max_length=255, blank=True)
    
    is_paid = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)
    
    history = HistoricalRecords()
    
    def __str__(self):
        return f"{self.loan.loan_number} - {self.get_fee_type_display()} ({self.amount})"


class CollateralDischarge(models.Model):
    """Management of collateral discharge process after loan repayment."""
    
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        LETTER_SENT = 'letter_sent', 'Discharge Letter Sent'
        CUSTOMER_CONFIRMED = 'customer_confirmed', 'Customer Confirmed Collection'
        COMPLETED = 'completed', 'Completed'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    loan = models.OneToOneField(Loan, on_delete=models.CASCADE, related_name='discharge_process')
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    
    # Documents
    discharge_letter = models.FileField(upload_to='discharge_letters/', null=True, blank=True)
    collection_confirmation = models.FileField(upload_to='collection_confirmations/', null=True, blank=True)
    
    initiated_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    history = HistoricalRecords()
    
    def __str__(self):
        return f"Discharge {self.loan.loan_number} - {self.get_status_display()}"


# ========== NEW ARREARS MANAGEMENT MODELS ==========

class CollectionCase(models.Model):
    """Collection case management for overdue loans."""
    
    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        RESOLVED = 'resolved', 'Resolved'
        ESCALATED = 'escalated', 'Escalated to Legal'
        WRITTEN_OFF = 'written_off', 'Written Off'
    
    class Priority(models.TextChoices):
        LOW = 'low', 'Low (1-30 days)'
        MEDIUM = 'medium', 'Medium (31-60 days)'
        HIGH = 'high', 'High (61-90 days)'
        CRITICAL = 'critical', 'Critical (90+ days)'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    loan = models.OneToOneField(Loan, on_delete=models.CASCADE, related_name='collection_case')
    
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_cases'
    )
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.LOW)
    
    days_overdue = models.IntegerField(default=0)
    overdue_amount = models.DecimalField(max_digits=12, decimal_places=2)
    
    opened_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    next_follow_up = models.DateField(null=True, blank=True)
    
    history = HistoricalRecords()
    
    def __str__(self):
        return f"Case {self.loan.loan_number} - {self.get_priority_display()}"
    
    class Meta:
        verbose_name_plural = "Collection Cases"
        ordering = ['-priority', '-days_overdue']


class CollectionNote(models.Model):
    """Track all collection interactions and follow-ups."""
    
    class ContactMethod(models.TextChoices):
        PHONE = 'phone', 'Phone Call'
        SMS = 'sms', 'SMS'
        EMAIL = 'email', 'Email'
        VISIT = 'visit', 'Physical Visit'
        LETTER = 'letter', 'Letter'
        OTHER = 'other', 'Other'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    case = models.ForeignKey(CollectionCase, on_delete=models.CASCADE, related_name='notes')
    
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    contact_method = models.CharField(max_length=20, choices=ContactMethod.choices)
    
    note = models.TextField(help_text="Details of the collection activity")
    customer_response = models.TextField(blank=True, help_text="Customer's response or commitment")
    
    created_at = models.DateTimeField(default=timezone.now)
    
    history = HistoricalRecords()
    
    def __str__(self):
        return f"{self.case.loan.loan_number} - {self.get_contact_method_display()} on {self.created_at.date()}"
    
    class Meta:
        ordering = ['-created_at']


class PromiseToPay(models.Model):
    """Track customer payment promises and their fulfillment."""
    
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        KEPT = 'kept', 'Kept'
        BROKEN = 'broken', 'Broken'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    case = models.ForeignKey(CollectionCase, on_delete=models.CASCADE, related_name='promises')
    
    promised_amount = models.DecimalField(max_digits=12, decimal_places=2)
    promised_date = models.DateField()
    
    actual_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    actual_date = models.DateField(null=True, blank=True)
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    notes = models.TextField(blank=True)
    
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    
    history = HistoricalRecords()
    
    def __str__(self):
        return f"Promise: KES {self.promised_amount} by {self.promised_date} - {self.get_status_display()}"
    
    class Meta:
        ordering = ['-promised_date']
        verbose_name_plural = "Promises to Pay"


class RecoveryAction(models.Model):
    """Track legal and recovery actions for defaulted loans."""
    
    class ActionType(models.TextChoices):
        DEMAND_LETTER = 'demand_letter', 'Demand Letter Sent'
        LEGAL_NOTICE = 'legal_notice', 'Legal Notice'
        COURT_FILING = 'court_filing', 'Court Filing'
        COLLATERAL_SEIZURE = 'collateral_seizure', 'Collateral Seizure'
        AUCTION = 'auction', 'Auction Scheduled'
        SETTLEMENT = 'settlement', 'Settlement Agreement'
        WRITE_OFF = 'write_off', 'Write-off Approved'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    loan = models.ForeignKey(Loan, on_delete=models.CASCADE, related_name='recovery_actions')
    
    action_type = models.CharField(max_length=30, choices=ActionType.choices)
    action_date = models.DateField()
    details = models.TextField(help_text="Details of the recovery action taken")
    
    cost_incurred = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    
    initiated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    document = models.FileField(upload_to='recovery_docs/', null=True, blank=True)
    
    created_at = models.DateTimeField(default=timezone.now)
    
    history = HistoricalRecords()
    
    def __str__(self):
        return f"{self.loan.loan_number} - {self.get_action_type_display()} on {self.action_date}"
    
    class Meta:
        ordering = ['-action_date', '-created_at']


class LoanDeduction(models.Model):
    """Dynamic charges/deductions applied to a loan application."""
    
    class ChargeMethod(models.TextChoices):
        FIXED = 'fixed', 'Fixed Amount'
        PERCENTAGE = 'percentage', 'Percentage of Principal'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application = models.ForeignKey(LoanApplication, on_delete=models.CASCADE, related_name='deductions')
    
    name = models.CharField(max_length=100, help_text="e.g. Processing Fee, Insurance, Legal Fee")
    charge_method = models.CharField(max_length=20, choices=ChargeMethod.choices, default=ChargeMethod.FIXED)
    
    # Value can be an amount or a percentage
    value = models.DecimalField(max_digits=12, decimal_places=2)
    
    # Calculated amount (synced on save)
    calculated_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    
    # Whether this deduction is withheld from disbursement or paid separately
    is_withheld = models.BooleanField(default=True, help_text="If true, this amount is deducted from the principal during disbursement")
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    history = HistoricalRecords()

    def save(self, *args, **kwargs):
        if self.charge_method == self.ChargeMethod.PERCENTAGE:
            self.calculated_amount = (self.application.approved_amount or self.application.requested_amount) * (self.value / Decimal('100.00'))
        else:
            self.calculated_amount = self.value
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} - {self.calculated_amount} for {self.application.application_number}"


class LoanGuarantor(models.Model):
    """Guarantors for a loan application."""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application = models.ForeignKey(LoanApplication, on_delete=models.CASCADE, related_name='guarantors')
    
    # Can be an existing customer or an external person
    customer = models.ForeignKey(
        'customers.Customer', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='guarantorships'
    )
    
    # Details if not a customer or for quick reference
    name = models.CharField(max_length=100)
    id_number = models.CharField(max_length=50)
    phone_number = models.CharField(max_length=15)
    relationship = models.CharField(max_length=50, blank=True, help_text="e.g. Spouse, Employer, Friend")
    
    # Collateral pledged by guarantor (optional)
    pledged_collateral = models.ForeignKey(
        'collateral.Collateral', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='guarantor_pledges'
    )
    
    amount_guaranteed = models.DecimalField(max_digits=12, decimal_places=2, help_text="Amount this person is guaranteeing")
    
    is_verified = models.BooleanField(default=False)
    signed_guaranty_form = models.FileField(upload_to='guaranty_forms/', null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    history = HistoricalRecords()

    def __str__(self):
        return f"{self.name} for {self.application.application_number}"


class CreditScoringRule(models.Model):
    """Define interest rate ranges and fee multipliers based on credit score."""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(
        LoanProduct, 
        on_delete=models.CASCADE, 
        null=True, blank=True,
        related_name='scoring_rules',
        help_text="Product-specific rule. If null, applies to all products"
    )
    
    # Score Range
    min_credit_score = models.IntegerField(help_text="Minimum score (inclusive)")
    max_credit_score = models.IntegerField(help_text="Maximum score (inclusive)")
    
    # Interest Rate Range
    min_interest_rate = models.DecimalField(
        max_digits=5, decimal_places=2,
        help_text="Minimum allowed interest rate (%)"
    )
    max_interest_rate = models.DecimalField(
        max_digits=5, decimal_places=2,
        help_text="Maximum allowed interest rate (%)"
    )
    suggested_interest_rate = models.DecimalField(
        max_digits=5, decimal_places=2,
        help_text="Suggested/default interest rate (%)"
    )
    
    # Fee Configuration
    processing_fee_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('2.00'),
        help_text="Processing fee percentage for this risk category"
    )
    
    # Risk Category
    risk_category = models.CharField(
        max_length=20,
        choices=[
            ('low', 'Low Risk'),
            ('medium', 'Medium Risk'),
            ('high', 'High Risk'),
        ]
    )
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()
    
    class Meta:
        ordering = ['-min_credit_score']
        unique_together = [['product', 'min_credit_score', 'max_credit_score']]
    
    def __str__(self):
        product_name = self.product.name if self.product else "All Products"
        return f"{product_name}: {self.min_credit_score}-{self.max_credit_score} ({self.risk_category})"
    
    def applies_to_score(self, score):
        """Check if this rule applies to the given credit score."""
        return self.min_credit_score <= score <= self.max_credit_score
