from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin
from .models import (
    LoanProduct, LoanApplication, Loan,
    RepaymentSchedule, LoanRepayment, LoanFee,
    CollectionCase, CollectionNote, PromiseToPay, RecoveryAction,
    CreditScoringRule, LoanComment, LoanDocument
)


@admin.register(LoanProduct)
class LoanProductAdmin(SimpleHistoryAdmin):
    list_display = ('name', 'code', 'min_amount', 'max_amount', 'suggested_interest_rate', 'is_active')
    list_filter = ('is_active', 'term_unit', 'requires_collateral', 'requires_guarantor')
    search_fields = ('name', 'code')
    fieldsets = (
        (None, {
            'fields': ('name', 'code', 'description', 'is_active')
        }),
        ('Amount Limits', {
            'fields': ('min_amount', 'max_amount')
        }),
        ('Suggested Defaults (Optional)', {
            'fields': ('suggested_interest_rate', 'suggested_processing_fee_percent'),
            'description': 'These are suggestions only - actual rates configured per loan based on customer risk'
        }),
        ('Term', {
            'fields': ('term_unit', 'default_term', 'min_term', 'max_term')
        }),
        ('Requirements', {
            'fields': ('requires_collateral', 'min_collateral_value', 'max_ltv_ratio', 'requires_guarantor', 'min_credit_score')
        }),
    )
class LoanDocumentInline(admin.TabularInline):
    model = LoanDocument
    extra = 1
    readonly_fields = ('uploaded_at', 'uploaded_by')
    fields = ('document_name', 'file', 'description', 'uploaded_at', 'uploaded_by')

@admin.register(LoanDocument)
class LoanDocumentAdmin(admin.ModelAdmin):
    list_display = ('document_name', 'application', 'loan', 'uploaded_at', 'uploaded_by')
    search_fields = ('document_name', 'application__application_number', 'loan__loan_number', 'application__borrower__first_name', 'application__borrower__last_name')
    list_filter = ('uploaded_at',)
    readonly_fields = ('uploaded_at', 'uploaded_by')

    def save_model(self, request, obj, form, change):
        if not obj.uploaded_by:
            obj.uploaded_by = request.user
        super().save_model(request, obj, form, change)


class RepaymentScheduleInline(admin.TabularInline):
    model = RepaymentSchedule
    extra = 0
    readonly_fields = ('installment_number', 'principal_due', 'interest_due', 'fees_due', 'penalty_due', 'status', 'paid_amount')
    can_delete = False


class LoanRepaymentInline(admin.TabularInline):
    model = LoanRepayment
    extra = 0
    readonly_fields = ('amount', 'payment_date', 'payment_method', 'reference_number', 'received_by')


class LoanFeeInline(admin.TabularInline):
    model = LoanFee
    extra = 0


@admin.register(LoanApplication)
class LoanApplicationAdmin(SimpleHistoryAdmin):
    list_display = ('application_number', 'borrower', 'product', 'requested_amount', 'status', 'created_at')
    list_filter = ('status', 'product', 'created_at')
    search_fields = ('application_number', 'customer__first_name', 'customer__last_name')
    fieldsets = (
        (None, {
            'fields': ('application_number', 'borrower', 'product', 'status')
        }),
        ('Request', {
            'fields': ('requested_amount', 'requested_term', 'purpose', 'collateral')
        }),
        ('Approval', {
            'fields': ('approved_amount', 'approved_term', 'calculated_interest', 'processing_fee', 'approved_by', 'approved_at')
        }),
        ('Rejection', {
            'fields': ('rejection_reason', 'rejected_by', 'rejected_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(Loan)
class LoanAdmin(SimpleHistoryAdmin):
    list_display = ('loan_number', 'borrower', 'product', 'principal_amount', 'outstanding_balance', 'status', 'disbursement_date')
    list_filter = ('status', 'product', 'disbursement_date')
    search_fields = ('loan_number', 'customer__first_name', 'customer__last_name')
    readonly_fields = ('loan_number', 'application', 'disbursement_date', 'closed_at')
    inlines = [RepaymentScheduleInline, LoanRepaymentInline, LoanFeeInline, LoanDocumentInline]
    fieldsets = (
        (None, {
            'fields': ('loan_number', 'application', 'borrower', 'product', 'status')
        }),
        ('Amounts', {
            'fields': ('principal_amount', 'total_interest', 'total_fees', 'disbursed_amount')
        }),
        ('Term', {
            'fields': ('term', 'disbursement_date', 'maturity_date')
        }),
        ('Outstanding', {
            'fields': ('outstanding_balance', 'outstanding_principal', 'outstanding_interest', 'outstanding_penalties')
        }),
        ('Payments', {
            'fields': ('last_payment_date', 'closed_at')
        }),
    )


@admin.register(LoanRepayment)
class LoanRepaymentAdmin(SimpleHistoryAdmin):
    list_display = ('loan', 'amount', 'payment_date', 'payment_method', 'reference_number', 'received_by')
    list_filter = ('payment_method', 'payment_date')
    search_fields = ('loan__loan_number', 'reference_number')


@admin.register(LoanFee)
class LoanFeeAdmin(SimpleHistoryAdmin):
    list_display = ('loan', 'fee_type', 'amount', 'is_paid', 'created_at')
    list_filter = ('fee_type', 'is_paid')


# ========== NEW ARREARS MANAGEMENT ADMIN ==========

class CollectionNoteInline(admin.TabularInline):
    model = CollectionNote
    extra = 1
    readonly_fields = ('created_at', 'created_by')


class PromiseToPayInline(admin.TabularInline):
    model = PromiseToPay
    extra = 1
    readonly_fields = ('created_at', 'created_by')


@admin.register(CollectionCase)
class CollectionCaseAdmin(SimpleHistoryAdmin):
    list_display = ('loan', 'status', 'priority', 'days_overdue', 'overdue_amount', 'assigned_to', 'next_follow_up')
    list_filter = ('status', 'priority', 'assigned_to')
    search_fields = ('loan__loan_number', 'loan__customer__first_name', 'loan__customer__last_name')
    readonly_fields = ('opened_at', 'resolved_at')
    inlines = [CollectionNoteInline, PromiseToPayInline]
    
    def save_model(self, request, obj, form, change):
        if not obj.pk:
            # new case
            pass
        super().save_model(request, obj, form, change)


@admin.register(CollectionNote)
class CollectionNoteAdmin(SimpleHistoryAdmin):
    list_display = ('case', 'contact_method', 'created_by', 'created_at')
    list_filter = ('contact_method', 'created_at')
    search_fields = ('case__loan__loan_number', 'note')


@admin.register(PromiseToPay)
class PromiseToPayAdmin(SimpleHistoryAdmin):
    list_display = ('case', 'promised_amount', 'promised_date', 'status', 'created_at')
    list_filter = ('status', 'promised_date')
    search_fields = ('case__loan__loan_number',)


@admin.register(RecoveryAction)
class RecoveryActionAdmin(SimpleHistoryAdmin):
    list_display = ('loan', 'action_type', 'action_date', 'cost_incurred', 'initiated_by')
    list_filter = ('action_type', 'action_date')
    search_fields = ('loan__loan_number', 'details')


@admin.register(CreditScoringRule)
class CreditScoringRuleAdmin(SimpleHistoryAdmin):
    list_display = ('product', 'min_credit_score', 'max_credit_score', 'risk_category', 'suggested_interest_rate', 'is_active')
    list_filter = ('risk_category', 'is_active', 'product')
    search_fields = ('product__name',)
    fieldsets = (
        (None, {
            'fields': ('product', 'risk_category', 'is_active')
        }),
        ('Score Range', {
            'fields': ('min_credit_score', 'max_credit_score')
        }),
        ('Interest Rate Range', {
            'fields': ('min_interest_rate', 'max_interest_rate', 'suggested_interest_rate')
        }),
        ('Fee Configuration', {
            'fields': ('processing_fee_percent',)
        }),
    )


@admin.register(LoanComment)
class LoanCommentAdmin(SimpleHistoryAdmin):
    list_display = ('loan', 'author', 'comment_type', 'is_internal', 'created_at')
    list_filter = ('comment_type', 'is_internal', 'created_at')
    search_fields = ('loan__loan_number', 'comment', 'author__username', 'author__first_name', 'author__last_name')
    readonly_fields = ('author', 'created_at', 'updated_at')
    fieldsets = (
        (None, {
            'fields': ('loan', 'author', 'comment_type', 'is_internal')
        }),
        ('Content', {
            'fields': ('comment',)
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def save_model(self, request, obj, form, change):
        if not obj.pk:
            obj.author = request.user
        super().save_model(request, obj, form, change)
