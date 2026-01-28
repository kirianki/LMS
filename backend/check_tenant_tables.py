from django.db import connection
from django_tenants.utils import schema_context
from apps.tenants.models import Tenant

tenants = Tenant.objects.exclude(schema_name='public')
for tenant in tenants:
    with schema_context(tenant.schema_name):
        print(f"--- Schema: {tenant.schema_name} ---")
        print("Tables:", connection.introspection.table_names())
