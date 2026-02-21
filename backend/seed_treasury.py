import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.accounts.models import Organization
from apps.treasury.models import CashAccount
from apps.accounting.models import ChartOfAccount
from django.core.management import call_command

def seed_treasury():
    org = Organization.objects.first()
    if not org:
        print("No organization found.")
        return

    print(f"Seeding treasury for: {org.company_name}")

    # Map of account names to COA codes
    cash_configs = [
        {'name': 'Main Office Till', 'type': 'cash', 'code': '1120'},
        {'name': 'Operational Bank Account', 'type': 'bank', 'code': '1110'},
        {'name': 'M-Pesa Paybill Wallet', 'type': 'mobile_money', 'code': '1130'},
    ]

    for config in cash_configs:
        coa = ChartOfAccount.objects.filter(organization=org, code=config['code']).first()
        if not coa:
            print(f"COA {config['code']} not found for {org.company_name}")
            continue
        
        CashAccount.objects.update_or_create(
            organization=org,
            name=config['name'],
            defaults={
                'account_type': config['type'],
                'coa_account': coa,
                'is_active': True,
                'opening_balance': 0,
            }
        )
        print(f"  Created/Updated: {config['name']} -> {coa.code}")

    print("\n✓ Treasury setup complete!")

if __name__ == "__main__":
    seed_treasury()
