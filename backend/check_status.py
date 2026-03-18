import os
import django
import sys
from decimal import Decimal

# Set up Django
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.loans.models import Loan
from django.db.models import Sum

def check():
    statuses = Loan.objects.values_list('status', flat=True).distinct()
    for s in statuses:
        stats = Loan.objects.filter(status=s).aggregate(p=Sum('outstanding_principal'), i=Sum('outstanding_interest'))
        print(f"Status {s}: P={stats['p']}, I={stats['i']}")

if __name__ == "__main__":
    check()
