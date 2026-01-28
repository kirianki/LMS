from django.contrib import admin
from django_tenants.admin import TenantAdminMixin
from .models import Tenant, Domain, Module, Subscription, TenantModule, TenantSettings
from simple_history.admin import SimpleHistoryAdmin

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
