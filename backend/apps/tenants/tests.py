from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from apps.tenants.models import Tenant, Domain, Subscription, Module
from datetime import date, timedelta
import uuid

User = get_user_model()

class TenantModelTest(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(
            schema_name='test_tenant',
            name='Test Tenant',
            kra_pin='A001234567Z',
            status=Tenant.Status.ACTIVE
        )

    def test_tenant_creation(self):
        """Test that a tenant is created with correct fields."""
        self.assertEqual(self.tenant.name, 'Test Tenant')
        self.assertEqual(self.tenant.schema_name, 'test_tenant')
        self.assertEqual(self.tenant.status, Tenant.Status.ACTIVE)

    def test_audit_log_created(self):
        """Test that simple-history creates a historical record on creation."""
        self.assertEqual(self.tenant.history.count(), 1)
        self.tenant.name = 'Updated Name'
        self.tenant.save()
        self.assertEqual(self.tenant.history.count(), 2)
        self.assertEqual(self.tenant.history.first().name, 'Updated Name')

@override_settings(ROOT_URLCONF='core.urls_public')
class TenantAPITest(APITestCase):
    def setUp(self):
        # Create Public Tenant and Domain for Routing
        self.public_tenant = Tenant.objects.create(schema_name='public', name='Public')
        Domain.objects.create(domain='testserver', tenant=self.public_tenant, is_primary=True)

        # Create Admin User
        self.admin_user = User.objects.create_superuser(
            email='admin@test.com',
            password='password123',
            first_name='Admin',
            last_name='User'
        )
        
        # Obtain JWT Token
        url = reverse('token_obtain_pair')
        response = self.client.post(url, {
            'email': 'admin@test.com',
            'password': 'password123'
        })
        self.token = response.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        
        # Create initial tenant for testing
        self.tenant = Tenant.objects.create(
            schema_name='merchant_a',
            name='Merchant A',
            status=Tenant.Status.ACTIVE
        )

    def test_list_tenants_authenticated(self):
        """Test listing tenants with admin credentials."""
        url = reverse('tenant-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should contain at least merchant_a and public
        self.assertGreaterEqual(len(response.data), 2)

    def test_list_tenants_unauthenticated(self):
        """Test that unauthenticated requests are blocked."""
        self.client.credentials() # Clear credentials
        url = reverse('tenant-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_tenant_api(self):
        """Test creating a tenant via the API."""
        url = reverse('tenant-list')
        data = {
            'name': 'New Merchant',
            'schema_name': 'merchant_new',
            'kra_pin': 'P123456789C',
            'status': 'pending',
            'domain_url': 'new.localhost',
            'owner_email': 'owner@new.com',
            'owner_password': 'ownerpass123',
            'owner_name': 'New Owner'
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Tenant.objects.filter(schema_name='merchant_new').count(), 1)

class SubscriptionTest(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(schema_name='sub_test', name='Sub Test')
        self.subscription = Subscription.objects.create(
            tenant=self.tenant,
            plan=Subscription.Plan.PREMIUM,
            expiry_date=date.today() + timedelta(days=365)
        )

    def test_subscription_creation(self):
        self.assertEqual(self.subscription.plan, Subscription.Plan.PREMIUM)
        self.assertTrue(self.subscription.is_active)

    def test_subscription_history(self):
        """Verify history is tracked for subscriptions."""
        self.assertEqual(self.subscription.history.count(), 1)
        self.subscription.is_active = False
        self.subscription.save()
        self.assertEqual(self.subscription.history.count(), 2)
