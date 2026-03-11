import os
import sys
import django
import json

# Setup Django environment
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.loans.models import Loan
from django.test import RequestFactory
from apps.loans.views import LoanViewSet
from apps.loans.serializers import LoanSerializer
from rest_framework.test import APIRequestFactory

def test_statement_email():
    loan = Loan.objects.first()
    if not loan:
        print("No loans found to test with.")
        return

    serializer = LoanSerializer(loan)
    data = serializer.data
    borrower_name = data.get('borrower_name')
    borrower_email = data.get('borrower_details', {}).get('email')

    print(f"Testing statement email for loan: {loan.loan_number}")
    print(f"Borrower: {borrower_name} ({borrower_email})")

    factory = APIRequestFactory()
    request = factory.post(f'/api/v1/loans/loans/{loan.id}/statement/', 
                           {'send_to_borrower': True},
                           format='json')
    
    from django.contrib.auth import get_user_model
    User = get_user_model()
    admin_user = User.objects.filter(is_superuser=True).first()
    
    from rest_framework.test import force_authenticate
    force_authenticate(request, user=admin_user)
    
    viewset = LoanViewSet.as_view({'post': 'statement'})
    
    response = viewset(request, pk=loan.id)
    
    print(f"Response Status: {response.status_code}")
    print(f"Response Data: {response.data}")
    
    if response.status_code == 200 and response.data.get('email_sent'):
        print("SUCCESS: Statement emailed successfully!")
    elif response.status_code == 200:
         print("DONE: Statement generated successfully (Email might have been skipped if no email address).")
    else:
        print(f"FAILED: Status {response.status_code}")

if __name__ == "__main__":
    test_statement_email()
