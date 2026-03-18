import os
import django
import sys
from decimal import Decimal

# Set up Django
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.loans.models import Loan
from apps.accounting.models import ChartOfAccount, LedgerEntry, JournalEntry
from apps.accounts.models import Organization
from django.db.models import Sum
from django.db import transaction
from django.utils import timezone

def accrue_interest():
    with transaction.atomic():
        print("Starting Interest Accrual for all organizations...")

        orgs = Organization.objects.all()
        for org in orgs:
            print(f"\nProcessing Organization: {org.company_name or 'Default'}")
            
            # 1. Get total outstanding interest from Loans for this org
            total_outstanding_interest = Loan.objects.filter(
                organization=org, 
                status__in=['active', 'defaulted']
            ).aggregate(i=Sum('outstanding_interest'))['i'] or Decimal('0.00')
            
            print(f"  Total Outstanding Interest (Dashboard): {total_outstanding_interest}")

            # 2. Check current balance of Interest Receivable (1220) for this org
            try:
                coa_interest_rec = ChartOfAccount.objects.get(code='1220', organization=org)
            except ChartOfAccount.DoesNotExist:
                print(f"  COA 1220 not found for organization {org.id}. Skipping.")
                continue
            except ChartOfAccount.MultipleObjectsReturned:
                # If multiple exist, pick the primary one or logs warning
                coa_interest_rec = ChartOfAccount.objects.filter(code='1220', organization=org).first()
                print(f"  WARNING: Multiple 1220 accounts found for {org.id}. Using first one.")

            current_gl_receivable = coa_interest_rec.balance
            print(f"  Current GL Interest Receivable (1220): {current_gl_receivable}")

            # 3. Calculate adjustment needed
            adjustment = total_outstanding_interest - current_gl_receivable
            
            if adjustment == 0:
                print("  Interest is already in sync.")
                continue

            print(f"  Adjustment needed: {adjustment}")

            # 4. Create Accrual Journal Entry
            from apps.accounting.services import create_double_entry
            
            create_double_entry(
                date=timezone.now().date(),
                description=f"Interest Accrual: Alignment to dashboard outstanding interest",
                reference=f"ACCRUE-{org.id}-{timezone.now().strftime('%H%M%S')}",
                debits=[('1220', adjustment)],
                credits=[('4100', adjustment)],
                organization=org
            )
            
            print(f"  Created Accrual Entry for {adjustment}")

        print("\nInterest Accrual Complete.")

if __name__ == "__main__":
    accrue_interest()
