from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from apps.accounts.models import Organization

User = get_user_model()

class PasswordChangeTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = Organization.objects.create(company_name='Test Org')
        self.user = User.objects.create_user(
            email='test@example.com',
            password='old_password123',
            first_name='Test',
            last_name='User',
            organization=self.org
        )
        self.client.force_authenticate(user=self.user)
        self.url = f'/api/v1/users/{self.user.id}/change_password/'

    def test_change_password_success(self):
        """Test that a user can successfully change their password."""
        data = {
            'old_password': 'old_password123',
            'new_password': 'new_password456'
        }
        response = self.client.post(self.url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify user can login with new password
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('new_password456'))
        self.assertFalse(self.user.check_password('old_password123'))

    def test_change_password_wrong_old_password(self):
        """Test error when old password is incorrect."""
        data = {
            'old_password': 'wrong_password',
            'new_password': 'new_password456'
        }
        response = self.client.post(self.url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.assertEqual(response.data['error'], 'Invalid old password.')

    def test_change_password_missing_fields(self):
        """Test error when fields are missing."""
        data = {
            'new_password': 'new_password456'
        }
        response = self.client.post(self.url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
    def test_change_other_user_password_forbidden(self):
        """Test that a regular user cannot change another user's password."""
        other_user = User.objects.create_user(
            email='other@example.com',
            password='password123',
            organization=self.org
        )
        url = f'/api/v1/users/{other_user.id}/change_password/'
        
        data = {
            'old_password': 'password123',
            'new_password': 'new_password456'
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
