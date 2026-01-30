import os
import django
import sys

# Set up Django environment
sys.path.append(os.getcwd() + '/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.loans.models import LoanApplication
from apps.loans.services.documents import generate_disbursement_letter
from apps.tenants.models import Tenant

def debug_generation():
    # Get the latest application
    app = LoanApplication.objects.latest('created_at')
    tenant = Tenant.objects.get(schema_name='public') # Assuming public or first
    
    print(f"Debugging App: {app.application_number}")
    print(f"Status: {app.status}")
    
    try:
        pdf_buffer = generate_disbursement_letter(app, tenant)
        print("PDF generated successfully!")
        print(f"Buffer size: {len(pdf_buffer.getvalue())} bytes")
    except Exception as e:
        print(f"FAILED: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_generation()
