import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.treasury.models import CashAccount, Transaction
from apps.accounting.models import ChartOfAccount, LedgerEntry

def compare_balances():
    # Typically 1110 is the Bank account code
    bank_coas = ChartOfAccount.objects.filter(code='1110')
    if not bank_coas.exists():
        print("No ChartOfAccount with code '1110' found.")
        return

    for bank_coa in bank_coas:
        print(f"\n==========================================")
        print(f"Auditing COA: {bank_coa.code} - {bank_coa.name} (Org: {getattr(bank_coa, 'organization', 'None')})")
        print(f"Current COA Balance: {bank_coa.balance}")
        
        cash_accounts = CashAccount.objects.filter(coa_account=bank_coa)
        if not cash_accounts.exists():
            print(f"  -> WARNING: No CashAccount linked to this COA.")
            continue
            
        for cash_account in cash_accounts:
            print(f"\n  Linked CashAccount: {cash_account.name} (Org: {getattr(cash_account, 'organization', 'None')})")
            print(f"  Current Treasury Balance: {cash_account.current_balance}")
            
            diff = bank_coa.balance - cash_account.current_balance
            print(f"  DIFFERENCE (COA - Treasury): {diff}")
            
            print(f"\n  --- Treasury Transactions ---")
            treasury_txns = Transaction.objects.filter(account=cash_account).order_by('created_at')
            t_balance = 0
            for t in treasury_txns:
                t_balance += t.amount if t.transaction_type == 'credit' else -t.amount
                print(f"  [{t.created_at.strftime('%Y-%m-%d %H:%M')}] {t.transaction_type.upper():<6} | {t.amount:>10} | {t.category:<15} | Ref: {t.reference} | RunBal: {t_balance}")
            
            print(f"\n  --- COA Ledger Entries ---")
            ledger_entries = LedgerEntry.objects.filter(account=bank_coa).order_by('journal_entry__date', 'id')
            l_balance = 0
            for l in ledger_entries:
                l_balance += l.amount if l.entry_type == 'debit' else -l.amount # Assuming Bank is Asset (Debit normally increases it)
                print(f"  [{l.journal_entry.date.strftime('%Y-%m-%d')}] {l.entry_type.upper():<6} | {l.amount:>10} | Ref: {l.journal_entry.reference:<15} | RunBal: {l_balance} | Desc: {l.journal_entry.description}")
            
            print(f"\n  Final Computed Treasury Balance: {t_balance}")
            print(f"  Final Computed COA Balance: {l_balance}")
            print(f"  Database COA Balance: {bank_coa.balance}")
            print(f"  Database Treasury Balance: {cash_account.current_balance}")
            
if __name__ == '__main__':
    compare_balances()
