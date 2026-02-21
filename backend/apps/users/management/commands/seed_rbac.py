from django.core.management.base import BaseCommand
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from apps.users.models import Role
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Seed standardized roles and permissions for RBAC'

    def handle(self, *args, **options):
        self.stdout.write("Seeding RBAC roles and permissions...")

        # Define Roles
        roles_data = {
            'Administrator': {
                'description': 'Full system access',
                'permissions': '__all__',
                'is_system_role': True,
                'approval_limit': 10000000.00
            },
            'Branch Manager': {
                'description': 'Oversees branch operations and local approvals',
                'permissions': [
                    # Borrowers
                    'customers.view_borrower', 'customers.add_borrower', 'customers.change_borrower',
                    # Loans & Products
                    'loans.view_loan', 'loans.view_loanapplication', 'loans.add_loanapplication', 
                    'loans.change_loanapplication', 'loans.view_loanproduct', 'loans.view_collectioncase',
                    # Savings & Investors
                    'savings.view_savingsaccount', 'investors.view_investor',
                    # Collateral
                    'collateral.view_collateral',
                    # Accounting & Treasury
                    'accounting.view_ledgerentry', 'accounting.view_chartofaccount', 'accounting.view_journalentry',
                    'treasury.view_cashaccount', 'treasury.view_transaction', 'treasury.view_dailysnapshot',
                    # Expenses & Payroll
                    'expenses.view_expense', 'users.view_payrollrecord',
                    # Staff & Branches
                    'users.view_user', 'branches.view_branch',
                    # Communications & Audit
                    'notifications.view_communicationlog', 'auditlog.view_activitylog'
                ],
                'is_system_role': True,
                'approval_limit': 500000.00
                
            },
            'Credit Manager': {
                'description': 'Senior credit review and high-limit approvals',
                'permissions': [
                    'customers.view_borrower', 'loans.view_loan', 'loans.view_loanapplication',
                    'loans.change_loanapplication', 'collateral.view_collateral'
                ],
                'is_system_role': True,
                'approval_limit': 1000000.00
            },
            'Credit Officer': {
                'description': 'Manages loan applications and active loans',
                'permissions': [
                    'customers.view_borrower', 'customers.add_borrower',
                    'loans.view_loan', 'loans.view_loanapplication', 'loans.add_loanapplication',
                    'loans.view_loanproduct', 'collateral.view_collateral', 'collateral.add_collateral'
                ],
                'is_system_role': True,
                'approval_limit': 50000.00
            },
            'Accountant': {
                'description': 'Financial reporting and journal management',
                'permissions': [
                    'accounting.view_ledgerentry', 'accounting.add_journalentry', 
                    'accounting.view_journalentry', 'treasury.view_cashaccount',
                    'treasury.view_transaction', 'treasury.view_dailysnapshot', 
                    'expenses.view_expense', 'expenses.add_expense'
                ],
                'is_system_role': True,
                'approval_limit': 0.00
            },
            'Field Officer': {
                'description': 'Borrower recruitment and collection management',
                'permissions': [
                    'customers.view_borrower', 'customers.add_borrower',
                    'loans.view_loan', 'loans.view_collectioncase'
                ],
                'is_system_role': True,
                'approval_limit': 0.00
            },
            'Collection Officer': {
                'description': 'Debt recovery and arrears management',
                'permissions': [
                    'customers.view_borrower', 'loans.view_loan', 
                    'loans.view_collectioncase', 'loans.change_collectioncase'
                ],
                'is_system_role': True,
                'approval_limit': 0.00
            },
            'Cashier': {
                'description': 'Processes payments and savings transactions',
                'permissions': [
                    'loans.view_loan', 'savings.view_savingsaccount', 'savings.add_savingsaccount',
                    'treasury.view_cashaccount', 'treasury.add_transaction'
                ],
                'is_system_role': True,
                'approval_limit': 0.00
            }
        }

        all_perms = Permission.objects.all()

        for role_name, data in roles_data.items():
            role, created = Role.objects.update_or_create(
                name=role_name,
                defaults={
                    'description': data['description'],
                    'is_system_role': data.get('is_system_role', False),
                    'approval_limit': data.get('approval_limit', 0.00)
                }
            )
            
            if data['permissions'] == '__all__':
                role.permissions.set(all_perms)
            else:
                perm_objs = []
                for perm_str in data['permissions']:
                    if '.' not in perm_str:
                        continue
                    app_label, codename = perm_str.split('.')
                    try:
                        perm = Permission.objects.get(content_type__app_label=app_label, codename=codename)
                        perm_objs.append(perm)
                    except Permission.DoesNotExist:
                        self.stderr.write(self.style.WARNING(f"Permission {perm_str} not found. Skipping."))
                
                role.permissions.set(perm_objs)
            
            status = "Created" if created else "Updated"
            self.stdout.write(self.style.SUCCESS(f"{status} role: {role_name}"))

        self.stdout.write(self.style.SUCCESS("RBAC seeding completed successfully."))
