from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.urls import reverse
from django.contrib.auth import get_user_model
from .models import Role
from apps.tenants.models import Tenant, Domain

User = get_user_model()

class UserTests(TenantTestCase):
    def setUp(self):
        super().setUp()
        self.client = APIClient()
        
        # Ensure domain exists for tenant routing
        if not Domain.objects.filter(tenant=self.tenant).exists():
           Domain.objects.create(domain='test.localhost', tenant=self.tenant, is_primary=True)
           
        self.client.defaults['HTTP_HOST'] = self.tenant.domains.first().domain

        # Create Role
        self.role = Role.objects.create(name='Manager', approval_limit=50000.00)

        # Create User
        self.user = User.objects.create_user(
            email='test@example.com',
            password='password123',
            first_name='Test',
            last_name='User',
            role=self.role
        )

    def test_create_user_model(self):
        """Test User model creation and fields"""
        self.assertEqual(self.user.email, 'test@example.com')
        self.assertTrue(self.user.check_password('password123'))
        self.assertEqual(self.user.role, self.role)
        self.assertTrue(self.user.is_active)
        self.assertFalse(self.user.is_staff)

    def test_create_superuser(self):
        """Test Superuser creation"""
        admin = User.objects.create_superuser('admin@test.com', 'adminpass')
        self.assertTrue(admin.is_superuser)
        self.assertTrue(admin.is_staff)

    def test_login_jwt(self):
        """Test JWT Authentication"""
        url = reverse('token_obtain_pair')
        data = {
            'email': 'test@example.com',
            'password': 'password123'
        }
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_list_users_authenticated(self):
        """Test listing users with valid token"""
        self.client.force_authenticate(user=self.user)
        url = reverse('user-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should be at least 1 user
        self.assertTrue(len(response.data) >= 1)

    def test_list_users_unauthenticated(self):
        """Test listing users without token fails"""
        url = reverse('user-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_role_api(self):
        """Test creating a role via API"""
        self.client.force_authenticate(user=self.user)
        url = reverse('role-list')
        data = {'name': 'Teller', 'approval_limit': '10000.00'}
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Role.objects.count(), 2)
