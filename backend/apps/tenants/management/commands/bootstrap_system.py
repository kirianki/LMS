from django.core.management.base import BaseCommand
from apps.tenants.models import Tenant, Domain
from django.contrib.auth import get_user_model
import os

class Command(BaseCommand):
    help = 'Bootstrap the shared schema and administrative user.'

    def handle(self, *args, **options):
        User = get_user_model()

        # 1. Create Public Tenant
        if not Tenant.objects.filter(schema_name='public').exists():
            tenant = Tenant.objects.create(
                schema_name='public',
                name='Aurum Shared Admin',
            )
            Domain.objects.create(
                domain='localhost', # Default local domain
                is_primary=True,
                tenant=tenant
            )
            self.stdout.write(self.style.SUCCESS("Public tenant created successfully."))
        else:
            self.stdout.write("Public tenant already exists.")

        # 2. Create Superuser in Public Schema
        if not User.objects.filter(email='admin@aurum.local').exists():
            User.objects.create_superuser(
                email='admin@aurum.local',
                password='adminpassword',
                first_name='Super',
                last_name='Admin'
            )
            self.stdout.write(self.style.SUCCESS("Superuser (admin@aurum.local / adminpassword) created."))
        else:
            self.stdout.write("Superuser already exists.")
