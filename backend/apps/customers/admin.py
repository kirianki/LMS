from django.contrib import admin
from .models import Customer
from simple_history.admin import SimpleHistoryAdmin

@admin.register(Customer)
class CustomerAdmin(SimpleHistoryAdmin):
    list_display = ('first_name', 'last_name', 'id_number', 'phone_number', 'is_verified', 'created_at')
    list_filter = ('is_verified', 'id_type', 'employment_status')
    search_fields = ('first_name', 'last_name', 'id_number', 'phone_number', 'email')
    readonly_fields = ('verified_by', 'verified_at', 'created_at', 'updated_at')
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('first_name', 'last_name', 'date_of_birth')
        }),
        ('Address Information', {
            'fields': ('physical_address', 'city', 'county', 'postal_code', 'country')
        }),
        ('Contact Information', {
            'fields': ('phone_number', 'email')
        }),
        ('Identification', {
            'fields': ('id_type', 'id_number', 'id_document')
        }),
        ('Employment & Income', {
            'fields': ('employment_status', 'monthly_income')
        }),
        ('Verification Status', {
            'fields': ('is_verified', 'verified_by', 'verified_at')
        }),
        ('Audit', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
