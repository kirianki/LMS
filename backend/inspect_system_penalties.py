import os
import django
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.loans.models import Loan, LoanProduct

def inspect_system():
    print("--- Loan Products ---")
    for p in LoanProduct.objects.all():
        print(f"Product: {p.name}")
        print(f"  Penalty: {p.penalty_value} ({p.penalty_type}), Basis: {p.penalty_basis}, Grace: {p.penalty_grace_period}")
    
    print("\n--- Active Loans with Penalties ---")
    loans = Loan.objects.filter(outstanding_penalties__gt=0, status__in=['active', 'defaulted'])
    for l in loans:
        print(f"Loan: {l.loan_number}, Penalty: {l.outstanding_penalties}, Status: {l.status}")
        print(f"  Setting: {l.penalty_value} ({l.penalty_type}), Basis: {l.penalty_basis}")

if __name__ == "__main__":
    inspect_system()
