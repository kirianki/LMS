from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.urls import reverse
from decimal import Decimal
from django.utils import timezone
from apps.users.models import User, Role, StaffContract, PayrollRecord, StaffAllowance, StaffDeduction
from apps.users.utils.payroll import KenyanPayrollCalculator
from apps.treasury.models import CashAccount, Transaction

class PayrollCalculatorTests(TestCase):
    def test_nssf_calculation_2026(self):
        """Verify NSSF Phase 4 (Feb 2026) rates."""
        # Case 1: Salary below Tier I limit (9,000)
        self.assertEqual(KenyanPayrollCalculator.calculate_nssf(Decimal('8000')), Decimal('480'))
        
        # Case 2: Salary between Tier I and Tier II limit (9,000 - 108,000)
        # Tier I: 540, Tier II: 6% of (50,000 - 9,000) = 2,460. Total = 3,000
        self.assertEqual(KenyanPayrollCalculator.calculate_nssf(Decimal('50000')), Decimal('3000'))
        
        # Case 3: Salary at/above Tier II limit (108,000)
        self.assertEqual(KenyanPayrollCalculator.calculate_nssf(Decimal('120000')), Decimal('6480'))

    def test_shif_calculation(self):
        """Verify SHIF (2.75%) with Kes 300 minimum."""
        # 10,000 * 2.75% = 275 (Should be 300 min)
        self.assertEqual(KenyanPayrollCalculator.calculate_shif(Decimal('10000')), Decimal('300'))
        # 50,000 * 2.75% = 1375
        self.assertEqual(KenyanPayrollCalculator.calculate_shif(Decimal('50000')), Decimal('1375'))

    def test_housing_levy_calculation(self):
        """Verify Housing Levy at 1.5%."""
        self.assertEqual(KenyanPayrollCalculator.calculate_housing_levy(Decimal('50000')), Decimal('750'))

    def test_paye_calculation(self):
        """Verify PAYE graduated bands with 2,400 relief."""
        # Taxable pay: 20,000 (below first band 24,000)
        # Tax: 2,000 - 2,400 relief = 0
        self.assertEqual(KenyanPayrollCalculator.calculate_paye(Decimal('20000')), Decimal('0'))
        
        # Taxable pay: 50,000
        # 24,000 @ 10% = 2,400
        # 8,333 @ 25% = 2,083
        # 17,667 @ 30% = 5,300
        # Total Tax = 9,783
        # Net PAYE = 9,783 - 2,400 = 7,383
        self.assertEqual(KenyanPayrollCalculator.calculate_paye(Decimal('50000')), Decimal('7383'))

    def test_comprehensive_payroll(self):
        """Test the full payroll breakdown with allowances and deductions."""
        allowances = [
            {'name': 'House Allowance', 'calculation_type': 'fixed', 'amount': Decimal('10000'), 'percentage_basis': 'basic'},
            {'name': 'Commuter', 'calculation_type': 'percentage', 'amount': Decimal('10'), 'percentage_basis': 'basic'}
        ]
        deductions = [
            {'name': 'Sacco', 'calculation_type': 'fixed', 'amount': Decimal('2000'), 'percentage_basis': 'basic'}
        ]
        
        # Basic: 50,000
        # House: 10,000
        # Commuter (10% of 50k): 5,000
        # Gross: 65,000
        # NSSF: 6% of 65k = 3,900
        # SHIF: 2.75% of 65k = 1,788
        # Housing Levy: 1.5% of 65k = 975
        # Taxable: 65,000 - 3,900 - 1,788 - 975 = 58,337
        # PAYE: (24k*10%) + (8333*25%) + (26004*30%) - 2400 = 2400 + 2083 + 7801 - 2400 = 9,884
        # Net: 65,000 - (3900+1788+975+9884+2000) = 46,453
        
        result = KenyanPayrollCalculator.calculate_payroll(Decimal('50000'), allowances, deductions)
        
        self.assertEqual(result['gross_pay'], Decimal('65000'))
        self.assertEqual(result['nssf'], Decimal('3900'))
        self.assertEqual(result['shif'], Decimal('1788'))
        self.assertEqual(result['housing_levy'], Decimal('975'))
        self.assertEqual(result['paye'], Decimal('9884'))
        self.assertEqual(result['other_deductions'], Decimal('2000'))
        self.assertEqual(result['net_pay'], Decimal('46453'))

class PayrollAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create Manager Role & User
        self.role = Role.objects.create(name='Admin', approval_limit=1000000)
        self.admin_user = User.objects.create_superuser(email='admin@system.com', password='password123', role=self.role)
        self.client.force_authenticate(user=self.admin_user)

        # Create Staff User & Contract
        self.staff_user = User.objects.create_user(email='staff@system.com', password='password123', first_name='Staff', last_name='One')
        self.contract = StaffContract.objects.create(
            user=self.staff_user,
            basic_salary=Decimal('50000.00'),
            bank_name='Test Bank',
            bank_account='123456',
            start_date=timezone.now().date(),
            status=StaffContract.Status.ACTIVE
        )
        StaffAllowance.objects.create(contract=self.contract, name='House', amount=10000, calculation_type='fixed')
        
        # Create Cash Account for treasury integration
        self.cash_account = CashAccount.objects.create(
            name="Payroll Account",
            account_type=CashAccount.AccountType.BANK,
            opening_balance=Decimal('100000.00'),
            current_balance=Decimal('100000.00')
        )

    def test_generate_monthly_payroll(self):
        """Test bulk generation of payroll records."""
        url = reverse('payrollrecord-generate-monthly')
        data = {'month': timezone.now().month, 'year': timezone.now().year}
        response = self.client.post(url, data)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(PayrollRecord.objects.count(), 1)
        
        payroll = PayrollRecord.objects.first()
        self.assertEqual(payroll.user, self.staff_user)
        self.assertEqual(payroll.status, PayrollRecord.Status.DRAFT)
        # Based on calc (Basic 50k + 10k House) = Gross 60k
        # Gross 60,000, NSSF: 3,600, SHIF: 1,650, Housing: 900
        # Taxable: 53,850. PAYE: 2400 + 2083 + 6455 - 2400 = 8538
        # Net: 60k - (3600+1650+900+8538) = 45,312
        self.assertEqual(payroll.gross_pay, Decimal('60000.00'))
        self.assertEqual(payroll.net_pay, Decimal('45312.00'))

    def test_payroll_approval_flow(self):
        """Test Draft -> Approved -> Paid workflow."""
        # 1. Create Draft
        payroll = PayrollRecord.objects.create(
            user=self.staff_user, contract=self.contract,
            month=1, year=2026, gross_pay=60000, nssf=3600, shif=1650, 
            paye=8538, housing_levy=900, net_pay=45312,
            status=PayrollRecord.Status.DRAFT
        )
        
        # 2. Approve
        url = reverse('payrollrecord-approve', kwargs={'pk': payroll.id})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payroll.refresh_from_db()
        self.assertEqual(payroll.status, PayrollRecord.Status.APPROVED)
        self.assertEqual(payroll.approved_by, self.admin_user)
        self.assertIsNotNone(payroll.approved_at)
        
        # 3. Pay
        url = reverse('payrollrecord-pay', kwargs={'pk': payroll.id})
        data = {
            'reference': 'TXN123',
            'account_id': str(self.cash_account.id)
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payroll.refresh_from_db()
        self.assertEqual(payroll.status, PayrollRecord.Status.PAID)
        self.assertEqual(payroll.reference, 'TXN123')
        self.assertEqual(payroll.payment_date, timezone.now().date())
        
        # 4. Verify Treasury Integration
        self.assertEqual(Transaction.objects.count(), 1)
        txn = Transaction.objects.first()
        self.assertEqual(txn.account, self.cash_account)
        self.assertEqual(txn.amount, payroll.net_pay)
        self.assertEqual(txn.category, Transaction.Category.PAYROLL)
        self.assertEqual(txn.transaction_type, Transaction.TransactionType.DEBIT)

    def test_payslip_pdf_endpoint(self):
        """Verify payslip endpoint returns a valid PDF FileResponse."""
        payroll = PayrollRecord.objects.create(
            user=self.staff_user, contract=self.contract,
            month=1, year=2026, gross_pay=60000, nssf=3600, shif=1650, 
            paye=8538, housing_levy=900, net_pay=45312,
            status=PayrollRecord.Status.PAID
        )
        url = reverse('payrollrecord-payslip', kwargs={'pk': payroll.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertTrue(response.has_header('Content-Disposition'))
        self.assertIn('attachment', response['Content-Disposition'])
        self.assertIn('.pdf', response['Content-Disposition'])
        # Verify content exists via streaming_content
        content = b"".join(response.streaming_content)
        self.assertTrue(len(content) > 0)
