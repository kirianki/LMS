import os
import django
from decimal import Decimal
from django.utils import timezone
from dateutil.relativedelta import relativedelta

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django_tenants.utils import schema_context
from apps.tenants.models import Tenant
from apps.customers.models import Borrower
from apps.loans.models import LoanProduct, LoanApplication, Loan, RepaymentSchedule
from apps.loans.serializers import DisburseSerializer
from apps.treasury.models import CashAccount, Transaction
from apps.accounting.models import ChartOfAccount
# AccountType helper for easier usage if needed
AccountType = ChartOfAccount.AccountType
from django.contrib.auth import get_user_model

User = get_user_model()

def verify():
    tenant = Tenant.objects.exclude(schema_name='public').first()
    if not tenant:
        print("No non-public tenant found. Please create one first.")
        return
    
    with schema_context(tenant.schema_name):
        print(f"--- Verifying Disbursement Flow for {tenant.name} ---")
        
        # 1. Ensure User
        user, _ = User.objects.get_or_create(email='admin@example.com', defaults={'is_superuser': True, 'is_staff': True})
        
        # 2. Setup Accounts if missing
        ChartOfAccount.objects.get_or_create(code='1110', defaults={'name': 'Bank', 'account_type': AccountType.ASSET})
        ChartOfAccount.objects.get_or_create(code='1130', defaults={'name': 'M-Pesa Pool', 'account_type': AccountType.ASSET})
        ChartOfAccount.objects.get_or_create(code='1210', defaults={'name': 'Loan Portfolio', 'account_type': AccountType.ASSET})
        ChartOfAccount.objects.get_or_create(code='4100', defaults={'name': 'Interest Income', 'account_type': AccountType.INCOME})
        ChartOfAccount.objects.get_or_create(code='4200', defaults={'name': 'Fee Income', 'account_type': AccountType.INCOME})
        
        cash_account, _ = CashAccount.objects.get_or_create(
            name='Main Bank Account',
            defaults={'account_type': CashAccount.AccountType.BANK, 'current_balance': Decimal('1000000.00')}
        )

        # 3. Create Application
        borrower = Borrower.objects.first()
        if not borrower:
            from apps.customers.models import BorrowerType
            borrower = Borrower.objects.create(
                first_name="Test", last_name="User", 
                phone_number="0700000000", email="test@example.com",
                id_number="12345678", borrower_type=BorrowerType.INDIVIDUAL
            )
            
        product = LoanProduct.objects.first()
        if not product:
            product = LoanProduct.objects.create(
                name="Test Product", code="TST",
                min_amount=Decimal('1000.00'), max_amount=Decimal('100000.00'),
                interest_rate=Decimal('12.00'), interest_type='reducing_balance',
                term_unit='months'
            )
        
        app = LoanApplication.objects.create(
            borrower=borrower,
            product=product,
            requested_amount=Decimal('50000.00'),
            requested_term=12,
            status=LoanApplication.Status.OFFER_ACCEPTED,
            approved_amount=Decimal('50000.00'),
            approved_term=12,
            approved_interest_rate=Decimal('12.00'),
            approved_interest_method='reducing_balance',
            approved_interest_period='per_month',
            repayment_channel='mpesa'
        )
        
        # Mock signed checklist
        app.signed_disbursement_letter = 'signed_checklist.pdf'
        app.save()
        print(f"Created Application {app.application_number} with signed checklist.")

        # 4. Attempt Disbursement via Mock API View Logic
        from apps.loans.views import LoanApplicationViewSet
        from rest_framework.test import APIRequestFactory, force_authenticate
        from rest_framework import status
        
        factory = APIRequestFactory()
        view = LoanApplicationViewSet.as_view({'post': 'disburse'})
        
        disbursement_data = {
            'disbursement_method': 'mpesa',
            'disbursement_details': {
                'phone_number': '0712345678',
                'verified_by': 'Admin'
            },
            'cash_account_id': str(cash_account.id)
        }
        
        request = factory.post(f'/api/loans/applications/{app.id}/disburse/', disbursement_data, format='json')
        force_authenticate(request, user=user)
        request.tenant = tenant
        request.user = user
        
        print("Initiating disbursement API call...")
        response = view(request, pk=str(app.id))
        
        if response.status_code == 200:
            print("Successfully disbursed funds via API!")
            loan = Loan.objects.get(application=app)
            print(f"Created Loan: {loan.loan_number}")
            print(f"Saved Disbursement Details: {loan.disbursement_details}")
            
            # Verify Treasury Transaction
            tx = Transaction.objects.filter(related_loan=loan, category=Transaction.Category.LOAN_DISBURSEMENT).first()
            if tx:
                print(f"Treasury Transaction recorded: {tx.description}")
                if "0712345678" in tx.description:
                    print("SUCCESS: Transaction description contains destination phone number.")
                else:
                    print("FAILURE: Transaction description missing destination phone number.")
            else:
                print("FAILURE: No treasury transaction found.")
        else:
            print(f"Disbursement failed with status {response.status_code}")
            print(response.data)

if __name__ == "__main__":
    verify()
