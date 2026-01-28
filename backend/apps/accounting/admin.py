from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin
from .models import ChartOfAccount, JournalEntry, LedgerEntry


class LedgerEntryInline(admin.TabularInline):
    model = LedgerEntry
    extra = 2
    autocomplete_fields = ['account']


@admin.register(ChartOfAccount)
class ChartOfAccountAdmin(SimpleHistoryAdmin):
    list_display = ('code', 'name', 'account_type', 'balance', 'is_active')
    list_filter = ('account_type', 'is_active')
    search_fields = ('code', 'name')
    readonly_fields = ('balance',)


@admin.register(JournalEntry)
class JournalEntryAdmin(SimpleHistoryAdmin):
    list_display = ('date', 'description', 'reference', 'status', 'is_balanced_display')
    list_filter = ('status', 'date')
    search_fields = ('description', 'reference')
    inlines = [LedgerEntryInline]
    
    def is_balanced_display(self, obj):
        return obj.is_balanced()
    is_balanced_display.boolean = True
    is_balanced_display.short_description = "Balanced"


@admin.register(LedgerEntry)
class LedgerEntryAdmin(admin.ModelAdmin):
    list_display = ('journal_entry', 'account', 'entry_type', 'amount', 'is_posted')
    list_filter = ('entry_type', 'is_posted', 'account')
    search_fields = ('journal_entry__description', 'account__name')
