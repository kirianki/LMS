import os
import django
from io import BytesIO

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.loans.models import LoanApplication
from apps.loans.services.documents import generate_disbursement_letter

# Find an application to test with
app = LoanApplication.objects.exclude(status='draft').first()

if app:
    print(f"Generating checklist for application: {app.application_number}")
    pdf_buffer = generate_disbursement_letter(app)
    if pdf_buffer:
        file_path = "verify_checklist.pdf"
        with open(file_path, "wb") as f:
            f.write(pdf_buffer.getvalue())
        print(f"PDF generated and saved to {os.path.abspath(file_path)}")
    else:

        print("Failed to generate PDF buffer")
else:
    print("No non-draft applications found to test with.")
