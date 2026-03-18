import os
import django
import sys
from decimal import Decimal

# Set up Django
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.treasury.models import CashAccount, Transaction
from apps.accounting.models import ChartOfAccount, JournalEntry
from apps.accounts.models import Organization

def test_treasury_automation():
    org = Organization.objects.first()
    if not org:
        print("No organization found")
        return

    print(f"Testing for Organization: {org.company_name}")

    # 1. Test Auto COA Creation
    account_name = f"Test Bank {os.urandom(2).hex()}"
    print(f"Creating new CashAccount: {account_name}")
    
    acc = CashAccount.objects.create(
        organization=org,
        name=account_name,
        account_type=CashAccount.AccountType.BANK,
        opening_balance=Decimal('1000.00')
    )
    
    if acc.coa_account:
        print(f"SUCCESS: COA Account auto-created and linked: {acc.coa_account.code} ({acc.coa_account.name})")
    else:
        print("FAILURE: No COA account linked.")
        return

    # 2. Test Top Up
    print(f"Performing Top-Up of 500.00 to {acc.name}")
    # Simulate API top_up logic
    from django.db import transaction as db_transaction
    from apps.treasury.services.integrity import post_manual_treasury_transaction
    
    with db_transaction.atomic():
        trx = Transaction.objects.create(
            account=acc,
            transaction_type=Transaction.TransactionType.CREDIT,
            category=Transaction.Category.OTHER,
            amount=Decimal('500.00'),
            description="Test Top Up",
            created_by=None # System
        )
        post_manual_treasury_transaction(trx)

    acc.refresh_from_db()
    acc.coa_account.refresh_from_db()
    
    print(f"New Treasury Balance: {acc.current_balance}")
    print(f"New COA Balance: {acc.coa_account.balance}")
    
    if acc.current_balance == Decimal('1500.00') and acc.coa_account.balance == Decimal('1500.00'):
        print("SUCCESS: Treasury and COA balances are in sync.")
    else:
        print("FAILURE: Balances are out of sync.")

if __name__ == "__main__":
    test_treasury_automation()
