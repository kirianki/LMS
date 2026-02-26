from django.test import TestCase
from django.utils import timezone
from apps.accounts.models import Organization
from apps.notifications.models import CommunicationLog
from apps.notifications.services import EmailService
from apps.customers.models import Borrower
from unittest.mock import patch, MagicMock

class EmailServiceTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(
            company_name="Test Org",
            smtp_host="smtp.test.com",
            smtp_port=587,
            smtp_username="user",
            smtp_password="password",
            smtp_from_email="noreply@test.com"
        )
        self.borrower = Borrower.objects.create(
            organization=self.org,
            first_name="John",
            last_name="Doe",
            email="john@example.com",
            phone_number="+254712345678"
        )

    @patch('django.core.mail.EmailMessage.send')
    @patch('django.core.mail.get_connection')
    def test_send_email_logs_correctly(self, mock_get_connection, mock_send):
        mock_send.return_value = 1
        service = EmailService(self.org)
        
        result = service.send_email(
            recipient_email="john@example.com",
            subject="Test Subject",
            body="Test Body",
            related_borrower=self.borrower
        )
        
        self.assertTrue(result['success'])
        
        # Verify log entry
        log = CommunicationLog.objects.get(recipient="john@example.com")
        self.assertEqual(log.status, CommunicationLog.Status.SENT)
        self.assertEqual(log.message_type, CommunicationLog.MessageType.EMAIL)
        self.assertEqual(log.content, "Test Body")
        self.assertEqual(log.related_borrower, self.borrower)

    def test_send_email_fails_without_config(self):
        self.org.smtp_host = ""
        self.org.save()
        
        service = EmailService(self.org)
        result = service.send_email(
            recipient_email="john@example.com",
            subject="Test Subject",
            body="Test Body"
        )
        
        self.assertFalse(result['success'])
        self.assertEqual(result['error'], "Email not configured")
        self.assertEqual(CommunicationLog.objects.count(), 0)
