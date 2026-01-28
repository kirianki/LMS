from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin
from .models import Collateral, Valuer, ValuationRequest, EmailConfiguration, ValuationReport

@admin.register(Valuer)
class ValuerAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'phone', 'is_active')
    search_fields = ('name', 'email')

@admin.register(ValuationRequest)
class ValuationRequestAdmin(admin.ModelAdmin):
    list_display = ('collateral', 'valuer', 'status', 'created_at')
    list_filter = ('status',)

@admin.register(EmailConfiguration)
class EmailConfigurationAdmin(admin.ModelAdmin):
    list_display = ('from_email', 'smtp_host', 'smtp_port')

@admin.register(ValuationReport)
class ValuationReportAdmin(SimpleHistoryAdmin):
    list_display = ('collateral', 'valuer_company', 'market_value', 'forced_sale_value', 'created_at')

@admin.register(Collateral)
class CollateralAdmin(SimpleHistoryAdmin):
    list_display = ('customer', 'collateral_type', 'status', 'market_value', 'forced_sale_value', 'created_at')
    list_filter = ('collateral_type', 'status', 'valuation_date')
    search_fields = ('customer__first_name', 'customer__last_name', 'reg_number', 'lr_number', 'logbook_number')
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('Owner', {
            'fields': ('customer', 'status')
        }),
        ('General Info', {
            'fields': ('collateral_type', 'description', 'document_upload')
        }),
        ('Valuation', {
            'fields': ('market_value', 'forced_sale_value', 'valuation_date', 'valuer_name')
        }),
        ('Motor Vehicle Details', {
            'classes': ('collapse',),
            'fields': ('make', 'model', 'body_type', 'reg_number', 'chassis_number', 'engine_number', 'year_of_manufacture', 'logbook_number')
        }),
        ('Land / Property Details', {
            'classes': ('collapse',),
            'fields': ('lr_number', 'location', 'property_size', 'tenure_type')
        }),
        ('Business Details', {
            'classes': ('collapse',),
            'fields': ('business_name', 'registration_number')
        }),
        ('System Info', {
            'fields': ('created_at', 'updated_at')
        }),
    )
