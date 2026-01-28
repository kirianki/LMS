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
        print(f"--- Cleaning Schema: {tenant.schema_name} ---")
        with connection.cursor() as cursor:
            cursor.execute("DROP TABLE IF EXISTS customers_crbreport CASCADE")
            cursor.execute("DROP TABLE IF EXISTS customers_historicalcustomer CASCADE")
            cursor.execute("DROP TABLE IF EXISTS customers_customer CASCADE")
            cursor.execute("DELETE FROM django_migrations WHERE app = 'customers'")
