"""
SMS Service for loan reminders.

Supports multiple SMS providers that tenants can configure.
"""
import requests
import logging

logger = logging.getLogger(__name__)


class SMSService:
    """SMS gateway integration service."""
    
    def __init__(self, tenant_settings):
        self.settings = tenant_settings
    
    def send_sms(self, phone_number, message):
        """
        Send SMS via configured provider.
        
        Args:
            phone_number: Recipient phone
            message: SMS text
        
        Returns:
            dict with success status
        """
        provider = self.settings.sms_provider.lower()
        
        if not provider or not self.settings.sms_api_key:
            logger.warning("SMS provider not configured for tenant")
            return {"success": False, "error": "SMS not configured"}
        
        if provider == 'africas_talking':
            return self._send_africas_talking(phone_number, message)
        elif provider == 'infobip':
            return self._send_infobip(phone_number, message)
        else:
            # Generic webhook fallback
            return self._send_generic_webhook(phone_number, message)
    
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



def send_loan_reminder_sms(tenant_settings, borrower, loan, schedule_entry):
    """
    Send a loan payment reminder SMS.
    
    Args:
        tenant_settings: TenantSettings instance
        borrower: Borrower instance
        loan: Loan instance
        schedule_entry: RepaymentSchedule instance
    
    Returns:
        SMS send result
    """
    sms_service = SMSService(tenant_settings)
    
    name = borrower.business_name if borrower.borrower_type in ['company', 'institution'] and borrower.business_name else borrower.first_name

    message = (
        f"Dear {name}, your loan payment of KES {schedule_entry.total_due:,.2f} "
        f"for loan {loan.loan_number} is due on {schedule_entry.due_date.strftime('%d/%m/%Y')}. "
        f"Please make payment to avoid penalties. Thank you."
    )
    
    return sms_service.send_sms(borrower.phone_number, message)


def send_overdue_reminder_sms(tenant_settings, borrower, loan, schedule_entry, days_overdue):
    """Send overdue payment reminder."""
    sms_service = SMSService(tenant_settings)
    
    name = borrower.business_name if borrower.borrower_type in ['company', 'institution'] and borrower.business_name else borrower.first_name

    message = (
        f"Dear {name}, your loan payment of KES {schedule_entry.total_due:,.2f} "
        f"for loan {loan.loan_number} is {days_overdue} days OVERDUE. "
        f"Please make payment immediately to avoid further penalties."
    )
    
    return sms_service.send_sms(borrower.phone_number, message)
