from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.core.management import call_command
import os

User = get_user_model()

class Command(BaseCommand):
    help = 'Bootstrap the system with a System Administrator and initial roles'

    def add_arguments(self, parser):
        parser.add_argument('--email', type=str, help='System Admin email', default=os.getenv('ADMIN_EMAIL', 'admin@aurum.com'))
        parser.add_argument('--password', type=str, help='System Admin password', default=os.getenv('ADMIN_PASSWORD', 'admin123'))

    def handle(self, *args, **options):
        email = options['email']
        password = options['password']

        self.stdout.write('Initializing system architecture...')
        
        # 1. Setup Roles
        call_command('setup_admin_roles')
        
        # 2. Create System Admin (Superuser)
        if not User.objects.filter(email=email).exists():
            User.objects.create_superuser(
                email=email,
                password=password,
                first_name='System',
                last_name='Administrator'
            )
            self.stdout.write(self.style.SUCCESS(f'Successfully created System Admin: {email}'))
        else:
            self.stdout.write(f'System Admin {email} already exists.')

        self.stdout.write(self.style.SUCCESS('System bootstrap complete.'))
