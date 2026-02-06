from django.db import transaction
from django_tenants.utils import schema_context
from apps.tenants.models import Tenant
from apps.branches.models import Branch, BranchAssignment
from apps.customers.models import Borrower
from apps.loans.models import Loan
from apps.savings.models import SavingsAccount
from apps.accounting.models import JournalEntry
from apps.expenses.models import Expense
from apps.collateral.models import Collateral
from apps.investors.models import Investor
from django.contrib.auth import get_user_model

User = get_user_model()

def migrate_to_hq():
    """
    Migrates all records without a branch to the "Main HQ" branch for all tenants.
    """
    tenants = Tenant.objects.exclude(schema_name='public')
    
    for tenant in tenants:
        print(f"Migrating tenant: {tenant.name}...")
        with schema_context(tenant.schema_name):
            with transaction.atomic():
                # 1. Ensure Main HQ exists
                hq, created = Branch.objects.get_or_create(
                    name='Main HQ',
                    defaults={'code': 'HQ001', 'is_active': True}
                )
                if created:
                    print(f"  Created 'Main HQ' for {tenant.name}")

                # 2. Assign Users without branch to HQ
                users_to_assign = User.objects.filter(branch_assignment__isnull=True)
                for user in users_to_assign:
                    BranchAssignment.objects.create(user=user, branch=hq)
                print(f"  Assigned {users_to_assign.count()} users to HQ")

                # 3. Update core models
                models_to_update = [
                    (Borrower, 'borrowers'),
                    (Loan, 'loans'),
                    (SavingsAccount, 'savings accounts'),
                    (JournalEntry, 'journal entries'),
                    (Expense, 'expenses'),
                    (Collateral, 'collateral'),
                    (Investor, 'investors')
                ]

                for model, label in models_to_update:
                    count = model.objects.filter(branch__isnull=True).update(branch=hq)
                    print(f"  Updated {count} {label}")

    print("Migration complete!")

if __name__ == "__main__":
    import django
    import os
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
    django.setup()
    migrate_to_hq()
