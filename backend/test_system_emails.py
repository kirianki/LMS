import os
import django
from datetime import date, timedelta
from io import BytesIO

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.loans.models import Loan, LoanApplication, RepaymentSchedule
from apps.customers.models import Borrower
from apps.accounts.models import Organization
from apps.loans.services.email import send_loan_reminder_email, send_overdue_reminder_email
from apps.notifications.services import EmailService
from apps.loans.services import generate_offer_letter, generate_loan_statement

def run_verified_tests(test_email):
    print(f"--- STARTING SYSTEM-WIDE EMAIL VERIFICATION FOR {test_email} ---")
    
    org = Organization.objects.first()
    if not org:
        print("Error: No organization found")
        return

    # 1. Test Loan Statement (Document Attachment)
    loan = Loan.objects.filter(status='active').first()
    if loan:
        print(f"1. Testing Loan Statement for {loan.loan_number}...")
        loan.borrower.email = test_email
        loan.borrower.save()
        
        pdf_buffer = generate_loan_statement(loan)
        email_service = EmailService(org)
        attachments = [(f"Statement_{loan.loan_number}.pdf", pdf_buffer.getvalue(), 'application/pdf')]
        
        res = email_service.send_email(
            test_email, 
            f"Loan Statement - {loan.loan_number}",
            "Please find your loan statement attached.",
            related_loan=loan,
            attachments=attachments
        )
        print(f"   Result: {res}")
    else:
        print("1. Skipping Loan Statement (no active loan found)")

    # 2. Test Offer Letter (Document Attachment)
    app = LoanApplication.objects.first()
    if app:
        print(f"2. Testing Offer Letter for {app.application_number}...")
        app.borrower.email = test_email
        app.borrower.save()
        
        pdf_buffer = generate_offer_letter(app)
        email_service = EmailService(org)
        attachments = [(f"Offer_Letter_{app.application_number}.pdf", pdf_buffer.getvalue(), 'application/pdf')]
        
        res = email_service.send_email(
            test_email,
            f"Offer Letter - {app.application_number}",
            "Please find your offer letter attached.",
            related_borrower=app.borrower,
            attachments=attachments
        )
        print(f"   Result: {res}")
    else:
        print("2. Skipping Offer Letter (no application found)")

    # 3. Test Upcoming Payment Reminder (Borrower + Staff notification)
    if loan:
        print("3. Testing Upcoming Payment Reminder + Staff Notice...")
        sched = RepaymentSchedule.objects.filter(loan=loan).first()
        if sched:
            res = send_loan_reminder_email(org, loan.borrower, loan, sched)
            print(f"   Result: {res}")
        else:
            print("   Skipped (No schedule found)")

    # 4. Test Overdue Payment Reminder (Borrower + Staff notification)
    if loan:
        print("4. Testing Overdue Payment Reminder + Staff Notice...")
        sched = RepaymentSchedule.objects.filter(loan=loan).first()
        if sched:
            res = send_overdue_reminder_email(org, loan.borrower, loan, sched, 5)
            print(f"   Result: {res}")
        else:
            print("   Skipped (No schedule found)")

    print("--- VERIFICATION COMPLETE ---")

if __name__ == "__main__":
    import sys
    recipient = sys.argv[1] if len(sys.argv) > 1 else 'samuelkirianki@outlook.com'
    run_verified_tests(recipient)
