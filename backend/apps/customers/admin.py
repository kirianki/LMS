from django.contrib import admin
from .models import Borrower, BorrowerContact
from simple_history.admin import SimpleHistoryAdmin

class BorrowerContactInline(admin.TabularInline):
    model = BorrowerContact
    extra = 1

@admin.register(Borrower)
class BorrowerAdmin(SimpleHistoryAdmin):
    list_display = ('get_name', 'borrower_number', 'borrower_type', 'phone_number', 'is_verified', 'created_at')
    list_filter = ('borrower_type', 'is_verified', 'id_type', 'employment_status')
    search_fields = ('first_name', 'last_name', 'business_name', 'borrower_number', 'id_number', 'phone_number', 'email')
    readonly_fields = ('verified_by', 'verified_at', 'created_at', 'updated_at', 'borrower_number')
    inlines = [BorrowerContactInline]
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('borrower_type', 'borrower_number')
        }),
        ('Individual Details', {
            'fields': ('first_name', 'last_name', 'date_of_birth'),
            'classes': ('collapse',),
            'description': "Fill only for Individuals"
        }),
        ('Entity Details', {
            'fields': ('business_name', 'incorporation_date', 'tax_id'),
            'classes': ('collapse',),
            'description': "Fill only for Companies/Institutions"
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
        ('Financials', {
            'fields': ('employment_status', 'monthly_income')
        }),
        ('Verification Status', {
            'fields': ('is_verified', 'verification_status', 'verified_by', 'verified_at', 'verification_notes')
        }),
        ('Audit', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def get_name(self, obj):
        return obj.business_name if obj.borrower_type in [Borrower.BorrowerType.COMPANY, Borrower.BorrowerType.INSTITUTION] else f"{obj.first_name} {obj.last_name}"
    get_name.short_description = 'Name'
    
    # Note: education_level/marital_status were not in model but I put them in fieldsets above, I must remove them if they don't exist.
    # Checking previous file content, they were NOT there. I will remove them from content below.

