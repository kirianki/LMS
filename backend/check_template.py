import os
import django
from django.template.loader import get_template
from django.template import Template, Context

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

template_path = 'default_disbursement_letter.html'
try:
    get_template(template_path)
    print("Template compiled successfully")
except Exception as e:
    print(f"Template compilation failed: {e}")
