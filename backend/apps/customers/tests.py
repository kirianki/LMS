from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from .models import Customer
from apps.tenants.models import Domain

User = get_user_model()

class CustomerTests(TenantTestCase):
    def setUp(self):
        super().setUp()
        self.client = APIClient()
        
        # Ensure domain exists for tenant routing
        if not Domain.objects.filter(tenant=self.tenant).exists():
           Domain.objects.create(domain='test.localhost', tenant=self.tenant, is_primary=True)
           
        self.client.defaults['HTTP_HOST'] = self.tenant.domains.first().domain

        # Create Staff User
        self.staff_user = User.objects.create_user(
            email='staff@test.com',
            password='password123',
            first_name='Staff',
            last_name='User',
            is_staff=True
        )

        # Create Regular User
        self.user = User.objects.create_user(
            email='user@test.com',
            password='password123',
            first_name='Regular',
            last_name='User'
        )

        # Sample ID Data
        self.customer_data = {
            'first_name': 'John',
            'last_name': 'Doe',
            'email': 'john.doe@example.com',
            'phone_number': '+254712345678',
            'id_type': 'national_id',
            'id_number': '12345678',
            'date_of_birth': '1990-01-01',
            'address': '123 Main St, Nairobi',
            'employment_status': 'employed',
            'monthly_income': '50000.00'
        }

    def test_create_customer(self):
        """Test creating a customer via API."""
        self.client.force_authenticate(user=self.user)
        url = reverse('customer-list')
        response = self.client.post(url, self.customer_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Customer.objects.count(), 1)
        self.assertEqual(Customer.objects.get().first_name, 'John')

    def test_verify_customer_id(self):
        """Test ID verification by staff."""
        # 1. Create customer with ID document
        customer = Customer.objects.create(
            **self.customer_data,
            id_document=SimpleUploadedFile('id.pdf', b'fake content', content_type='application/pdf')
        )
        
        # 2. Regular user tries to verify (should fail)
        self.client.force_authenticate(user=self.user)
        verify_url = reverse('customer-verify-id', kwargs={'pk': customer.pk})
        response = self.client.post(verify_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        # 3. Staff user verifies
        self.client.force_authenticate(user=self.staff_user)
        response = self.client.post(verify_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        customer.refresh_from_db()
        self.assertTrue(customer.is_verified)
        self.assertEqual(customer.verified_by, self.staff_user)

    def test_fetch_crb_report(self):
        """Test fetching CRB report and hybrid scoring."""
        customer = Customer.objects.create(**self.customer_data)
        
        self.client.force_authenticate(user=self.staff_user)
        url = reverse('customer-fetch-crb-report', kwargs={'pk': customer.pk})
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('hybrid_score', response.data)
        
        customer.refresh_from_db()
        self.assertIsNotNone(customer.crb_score)
        self.assertIsNotNone(customer.hybrid_score)
        self.assertEqual(customer.crb_reports.count(), 1)
        
        # Verify hybrid calculation: (CRB * 0.6) + (0 * 0.4)
        expected_hybrid = int(customer.crb_score * 0.6)
        self.assertEqual(customer.hybrid_score, expected_hybrid)

    def test_hybrid_score_with_internal(self):
        """Test hybrid score remains consistent with internal history."""
        customer = Customer.objects.create(**self.customer_data)
        customer.internal_score = 500
        customer.save()
        
        self.client.force_authenticate(user=self.staff_user)
        url = reverse('customer-fetch-crb-report', kwargs={'pk': customer.pk})
        self.client.post(url)
        
        customer.refresh_from_db()
        # (CRB * 0.6) + (500 * 0.4)
        expected_hybrid = int((customer.crb_score * 0.6) + (500 * 0.4))
        self.assertEqual(customer.hybrid_score, expected_hybrid)

    def test_verification_fails_without_document(self):
        """Test verification fails if no document is uploaded."""
        customer = Customer.objects.create(**self.customer_data)
        
        self.client.force_authenticate(user=self.staff_user)
        verify_url = reverse('customer-verify-id', kwargs={'pk': customer.pk})
        response = self.client.post(verify_url)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)

    def test_customer_history(self):
        """Verify history tracking for customers."""
        customer = Customer.objects.create(**self.customer_data)
        self.assertEqual(customer.history.count(), 1)
        
        customer.first_name = 'Johnny'
        customer.save()
        self.assertEqual(customer.history.count(), 2)
        self.assertEqual(customer.history.first().first_name, 'Johnny')
