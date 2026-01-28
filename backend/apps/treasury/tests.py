from django.test import TestCase
from django_tenants.test.cases import TenantTestCase
from django.utils import timezone
from decimal import Decimal
from django.contrib.auth import get_user_model
from .models import CashAccount, Transaction
from apps.loans.models import Loan, LoanProduct, LoanApplication
from apps.customers.models import Customer
from apps.accounting.utils import seed_standard_coa
from apps.accounting.models import ChartOfAccount, JournalEntry
from .services.integrity import record_money_event

User = get_user_model()

class TreasuryTestCase(TenantTestCase):
    def setUp(self):
        seed_standard_coa()
        self.user = User.objects.create_user(email='treasuryuser@example.com', password='password')
        self.customer = Customer.objects.create(
            first_name="Test", last_name="Customer", email="test@example.com", 
            phone_number="0712345678", id_number="ID12345", date_of_birth="1990-01-01"
        )
        self.product = LoanProduct.objects.create(
            name="Test Product", code="TP01",
            min_amount=1000, max_amount=100000,
            interest_rate=10, min_term=1, max_term=12
        )
        self.account = CashAccount.objects.create(
            name="Test Bank", account_type=CashAccount.AccountType.BANK, current_balance=Decimal('50000.00')
        )

    def test_transaction_updates_balance(self):
        """Test that treasury transactions update account balance."""
        initial_balance = self.account.current_balance
        amount = Decimal('5000.00')
        
        Transaction.objects.create(
            account=self.account,
            transaction_type=Transaction.TransactionType.CREDIT,
            category=Transaction.Category.OTHER,
            amount=amount,
            description="Test Inflow"
        )
        
        self.account.refresh_from_db()
        self.assertEqual(self.account.current_balance, initial_balance + amount)
        
        # Debit (Outflow)
        Transaction.objects.create(
            account=self.account,
            transaction_type=Transaction.TransactionType.DEBIT,
            category=Transaction.Category.EXPENSE,
            amount=Decimal('2000.00'),
            description="Test Outflow"
        )
        
        self.account.refresh_from_db()
        self.assertEqual(self.account.current_balance, initial_balance + amount - Decimal('2000.00'))

    def test_transaction_history_tracking(self):
        """Test simple historical record for account balance."""
        Transaction.objects.create(
            account=self.account,
            transaction_type=Transaction.TransactionType.CREDIT,
            amount=Decimal('100.00'),
            description="T1"
        )
        self.assertGreaterEqual(self.account.history.count(), 1)

    def test_integrity_service_disbursement(self):
        """Test that record_money_event updates both Treasury and GL."""
        # Create a LoanApplication first
        app = LoanApplication.objects.create(
            customer=self.customer,
            product=self.product,
            requested_amount=Decimal('10000.00'),
            requested_term=12,
            status=LoanApplication.Status.APPROVED
        )
        # Create a Loan
        loan = Loan.objects.create(
            application=app,
            customer=self.customer,
            product=self.product,
            principal_amount=Decimal('10000.00'),
            total_interest=Decimal('1200.00'),
            disbursed_amount=Decimal('10000.00'),
            disbursement_date=timezone.now().date(),
            term=12,
            maturity_date=timezone.now().date(), # Simplified
            outstanding_balance=Decimal('11200.00'),
            outstanding_principal=Decimal('10000.00'),
            outstanding_interest=Decimal('1200.00'),
            loan_number="LN-INT-01",
            status='active'
        )
        
        # Manually trigger (in signals it's auto)
        record_money_event('loan_disbursement', loan)
        
        # 1. Check Treasury
        self.assertTrue(Transaction.objects.filter(related_loan=loan, category=Transaction.Category.LOAN_DISBURSEMENT).exists())
        
        # 2. Check GL (Accounting)
        # M-Pesa account code 1130 should have decreased (Credit)
        bank_coa = ChartOfAccount.objects.get(code='1130')
        self.assertEqual(bank_coa.balance, Decimal('-10000.00')) 
        
        # Principal account 1210 should have increased (Debit)
        principal_coa = ChartOfAccount.objects.get(code='1210')
        self.assertEqual(principal_coa.balance, Decimal('10000.00'))
        
        # Journal Entry should exist
        self.assertTrue(JournalEntry.objects.filter(reference=loan.loan_number).exists())
