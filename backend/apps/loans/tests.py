from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from decimal import Decimal
from datetime import date, timedelta
from django.utils import timezone

from apps.users.models import User
from apps.customers.models import Borrower
from apps.accounting.models import ChartOfAccount
from apps.treasury.models import CashAccount
from .models import LoanProduct, LoanApplication, Loan, RepaymentSchedule, LoanRepayment


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

    def test_ltv_enforcement_during_approval(self):
        """Test multi-collateral LTV requirements during fast approval."""
        from apps.collateral.models import Collateral

        self.product.requires_collateral = True
        self.product.min_collateral_value = Decimal('140000.00')
        self.product.save()

        app = LoanApplication.objects.create(
            organization=self.org, borrower=self.customer, product=self.product,
            requested_amount=Decimal('50000.00'), requested_term=6, status='under_review',
            created_by=self.user
        )

        c1 = Collateral.objects.create(
            organization=self.org, borrower=self.customer, collateral_type='motor_vehicle',
            status='available', market_value=Decimal('120000.00'), forced_sale_value=Decimal('100000.00'),
            valuation_date=timezone.now().date(),
            is_charged=True, tracker_installed=True
        )
        c2 = Collateral.objects.create(
            organization=self.org, borrower=self.customer, collateral_type='motor_vehicle',
            status='available', market_value=Decimal('60000.00'), forced_sale_value=Decimal('50000.00'),
            valuation_date=timezone.now().date(),
            is_charged=True, tracker_installed=True
        )

        url = reverse('loanapplication-approve', args=[app.id])
        data = { "approved_amount": "50000.00", "approved_term": 6, "approved_interest_rate": "24.00", "approved_interest_method": "flat"}
        
        # Test 1: No collateral linked (Fails)
        res = self.client.post(url, data, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("requires collateral", str(res.data))
        
        # Test 2: One collateral linked, but insufficient FSV (100k < 140k)
        app.collaterals.add(c1)
        res = self.client.post(url, data, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("below the product minimum", str(res.data))
        
        # Test 3: Multiple collaterals linked, meeting FSV (100k + 50k = 150k > 140k)
        app.collaterals.add(c2)
        res = self.client.post(url, data, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK, f"Approval failed: {res.data}")


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

    def test_interest_allocation_accuracy(self):
        """Test that interest is correctly allocated in partial and specific payments."""
        # 1. Scenario: Partial payment of first installment
        # First installment owes 3333.33 principal + 300 interest = 3633.33 total
        # Pay 200. Should all go to interest.
        url = reverse('loan-repayments', args=[self.loan.id])
        data = {
            "amount": "200.00",
            "payment_date": str(date.today()),
            "payment_method": "cash",
            "reference_number": "PARTIAL-1",
            "treasury_account_code": "1110",
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        repayment = LoanRepayment.objects.get(reference_number="PARTIAL-1")
        self.assertEqual(repayment.interest_paid, Decimal('200.00'))
        self.assertEqual(repayment.principal_paid, Decimal('0.00'))
        
        # Verify COA Interest Income (4100)
        interest_coa = ChartOfAccount.objects.get(code='4100', organization=self.org)
        self.assertEqual(interest_coa.balance, Decimal('200.00'))
        
        # 2. Scenario: Specific payment to first installment
        # Total interest on S1 was 300. 200 paid. 100 remaining.
        # Pay another 500 specifically to S1. 
        # Breakdown should be: 100 interest, 400 principal.
        s1 = self.loan.schedules.get(installment_number=1)
        data = {
            "amount": "500.00",
            "payment_date": str(date.today()),
            "payment_method": "cash",
            "reference_number": "SPECIFIC-1",
            "installment_id": str(s1.id),
            "treasury_account_code": "1110",
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, f"Error: {response.data}")
        
        repayment2 = LoanRepayment.objects.get(reference_number="SPECIFIC-1")
        self.assertEqual(repayment2.interest_paid, Decimal('100.00'))
        self.assertEqual(repayment2.principal_paid, Decimal('400.00'))
        
        interest_coa.refresh_from_db()
        self.assertEqual(interest_coa.balance, Decimal('300.00')) # 200 + 100
    def test_multi_payment_interest_allocation(self):
        """
        Verify that multiple partial payments to the same installment correctly 
        track already-paid interest and don't re-allocate.
        S1: 300 interest, 3333.33 principal.
        """
        url = reverse('loan-repayments', args=[self.loan.id])
        
        # 1. Pay 100. Should go entirely to interest.
        self.client.post(url, {
            "amount": "100.00",
            "payment_date": str(date.today()),
            "payment_method": "cash",
            "reference_number": "MULTI-1",
            "treasury_account_code": "1110",
        }, format='json')
        
        s1 = self.loan.schedules.get(installment_number=1)
        self.assertEqual(s1.interest_paid, Decimal('100.00'))
        self.assertEqual(s1.principal_paid, Decimal('0.00'))
        
        # 2. Pay 250 more. 
        # Breakdown should be: 200 interest (to finish the 300) and 50 principal.
        # BEFORE FIX: This would have incorrectly allocated 250 to interest because it
        # would see 'installment.paid_amount' was only 100, and assume 300 interest was still owed.
        self.client.post(url, {
            "amount": "250.00",
            "payment_date": str(date.today()),
            "payment_method": "cash",
            "reference_number": "MULTI-2",
            "treasury_account_code": "1110",
        }, format='json')
        
        s1.refresh_from_db()
        self.assertEqual(s1.interest_paid, Decimal('300.00'))
        self.assertEqual(s1.principal_paid, Decimal('50.00'))
        self.assertEqual(s1.paid_amount, Decimal('350.00'))

        # Verify LoanRepayment records
        rep2 = LoanRepayment.objects.get(reference_number="MULTI-2")
        self.assertEqual(rep2.interest_paid, Decimal('200.00'))
        self.assertEqual(rep2.principal_paid, Decimal('50.00'))

    def test_penalty_on_partial_principal(self):
        """
        Verify that percentage penalties are calculated on UNPAID principal only.
        Principal due: 3333.33. Penalty rate: 10% (Fixed in this test).
        """
        from apps.loans.tasks import calculate_loan_penalties
        
        # Configure product for 10% daily penalty (simulated)
        self.product.penalty_type = 'percentage'
        self.product.penalty_value = Decimal('10.00')
        self.product.penalty_grace_period = 5
        self.product.penalty_basis = 'per_day'
        self.product.save()

        # 1. Pay 1333.33 of principal. Remaining principal owe: 2000.00

        # First pay off curiosity interest (300) then 1333.33 principal = 1633.33 total
        url = reverse('loan-repayments', args=[self.loan.id])
        self.client.post(url, {
            "amount": "1633.33",
            "payment_date": str(date.today()),
            "payment_method": "cash",
            "reference_number": "PARTIAL-P",
            "treasury_account_code": "1110",
        }, format='json')
        
        s1 = self.loan.schedules.get(installment_number=1)
        self.assertEqual(s1.principal_paid, Decimal('1333.33'))
        
        # 2. Force installment to overdue and past grace period
        s1.status = 'overdue'
        s1.due_date = date.today() - timedelta(days=10) # past 5 day grace
        s1.save()
        
        # 3. Trigger penalty calculation
        calculate_loan_penalties()
        
        s1.refresh_from_db()
        # Unpaid Principal = 3333.33 - 1333.33 = 2000.00
        # Penalty = 10% of 2000.00 * (10 days - 5 days grace) = 200 * 5 = 1000
        self.assertEqual(s1.penalty_due, Decimal('1000.00'))

    def test_in_place_restructuring(self):
        """
        Verify that an active/overdue loan can be restructured in-place.
        """
        # Set loan to overdue with some penalties
        self.loan.status = 'overdue'
        self.loan.outstanding_penalties = Decimal('500.00')
        self.loan.save()

        # Mark first schedule as overdue
        s1 = self.loan.schedules.get(installment_number=1)
        s1.status = 'overdue'
        s1.penalty_due = Decimal('500.00')
        s1.save()

        restructure_url = reverse('loan-restructure', args=[self.loan.id])
        data = {
            'new_term': 6,
            'new_interest_rate': '15.00',
            'new_frequency': 'monthly',
            'capitalize_arrears': True,
            'waive_penalties': False,
            'notes': 'Restructuring due to hardship'
        }
        
        # Ensure outstanding balance before restructure
        self.assertEqual(self.loan.outstanding_principal, Decimal('10000.00'))
        self.assertEqual(self.loan.outstanding_interest, Decimal('900.00'))

        response = self.client.post(restructure_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, f"Restructure failed: {response.data}")
        
        self.loan.refresh_from_db()
        
        # Check loan status and fields
        self.assertEqual(self.loan.status, 'active')
        self.assertTrue(self.loan.is_restructured)
        self.assertEqual(self.loan.term, 6)
        self.assertEqual(self.loan.interest_rate, Decimal('15.00'))
        self.assertEqual(self.loan.original_term, 3)
        self.assertEqual(self.loan.restructure_notes, 'Restructuring due to hardship')
        
        # Check areas capitalized (Principal should now be 10000 + 900 + 500 = 11400)
        self.assertEqual(self.loan.outstanding_principal, Decimal('11400.00'))
        # The new interest generated for 11400 at 15% flat over 6 months = 855.00
        self.assertEqual(self.loan.outstanding_interest, Decimal('855.00'))
        self.assertEqual(self.loan.outstanding_penalties, Decimal('0.00'))
        
        # Check schedules (should be 6 new ones)
        self.assertEqual(self.loan.schedules.count(), 6)
        new_s1 = self.loan.schedules.get(installment_number=1)
        self.assertEqual(new_s1.status, 'pending')
        # Total principal to be scheduled = 11400. 11400 / 6 = 1900
        self.assertEqual(new_s1.principal_due, Decimal('1900.00'))


class CollateralManagementTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        from apps.accounts.models import Organization
        self.org = Organization.objects.create(company_name="Test Org")
        self.user = User.objects.create_superuser(email='collat@system.com', password='pwd')
        self.client.force_authenticate(user=self.user)
        self._setup_coa()
        
        from apps.treasury.models import CashAccount
        cash = CashAccount.objects.create(
            organization=self.org, name="Default Cash", 
            account_type='cash', opening_balance=Decimal('1000000.00'),
            is_active=True,
            coa_account=ChartOfAccount.objects.get(code='1130', organization=self.org)
        )
        
        from apps.customers.models import Borrower
        self.customer = Borrower.objects.create(
            organization=self.org, first_name="Test", last_name="User", 
            email="test@collat.com", phone_number="123456", id_number="COLL-123"
        )
        
        from apps.collateral.models import Collateral
        self.collateral = Collateral.objects.create(
            organization=self.org, borrower=self.customer, collateral_type='motor_vehicle',
            status='available', market_value=120000, forced_sale_value=100000,
            valuation_date=timezone.now().date(),
            is_charged=True, tracker_installed=True
        )
        
        self.product = LoanProduct.objects.create(
            organization=self.org, name="Test Product", code="TP_COLLAT",
            suggested_interest_rate=12, interest_type="flat",
            min_amount=1000, max_amount=1000000
        )
        
        app = LoanApplication.objects.create(
            organization=self.org, borrower=self.customer, product=self.product,
            requested_amount=50000, requested_term=6, status='disbursed',
            created_by=self.user
        )
        
        self.loan = Loan.objects.create(
            organization=self.org, borrower=self.customer, product=self.product,
            application=app, loan_number="L099", status='active', 
            principal_amount=50000, total_interest=3000, total_fees=0,
            disbursed_amount=50000, disbursement_date=timezone.now().date(),
            maturity_date=timezone.now().date() + timedelta(days=180),
            term=6, interest_rate=12, interest_method='flat',
            outstanding_balance=53000, outstanding_principal=50000, 
            outstanding_interest=3000, outstanding_penalties=0
        )
        self.loan.collaterals.add(self.collateral)

    def test_manual_incharge_and_discharge(self):
        """Test the explicit lifecycle logic of pleading and discharging collateral."""
        # 1. Incharge Collateral
        url = reverse('loan-incharge-collateral', args=[self.loan.id])
        res = self.client.post(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK, f"Incharge failed: {res.data}")
        self.collateral.refresh_from_db()
        self.assertEqual(self.collateral.status, 'pledged')
        
        # 2. Try to discharge while loan is active (should fail due to exposure)
        discharge_url = reverse('collateral-discharge', args=[self.collateral.id])
        res = self.client.post(discharge_url)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("still secures active or overdue loans", str(res.data))
        
        # 3. Payoff loan and initiate discharge protocol
        self.loan.status = 'paid_off'
        self.loan.save()
        
        init_discharge_url = reverse('loan-initiate-discharge', args=[self.loan.id])
        res = self.client.post(init_discharge_url)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        
        # 4. Finalize the discharge at the Collateral level
        res = self.client.post(discharge_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.collateral.refresh_from_db()
        self.assertEqual(self.collateral.status, 'available')

    def _setup_coa(self):
        from apps.accounting.models import ChartOfAccount
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



