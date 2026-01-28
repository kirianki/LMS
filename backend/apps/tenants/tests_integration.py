from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse
from django.db import connection
from django_tenants.utils import schema_context
from django.contrib.auth import get_user_model
from django.test import override_settings
from apps.tenants.models import Tenant, Domain
from apps.users.models import Role

User = get_user_model()

@override_settings(ROOT_URLCONF='core.urls_public')
class TenantBootstrappingTest(APITestCase):
    def setUp(self):
        # Create Public Tenant and Domain for Routing
        self.public_tenant = Tenant.objects.create(schema_name='public', name='Public')
        Domain.objects.create(domain='testserver', tenant=self.public_tenant, is_primary=True)
        
        # We need to manually set the schema to public for the test runner if not handled automatically
        connection.set_schema_to_public()
        
        # Create Superuser to access Tenant Creation API
        self.admin = User.objects.create_superuser('admin@public.com', 'adminpass')
        
        # Authenticate
        token_url = reverse('token_obtain_pair')
        response = self.client.post(token_url, {
            'email': 'admin@public.com',
            'password': 'adminpass'
        }, format='json')
        self.token = response.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')

    def test_tenant_provisioning_flow(self):
        """
        Test full onboarding:
        1. Access Public API
        2. Create Tenant with Owner Info
        3. Verify Tenant & Domain Created
        4. Verify Schema Created
        5. Verify Owner User & Role in new Schema
        """
        url = reverse('tenant-list')
        data = {
            "name": "Acme Microfinance",
            "schema_name": "acme",
            "kra_pin": "P051389456Z",
            "status": "active",
            "domain_url": "acme.localhost",
            "owner_email": "ceo@acme.com",
            "owner_password": "securepass123",
            "owner_name": "Wile E. Coyote"
        }
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # 1. Verify Tenant
        self.assertTrue(Tenant.objects.filter(schema_name='acme').exists())
        tenant = Tenant.objects.get(schema_name='acme')
        
        # 2. Verify Domain
        self.assertTrue(tenant.domains.filter(domain='acme.localhost').exists())
        
        # 3. Verify Bootstrapped Data in Tenant Schema
        with schema_context('acme'):
            # Check Role
            self.assertTrue(Role.objects.filter(name='Administrator').exists())
            
            # Check User
            self.assertTrue(User.objects.filter(email='ceo@acme.com').exists())
            user = User.objects.get(email='ceo@acme.com')
            self.assertTrue(user.is_superuser)
            self.assertTrue(user.check_password('securepass123'))
            self.assertEqual(user.first_name, "Wile")
            self.assertEqual(user.last_name, "E. Coyote")
