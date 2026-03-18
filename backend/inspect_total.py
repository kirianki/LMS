import os
import django
import sys
from decimal import Decimal

sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.loans.models import Loan

def check():
    loan = Loan.objects.get(loan_number='LN2026020006')
    print(f"Total Interest: {loan.total_interest}")
    print(f"Outstanding Interest: {loan.outstanding_interest}")
    repayments = loan.repayments.all()
    print(f"Repayments: {[r.interest_paid for r in repayments]}")

if __name__ == "__main__":
    check()
