import datetime
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.loans.models import Loan, RepaymentSchedule
from apps.loans.tasks import calculate_loan_penalties, send_overdue_payment_reminders, update_arrears_status

class Command(BaseCommand):
    help = 'Test collections logic by simulating an overdue loan.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("Running collections logic test..."))
        
        # 1. Find or Create an Active Loan
        loan = Loan.objects.filter(status='active').first()
        if not loan:
            self.stdout.write(self.style.ERROR("No active loan found to test."))
            return

        self.stdout.write(f"Testing with Loan: {loan.loan_number} (Outstanding: {loan.outstanding_balance})")
        
        # 2. Manipulate a Schedule to be Overdue
        # Find the next pending schedule
        schedule = RepaymentSchedule.objects.filter(
            loan=loan, 
            status='pending'
        ).order_by('due_date').first()
        
        if not schedule:
            self.stdout.write(self.style.ERROR("No pending schedule found."))
            return
            
        original_due_date = schedule.due_date
        
        # Set due date to 9 days ago (to trigger 3-day reminder interval: 9 % 3 == 0)
        new_due_date = datetime.date.today() - datetime.timedelta(days=9)
        schedule.due_date = new_due_date
        schedule.save()
        
        self.stdout.write(self.style.WARNING(f"Moved schedule {schedule.installment_number} due date from {original_due_date} to {new_due_date}"))
        
        # 3. Trigger Tasks
        self.stdout.write("Running update_arrears_status...")
        update_arrears_status()
        
        self.stdout.write("Running calculate_loan_penalties...")
        calculate_loan_penalties()
        
        self.stdout.write("Running send_overdue_payment_reminders...")
        send_overdue_payment_reminders()
        
        # 4. Verify Results
        loan.refresh_from_db()
        schedule.refresh_from_db()
        
        from apps.notifications.models import CommunicationLog
        logs_count = CommunicationLog.objects.filter(related_loan=loan).count()
        
        self.stdout.write("\nVerification Results:")
        self.stdout.write(f"Loan Status: {loan.status}")
        self.stdout.write(f"Outstanding Penalties: {loan.outstanding_penalties}")
        self.stdout.write(f"Schedule Status: {schedule.status}")
        self.stdout.write(f"Schedule Penalty Due: {schedule.penalty_due}")
        self.stdout.write(f"Communication Logs count: {logs_count}")
        
        if schedule.status == 'overdue' and schedule.penalty_due > 0 and logs_count > 0:
            self.stdout.write(self.style.SUCCESS("TEST PASSED: Arrears updated, penalties applied, and reminders logged."))
        else:
            self.stdout.write(self.style.ERROR("TEST FAILED: Check logs above for details."))
