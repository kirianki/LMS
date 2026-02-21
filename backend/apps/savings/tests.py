from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.urls import reverse
from decimal import Decimal
from datetime import date
from django.utils import timezone

from apps.users.models import User
from apps.customers.models import Customer
from apps.accounting.models import ChartOfAccount, JournalEntry, LedgerEntry
from .models import SavingsProduct, SavingsAccount, SavingsTransaction

class SavingsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        self.user = User.objects.create_user(
            email='savings-test@system.com',
            password='password123',
            first_name='Savings',
            last_name='Officer'
        )
        self.client.force_authenticate(user=self.user)
        self._setup_coa()
        
        # Create customer
        self.customer = Customer.objects.create(
            first_name='Alice',
            last_name='Saver',
            id_number='SAV001',
            phone_number='+254700000001',
            email='alice@example.com',
            date_of_birth='1995-01-01'
        )
        
        # Create product
        self.product = SavingsProduct.objects.create(
            name='Regular Savings',
            code='RS001',
            interest_rate=Decimal('5.00'),
            minimum_balance=Decimal('500.00'),
        )

    def _setup_coa(self):
        """Setup required Chart of Accounts."""
        coa_data = [
            ('1110', 'Bank', 'asset'),
            ('1130', 'Mpesa', 'asset'),
            ('2110', 'Savings Deposits', 'liability'),
            ('5200', 'Savings Interest Expense', 'expense'),
        ]
        for code, name, acc_type in coa_data:
            ChartOfAccount.objects.get_or_create(code=code, defaults={'name': name, 'account_type': acc_type})

    def test_create_savings_account(self):
        """Test creating a savings account."""
        url = reverse('savingsaccount-list')
        data = {
            "customer": str(self.customer.id),
            "product": str(self.product.id),
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(SavingsAccount.objects.count(), 1)
        account = SavingsAccount.objects.first()
        self.assertTrue(account.account_number.startswith('SAV'))
        self.assertEqual(account.status, 'active')

    def test_deposit_and_accounting(self):
        """Test deposit transaction and its GL entries."""
        account = SavingsAccount.objects.create(customer=self.customer, product=self.product)
        
        url = reverse('savingsaccount-deposit', args=[account.id])
        data = {
            "amount": "2000.00",
            "reference": "DEP123",
            "description": "Initial deposit"
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        account.refresh_from_db()
        self.assertEqual(account.current_balance, Decimal('2000.00'))
        
        # Verify GL Entry
        journal = JournalEntry.objects.filter(reference="DEP123").first()
        self.assertIsNotNone(journal)
        
        # Debit Bank (1110), Credit Savings (2110)
        self.assertTrue(LedgerEntry.objects.filter(journal_entry=journal, account__code='1110', entry_type='debit', amount=2000).exists())
        self.assertTrue(LedgerEntry.objects.filter(journal_entry=journal, account__code='2110', entry_type='credit', amount=2000).exists())

    def test_withdrawal_insufficient_funds(self):
        """Test withdrawal fails if below minimum balance."""
        account = SavingsAccount.objects.create(customer=self.customer, product=self.product, current_balance=Decimal('1000.00'))
        
        url = reverse('savingsaccount-withdraw', args=[account.id])
        data = {
            "amount": "600.00", # Left with 400 < 500 (min balance)
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Insufficient funds", response.data['error'])

    def test_interest_accrual_and_posting(self):
        """Test daily interest accrual and posting."""
        from .services import calculate_daily_interest
        
        account = SavingsAccount.objects.create(customer=self.customer, product=self.product, current_balance=Decimal('10000.00'))
        
        # 1. Accrue Daily Interest
        # Rate is 5% annual. Daily = 0.05 / 365.
        # Interest on 10,000 = 10,000 * 0.05 / 365 = 1.369...
        calculate_daily_interest()
        account.refresh_from_db()
        self.assertGreater(account.accrued_interest, 0)
        expected_daily = Decimal('10000.00') * (Decimal('0.05') / Decimal('365'))
        self.assertAlmostEqual(float(account.accrued_interest), float(expected_daily), places=4)
        
        # 2. Post Interest
        url = reverse('savingsaccount-post-interest', args=[account.id])
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        account.refresh_from_db()
        self.assertEqual(account.accrued_interest, 0)
        # Account balance is rounded to 2 places
        self.assertAlmostEqual(float(account.current_balance), float(Decimal('10000.00') + expected_daily), places=2)
        
        # Verify GL Entry (Debit Expense 5200, Credit Liability 2110)
        txn = SavingsTransaction.objects.filter(transaction_type='interest').first()
        journal = JournalEntry.objects.filter(description__contains=account.account_number).last()
        self.assertTrue(LedgerEntry.objects.filter(journal_entry=journal, account__code='5200', entry_type='debit').exists())
        self.assertTrue(LedgerEntry.objects.filter(journal_entry=journal, account__code='2110', entry_type='credit').exists())
