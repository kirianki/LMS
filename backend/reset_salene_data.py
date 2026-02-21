import os
import django
from django.conf import settings
from decimal import Decimal

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.accounts.models import Organization
from apps.loans.models import Loan, LoanApplication
from apps.accounting.models import ChartOfAccount, JournalEntry, LedgerEntry
from apps.treasury.models import Transaction, CashAccount
from django.core.management import call_command

def reset_org_data(org_id):
    try:
        org = Organization.objects.get(id=org_id)
        print(f"--- Resetting data for: {org.company_name} (ID: {org_id}) ---")
    except Organization.DoesNotExist:
        print(f"Error: Organization with ID {org_id} not found.")
        return

    # 1. Delete Treasury Transactions (Protected by CashAccount)
    print("Deleting Treasury Transactions...")
    Transaction.objects.filter(organization=org).delete()

    # 2. Delete Journal Entries and Ledger Entries
    print("Deleting Journal Entries (cascades to Ledger Entries)...")
    JournalEntry.objects.filter(organization=org).delete()

    # 3. Delete Loans and Applications
    print("Deleting Loans...")
    Loan.objects.filter(organization=org).delete()
    print("Deleting Loan Applications...")
    LoanApplication.objects.filter(organization=org).delete()

    # 4. Delete Cash Accounts (linked to COA)
    print("Deleting Cash Accounts...")
    CashAccount.objects.filter(organization=org).delete()

    # 5. Delete Chart of Accounts
    print("Deleting Chart of Accounts...")
    # We delete them in reverse or handle parents
    # Actually, children link to parent with SET_NULL or CASCADE?
    # backend/apps/accounting/models.py:25: parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='children')
    ChartOfAccount.objects.filter(organization=org).delete()

    print("\nPurge complete. Re-initializing COA...")
    
    # 6. Run init_coa
    # The command init_coa iterates through all orgs, so it will recreate for Salene
    call_command('init_coa')
    
    print("\n--- Reset Complete! ---")

if __name__ == "__main__":
    # Salene org ID is 2
    reset_org_data(2)
