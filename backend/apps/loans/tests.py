from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.urls import reverse
from decimal import Decimal
from datetime import date

from apps.users.models import User
from apps.tenants.models import Domain
from apps.customers.models import Customer
from apps.accounting.models import ChartOfAccount
from .models import LoanProduct, LoanApplication, Loan, RepaymentSchedule


class LoanProductTests(TenantTestCase):
    def setUp(self):
        super().setUp()
        self.client = APIClient()
        
        if not Domain.objects.filter(tenant=self.tenant).exists():
            Domain.objects.create(domain='test.localhost', tenant=self.tenant, is_primary=True)
        
        self.client.defaults['HTTP_HOST'] = self.tenant.domains.first().domain
        
        self.user = User.objects.create_user(
            email='loans-test@tenant.com',
            password='password123',
            first_name='Test',
            last_name='Officer'
        )
        self.client.force_authenticate(user=self.user)
        self._setup_coa()

    def _setup_coa(self):
        """Setup required Chart of Accounts for testing disbursements/repayments."""
        coa_data = [
            ('1110', 'Default Bank', 'asset'),
            ('1130', 'Mpesa Account', 'asset'),
            ('1210', 'Loan Portfolio', 'asset'),
            ('4100', 'Interest Income', 'income'),
            ('4200', 'Fee Income', 'income'),
            ('4300', 'Penalty Income', 'income'),
        ]
        for code, name, acc_type in coa_data:
            ChartOfAccount.objects.get_or_create(
                code=code,
                defaults={'name': name, 'account_type': acc_type}
            )
    
    def test_create_loan_product(self):
        """Test creating a loan product."""
        url = reverse('loanproduct-list')
        data = {
            "name": "Personal Loan",
            "code": "PL001",
            "min_amount": "10000.00",
            "max_amount": "500000.00",
            "interest_rate": "18.00",
            "interest_type": "reducing_balance",
            "term_unit": "months",
            "min_term": 3,
            "max_term": 24,
            "penalty_rate": "1.00",
            "grace_period_days": 3,
            "processing_fee_type": "percentage",
            "processing_fee_value": "2.00"
        }
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(LoanProduct.objects.count(), 1)
        self.assertEqual(LoanProduct.objects.first().name, "Personal Loan")


class LoanApplicationLifecycleTests(TenantTestCase):
    def setUp(self):
        super().setUp()
        self.client = APIClient()
        
        if not Domain.objects.filter(tenant=self.tenant).exists():
            Domain.objects.create(domain='test.localhost', tenant=self.tenant, is_primary=True)
        
        self.client.defaults['HTTP_HOST'] = self.tenant.domains.first().domain
        
        self.user = User.objects.create_user(
            email='loan-officer@tenant.com',
            password='password123',
            first_name='Loan',
            last_name='Officer'
        )
        self.client.force_authenticate(user=self.user)
        self._setup_coa()

    def _setup_coa(self):
        """Setup required Chart of Accounts."""
        coa_data = [
            ('1110', 'Bank', 'asset'),
            ('1130', 'Mpesa', 'asset'),
            ('1210', 'Portfolio', 'asset'),
            ('4100', 'Interest', 'income'),
            ('4200', 'Fees', 'income'),
            ('4300', 'Penalty', 'income'),
        ]
        for code, name, acc_type in coa_data:
            ChartOfAccount.objects.get_or_create(code=code, defaults={'name': name, 'account_type': acc_type})
        
        # Create customer
        self.customer = Customer.objects.create(
            first_name='John',
            last_name='Borrower',
            id_number='12345678',
            phone_number='+254700111222',
            email='john@example.com',
            date_of_birth='1990-01-01',
            address='123 Test Street, Nairobi'
        )
        
        # Create product
        self.product = LoanProduct.objects.create(
            name='Quick Loan',
            code='QL001',
            min_amount=Decimal('5000.00'),
            max_amount=Decimal('100000.00'),
            interest_rate=Decimal('24.00'),
            interest_type='flat',
            term_unit='months',
            min_term=1,
            max_term=12,
            penalty_rate=Decimal('1.00'),
            grace_period_days=3,
            processing_fee_type='percentage',
            processing_fee_value=Decimal('3.00')
        )
    
    def test_full_loan_lifecycle(self):
        """Test complete loan lifecycle: Create → Submit → Approve → Disburse."""
        # 1. Create Application
        url = reverse('loanapplication-list')
        data = {
            "customer": str(self.customer.id),
            "product": str(self.product.id),
            "requested_amount": "50000.00",
            "requested_term": 6,
            "purpose": "Business expansion"
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        application_id = response.data['id']
        self.assertEqual(response.data['status'], 'draft')
        
        # 2. Submit Application
        url = reverse('loanapplication-submit', args=[application_id])
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify status changed
        application = LoanApplication.objects.get(id=application_id)
        self.assertEqual(application.status, 'submitted')
        
        # 3. Approve Application
        url = reverse('loanapplication-approve', args=[application_id])
        data = {
            "approved_amount": "50000.00",
            "approved_term": 6
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('calculated_interest', response.data)
        
        application.refresh_from_db()
        self.assertEqual(application.status, 'approved')
        self.assertEqual(application.approved_by, self.user)
        
        # 4. Disburse Loan
        url = reverse('loanapplication-disburse', args=[application_id])
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('loan_number', response.data)
        
        # Verify Loan created
        application.refresh_from_db()
        self.assertEqual(application.status, 'disbursed')
        
        loan = Loan.objects.get(application=application)
        self.assertEqual(loan.status, 'active')
        self.assertEqual(loan.customer, self.customer)
        
        # Verify schedule generated
        schedules = RepaymentSchedule.objects.filter(loan=loan)
        self.assertEqual(schedules.count(), 6)  # 6 months
    
    def test_reject_application(self):
        """Test rejecting a loan application."""
        # Create and submit application
        application = LoanApplication.objects.create(
            customer=self.customer,
            product=self.product,
            requested_amount=Decimal('50000.00'),
            requested_term=6,
            status='submitted',
            created_by=self.user
        )
        
        url = reverse('loanapplication-reject', args=[application.id])
        data = {"rejection_reason": "Insufficient credit score"}
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        application.refresh_from_db()
        self.assertEqual(application.status, 'rejected')
        self.assertEqual(application.rejection_reason, "Insufficient credit score")


class LoanRepaymentTests(TenantTestCase):
    def setUp(self):
        super().setUp()
        self.client = APIClient()
        
        if not Domain.objects.filter(tenant=self.tenant).exists():
            Domain.objects.create(domain='test.localhost', tenant=self.tenant, is_primary=True)
        
        self.client.defaults['HTTP_HOST'] = self.tenant.domains.first().domain
        
        self.user = User.objects.create_user(
            email='cashier@tenant.com',
            password='password123',
            first_name='Test',
            last_name='Cashier'
        )
        self.client.force_authenticate(user=self.user)
        self._setup_coa()

    def _setup_coa(self):
        """Setup required Chart of Accounts."""
        coa_data = [
            ('1110', 'Bank', 'asset'),
            ('1130', 'Mpesa', 'asset'),
            ('1210', 'Portfolio', 'asset'),
            ('4100', 'Interest', 'income'),
            ('4200', 'Fees', 'income'),
            ('4300', 'Penalty', 'income'),
        ]
        for code, name, acc_type in coa_data:
            ChartOfAccount.objects.get_or_create(code=code, defaults={'name': name, 'account_type': acc_type})
        
        # Setup loan
        self.customer = Customer.objects.create(
            first_name='Jane',
            last_name='Doe',
            id_number='87654321',
            phone_number='+254700333444',
            email='jane@example.com',
            date_of_birth='1985-05-15',
            address='456 Test Avenue, Nairobi'
        )
        
        self.product = LoanProduct.objects.create(
            name='Emergency Loan',
            code='EL001',
            min_amount=Decimal('1000.00'),
            max_amount=Decimal('50000.00'),
            interest_rate=Decimal('36.00'),
            interest_type='flat',
            term_unit='months',
            min_term=1,
            max_term=6
        )
        
        application = LoanApplication.objects.create(
            customer=self.customer,
            product=self.product,
            requested_amount=Decimal('10000.00'),
            requested_term=3,
            approved_amount=Decimal('10000.00'),
            approved_term=3,
            calculated_interest=Decimal('900.00'),
            processing_fee=Decimal('0.00'),
            status='disbursed',
            created_by=self.user
        )
        
        self.loan = Loan.objects.create(
            application=application,
            customer=self.customer,
            product=self.product,
            principal_amount=Decimal('10000.00'),
            total_interest=Decimal('900.00'),
            disbursed_amount=Decimal('10000.00'),
            disbursement_date=date.today(),
            term=3,
            maturity_date=date.today(),
            outstanding_balance=Decimal('10900.00'),
            outstanding_principal=Decimal('10000.00'),
            outstanding_interest=Decimal('900.00')
        )
    
    def test_record_repayment(self):
        """Test recording a loan repayment."""
        url = reverse('loan-repayments', args=[self.loan.id])
        data = {
            "amount": "4000.00",
            "payment_date": str(date.today()),
            "payment_method": "mpesa",
            "reference_number": "QWE123456"
        }
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        self.loan.refresh_from_db()
        self.assertEqual(self.loan.outstanding_balance, Decimal('6900.00'))
