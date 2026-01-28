from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import TenantClient
from rest_framework.test import APIClient
from rest_framework import status
from django.urls import reverse
from apps.users.models import User
from apps.tenants.models import Domain
from .models import AgentLog

class AgentTests(TenantTestCase):
    def setUp(self):
        super().setUp()
        self.client = APIClient()
        
        # Ensure domain exists for tenant routing
        if not Domain.objects.filter(tenant=self.tenant).exists():
           Domain.objects.create(domain='test.localhost', tenant=self.tenant, is_primary=True)
           
        self.client.defaults['HTTP_HOST'] = self.tenant.domains.first().domain

        self.user = User.objects.create_user(
            email='agent-test@tenant.com', 
            password='password123',
            first_name='Agent',
            last_name='Tester'
        )
        self.client.force_authenticate(user=self.user)
        
        # Enable features for tests
        from apps.tenants.models import TenantSettings
        settings, _ = TenantSettings.objects.get_or_create(tenant=self.tenant)
        settings.is_ai_enabled = True
        settings.is_automation_enabled = True
        settings.save()

    def test_manual_valuation_parsing(self):
        """Test the manual AI parsing endpoint."""
        url = reverse('ai-agents-parse-valuation')
        data = {"text": "Asset valuation for KDC 123A is 1,500,000"}
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        
        # Verify log entry
        self.assertEqual(AgentLog.objects.count(), 1)
        log = AgentLog.objects.first()
        self.assertEqual(log.agent_name, "ValuationParsingAgent")
        self.assertEqual(log.status, "success")

    def test_get_agent_logs(self):
        """Test retrieving agent logs."""
        AgentLog.objects.create(
            agent_name="TestAgent",
            action="test_action",
            status="success"
        )
        
        url = reverse('agent-logs-list')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_ai_disabled_toggle(self):
        """Test that AI parsing returns 403 when disabled in TenantSettings."""
        from apps.tenants.models import TenantSettings
        
        # Disable AI
        settings = TenantSettings.objects.get(tenant=self.tenant)
        settings.is_ai_enabled = False
        settings.save()
        
        url = reverse('ai-agents-parse-valuation')
        data = {"text": "KDC 123A valuation"}
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['error'], "AI features are not enabled for this tenant.")
