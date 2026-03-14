import os
import django
import sys
from io import BytesIO

# Set up Django environment
sys.path.append('/home/sammy/Desktop/LMS/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.loans.views import export_arrears_report
from rest_framework.test import APIRequestFactory, APIClient, force_authenticate
from apps.users.models import User
from django.utils import timezone

def verify_export():
    factory = APIRequestFactory()
    user = User.objects.filter(is_superuser=True).first()
    
    if not user:
        print("No superuser found for testing.")
        return

    # Test PDF Export
    print("Testing PDF Export...")
    request_pdf = factory.get('/api/v1/loans/arrears_reports/export/', {'export_type': 'pdf'})
    force_authenticate(request_pdf, user=user)
    response_pdf = export_arrears_report(request_pdf)
    
    print(f"PDF Export Status: {response_pdf.status_code}")
    if hasattr(response_pdf, 'status_code') and response_pdf.status_code == 200:
        print(f"PDF Content Type: {response_pdf.get('Content-Type')}")
    
    # Test Word Export
    print("\nTesting Word Export...")
    request_docx = factory.get('/api/v1/loans/arrears_reports/export/', {'export_type': 'docx'})
    force_authenticate(request_docx, user=user)
    response_docx = export_arrears_report(request_docx)
    
    print(f"DOCX Export Status: {response_docx.status_code}")
    if hasattr(response_docx, 'status_code') and response_docx.status_code == 200:
        print(f"DOCX Content Type: {response_docx.get('Content-Type')}")

    if response_pdf.status_code == 200 and response_docx.status_code == 200:
        print("\nVerification SUCCESS: Both export types work correctly.")
    else:
        print("\nVerification FAILED.")
        print(f"PDF Response: {response_pdf.content[:200] if hasattr(response_pdf, 'content') else 'N/A'}")

if __name__ == "__main__":
    verify_export()
