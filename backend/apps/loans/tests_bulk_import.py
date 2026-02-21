from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.urls import reverse
from decimal import Decimal
from datetime import date
from django.utils import timezone

from apps.users.models import User
from apps.customers.models import Borrower
from apps.loans.models import LoanProduct, LoanApplication, Loan, RepaymentSchedule
from apps.branches.models import Branch
from apps.accounts.models import Organization

class BulkLoanImportTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        # Setup Organization and Branch
        self.organization = Organization.objects.create(name="Test Org")
        self.branch = Branch.objects.create(
            name="Test Branch", 
            organization=self.organization,
            code="TB001"
        )
        
        # Setup User
        self.user = User.objects.create_superuser(
            email='admin@test.com',
            password='password123',
            first_name='Admin',
            last_name='User'
        )
        self.client.force_authenticate(user=self.user)
        
        # Setup Borrower
        self.borrower = Borrower.objects.create(
            first_name='Bulk',
            last_name='Borrower',
            phone_number='+254700000001',
            borrower_number='BRW-001',
            organization=self.organization,
            branch=self.branch
        )
        
        # Setup Product
        self.product = LoanProduct.objects.create(
            name='Bulk Product',
            code='BP001',
            min_amount=Decimal('1000.00'),
            max_amount=Decimal('100000.00'),
            suggested_interest_rate=Decimal('10.00'),
            interest_type='flat',
            term_unit='months',
            organization=self.organization
        )

    def test_bulk_import_success(self):
        """Test successful bulk import of loans."""
        url = reverse('bulk-import')
        
        data = [
            {
                "borrower_number": "BRW-001",
                "product_code": "BP001",
                "amount": "50000.00",
                "term": 12,
                "disbursement_date": str(date.today()),
                "interest_rate": "12.00",
                "repayment_frequency": "monthly"
            },
            {
                "borrower_number": "BRW-001",
                "product_code": "BP001",
                "amount": "20000.00",
                "term": 6,
                "disbursement_date": "2023-01-01"
            }
        ]
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['created_count'], 2)
        self.assertEqual(len(response.data['errors']), 0)
        
        # Verify Loans Created
        self.assertEqual(Loan.objects.count(), 2)
        self.assertEqual(LoanApplication.objects.count(), 2)
        
        # Verify specific loan details
        loan1 = Loan.objects.filter(principal_amount=Decimal('50000.00')).first()
        self.assertIsNotNone(loan1)
        self.assertEqual(loan1.interest_rate, Decimal('12.00')) # Overridden rate
        self.assertEqual(loan1.term, 12)
        
        loan2 = Loan.objects.filter(principal_amount=Decimal('20000.00')).first()
        self.assertIsNotNone(loan2)
        self.assertEqual(loan2.interest_rate, Decimal('10.00')) # Default rate
        self.assertEqual(str(loan2.disbursement_date), "2023-01-01")
        
        # Verify Schedule
        self.assertTrue(RepaymentSchedule.objects.filter(loan=loan1).exists())
        self.assertTrue(RepaymentSchedule.objects.filter(loan=loan2).exists())

    def test_bulk_import_validation_error(self):
        """Test validation error (e.g. invalid borrower)."""
        url = reverse('bulk-import')
        
        data = [
            {
                "borrower_number": "INVALID-BRW",
                "product_code": "BP001",
                "amount": "50000.00",
                "term": 12,
                "disbursement_date": str(date.today())
            }
        ]
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_bulk_import_partial_failure(self):
        """Test partial failure handling (atomic transaction shoud rollback specific item or all?).
           Current implementation does ALL entries in ONE atomic block per user request? 
           Wait, implementation has `with transaction.atomic(): for index, item ...`.
           If one fails, the WHOLE transaction rolls back and it raises exception.
        """
        url = reverse('bulk-import')
        
        data = [
            {
                "borrower_number": "BRW-001",
                "product_code": "BP001",
                "amount": "50000.00",
                "term": 12,
                "disbursement_date": str(date.today())
            },
            {
                "borrower_number": "BRW-001",
                "product_code": "INVALID-PRODUCT", # This should fail
                "amount": "20000.00",
                "term": 6,
                "disbursement_date": str(date.today())
            }
        ]
        
        # The serializer validation runs BEFORE the loop.
        # So "INVALID-PRODUCT" will be caught by `serializer.is_valid()`.
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
        # Verify NO loans created
        self.assertEqual(Loan.objects.count(), 0)
