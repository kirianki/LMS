import os
import django
from decimal import Decimal

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.accounting.reports import generate_general_ledger
from apps.accounting.models import ChartOfAccount, LedgerEntry

def verify_recursive_gl():
    print("--- Verifying Recursive General Ledger ---")
    
    # Target: Current Assets (Salene credit ltd)
    parent_code = '1100'
    parent_acc = ChartOfAccount.objects.filter(code=parent_code, organization__company_name='Salene credit ltd').first()
    
    if not parent_acc:
        print(f"Error: Parent account {parent_code} not found for Salene credit ltd.")
        return

    print(f"Parent Account: {parent_acc.code} - {parent_acc.name} ({parent_acc.id})")
    
    # Check if it has children
    children = parent_acc.children.all()
    print(f"Children: {[f'{c.code} - {c.name}' for c in children]}")
    
    # Count entries for children
    child_entry_count = LedgerEntry.objects.filter(account__in=children, is_posted=True).count()
    parent_entry_count = LedgerEntry.objects.filter(account=parent_acc, is_posted=True).count()
    print(f"Direct Entries in Parent: {parent_entry_count}")
    print(f"Direct Entries in Children: {child_entry_count}")
    
    # Call the report
    data = generate_general_ledger(account_id=str(parent_acc.id))
    
    report_history = data['history']
    print(f"Report Entries Count: {len(report_history)}")
    
    if len(report_history) == (parent_entry_count + child_entry_count):
        print("SUCCESS: Report includes all entries from parent and children.")
    else:
        print(f"FAILURE: Report entry count ({len(report_history)}) mismatch.")
        
    # Check if account_code is present in history items
    if all('account_code' in item for item in report_history):
        print("SUCCESS: Each history item includes account_code.")
    else:
        print("FAILURE: Some history items are missing account_code.")

    # Check some child entries in history
    child_codes = [c.code for c in children]
    found_child_entries = [h for h in report_history if h['account_code'] in child_codes]
    print(f"Found {len(found_child_entries)} child entries in report history.")

if __name__ == "__main__":
    verify_recursive_gl()
