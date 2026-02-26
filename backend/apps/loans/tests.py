from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from decimal import Decimal
from datetime import date

from apps.users.models import User
from apps.customers.models import Borrower
from apps.accounting.models import ChartOfAccount
from apps.treasury.models import CashAccount
from .models import LoanProduct, LoanApplication, Loan, RepaymentSchedule


class LoanProductTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        from apps.accounts.models import Organization
        self.org = Organization.objects.create(company_name="Test Org")
        
        self.user = User.objects.create_superuser(
            email='loans-test@system.com',
            password='password123',
            first_name='Test',
            last_name='Officer',
            organization=self.org
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
                defaults={'name': name, 'account_type': acc_type, 'organization': self.org}
            )
    
    def test_create_loan_product(self):
        """Test creating a loan product."""
        url = reverse('loanproduct-list')
        data = {
            "name": "Personal Loan",
            "code": "PL001",
            "min_amount": "10000.00",
            "max_amount": "500000.00",
            "suggested_interest_rate": "18.00",
            "interest_type": "reducing_balance",
            "term_unit": "months",
            "min_term": 3,
            "max_term": 24,
            "penalty_value": "1.00",
            "penalty_grace_period": 3,
        }
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(LoanProduct.objects.count(), 1)
        self.assertEqual(LoanProduct.objects.first().name, "Personal Loan")


class LoanApplicationLifecycleTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        from apps.accounts.models import Organization
        self.org = Organization.objects.create(company_name="Test Org")
        
        self.user = User.objects.create_superuser(
            email='loan-officer@system.com',
            password='password123',
            first_name='Loan',
            last_name='Officer',
            organization=self.org
        )
        self.client.force_authenticate(user=self.user)
        self._setup_coa()

    def _setup_coa(self):
        """Setup required Chart of Accounts."""
        coa_data = [
            ('1110', 'Bank', 'asset'),
            ('1130', 'Mpesa', 'asset'),
            ('1210', 'Portfolio', 'asset'),
            ('2140', 'Overpayment', 'liability'),
            ('4100', 'Interest', 'income'),
            ('4200', 'Fees', 'income'),
            ('4300', 'Penalty', 'income'),
        ]
        for code, name, acc_type in coa_data:
            ChartOfAccount.objects.get_or_create(code=code, defaults={'name': name, 'account_type': acc_type, 'organization': self.org})
        
        # Ensure a cash account exists for disbursement/repayment recording
        bank_coa = ChartOfAccount.objects.filter(code='1110').first()
        CashAccount.objects.get_or_create(
            account_type=CashAccount.AccountType.BANK,
            defaults={'name': 'Test Bank', 'coa_account': bank_coa, 'organization': self.org}
        )
        
        # Create customer
        self.customer = Borrower.objects.create(
            organization=self.org,
            first_name='John',
            last_name='Borrower',
            id_number='12345678',
            phone_number='+254700111222',
            email='john@example.com',
            date_of_birth='1990-01-01',
            physical_address='123 Test Street, Nairobi'
        )
        
        # Create product
        self.product = LoanProduct.objects.create(
            organization=self.org,
            name='Quick Loan',
            code='QL001',
            min_amount=Decimal('5000.00'),
            max_amount=Decimal('100000.00'),
            suggested_interest_rate=Decimal('24.00'),
            interest_type='flat',
            term_unit='months',
            min_term=1,
            max_term=12,
            penalty_value=Decimal('1.00'),
            penalty_grace_period=3,
        )
    
    def test_full_loan_lifecycle(self):
        """Test complete loan lifecycle: Create → Submit → Approve → Disburse."""
        # 1. Create Application
        url = reverse('loanapplication-list')
        data = {
            "borrower": str(self.customer.id),
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
        
        # 2b. Start review (required before approve)
        detail_url = reverse('loanapplication-detail', args=[application_id])
        url = detail_url.rstrip('/') + '/start_review/'
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify status changed
        application = LoanApplication.objects.get(id=application_id)
        self.assertEqual(application.status, 'under_review')
        
        # 3. Approve Application
        url = reverse('loanapplication-approve', args=[application_id])
        data = {
            "approved_amount": "50000.00",
            "approved_term": 6,
            "approved_interest_rate": "24.00",
            "approved_interest_method": "flat",
            "approved_interest_period": "per_year",
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, f"approve: {response.data}")
        self.assertEqual(response.data.get('status'), 'approved')
        
        application.refresh_from_db()
        self.assertEqual(application.status, 'approved')
        self.assertEqual(application.approved_by, self.user)
        
        # 3b. Send offer letter
        url = detail_url.rstrip('/') + '/send_offer_letter/'
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK, f"send_offer_letter: {response.data}")
        self.assertEqual(response.data.get('status'), 'offer_sent')
        
        # 3c. Accept offer (upload signed offer)
        url = detail_url.rstrip('/') + '/accept_offer/'
        pdf_file = SimpleUploadedFile('signed_offer.pdf', b'%PDF-1.4 fake signed offer', content_type='application/pdf')
        response = self.client.post(url, {'signed_offer': pdf_file}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        application.refresh_from_db()
        self.assertEqual(application.status, 'offer_accepted')
        
        # 3d. Upload signed disbursement checklist
        url = detail_url.rstrip('/') + '/upload_disbursement_authorization/'
        disb_file = SimpleUploadedFile('signed_disbursement.pdf', b'%PDF-1.4 fake signed disbursement', content_type='application/pdf')
        response = self.client.post(url, {'signed_disbursement': disb_file}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # 4. Disburse Loan (manual mode: proof + reference)
        url = detail_url.rstrip('/') + '/disburse/'
        proof_file = SimpleUploadedFile('proof.pdf', b'%PDF-1.4 proof', content_type='application/pdf')
        response = self.client.post(url, {
            'disbursement_method': 'cash',
            'disbursement_proof': proof_file,
            'disbursement_reference_manual': 'MANUAL-REF-001',
        }, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('loan_number', response.data)
        
        # Verify Loan created
        application.refresh_from_db()
        self.assertEqual(application.status, 'disbursed')
        
        loan = Loan.objects.get(application=application)
        self.assertEqual(loan.status, 'active')
        self.assertEqual(loan.borrower, self.customer)
        
        # Verify schedule generated
        schedules = RepaymentSchedule.objects.filter(loan=loan)
        self.assertEqual(schedules.count(), 6)  # 6 months
    
    def test_reject_application(self):
        """Test rejecting a loan application."""
        # Create and submit application
        application = LoanApplication.objects.create(
            organization=self.org,
            borrower=self.customer,
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


class LoanRepaymentTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        from apps.accounts.models import Organization
        self.org = Organization.objects.create(company_name="Test Org")
        
        self.user = User.objects.create_superuser(
            email='cashier@system.com',
            password='password123',
            first_name='Test',
            last_name='Cashier',
            organization=self.org
        )
        self.client.force_authenticate(user=self.user)
        self._setup_coa()

    def _setup_coa(self):
        """Setup required Chart of Accounts."""
        coa_data = [
            ('1110', 'Bank', 'asset'),
            ('1130', 'Mpesa', 'asset'),
            ('1210', 'Portfolio', 'asset'),
            ('2140', 'Overpayment', 'liability'),
            ('4100', 'Interest', 'income'),
            ('4200', 'Fees', 'income'),
            ('4300', 'Penalty', 'income'),
        ]
        for code, name, acc_type in coa_data:
            ChartOfAccount.objects.get_or_create(code=code, defaults={'name': name, 'account_type': acc_type, 'organization': self.org})
        
        bank_coa = ChartOfAccount.objects.filter(code='1110').first()
        CashAccount.objects.get_or_create(
            account_type=CashAccount.AccountType.BANK,
            defaults={'name': 'Test Bank', 'coa_account': bank_coa, 'organization': self.org}
        )
        
        # Setup loan
        self.customer = Borrower.objects.create(
            organization=self.org,
            first_name='Jane',
            last_name='Doe',
            id_number='87654321',
            phone_number='+254700333444',
            email='jane@example.com',
            date_of_birth='1985-05-15',
            physical_address='456 Test Avenue, Nairobi'
        )
        
        self.product = LoanProduct.objects.create(
            organization=self.org,
            name='Emergency Loan',
            code='EL001',
            min_amount=Decimal('1000.00'),
            max_amount=Decimal('50000.00'),
            suggested_interest_rate=Decimal('36.00'),
            interest_type='flat',
            term_unit='months',
            min_term=1,
            max_term=6
        )
        
        application = LoanApplication.objects.create(
            organization=self.org,
            borrower=self.customer,
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
            organization=self.org,
            application=application,
            borrower=self.customer,
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
        # Create repayment schedule so payments allocate correctly
        from dateutil.relativedelta import relativedelta
        for i in range(1, 4):
            due = date.today() + relativedelta(months=i)
            RepaymentSchedule.objects.create(
                loan=self.loan,
                installment_number=i,
                due_date=due,
                principal_due=Decimal('3333.33') if i < 3 else Decimal('3333.34'),
                interest_due=Decimal('300.00'),
                total_due=Decimal('3633.33') if i < 3 else Decimal('3633.34'),
                status='pending'
            )
    
    def test_record_repayment(self):
        """Test recording a loan repayment."""
        url = reverse('loan-repayments', args=[self.loan.id])
        data = {
            "amount": "4000.00",
            "payment_date": str(date.today()),
            "payment_method": "mpesa",
            "reference_number": "QWE123456",
            "treasury_account_code": "1110",
        }
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        self.loan.refresh_from_db()
        self.assertEqual(self.loan.outstanding_balance, Decimal('6900.00'))
