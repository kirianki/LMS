import os
import django
from datetime import date, timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.loans.models import Loan, RepaymentSchedule
from apps.customers.models import Borrower
from apps.loans.tasks import send_upcoming_payment_reminders

today = date.today()
target_date = today + timedelta(days=5)

loan = Loan.objects.filter(loan_number='LN2026020001').first()
if loan:
    # Ensure loan is active for the reminder task
    loan.status = 'active'
    loan.save()
    
    sched = RepaymentSchedule.objects.filter(loan=loan, status='pending').first()
    if sched:
        sched.due_date = target_date
        sched.save()
        
        b = loan.borrower
        b.email = 'test_borrower@example.com'
        b.save()
        
        print(f"Set loan {loan.loan_number} due to {target_date} for borrower {b.first_name}")
        
        # Now trigger the task
        processed = send_upcoming_payment_reminders()
        print(f"Processed {processed} reminders")
    else:
        print("No pending schedule found for this loan")
else:
    print("Loan LN2026020001 not found")
