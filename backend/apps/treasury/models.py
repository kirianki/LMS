from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator
from simple_history.models import HistoricalRecords
from decimal import Decimal
import uuid


class CashAccount(models.Model):
    """Cash accounts for the institution."""
    
    class AccountType(models.TextChoices):
        CASH = 'cash', 'Petty Cash'
        BANK = 'bank', 'Bank Account'
        MOBILE_MONEY = 'mobile_money', 'Mobile Money'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey('accounts.Organization', on_delete=models.CASCADE, related_name='cash_accounts', null=True, blank=True)
    name = models.CharField(max_length=100)
    account_type = models.CharField(max_length=20, choices=AccountType.choices)
    account_number = models.CharField(max_length=50, blank=True)
    bank_name = models.CharField(max_length=100, blank=True)
    
    opening_balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    current_balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    
    is_active = models.BooleanField(default=True)
    coa_account = models.ForeignKey(
        'accounting.ChartOfAccount', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='cash_accounts',
        help_text="Link to the Chart of Accounts ledger"
    )
    branch = models.ForeignKey(
        'branches.Branch',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cash_accounts'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    history = HistoricalRecords()
    
    def __str__(self):
        return f"{self.name} ({self.get_account_type_display()})"
    
    class Meta:
        ordering = ['name']

    def save(self, *args, **kwargs):
        if not self.id or not CashAccount.objects.filter(pk=self.id).exists():
            self.current_balance = self.opening_balance
        super().save(*args, **kwargs)


class Transaction(models.Model):
    """Financial transaction log."""
    
    class TransactionType(models.TextChoices):
        CREDIT = 'credit', 'Credit (Money In)'
        DEBIT = 'debit', 'Debit (Money Out)'
    
    class Category(models.TextChoices):
        LOAN_DISBURSEMENT = 'loan_disbursement', 'Loan Disbursement'
        LOAN_REPAYMENT = 'loan_repayment', 'Loan Repayment'
        INVESTMENT_RECEIVED = 'investment_received', 'Investment Received'
        INVESTOR_PAYOUT = 'investor_payout', 'Investor Payout'
        EXPENSE = 'expense', 'Expense'
        PAYROLL = 'payroll', 'Payroll'
        TRANSFER = 'transfer', 'Account Transfer'
        INTEREST_INCOME = 'interest_income', 'Interest Income'
        FEE_INCOME = 'fee_income', 'Fee Income'
        OTHER = 'other', 'Other'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        'accounts.Organization', 
        on_delete=models.CASCADE, 
        related_name='treasury_transactions', 
        null=True, 
        blank=True
    )
    account = models.ForeignKey(CashAccount, on_delete=models.PROTECT, related_name='transactions')
    
    transaction_type = models.CharField(max_length=10, choices=TransactionType.choices)
    category = models.CharField(max_length=30, choices=Category.choices)
    
    amount = models.DecimalField(
        max_digits=14, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    description = models.TextField()
    reference = models.CharField(max_length=100, blank=True)
    
    # Optional links to related records
    related_loan = models.ForeignKey(
        'loans.Loan', on_delete=models.SET_NULL, null=True, blank=True, related_name='treasury_transactions'
    )
    related_investment = models.ForeignKey(
        'investors.Investment', on_delete=models.SET_NULL, null=True, blank=True, related_name='treasury_transactions'
    )
    related_expense = models.ForeignKey(
        'expenses.Expense', on_delete=models.SET_NULL, null=True, blank=True, related_name='treasury_transactions'
    )
    counterparty_coa = models.ForeignKey(
        'accounting.ChartOfAccount',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='treasury_transactions',
        help_text="The opposite side of the transaction for manual records"
    )

    
    balance_after = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    history = HistoricalRecords()
    
    def save(self, *args, **kwargs):
        # Automatically assign organization from account if not set
        if not self.organization and self.account:
            self.organization = self.account.organization
            
        # Update account balance for new transactions only
        # Note: We use _state.adding because UUID PKs are assigned before save()
        if self._state.adding:  # New transaction
            if self.transaction_type == self.TransactionType.CREDIT:
                self.account.current_balance += self.amount
            else:
                self.account.current_balance -= self.amount
            self.balance_after = self.account.current_balance
            self.account.save()
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.get_transaction_type_display()} - {self.amount} ({self.get_category_display()})"
    
    class Meta:
        ordering = ['-created_at']


class DailySnapshot(models.Model):
    """Daily financial snapshot for reporting."""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey('accounts.Organization', on_delete=models.CASCADE, related_name='daily_snapshots', null=True, blank=True)
    date = models.DateField()
    
    total_cash = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    total_disbursed = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    total_received = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    
    outstanding_principal = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    outstanding_interest = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    expected_collections_30d = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    
    total_investments = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    total_investor_payouts = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    
    total_expenses = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-date']
        unique_together = ('organization', 'date')
    
    def __str__(self):
        return f"Snapshot {self.date}"
