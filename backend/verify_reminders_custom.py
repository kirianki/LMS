import os
import sys
import django
import json

# Setup Django environment
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.loans.models import Loan, RepaymentSchedule
from apps.accounts.models import Organization
from apps.loans.services.email import send_loan_reminder_email, send_overdue_reminder_email
from django.conf import settings

def test_custom_emails():
    org = Organization.objects.first()
    loan = Loan.objects.filter(status='active').first()
    
    if not (org and loan):
        print("Missing required data (org or active loan).")
        return

    schedule_entry = loan.schedules.first()
    if not schedule_entry:
        print("No schedule entry found for loan.")
        return

    print("--- TESTING GLOBAL SENDER NAME ---")
    print(f"DEFAULT_FROM_EMAIL: {settings.DEFAULT_FROM_EMAIL}")
    
    if 'Salene Credit Ltd' in settings.DEFAULT_FROM_EMAIL:
        print("SUCCESS: Default sender name updated correctly.")
    else:
        print("FAILED: Default sender name NOT updated.")

    print("\n--- TESTING UPCOMING REMINDER CONTENT ---")
    borrower = loan.borrower
    # Use a dummy email for safety in tests if needed, but here we just want to see the body
    result = send_loan_reminder_email(org, borrower, loan, schedule_entry)
    
    # Check the latest CommunicationLog
    from apps.notifications.models import CommunicationLog
    log = CommunicationLog.objects.filter(recipient=borrower.email, message_type='email').order_by('-created_at').first()
    
    if log:
        print(f"Latest Reminder Body:\n{log.content}")
        if "NCBA Bank" in log.content and "Paybill: 880100" in log.content:
            print("SUCCESS: Upcoming reminder contains banking details.")
        else:
            print("FAILED: Upcoming reminder MISSING banking details.")
            
        if "Salene Credit Ltd" in log.content:
            print("SUCCESS: Body mentions Salene Credit Ltd.")
        else:
             print("FAILED: Body MISSING Salene Credit Ltd.")
    else:
        print("FAILED: No communication log found.")

if __name__ == "__main__":
    test_custom_emails()
