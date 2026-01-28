from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin
from .models import Investor, Investment, InvestorPayout


class InvestmentInline(admin.TabularInline):
    model = Investment
    extra = 0
    readonly_fields = ('investment_number', 'total_expected_return', 'total_paid_out')


@admin.register(Investor)
class InvestorAdmin(SimpleHistoryAdmin):
    list_display = ('investor_number', 'name', 'investor_type', 'phone', 'is_active')
    list_filter = ('investor_type', 'is_active')
    search_fields = ('name', 'investor_number', 'phone', 'email')
    inlines = [InvestmentInline]


class InvestorPayoutInline(admin.TabularInline):
    model = InvestorPayout
    extra = 1


@admin.register(Investment)
class InvestmentAdmin(SimpleHistoryAdmin):
    list_display = ('investment_number', 'investor', 'principal_amount', 'status', 'maturity_date')
    list_filter = ('status', 'investment_date', 'maturity_date')
    search_fields = ('investment_number', 'investor__name')
    readonly_fields = ('investment_number', 'total_expected_return', 'total_paid_out')
    inlines = [InvestorPayoutInline]


@admin.register(InvestorPayout)
class InvestorPayoutAdmin(SimpleHistoryAdmin):
    list_display = ('payout_date', 'investment', 'payout_type', 'amount', 'reference')
    list_filter = ('payout_type', 'payment_method')
    search_fields = ('reference', 'notes', 'investment__investment_number')
    date_hierarchy = 'payout_date'
