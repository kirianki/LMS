from django.core.management.base import BaseCommand
from django.contrib.auth.models import Permission
from apps.users.models import Role
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Setup initial administrative roles and permissions'

    def handle(self, *args, **options):
        self.stdout.write('Setting up administrative roles...')
        
        # 1. Create Company Administrator Role
        company_admin_role, created = Role.objects.get_or_create(
            name='Company Administrator',
            defaults={
                'description': 'Full administrative access to MFI business logic (Loans, Savings, Customers, Branches, etc.)',
                'is_system_role': True
            }
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS(f'Created role: {company_admin_role.name}'))
        else:
            self.stdout.write(f'Role {company_admin_role.name} already exists.')

        # 2. Identify Functional Permissions
        # We exclude technical/system apps
        excluded_apps = [
            'admin', 'auth', 'contenttypes', 'sessions', 'auditlog', 
            'authtoken', 'simple_history', 'users' 
        ]
        
        # Note: Users app contains Profile, etc. We might want to allow 
        # Company Admin to manage users but NOT roles or permissions.
        # So we include users but filter later.
        
        permissions = Permission.objects.exclude(content_type__app_label__in=excluded_apps)
        
        # Add specific permissions from 'users' app (e.g., manage users)
        user_permissions = Permission.objects.filter(
            content_type__app_label='users'
        ).exclude(
            codename__in=['add_role', 'change_role', 'delete_role', 'view_role',
                        'add_permission', 'change_permission', 'delete_permission', 'view_permission']
        )
        
        all_perms = list(permissions) + list(user_permissions)
        
        # 3. Assign Permissions
        company_admin_role.permissions.set(all_perms)
        self.stdout.write(self.style.SUCCESS(f'Assigned {len(all_perms)} permissions to {company_admin_role.name}'))
        
        self.stdout.write(self.style.SUCCESS('Role setup complete.'))
