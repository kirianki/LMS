import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from apps.loans.models import LoanApplication
from apps.loans.services.documents import generate_disbursement_letter
from apps.tenants.models import Tenant
from django_tenants.utils import schema_context

def test():
    for schema in ['babe', 'intelafro']:
        try:
            tenant = Tenant.objects.get(schema_name=schema)
            with schema_context(schema):
                app = LoanApplication.objects.latest('created_at')
                pdf = generate_disbursement_letter(app, tenant)
                print(f'SUCCESS [{schema}]: PDF size {len(pdf.getvalue())} bytes')
        except Exception as e:
            print(f'FAILED [{schema}]: {e}')

if __name__ == "__main__":
    test()
