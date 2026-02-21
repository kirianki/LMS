from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.urls import reverse
from apps.users.models import User
from apps.accounts.models import Organization
from .models import AgentLog

class AgentTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        # Create Organization
        self.org = Organization.objects.create(
            company_name='Test MFI',
            is_ai_enabled=True,
            is_automation_enabled=True
        )
        
        self.user = User.objects.create_user(
            email='agent-test@system.com', 
            password='password123',
            first_name='Agent',
            last_name='Tester',
            organization=self.org
        )
        self.client.force_authenticate(user=self.user)

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
        self.assertEqual(log.organization, self.org)

    def test_get_agent_logs(self):
        """Test retrieving agent logs."""
        AgentLog.objects.create(
            organization=self.org,
            agent_name="TestAgent",
            action="test_action",
            status="success"
        )
        
        url = reverse('agent-logs-list')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_ai_disabled_toggle(self):
        """Test that AI parsing returns 403 when disabled in Organization."""
        
        # Disable AI
        self.org.is_ai_enabled = False
        self.org.save()
        
        url = reverse('ai-agents-parse-valuation')
        data = {"text": "KDC 123A valuation"}
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['error'], "AI features are not enabled for this system.")
