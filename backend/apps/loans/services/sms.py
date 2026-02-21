"""
SMS Service for loan reminders.

Supports multiple SMS providers that can be configured globally.
"""
import requests
import logging
from django.utils import timezone

logger = logging.getLogger(__name__)


class SMSService:
    """SMS gateway integration service."""
    
    def __init__(self, site_settings):
        self.settings = site_settings
    
    def send_sms(self, phone_number, message, related_loan=None, related_borrower=None):
        """
        Send SMS via configured provider and log the attempt.
        """
        from apps.notifications.models import CommunicationLog
        
        provider = self.settings.sms_provider.lower() if self.settings.sms_provider else 'generic'
        
        # Create Log Entry (Queued)
        log = CommunicationLog.objects.create(
            recipient=phone_number,
            message_type=CommunicationLog.MessageType.SMS,
            content=message,
            status=CommunicationLog.Status.QUEUED,
            provider=provider,
            related_loan=related_loan,
            related_borrower=related_borrower
        )
        
        if not self.settings.sms_api_key:
            logger.warning("SMS provider not configured")
            log.status = CommunicationLog.Status.FAILED
            log.provider_response = {"error": "SMS not configured"}
            log.save()
            return {"success": False, "error": "SMS not configured"}
        
        result = {}
        try:
            if provider == 'africas_talking':
                result = self._send_africas_talking(phone_number, message)
            elif provider == 'infobip':
                result = self._send_infobip(phone_number, message)
            else:
                # Generic fallback
                result = self._send_generic_webhook(phone_number, message)
                
            # Update Log
            log.status = CommunicationLog.Status.SENT if result.get('success') else CommunicationLog.Status.FAILED
            log.provider_response = result
            if result.get('success'):
                log.sent_at = timezone.now()
            log.save()
            
            return result
            
        except Exception as e:
            log.status = CommunicationLog.Status.FAILED
            log.provider_response = {"error": str(e)}
            log.save()
            return {"success": False, "error": str(e)}
    
    def _send_africas_talking(self, phone_number, message):
        """Send via Africa's Talking."""
        url = "https://api.africastalking.com/version1/messaging"
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
            "apiKey": self.settings.sms_api_key,
        }
        data = {
            "username": self.settings.sms_api_secret,  # AT uses username here
            "to": phone_number,
            "message": message,
            "from": self.settings.sms_sender_id or None,
        }
        
        try:
            response = requests.post(url, headers=headers, data=data, timeout=30)
            response.raise_for_status()
            result = response.json()
            logger.info(f"AT SMS sent: {result}")
            return {"success": True, "response": result}
        except requests.RequestException as e:
            logger.error(f"AT SMS failed: {e}")
            return {"success": False, "error": str(e)}
    
    def _send_infobip(self, phone_number, message):
        """Send via Infobip."""
        url = "https://api.infobip.com/sms/2/text/advanced"
        headers = {
            "Authorization": f"App {self.settings.sms_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "messages": [{
                "from": self.settings.sms_sender_id,
                "destinations": [{"to": phone_number}],
                "text": message,
            }]
        }
        
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=30)
            response.raise_for_status()
            result = response.json()
            logger.info(f"Infobip SMS sent: {result}")
            return {"success": True, "response": result}
        except requests.RequestException as e:
            logger.error(f"Infobip SMS failed: {e}")
            return {"success": False, "error": str(e)}
    
    def _send_generic_webhook(self, phone_number, message):
        """Fallback generic webhook."""
        logger.info(f"[MOCK SMS] To: {phone_number}, Message: {message}")
        return {"success": True, "mock": True}


def send_loan_reminder_sms(site_settings, borrower, loan, schedule_entry):
    """
    Send a loan payment reminder SMS.
    """
    sms_service = SMSService(site_settings)
    
    name = borrower.business_name if borrower.borrower_type in ['company', 'institution'] and borrower.business_name else borrower.first_name

    message = (
        f"Dear {name}, your loan payment of KES {schedule_entry.total_due:,.2f} "
        f"for loan {loan.loan_number} is due on {schedule_entry.due_date.strftime('%d/%m/%Y')}. "
        f"Please make payment to avoid penalties. Thank you."
    )
    
    return sms_service.send_sms(
        borrower.phone_number, 
        message, 
        related_loan=loan,
        related_borrower=borrower
    )


def send_overdue_reminder_sms(site_settings, borrower, loan, schedule_entry, days_overdue):
    """Send overdue payment reminder."""
    sms_service = SMSService(site_settings)
    
    name = borrower.business_name if borrower.borrower_type in ['company', 'institution'] and borrower.business_name else borrower.first_name

    message = (
        f"Dear {name}, your loan payment of KES {schedule_entry.total_due:,.2f} "
        f"for loan {loan.loan_number} is {days_overdue} days OVERDUE. "
        f"Please make payment immediately to avoid further penalties."
    )
    
    return sms_service.send_sms(
        borrower.phone_number, 
        message,
        related_loan=loan,
        related_borrower=borrower
    )
