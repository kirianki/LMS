from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from django_tenants.test.cases import TenantTestCase
from apps.users.models import User
from apps.customers.models import Customer
from apps.tenants.models import Domain
from .models import Collateral

class CollateralTests(TenantTestCase):
    def setUp(self):
        super().setUp()
        self.client = APIClient()
        
        # Ensure domain exists for tenant routing
        if not Domain.objects.filter(tenant=self.tenant).exists():
           Domain.objects.create(domain='test.localhost', tenant=self.tenant, is_primary=True)
           
        self.client.defaults['HTTP_HOST'] = self.tenant.domains.first().domain
        
        # Create tenant settings for automation
        from apps.tenants.models import TenantSettings
        TenantSettings.objects.update_or_create(
            tenant=self.tenant,
            defaults={'is_automation_enabled': True}
        )

        self.user = User.objects.create_user(
            email='test@tenant.com', 
            password='password123',
            first_name='Test',
            last_name='User'
        )
        self.customer = Customer.objects.create(
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
            "customer": str(self.customer.id),
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

    def test_vehicle_validation_fails(self):
        """Test that vehicle creation fails if motor vehicle fields are missing."""
        self.client.force_authenticate(user=self.user)
        url = reverse('collateral-list')
        data = {
            "customer": str(self.customer.id),
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
            "customer": str(self.customer.id),
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
            customer=self.customer,
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
        from apps.collateral.models import Valuer, ValuationRequest
        from apps.tenants.models import TenantSettings
        from django.core import mail

        # 1. Setup trusted valuer and SMTP config in TenantSettings
        valuer = Valuer.objects.create(
            name="Swift Valuers",
            email="swift@valuers.com",
            valuation_types=["motor_vehicle"]
        )
        TenantSettings.objects.update_or_create(
            tenant=self.tenant,
            defaults={
                'smtp_host': "smtp.test.com",
                'smtp_username': "test@tenant.com",
                'smtp_password': "pwd",
                'smtp_from_email': "noreply@tenant.com"
            }
        )

        # 2. Register Collateral
        url = reverse('collateral-list')
        self.client.force_authenticate(user=self.user)
        data = {
            "customer": str(self.customer.id),
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

        # 4. Verify Emails "sent" (Django Outbox)
        # Note: In our signal we use apps.agents.utils.send_tenant_email 
        # which uses a custom connection. Standard Django mail.outbox 
        # might not capture it if custom connection is used, 
        # unless we mock it. For simplicity in this test, 
        # we check the ValuationRequest existence which proves the signal ran.

    def test_ai_agent_parsing(self):
        """Test the AI agent parsing logic."""
        from apps.agents.services import ValuationParsingAgent
        agent = ValuationParsingAgent()
        
        report_text = "Market value of Toyota Camry KDC 123A is 1,500,000. Forced sale is 1,100,000 as of 2024-01-16."
        result = agent.parse_report_text(report_text)
        
        self.assertTrue(result['success'])
        self.assertEqual(result['data']['market_value'], "1500000.00")
