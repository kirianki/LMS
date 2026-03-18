import os
import django
import sys
from decimal import Decimal

# Set up Django
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.loans.models import Loan
from apps.accounts.models import Organization
from django.db.models import Sum

def check():
    orgs = Organization.objects.all()
    for o in orgs:
        stats = Loan.objects.filter(organization=o, status__in=['active', 'defaulted']).aggregate(p=Sum('outstanding_principal'), i=Sum('outstanding_interest'))
        print(f"Org {o.company_name}: P={stats['p']}, I={stats['i']}")

if __name__ == "__main__":
    check()
