from django.db.models.signals import post_save
from django.dispatch import receiver
from django_tenants.utils import schema_context
from django_tenants.signals import post_schema_sync
from .models import Tenant, TenantSettings
from django.contrib.auth import get_user_model

@receiver(post_save, sender=Tenant)
def create_tenant_settings(sender, instance, created, **kwargs):
    if created:
        TenantSettings.objects.get_or_create(tenant=instance)

@receiver(post_schema_sync)
def bootstrap_tenant_data(sender, **kwargs):
    """
    Automatically create default roles and an admin user 
    when a new tenant is created and schema is synced.
    """
    tenant = kwargs.get('tenant')
    if tenant and tenant.schema_name != 'public':
        with schema_context(tenant.schema_name):
            from apps.users.models import Role
            User = get_user_model()

            # 1. Create Default Administrator Role
            # Note: We avoid get_or_create to manually set _history_user = None
            # This prevents FK violations with simple-history in multi-tenant setup
            if not Role.objects.filter(name='Administrator').exists():
                admin_role = Role(
                    name='Administrator',
                    description='Full system access',
                    is_system_role=True,
                    approval_limit=10000000.00
                )
                admin_role._history_user = None
                admin_role.save()
            else:
                admin_role = Role.objects.get(name='Administrator')

            # 2. Create Default Other Roles
            for role_name, desc, limit in [
                ('Branch Manager', 'Oversees branch operations and local approvals', 500000.00),
                ('Credit Manager', 'Senior credit review and high-limit approvals', 1000000.00),
                ('Credit Officer', 'Standard loan application review', 50000.00),
                ('Accountant', 'Financial reporting and journal management', 0.00),
                ('Field Officer', 'Borrower recruitment and collection management', 0.00),
                ('Collection Officer', 'Debt recovery and arrears management', 0.00)
            ]:
                if not Role.objects.filter(name=role_name).exists():
                    r = Role(
                        name=role_name, 
                        description=desc, 
                        is_system_role=True,
                        approval_limit=limit
                    )
                    r._history_user = None
                    r.save()

            # 3. Create Default Branch (Main HQ)
            from apps.branches.models import Branch, BranchAssignment
            if not Branch.objects.filter(name='Main HQ').exists():
                main_hq = Branch(
                    name='Main HQ',
                    code='HQ001',
                    address=f"{tenant.name} Headquarters",
                    is_active=True
                )
                main_hq._history_user = None
                main_hq.save()
            else:
                main_hq = Branch.objects.get(name='Main HQ')

            # 4. Auto-assign first user to Main HQ
            # This ensures that a tenant owner (or the first user created) 
            # is automatically linked to the headquarters branch.
            first_user = User.objects.filter(is_active=True).first()
            if first_user and not BranchAssignment.objects.filter(user=first_user).exists():
                assignment = BranchAssignment(user=first_user, branch=main_hq)
                assignment._history_user = None
                assignment.save()
                
                # Also ensure they have the Administrator role if they don't have one
                if not first_user.role:
                    first_user.role = admin_role
                    first_user._history_user = None
                    first_user.save()
