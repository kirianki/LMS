import os
import django
import sys
from decimal import Decimal

sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.loans.models import Loan, LoanRepayment, RepaymentSchedule

def debug_loan(loan_num):
    try:
        loan = Loan.objects.get(loan_number=loan_num)
        print(f"=== LOAN {loan.loan_number} ({loan.borrower}) ===")
        print(f"Status: {loan.status}")
        print(f"Disbursed Amount: {loan.disbursed_amount}")
        print(f"Interest Rate: {loan.interest_rate}% per {loan.interest_period}")
        print(f"Outstanding Principal: {loan.outstanding_principal}")
        
        schedule_total_int_due = sum(s.interest_due for s in loan.schedules.all())
        schedule_total_int_paid = sum(s.interest_paid for s in loan.schedules.all())
        print(f"Schedule - Total Interest Due: {schedule_total_int_due}")
        print(f"Schedule - Total Interest Paid: {schedule_total_int_paid}")
        print(f"Schedule - Unpaid Interest (Due - Paid): {schedule_total_int_due - schedule_total_int_paid}")
        
        print(f"\nLoan Model Field - Outstanding Interest: {loan.outstanding_interest}")
        
        print("\n--- SCHEDULE ---")
        for s in loan.schedules.all().order_by('due_date'):
            print(f"Date: {s.due_date} | Due: P={s.principal_due}, I={s.interest_due} | Paid: P={s.principal_paid}, I={s.interest_paid} | Status: {s.status}")

        print("\n--- REPAYMENTS ---")
        for r in loan.repayments.all().order_by('payment_date'):
            print(f"Date: {r.payment_date} | Amount: {r.amount} | Principal: {r.principal_paid} | Interest: {r.interest_paid} | Status: {r.status}")

        print(f"\nDiscrepancy: Modeled Outstanding Interest = {loan.outstanding_interest}, Calculated from Schedule = {schedule_total_int_due - schedule_total_int_paid}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    debug_loan('LN2026020006')
