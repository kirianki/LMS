from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin
from .models import CashAccount, Transaction, DailySnapshot


@admin.register(CashAccount)
class CashAccountAdmin(SimpleHistoryAdmin):
    list_display = ('name', 'account_type', 'current_balance', 'is_active')
    list_filter = ('account_type', 'is_active')
    search_fields = ('name', 'account_number', 'bank_name')
    readonly_fields = ('current_balance',)


@admin.register(Transaction)
class TransactionAdmin(SimpleHistoryAdmin):
    list_display = ('created_at', 'account', 'transaction_type', 'category', 'amount', 'reference')
    list_filter = ('transaction_type', 'category', 'account')
    search_fields = ('description', 'reference')
    readonly_fields = ('balance_after', 'created_by', 'created_at')
    date_hierarchy = 'created_at'


@admin.register(DailySnapshot)
class DailySnapshotAdmin(admin.ModelAdmin):
    list_display = ('date', 'total_cash', 'total_disbursed', 'total_received', 'outstanding_principal')
    date_hierarchy = 'date'
