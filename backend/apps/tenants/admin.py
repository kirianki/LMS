from django.contrib import admin
from django_tenants.admin import TenantAdminMixin
from django.http import HttpResponse
from .models import Tenant, Domain, Module, Subscription, TenantModule, TenantSettings, DocumentTemplate
from simple_history.admin import SimpleHistoryAdmin
from apps.loans.services.documents import render_document_preview

class DomainInline(admin.TabularInline):
    model = Domain
    max_num = 1

class TenantModuleInline(admin.TabularInline):
    model = TenantModule
    extra = 1

class SubscriptionInline(admin.TabularInline):
    model = Subscription
    extra = 1

class TenantSettingsInline(admin.StackedInline):
    model = TenantSettings
    can_delete = False

@admin.register(Tenant)
class TenantAdmin(TenantAdminMixin, admin.ModelAdmin):
    list_display = ('name', 'schema_name', 'status', 'kra_pin', 'created_on')
    list_filter = ('status',)
    search_fields = ('name', 'schema_name', 'kra_pin')
    inlines = [DomainInline, SubscriptionInline, TenantModuleInline, TenantSettingsInline]

@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ('name', 'description')
    search_fields = ('name',)

@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ('tenant', 'plan', 'start_date', 'expiry_date', 'is_active')
    list_filter = ('plan', 'is_active')
    search_fields = ('tenant__name',)

@admin.register(TenantModule)
class TenantModuleAdmin(admin.ModelAdmin):
    list_display = ('tenant', 'module', 'is_enabled')
    list_filter = ('is_enabled',)
    search_fields = ('tenant__name', 'module__name')
@admin.register(TenantSettings)
class TenantSettingsAdmin(SimpleHistoryAdmin):
    list_display = ('tenant', 'is_ai_enabled', 'is_automation_enabled', 'reminder_enabled', 'mpesa_environment')
    list_filter = ('is_ai_enabled', 'is_automation_enabled', 'reminder_enabled', 'mpesa_environment')
    search_fields = ('tenant__name',)
    fieldsets = (
        ('Feature Toggles', {
            'fields': ('tenant', 'is_ai_enabled', 'is_automation_enabled', 'max_valuers_limit')
        }),
        ('M-Pesa Configuration', {
            'fields': ('mpesa_environment', 'mpesa_consumer_key', 'mpesa_consumer_secret', 
                      'mpesa_shortcode', 'mpesa_passkey', 'mpesa_initiator_name', 
                      'mpesa_initiator_password', 'mpesa_callback_url'),
            'classes': ('collapse',)
        }),
        ('SMS Gateway', {
            'fields': ('sms_provider', 'sms_api_key', 'sms_api_secret', 'sms_sender_id'),
            'classes': ('collapse',)
        }),
        ('Reminders', {
            'fields': ('reminder_enabled', 'reminder_days_before', 'overdue_reminder_enabled')
        }),
        ('Branding', {
            'fields': ('company_address', 'company_phone', 'company_email', 'logo'),
            'classes': ('collapse',)
        }),
    )

@admin.register(DocumentTemplate)
class DocumentTemplateAdmin(SimpleHistoryAdmin):
    list_display = ('name', 'template_type', 'is_active', 'updated_at')
    list_filter = ('template_type', 'is_active')
    search_fields = ('name', 'description')
    readonly_fields = ('created_at', 'updated_at')
    actions = ['preview_template']

    def preview_template(self, request, queryset):
        if queryset.count() != 1:
            self.message_user(request, "Please select exactly one template to preview.", level='warning')
            return
        
        template = queryset.first()
        from apps.loans.services.documents import render_document_preview
        pdf_buffer = render_document_preview(template, request.tenant)
        
        if pdf_buffer:
            response = HttpResponse(pdf_buffer, content_type='application/pdf')
            response['Content-Disposition'] = f'inline; filename="preview_{template.name}.pdf"'
            return response
        else:
            self.message_user(request, "Failed to generate preview. Check your template syntax.", level='error')
    
    preview_template.short_description = "Preview selected template as PDF"
    
    fieldsets = (
        (None, {
            'fields': ('tenant', 'name', 'description', 'template_type', 'is_active')
        }),
        ('Template Content', {
            'fields': ('content',),
            'description': '''
                <div style="background: #f0f9ff; padding: 15px; border-left: 4px solid #3b82f6; margin: 10px 0;">
                    <h4 style="margin-top: 0;">Available Template Variables:</h4>
                    <ul style="margin-bottom: 0;">
                        <li><code>{{ application }}</code> - Loan application object</li>
                        <li><code>{{ borrower }}</code> - Borrower details</li>
                        <li><code>{{ product }}</code> - Loan product details</li>
                        <li><code>{{ tenant }}</code> - Tenant object</li>
                        <li><code>{{ tenant_settings }}</code> - Tenant branding and settings</li>
                        <li><code>{{ today }}</code> - Current date</li>
                        <li><code>{{ deductions }}</code> - List of deductions</li>
                        <li><code>{{ total_deductions }}</code> - Sum of all deductions</li>
                        <li><code>{{ net_disbursement }}</code> - Amount after deductions</li>
                        <li><code>{{ total_repayable }}</code> - Principal + interest</li>
                        <li><code>{{ installment_amount }}</code> - Per-period payment</li>
                        <li><code>{{ payment_frequency }}</code> - Monthly/Weekly/Daily</li>
                        <li><code>{{ first_payment_date }}</code> - First payment due date</li>
                        <li><code>{{ final_payment_date }}</code> - Last payment due date</li>
                    </ul>
                    <p style="margin-top: 10px; margin-bottom: 0;"><strong>Note:</strong> Use Django template syntax for logic and formatting.</p>
                </div>
            '''
        }),
    )

