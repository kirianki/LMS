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
            for role_name, desc in [
                ('Credit Officer', 'Loan application review and approval'),
                ('Collection Officer', 'Debt recovery management')
            ]:
                if not Role.objects.filter(name=role_name).exists():
                    r = Role(name=role_name, description=desc, is_system_role=True)
                    r._history_user = None
                    r.save()

            # 3. Create Admin User
            admin_email = f"admin@{tenant.schema_name}.local"
            if not User.objects.filter(email=admin_email).exists():
                admin_user = User(
                    email=admin_email,
                    first_name=f"{tenant.name}",
                    last_name="Admin",
                    role=admin_role,
                    is_staff=True
                )
                admin_user.set_password("InitPassword123!")
                admin_user._history_user = None
                admin_user.save()
