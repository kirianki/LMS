from django.core.management.base import BaseCommand
from apps.tenants.models import Tenant, DocumentTemplate
import os
from django.conf import settings

class Command(BaseCommand):
    help = 'Seed default document templates for all tenants'

    def handle(self, *args, **options):
        template_map = {
            'offer_letter': ('Default Offer Letter', 'default_offer_letter.html'),
            'disbursement_letter': ('Default Disbursement Letter', 'default_disbursement_letter.html'),
            'loan_statement': ('Default Loan Statement', 'default_loan_statement.html'),
        }

        tenants = Tenant.objects.all().exclude(schema_name='public')
        for tenant in tenants:
            self.stdout.write(f'Seeding templates for tenant: {tenant.name}')
            for t_type, (t_name, filename) in template_map.items():
                if not DocumentTemplate.objects.filter(tenant=tenant, template_type=t_type).exists():
                    template_path = os.path.join(settings.BASE_DIR, 'apps', 'loans', 'templates', filename)
                    if os.path.exists(template_path):
                        with open(template_path, 'r') as f:
                            content = f.read()
                        
                        DocumentTemplate.objects.create(
                            tenant=tenant,
                            name=t_name,
                            template_type=t_type,
                            content=content,
                            is_active=True
                        )
                        self.stdout.write(self.style.SUCCESS(f'  Created {t_type} template'))
                    else:
                        self.stdout.write(self.style.WARNING(f'  Template file not found: {filename}'))
                else:
                    self.stdout.write(f'  {t_type} template already exists')
