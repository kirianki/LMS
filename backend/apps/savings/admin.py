from django.contrib import admin
from .models import SavingsProduct, SavingsAccount, SavingsTransaction
from simple_history.admin import SimpleHistoryAdmin

@admin.register(SavingsProduct)
class SavingsProductAdmin(SimpleHistoryAdmin):
    list_display = ('name', 'code', 'interest_rate', 'minimum_balance', 'is_active')
    search_fields = ('name', 'code')

@admin.register(SavingsAccount)
class SavingsAccountAdmin(SimpleHistoryAdmin):
    list_display = ('account_number', 'borrower', 'product', 'current_balance', 'status')
    list_filter = ('status', 'product')
    search_fields = ('account_number', 'customer__first_name', 'customer__last_name')
    readonly_fields = ('account_number', 'current_balance', 'accrued_interest')

@admin.register(SavingsTransaction)
class SavingsTransactionAdmin(SimpleHistoryAdmin):
    list_display = ('account', 'transaction_type', 'amount', 'balance_after', 'transaction_date')
    list_filter = ('transaction_type', 'transaction_date')
    search_fields = ('account__account_number', 'reference')
    readonly_fields = ('balance_after', 'transaction_date')
