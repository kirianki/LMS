from django.contrib import admin
from django.http import HttpResponse
from .models import Organization, DocumentTemplate
from simple_history.admin import SimpleHistoryAdmin

@admin.register(Organization)
class OrganizationAdmin(SimpleHistoryAdmin):
    list_display = ('company_name', 'is_ai_enabled', 'is_automation_enabled', 'reminder_enabled', 'mpesa_environment')
    list_filter = ('is_ai_enabled', 'is_automation_enabled', 'reminder_enabled', 'mpesa_environment')
    search_fields = ('company_name',)
    fieldsets = (
        ('General Info', {
            'fields': ('company_name', 'company_tagline', 'website', 'logo', 'primary_color', 'secondary_color')
        }),
        ('Feature Toggles', {
            'fields': ('is_ai_enabled', 'is_automation_enabled', 'is_branches_enabled', 'max_branches_limit', 'max_valuers_limit')
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
        ('Contact Information', {
            'fields': ('company_address', 'company_postal_address', 'company_city', 'company_country', 'company_phone', 'company_email'),
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
        # Pass None or a dummy object since tenant is no longer used in render_document_preview
        pdf_buffer = render_document_preview(template, None)
        
        if pdf_buffer:
            response = HttpResponse(pdf_buffer, content_type='application/pdf')
            response['Content-Disposition'] = f'inline; filename="preview_{template.name}.pdf"'
            return response
        else:
            self.message_user(request, "Failed to generate preview. Check your template syntax.", level='error')
    
    preview_template.short_description = "Preview selected template as PDF"
    
    fieldsets = (
        (None, {
            'fields': ('name', 'description', 'template_type', 'is_active')
        }),
        ('Template Content', {
            'fields': ('content',),
        }),
    )
