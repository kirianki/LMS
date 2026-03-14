from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from apps.users.models import User
from apps.customers.models import Borrower
from apps.accounts.models import Organization
from .models import Collateral, Valuer, ValuationRequest

class CollateralTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        # Create organization for automation
        self.org = Organization.objects.create(
            company_name="Test MFI",
            is_automation_enabled=True,
            smtp_host="smtp.test.com",
            smtp_username="test@system.com",
            smtp_password="pwd",
            smtp_from_email="noreply@system.com"
        )

        self.user = User.objects.create_user(
            email='test@system.com', 
            password='password123',
            first_name='Test',
            last_name='User',
            organization=self.org
        )
        self.borrower = Borrower.objects.create(
            organization=self.org,
            first_name="Jane",
            last_name="Doe",
            phone_number="+254711222333",
            id_number="999888777",
            date_of_birth="1990-01-01"
        )

    def test_create_vehicle_collateral(self):
        """Test creating a motor vehicle collateral with required fields."""
        self.client.force_authenticate(user=self.user)
        url = reverse('collateral-list')
        data = {
            "borrower": str(self.borrower.id),
            "collateral_type": "motor_vehicle",
            "market_value": "1500000.00",
            "forced_sale_value": "1100000.00",
            "valuation_date": "2024-01-16",
            "reg_number": "KDC 123A",
            "logbook_number": "L-554433",
            "make": "Toyota",
            "model": "Camry",
            "status": "available"
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Collateral.objects.count(), 1)
        self.assertEqual(Collateral.objects.first().reg_number, "KDC 123A")
        self.assertEqual(Collateral.objects.first().organization, self.org)

    def test_vehicle_validation_fails(self):
        """Test that vehicle creation fails if motor vehicle fields are missing."""
        self.client.force_authenticate(user=self.user)
        url = reverse('collateral-list')
        data = {
            "borrower": str(self.borrower.id),
            "collateral_type": "motor_vehicle",
            "market_value": "1500000.00",
            "forced_sale_value": "1100000.00",
            "valuation_date": "2024-01-16",
            # Missing reg_number etc
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('reg_number', response.data)

    def test_create_land_collateral(self):
        """Test creating a land/property collateral."""
        self.client.force_authenticate(user=self.user)
        url = reverse('collateral-list')
        data = {
            "borrower": str(self.borrower.id),
            "collateral_type": "land_property",
            "market_value": "5000000.00",
            "forced_sale_value": "3500000.00",
            "valuation_date": "2024-01-16",
            "lr_number": "NAIROBI/BLOCK123/456",
            "location": "Upper Hill",
            "property_size": "0.5 Acres",
            "tenure_type": "freehold",
            "status": "available"
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Collateral.objects.filter(collateral_type="land_property").count(), 1)

    def test_collateral_history(self):
        """Test that simple-history tracks changes to collateral."""
        collateral = Collateral.objects.create(
            organization=self.org,
            borrower=self.borrower,
            collateral_type="motor_vehicle",
            market_value=1000000,
            forced_sale_value=700000,
            valuation_date="2024-01-01",
            reg_number="KAA 001A",
            logbook_number="ABC12345",
            make="Honda",
            model="Civic"
        )
        
        # Update status to Pledged
        collateral.status = "pledged"
        collateral.save()
        
        self.assertEqual(collateral.history.count(), 2)
        self.assertEqual(collateral.history.first().status, "pledged")

    def test_automated_valuation_workflow(self):
        """Test that creating collateral triggers valuer emails and requests."""
        # 1. Setup trusted valuer for this organization
        valuer = Valuer.objects.create(
            organization=self.org,
            name="Swift Valuers",
            email="swift@valuers.com",
            valuation_types=["motor_vehicle"]
        )

        # 2. Register Collateral
        url = reverse('collateral-list')
        self.client.force_authenticate(user=self.user)
        data = {
            "borrower": str(self.borrower.id),
            "collateral_type": "motor_vehicle",
            "market_value": "1000000.00",
            "forced_sale_value": "700000.00",
            "valuation_date": "2024-01-16",
            "reg_number": "KDD 555X",
            "logbook_number": "L-9988",
            "make": "Nissan",
            "model": "Note",
            "status": "available"
        }
        
        # This should trigger signals
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # 3. Verify ValuationRequest created
        self.assertEqual(ValuationRequest.objects.count(), 1)
        request = ValuationRequest.objects.first()
        self.assertEqual(request.valuer, valuer)
        self.assertEqual(request.collateral.organization, self.org)
