from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from apps.accounts.models import Organization, DocumentTemplate
import uuid

User = get_user_model()

class OrganizationTest(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(
            company_name='Aurum Finance',
            is_ai_enabled=True
        )

    def test_organization_creation(self):
        """Test that Organization is created with correct fields."""
        self.assertEqual(self.org.company_name, 'Aurum Finance')
        self.assertTrue(self.org.is_ai_enabled)

    def test_audit_log_created(self):
        """Test that simple-history creates a historical record on creation."""
        self.assertEqual(self.org.history.count(), 1)
        self.org.company_name = 'Aurum Updated'
        self.org.save()
        self.assertEqual(self.org.history.count(), 2)

class OrganizationAPITest(APITestCase):
    def setUp(self):
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
        
        # Create initial organization
        self.org = Organization.objects.create(company_name='Aurum Finance')

    def test_get_organizations(self):
        """Test retrieving organizations."""
        url = reverse('organization-settings-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['company_name'], 'Aurum Finance')

    def test_update_organization(self):
        """Test updating organization settings via API."""
        url = reverse('organization-settings-detail', args=[self.org.id])
        data = {'company_name': 'New Logo Corp'}
        response = self.client.patch(url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.org.refresh_from_db()
        self.assertEqual(self.org.company_name, 'New Logo Corp')

class DocumentTemplateTest(TestCase):
    def setUp(self):
        self.template = DocumentTemplate.objects.create(
            name='Offer Letter',
            template_type=DocumentTemplate.TemplateType.OFFER_LETTER,
            content='<html>Test</html>'
        )

    def test_template_creation(self):
        self.assertEqual(self.template.name, 'Offer Letter')
        self.assertEqual(self.template.template_type, 'offer_letter')
