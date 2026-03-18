import os
import django
import sys
from decimal import Decimal

sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.loans.models import Loan
from apps.loans.services.reconciler import LoanReconciler

def test_reconcile():
    loan = Loan.objects.get(loan_number='LN2026020006')
    print(f"BEFORE: outstanding_interest = {loan.outstanding_interest}")
    reconciler = LoanReconciler()
    reconciler.reconcile_loan(loan.id)
    
    loan.refresh_from_db()
    print(f"AFTER: outstanding_interest = {loan.outstanding_interest}")

if __name__ == "__main__":
    test_reconcile()
