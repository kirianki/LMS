import os
import django
import sys
from decimal import Decimal

# Set up Django
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.accounting.models import JournalEntry, ChartOfAccount, LedgerEntry
from django.db.models import Sum

def cleanup():
    # 1. Delete all incorrect REV- journals
    journals = JournalEntry.objects.filter(reference__startswith='REV-')
    count = journals.count()
    journals.delete()
    print(f"Deleted {count} incorrect reversal journals.")

    # 2. Recalculate all COA balances
    accounts = ChartOfAccount.objects.all()
    for acc in accounts:
        debits = LedgerEntry.objects.filter(account=acc, entry_type='debit').aggregate(s=Sum('amount'))['s'] or Decimal('0.00')
        credits = LedgerEntry.objects.filter(account=acc, entry_type='credit').aggregate(s=Sum('amount'))['s'] or Decimal('0.00')
        
        if acc.account_type in ['asset', 'expense']:
            new_bal = debits - credits
        else:
            new_bal = credits - debits
            
        acc.balance = new_bal
        acc.save()
        print(f"Restored {acc.code} ({acc.name}) balance to {new_bal}")

if __name__ == "__main__":
    cleanup()
