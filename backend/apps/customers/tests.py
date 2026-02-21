from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from .models import Borrower

User = get_user_model()

class BorrowerTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        # Create Staff User
        self.staff_user = User.objects.create_user(
            email='staff@system.com',
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
        self.borrower_data = {
            'first_name': 'John',
            'last_name': 'Doe',
            'email': 'john.doe@example.com',
            'phone_number': '+254712345678',
            'id_type': 'national_id',
            'id_number': '12345678',
            'date_of_birth': '1990-01-01',
            'physical_address': '123 Main St, Nairobi',
            'employment_status': 'employed',
            'monthly_income': '50000.00'
        }

    def test_create_borrower(self):
        """Test creating a borrower via API."""
        self.client.force_authenticate(user=self.user)
        url = reverse('borrower-list')
        response = self.client.post(url, self.borrower_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Borrower.objects.count(), 1)
        self.assertEqual(Borrower.objects.get().first_name, 'John')

    def test_create_company_borrower(self):
        """Test creating a company borrower."""
        self.client.force_authenticate(user=self.user)
        url = reverse('borrower-list')
        
        data = {
            'borrower_type': Borrower.BorrowerType.COMPANY,
            'business_name': 'Acme Corp',
            'incorporation_date': '2020-01-01',
            'tax_id': 'P000000000A',
            'phone_number': '+254722000000',
            'email': 'info@acme.com',
            'id_number': 'REG12345', # Registration No
            'physical_address': 'Industrial Area',
            'contact_person_name': 'Jane Doe',
            'contact_person_phone': '+254722111111'
        }
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        borrower = Borrower.objects.get(id_number='REG12345')
        self.assertEqual(borrower.borrower_type, Borrower.BorrowerType.COMPANY)
        self.assertEqual(borrower.business_name, 'Acme Corp')

    def test_verify_borrower_id(self):
        """Test ID verification by staff."""
        # 1. Create borrower with ID document
        borrower = Borrower.objects.create(
            **self.borrower_data,
            id_document=SimpleUploadedFile('id.pdf', b'fake content', content_type='application/pdf')
        )
        
        # 2. Regular user tries to verify (should fail)
        self.client.force_authenticate(user=self.user)
        verify_url = reverse('borrower-verify-id', kwargs={'pk': borrower.pk})
        response = self.client.post(verify_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        # 3. Staff user verifies
        self.client.force_authenticate(user=self.staff_user)
        response = self.client.post(verify_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        borrower.refresh_from_db()
        self.assertTrue(borrower.is_verified)
        self.assertEqual(borrower.verified_by, self.staff_user)

    def test_fetch_crb_report(self):
        """Test fetching CRB report and hybrid scoring."""
        borrower = Borrower.objects.create(**self.borrower_data)
        
        self.client.force_authenticate(user=self.staff_user)
        url = reverse('borrower-fetch-crb-report', kwargs={'pk': borrower.pk})
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('hybrid_score', response.data)
        
        borrower.refresh_from_db()
        self.assertIsNotNone(borrower.crb_score)
        self.assertIsNotNone(borrower.hybrid_score)
        self.assertEqual(borrower.crb_reports.count(), 1)
        
        # Verify hybrid calculation: (CRB * 0.6) + (0 * 0.4)
        expected_hybrid = int(borrower.crb_score * 0.6)
        self.assertEqual(borrower.hybrid_score, expected_hybrid)

    def test_hybrid_score_with_internal(self):
        """Test hybrid score remains consistent with internal history."""
        borrower = Borrower.objects.create(**self.borrower_data)
        borrower.internal_score = 500
        borrower.save()
        
        self.client.force_authenticate(user=self.staff_user)
        url = reverse('borrower-fetch-crb-report', kwargs={'pk': borrower.pk})
        self.client.post(url)
        
        borrower.refresh_from_db()
        # (CRB * 0.6) + (500 * 0.4)
        expected_hybrid = int((borrower.crb_score * 0.6) + (500 * 0.4))
        self.assertEqual(borrower.hybrid_score, expected_hybrid)

    def test_verification_fails_without_document(self):
        """Test verification fails if no document is uploaded."""
        borrower = Borrower.objects.create(**self.borrower_data)
        
        self.client.force_authenticate(user=self.staff_user)
        verify_url = reverse('borrower-verify-id', kwargs={'pk': borrower.pk})
        response = self.client.post(verify_url)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)

    def test_borrower_history(self):
        """Verify history tracking for borrowers."""
        borrower = Borrower.objects.create(**self.borrower_data)
        self.assertEqual(borrower.history.count(), 1)
        
        borrower.first_name = 'Johnny'
        borrower.save()
        self.assertEqual(borrower.history.count(), 2)
        self.assertEqual(borrower.history.first().first_name, 'Johnny')
