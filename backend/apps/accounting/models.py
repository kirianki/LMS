from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator
from simple_history.models import HistoricalRecords
from decimal import Decimal
import uuid


class ChartOfAccount(models.Model):
    """Professional Chart of Accounts (COA)."""
    
    class AccountType(models.TextChoices):
        ASSET = 'asset', 'Asset'
        LIABILITY = 'liability', 'Liability'
        EQUITY = 'equity', 'Equity'
        INCOME = 'income', 'Income'
        EXPENSE = 'expense', 'Expense'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey('accounts.Organization', on_delete=models.CASCADE, related_name='chart_of_accounts', null=True, blank=True)
    code = models.CharField(max_length=20, help_text="Accounting code (e.g., 1000, 2000)")
    name = models.CharField(max_length=100)
    account_type = models.CharField(max_length=20, choices=AccountType.choices)
    
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='children')
    description = models.TextField(blank=True)
    
    balance = models.DecimalField(max_digits=16, decimal_places=2, default=Decimal('0.00'))
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()
    
    def __str__(self):
        return f"{self.code} - {self.name}"
    
    class Meta:
        ordering = ['code']
        unique_together = ('organization', 'code')


class JournalEntry(models.Model):
    """Groups a set of ledger entries that must balance."""
    
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        POSTED = 'posted', 'Posted'
        VOID = 'void', 'Voided'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey('accounts.Organization', on_delete=models.CASCADE, related_name='journal_entries', null=True, blank=True)
    date = models.DateField()
    description = models.TextField()
    reference = models.CharField(max_length=100, blank=True)
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    branch = models.ForeignKey('branches.Branch', on_delete=models.SET_NULL, null=True, blank=True, related_name='journal_entries')
    
    history = HistoricalRecords()
    
    def is_balanced(self):
        """Check if total debits equal total credits."""
        entries = self.ledger_entries.all()
        debits = sum(e.amount for e in entries if e.entry_type == LedgerEntry.EntryType.DEBIT)
        credits = sum(e.amount for e in entries if e.entry_type == LedgerEntry.EntryType.CREDIT)
        return debits == credits
    
    def __str__(self):
        return f"JE {self.date} - {self.description[:50]}"
    
    class Meta:
        verbose_name_plural = "Journal Entries"
        ordering = ['-date', '-created_at']


class LedgerEntry(models.Model):
    """Individual debit/credit entries in a Journal Entry."""
    
    class EntryType(models.TextChoices):
        DEBIT = 'debit', 'Debit'
        CREDIT = 'credit', 'Credit'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    journal_entry = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name='ledger_entries')
    account = models.ForeignKey(ChartOfAccount, on_delete=models.PROTECT, related_name='ledger_entries')
    
    entry_type = models.CharField(max_length=10, choices=EntryType.choices)
    amount = models.DecimalField(
        max_digits=16, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    
    is_posted = models.BooleanField(default=False)
    
    def save(self, *args, **kwargs):
        # Update account balance if being posted
        if self.journal_entry.status == JournalEntry.Status.POSTED and not self.is_posted:
            self._update_account_balance()
            self.is_posted = True
        super().save(*args, **kwargs)
    
    def _update_account_balance(self):
        """
        Update COA balance based on entry type and account type.
        Normal Balances:
        - Assets & Expenses: Debit increases (+), Credit decreases (-)
        - Liabilities, Equity, Income: Credit increases (+), Debit decreases (-)
        """
        acc = self.account
        acc_type = acc.account_type
        if acc_type in ['asset', 'expense']:
            if self.entry_type == LedgerEntry.EntryType.DEBIT:
                acc.balance += self.amount
            else:
                acc.balance -= self.amount
        else: # Liability, Equity, Income
            if self.entry_type == LedgerEntry.EntryType.CREDIT:
                acc.balance += self.amount
            else:
                acc.balance -= self.amount
        acc.save()

    def delete(self, *args, **kwargs):
        # Reverse account balance if it was posted
        if self.is_posted:
            self._reverse_account_balance()
        super().delete(*args, **kwargs)

    def _reverse_account_balance(self):
        """Reverse the effect of this ledger entry on the COA balance."""
        acc = self.account
        acc_type = acc.account_type
        if acc_type in ['asset', 'expense']:
            if self.entry_type == LedgerEntry.EntryType.DEBIT:
                acc.balance -= self.amount
            else:
                acc.balance += self.amount
        else: # Liability, Equity, Income
            if self.entry_type == LedgerEntry.EntryType.CREDIT:
                acc.balance -= self.amount
            else:
                acc.balance += self.amount
        acc.save()

    def __str__(self):
        return f"{self.get_entry_type_display()} - {self.account.name}: {self.amount}"
    
    class Meta:
        verbose_name_plural = "Ledger Entries"
