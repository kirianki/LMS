import os
import django
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.loans.models import Loan

def inspect_loan(loan_number):
    try:
        loan = Loan.objects.get(loan_number=loan_number)
        print(f"Loan: {loan.loan_number}")
        print(f"Status: {loan.status}")
        print(f"Principal: {loan.principal_amount}")
        print(f"Outstanding Balance: {loan.outstanding_balance}")
        print(f"Outstanding Penalty: {loan.outstanding_penalties}")
        print(f"Penalty Type: {loan.penalty_type}")
        print(f"Penalty Value: {loan.penalty_value}")
        print(f"Penalty Basis: {loan.penalty_basis}")
        print(f"Penalty Grace Period: {loan.penalty_grace_period}")
        print("\nSchedules:")
        for s in loan.schedules.all().order_by('due_date'):
            print(f"Inst {s.installment_number}: Due {s.due_date}, Total Due {s.total_due}, Paid {s.paid_amount}, Penalty Due {s.penalty_due}, Status {s.status}")
            if s.penalty_due > 0:
                print(f"  Penalty breakdown: Paid {s.penalty_paid}, Last Accrual {s.last_penalty_accrual_date}")
        
        print("\nRecent Repayments:")
        for r in loan.repayments.all().order_by('-payment_date')[:5]:
            print(f"Date: {r.payment_date}, Amount: {r.amount}, Penalty Paid: {r.penalty_paid}, Method: {r.payment_method}")
            
    except Loan.DoesNotExist:
        print(f"Loan {loan_number} not found.")

if __name__ == "__main__":
    inspect_loan('LN2026020004')
