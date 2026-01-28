from django.core.mail import get_connection, EmailMessage
from django.conf import settings
from apps.collateral.models import EmailConfiguration
import logging

logger = logging.getLogger(__name__)

def send_tenant_email(tenant_config_id, subject, message, recipient_list):
    """
    Sends an email using dynamic SMTP settings for a specific tenant.
    """
    try:
        config = EmailConfiguration.objects.get(id=tenant_config_id)
        
        connection = get_connection(
            host=config.smtp_host,
            port=config.smtp_port,
            username=config.smtp_user,
            password=config.smtp_password, # In real app, decrypt this
            use_tls=config.use_tls,
        )
        
        email = EmailMessage(
            subject=subject,
            body=message,
            from_email=config.from_email,
            to=recipient_list,
            connection=connection,
        )
        
        return email.send()
    except Exception as e:
        logger.error(f"Failed to send tenant email: {e}")
        return 0
