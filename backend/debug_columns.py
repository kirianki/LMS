import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.db import connection
from django_tenants.utils import schema_context
from apps.tenants.models import Tenant

tenants = Tenant.objects.all()
for tenant in tenants:
    with schema_context(tenant.schema_name):
        with connection.cursor() as cursor:
            try:
                cursor.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name = 'customers_customer'")
                columns = [row[0] for row in cursor.fetchall()]
                print(f"--- Schema: {tenant.schema_name} ---")
                print(f"Columns in customers_customer: {columns}")
            except Exception as e:
                print(f"Error in schema {tenant.schema_name}: {e}")
