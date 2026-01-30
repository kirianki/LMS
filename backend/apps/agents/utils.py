from django.core.mail import get_connection, EmailMessage
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

def send_tenant_email(settings_obj, subject, message, recipient_list, attachments=None):
    """
    Sends an email using dynamic SMTP settings from TenantSettings.
    attachments: list of tuples (filename, content, mimetype)
    """
    if not settings_obj or not settings_obj.smtp_host:
        logger.warning("Email configuration missing for tenant.")
        return 0

    try:
        connection = get_connection(
            host=settings_obj.smtp_host,
            port=settings_obj.smtp_port,
            username=settings_obj.smtp_username,
            password=settings_obj.smtp_password,
            use_tls=settings_obj.smtp_use_tls,
        )
        
        email = EmailMessage(
            subject=subject,
            body=message,
            from_email=settings_obj.smtp_from_email,
            to=recipient_list,
            connection=connection,
        )
        
        if attachments:
            for attachment in attachments:
                email.attach(*attachment)
        
        return email.send()
    except Exception as e:
        logger.error(f"Failed to send tenant email: {e}")
        return 0
