import os
import django
import sys
from decimal import Decimal

# Set up Django
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.loans.models import Loan
from apps.branches.models import Branch
from django.db.models import Sum

def check():
    branches = Branch.objects.all()
    for b in branches:
        stats = Loan.objects.filter(borrower__branch=b, status__in=['active', 'defaulted']).aggregate(p=Sum('outstanding_principal'), i=Sum('outstanding_interest'))
        print(f"Branch {b.name}: P={stats['p']}, I={stats['i']}")

if __name__ == "__main__":
    check()
