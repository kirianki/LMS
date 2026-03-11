import os
import django
import sys
from django.core.mail import send_mail

from django.conf import settings

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

print(f"DEBUG: Using EMAIL_HOST={settings.EMAIL_HOST}")
print(f"DEBUG: Using EMAIL_PORT={settings.EMAIL_PORT}")
print(f"DEBUG: Using EMAIL_HOST_USER={settings.EMAIL_HOST_USER}")
print(f"DEBUG: Using EMAIL_USE_TLS={settings.EMAIL_USE_TLS}")
print(f"DEBUG: Using DEFAULT_FROM_EMAIL={settings.DEFAULT_FROM_EMAIL}")

if len(sys.argv) < 2:
    print("Usage: python3 test_email_direct.py <recipient_email>")
    sys.exit(1)

recipient = sys.argv[1]
subject = "LMS Global Email Test"
message = "This is a test email from the LMS system to verify that global SMTP settings in .env are working correctly."

try:
    print(f"Attempting to send email to {recipient}...")
    sent = send_mail(
        subject,
        message,
        None, # Uses DEFAULT_FROM_EMAIL from settings
        [recipient],
        fail_silently=False,
    )
    if sent:
        print(f"SUCCESS! Email sent to {recipient}")
    else:
        print("FAILED: Email not sent.")
except Exception as e:
    print(f"ERROR: {str(e)}")
