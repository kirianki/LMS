from django.test import TestCase
from django_tenants.test.cases import TenantTestCase
from django.utils import timezone
from decimal import Decimal
from django.contrib.auth import get_user_model
from .models import ChartOfAccount, JournalEntry, LedgerEntry
from .utils import seed_standard_coa
from .services import create_double_entry
from .reports import generate_trial_balance, generate_profit_loss

User = get_user_model()

class AccountingTestCase(TenantTestCase):
    def setUp(self):
        self.user = User.objects.create_user(email='testadmin@example.com', password='password', is_staff=True)
        seed_standard_coa()
        
    def test_seed_coa(self):
        """Test that COA is seeded correctly."""
        self.assertTrue(ChartOfAccount.objects.filter(code='1000').exists())
        self.assertTrue(ChartOfAccount.objects.filter(code='5000').exists())

    def test_double_entry_logic(self):
        """Test that debits and credits update balances correctly."""
        # 1110 is Cash at Bank (Asset), 4100 is Interest Income (Income)
        bank_acc = ChartOfAccount.objects.get(code='1110')
        income_acc = ChartOfAccount.objects.get(code='4100')
        
        initial_bank = bank_acc.balance
        initial_income = income_acc.balance
        
        amount = Decimal('1000.00')
        
        create_double_entry(
            date=timezone.now().date(),
            description="Test Income",
            reference="REF-001",
            debits=[('1110', amount)],
            credits=[('4100', amount)],
            created_by=self.user
        )
        
        bank_acc.refresh_from_db()
        income_acc.refresh_from_db()
        
        # Asset increases with Debit
        self.assertEqual(bank_acc.balance, initial_bank + amount)
        # Income increases with Credit
        self.assertEqual(income_acc.balance, initial_income + amount)

    def test_unbalanced_entry_fails(self):
        """Test that unbalanced entries raise an error."""
        with self.assertRaises(ValueError):
            create_double_entry(
                date=timezone.now().date(),
                description="Unbalanced",
                reference="REF-FAIL",
                debits=[('1110', Decimal('100.00'))],
                credits=[('4100', Decimal('50.00'))]
            )

    def test_journal_entry_balance_check(self):
        """Test the is_balanced method on JournalEntry."""
        je = JournalEntry.objects.create(
            date=timezone.now().date(),
            description="Check Balance"
        )
        acc = ChartOfAccount.objects.get(code='1110')
        
        LedgerEntry.objects.create(journal_entry=je, account=acc, entry_type='debit', amount=Decimal('100.00'))
        self.assertFalse(je.is_balanced())
        
        LedgerEntry.objects.create(journal_entry=je, account=acc, entry_type='credit', amount=Decimal('100.00'))
        self.assertTrue(je.is_balanced())

    def test_reporting_services(self):
        """Test the generation of financial reports."""
        # Record some income
        create_double_entry(
            date=timezone.now().date(),
            description="Fee Income",
            reference="FEE-01",
            debits=[('1110', Decimal('50.00'))], # Cash
            credits=[('4200', Decimal('50.00'))], # Fee Income
        )
        
        # Trial Balance
        tb = generate_trial_balance()
        self.assertTrue(tb['is_balanced'])
        self.assertEqual(tb['total_debit'], Decimal('50.00'))
        
        # P&L
        pl = generate_profit_loss(timezone.now().date(), timezone.now().date())
        self.assertEqual(pl['income']['total'], Decimal('50.00'))
        self.assertEqual(pl['net_profit'], Decimal('50.00'))
