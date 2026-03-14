import os
import django
import sys
from io import BytesIO

# Set up Django environment
sys.path.append('/home/sammy/Desktop/LMS/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.users.models import User
from apps.loans.models import Loan
from apps.auditlog.models import ActivityLog
from rest_framework.test import APIClient
from django.utils import timezone

def verify_audit_user():
    from apps.loans.views import LoanViewSet
    from rest_framework.test import APIRequestFactory, force_authenticate
    
    factory = APIRequestFactory()
    user = User.objects.filter(is_superuser=True).first()
    
    if not user:
        print("No superuser found for testing.")
        return

    # Get a loan to update
    loan = Loan.objects.first()
    if not loan:
        print("No loan found to update for testing.")
        return

    print(f"Testing with user: {user.email}")
    print(f"Updating loan: {loan.loan_number}")

    # Create a request
    request = factory.patch(f'/api/v1/loans/{loan.id}/', {'description': f"Audit Test {timezone.now()}"})
    force_authenticate(request, user=user)
    
    # We need the middleware to run.
    # But we can also just manually set the thread locals like the middleware would.
    from apps.users.middleware import _thread_locals
    _thread_locals.user = user
    _thread_locals.request = request
    
    try:
        # Trigger the save signal
        loan.description = f"Audit Update {timezone.now()}"
        loan.save()
        
        # Check the latest ActivityLog for this loan
        latest_log = ActivityLog.objects.filter(object_id=str(loan.id)).order_by('-timestamp').first()
        
        if latest_log:
            print(f"Latest Log Action: {latest_log.action}")
            print(f"Latest Log User: {latest_log.user}")
            if latest_log.user == user:
                print("\nVerification SUCCESS: Actual user correctly captured in Audit Log.")
            else:
                print(f"\nVerification FAILED: User was {latest_log.user}, expected {user}")
        else:
            print("\nVerification FAILED: No log entry found for the action.")
    finally:
        # Clean up
        if hasattr(_thread_locals, 'user'):
            del _thread_locals.user
        if hasattr(_thread_locals, 'request'):
            del _thread_locals.request

if __name__ == "__main__":
    verify_audit_user()
