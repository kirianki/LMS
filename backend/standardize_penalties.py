import os
import django
from decimal import Decimal
from django.utils import timezone

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.loans.models import Loan, LoanProduct, RepaymentSchedule

def update_penalties():
    print("--- Updating Loan Products ---")
    products_updated = LoanProduct.objects.all().update(
        penalty_type='percentage',
        penalty_value=Decimal('10.00'),
        penalty_basis='per_month'
    )
    print(f"Updated {products_updated} loan products.")

    print("\n--- Updating Existing Loans ---")
    loans_updated = Loan.objects.all().update(
        penalty_type='percentage',
        penalty_value=Decimal('10.00'),
        penalty_basis='per_month'
    )
    print(f"Updated {loans_updated} existing loans.")

    print("\n--- Correcting LN2026020004 ---")
    try:
        loan = Loan.objects.get(loan_number='LN2026020004')
        
        # 1. Reset Penalty on Schedules
        schedules = loan.schedules.all()
        total_new_penalty = Decimal('0.00')
        
        for s in schedules:
            # If it's overdue, but less than 30 days, should it have a penalty?
            # User said "10% monthly". In 4 days, maybe it should be 0 or flat?
            # Actually, standard logic for per_month is 10% once it hits a month.
            # But maybe they want 10% IMMEDIATELY for the first month?
            # If so, per_installment might be better?
            # But they said "10 monthly".
            
            # Let's see... if I set it back to 0, and they want it to be 10% for the first month, 
            # I should clarify. BUT, they said it "should be 10% of the overdue principle".
            
            # If I set it to exactly 10% of overdue principal (one-off), it would be 1666.67.
            
            # Let's reset it to 0 and let the task recalculate if we use per_month?
            # NO, if it's per_month and only 4 days late, task will set it to 0.
            
            # If I set it to 1666.67 (10% flat), that would be MORE correct for "10 monthly".
            
            if s.installment_number == 1 and s.due_date < timezone.now().date():
                s.penalty_due = (s.principal_due * Decimal('0.10')).quantize(Decimal('0.01'))
                s.last_penalty_accrual_date = s.due_date # Start from due date
                s.save()
                total_new_penalty += s.penalty_due
            else:
                s.penalty_due = Decimal('0.00')
                s.last_penalty_accrual_date = None
                s.save()
        
        # 2. Update Loan Level
        loan.outstanding_penalties = total_new_penalty
        loan.outstanding_balance = (
            loan.outstanding_principal + 
            loan.outstanding_interest + 
            loan.outstanding_penalties
        )
        loan.save()
        print(f"Loan LN2026020004 corrected. New Penalty: {loan.outstanding_penalties}, Balance: {loan.outstanding_balance}")

    except Loan.DoesNotExist:
        print("Loan LN2026020004 not found for correction.")

if __name__ == "__main__":
    update_penalties()
