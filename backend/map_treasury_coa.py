import os
import django

# Setup Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django_tenants.utils import schema_context
from apps.tenants.models import Tenant
from apps.treasury.models import CashAccount
from apps.accounting.models import ChartOfAccount

def map_treasury_to_coa():
    tenants = Tenant.objects.all()
    print(f"Found {tenants.count()} tenants.")
    
    mapping = {
        'mobile_money': '1130',
        'bank': '1110',
        'cash': '1120'
    }

    for tenant in tenants:
        print(f"\n--- Mapping Treasury for Tenant: {tenant.name} ({tenant.schema_name}) ---")
        with schema_context(tenant.schema_name):
            try:
                accounts = CashAccount.objects.all()
                for acc in accounts:
                    target_code = mapping.get(acc.account_type)
                    if target_code:
                        coa = ChartOfAccount.objects.filter(code=target_code).first()
                        if coa:
                            acc.coa_account = coa
                            acc.save()
                            print(f"Mapped {acc.name} ({acc.account_type}) to COA {target_code}")
                        else:
                            print(f"COA Account {target_code} not found for {acc.name}")
            except Exception as e:
                print(f"Error mapping for {tenant.name}: {e}")

if __name__ == "__main__":
    map_treasury_to_coa()
