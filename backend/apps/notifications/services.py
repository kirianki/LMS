from django.core.mail import get_connection, EmailMessage
from django.utils import timezone
import logging
from .models import CommunicationLog

logger = logging.getLogger(__name__)

class EmailService:
    """Centralized Email service using organization SMTP settings."""
    
    def __init__(self, organization):
        self.org = organization

    def send_email(self, recipient_email, subject, body, related_loan=None, related_borrower=None, attachments=None):
        """
        Send an email via the organization's SMTP settings and log the attempt.
        
        Args:
            attachments: Optional list of tuples (filename, content_bytes, mimetype)
        """
        if not self.org or not self.org.smtp_host:
            logger.warning(f"Email configuration missing for organization: {self.org}")
            return {"success": False, "error": "Email not configured"}

        # Create Log Entry (Queued)
        attachment_names = [a[0] for a in attachments] if attachments else []
        log = CommunicationLog.objects.create(
            recipient=recipient_email,
            message_type=CommunicationLog.MessageType.EMAIL,
            content=body,
            status=CommunicationLog.Status.QUEUED,
            provider='smtp',
            provider_response={"attachments": attachment_names} if attachment_names else None,
            related_loan=related_loan,
            related_borrower=related_borrower
        )

        try:
            connection = get_connection(
                host=self.org.smtp_host,
                port=self.org.smtp_port,
                username=self.org.smtp_username,
                password=self.org.smtp_password,
                use_tls=self.org.smtp_use_tls,
            )
            
            email = EmailMessage(
                subject=subject,
                body=body,
                from_email=self.org.smtp_from_email or self.org.company_email,
                to=[recipient_email],
                connection=connection,
            )
            
            # Attach files if provided
            if attachments:
                for filename, content, mimetype in attachments:
                    email.attach(filename, content, mimetype)
            
            sent = email.send()
            
            if sent:
                log.status = CommunicationLog.Status.SENT
                log.sent_at = timezone.now()
                log.save()
                return {"success": True}
            else:
                log.status = CommunicationLog.Status.FAILED
                log.provider_response = {"error": "Email failed to send (returned 0)"}
                log.save()
                return {"success": False, "error": "Email failed to send"}

        except Exception as e:
            logger.error(f"Failed to send email to {recipient_email}: {e}")
            log.status = CommunicationLog.Status.FAILED
            log.provider_response = {"error": str(e)}
            log.save()
            return {"success": False, "error": str(e)}
