import os
import django

# Setup Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django_tenants.utils import schema_context
from apps.tenants.models import Tenant
from apps.accounting.utils import seed_standard_coa

def run():
    tenants = Tenant.objects.all()
    print(f"Found {tenants.count()} tenants.")
    for tenant in tenants:
        print(f"\n--- Seeding COA for Tenant: {tenant.name} ({tenant.schema_name}) ---")
        with schema_context(tenant.schema_name):
            try:
                seed_standard_coa()
                print(f"Successfully seeded/updated accounts for {tenant.name}.")
            except Exception as e:
                print(f"Error seeding COA for {tenant.name}: {e}")

if __name__ == "__main__":
    run()
