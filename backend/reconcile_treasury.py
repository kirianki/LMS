import os
import django
from decimal import Decimal

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.treasury.models import CashAccount, Transaction

def reconcile_treasury_balances():
    print("--- Reconciling Treasury Balances ---")
    
    for account in CashAccount.objects.all():
        print(f"\nAccount: {account.name}")
        print(f"  Opening Balance: {account.opening_balance}")
        print(f"  Reported Current Balance: {account.current_balance}")
        
        # Calculate sum of transactions
        # Credit = Money In (+), Debit = Money Out (-)
        transactions = Transaction.objects.filter(account=account).order_by('created_at')
        tx_sum = Decimal('0.00')
        for tx in transactions:
            if tx.transaction_type == 'credit':
                tx_sum += tx.amount
            else:
                tx_sum -= tx.amount
            
            # Optionally update balance_after for each transaction if needed
            # For now just checking final balance
        
        computed_balance = account.opening_balance + tx_sum
        print(f"  Computed Balance: {computed_balance}")
        
        if account.current_balance != computed_balance:
            print(f"  [!] MISMATCH FOUND: Difference is {account.current_balance - computed_balance}")
            account.current_balance = computed_balance
            account.save()
            print(f"  [+] Reconciled: New current_balance set to {account.current_balance}")
        else:
            print("  [✓] Balance is correct.")

if __name__ == "__main__":
    reconcile_treasury_balances()
