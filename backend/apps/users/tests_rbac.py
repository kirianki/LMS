from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.urls import reverse
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType

from apps.users.models import User, Role
from apps.customers.models import Borrower

from apps.tenants.models import Domain

class RBACTests(TenantTestCase):
    def setUp(self):
        super().setUp()
        self.client = APIClient()
        
        if not Domain.objects.filter(tenant=self.tenant).exists():
            Domain.objects.create(domain='test.localhost', tenant=self.tenant, is_primary=True)
        
        self.client.defaults['HTTP_HOST'] = self.tenant.domains.first().domain
        
        # Create a role without permissions
        self.role_limited = Role.objects.create(name="Limited Officer")
        self.user_limited = User.objects.create_user(
            email='limited@tenant.com',
            password='password123',
            role=self.role_limited
        )
        
        # Create a role with customer view permissions only
        self.role_viewer = Role.objects.create(name="Borrower Viewer")
        borrower_ct = ContentType.objects.get_for_model(Borrower)
        view_perm = Permission.objects.get(content_type=borrower_ct, codename='view_borrower')
        self.role_viewer.permissions.add(view_perm)
        
        self.user_viewer = User.objects.create_user(
            email='viewer@tenant.com',
            password='password123',
            role=self.role_viewer
        )
        
        # Create a borrower for testing
        self.borrower = Borrower.objects.create(
            first_name='John',
            last_name='Doe',
            id_number='ID123',
            phone_number='+254700111222',
            email='john@example.com',
            date_of_birth='1990-01-01'
        )

    def test_limited_user_cannot_view_borrowers(self):
        """User with no permissions on role should be denied access."""
        self.client.force_authenticate(user=self.user_limited)
        url = reverse('borrower-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_viewer_user_can_view_but_not_create(self):
        """User with 'view' permission should see list but fail on 'add'."""
        self.client.force_authenticate(user=self.user_viewer)
        
        # 1. Test View (Should pass)
        url = reverse('borrower-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data) # Check pagination too
        
        # 2. Test Create (Should fail)
        data = {
            "first_name": "New",
            "last_name": "Borrower",
            "id_number": "ID456",
            "phone_number": "+254700333444",
            "email": "new@example.com",
            "date_of_birth": "1995-01-01"
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_pagination_standard_format(self):
        """Verify that pagination returns the expected structure."""
        self.client.force_authenticate(user=self.user_viewer)
        url = reverse('borrower-list')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('count', response.data)
        self.assertIn('next', response.data)
        self.assertIn('previous', response.data)
        self.assertIn('results', response.data)
        self.assertIn('total_pages', response.data)

    def test_rate_limiting(self):
        """Test rate limiting blocks excessive requests."""
        # Note: In some test environments, throttling might be disabled by default.
        # We assume it's enabled as per settings.py
        self.client.force_authenticate(user=self.user_viewer)
        url = reverse('borrower-list')
        
        # Send 105 requests (Limit is 100/minute)
        # We use a loop. This might be slow but it verifies the logic.
        for i in range(101):
            response = self.client.get(url)
            if response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
                break
        
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
