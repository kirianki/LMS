"""
M-Pesa Integration Service

This module provides integration with Safaricom M-Pesa APIs.
Configuration is stored per Organization.
"""
import requests
import base64
from datetime import datetime
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class MpesaService:
    """M-Pesa API integration service."""
    
    SANDBOX_URL = "https://sandbox.safaricom.co.ke"
    PRODUCTION_URL = "https://api.safaricom.co.ke"
    
    def __init__(self, organization):
        self.settings = organization
        self.base_url = self.PRODUCTION_URL if organization and organization.mpesa_environment == 'production' else self.SANDBOX_URL
    
    def _get_access_token(self):
        """Get OAuth access token from M-Pesa."""
        if not self.settings or not self.settings.mpesa_consumer_key or not self.settings.mpesa_consumer_secret:
            raise ValueError("M-Pesa credentials not configured")
        
        credentials = base64.b64encode(
            f"{self.settings.mpesa_consumer_key}:{self.settings.mpesa_consumer_secret}".encode()
        ).decode()
        
        url = f"{self.base_url}/oauth/v1/generate?grant_type=client_credentials"
        headers = {"Authorization": f"Basic {credentials}"}
        
        try:
            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()
            return response.json().get("access_token")
        except requests.RequestException as e:
            logger.error(f"Failed to get M-Pesa access token: {e}")
            raise
    
    def _get_password(self):
        """Generate the password for STK push."""
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        data_to_encode = f"{self.settings.mpesa_shortcode}{self.settings.mpesa_passkey}{timestamp}"
        return base64.b64encode(data_to_encode.encode()).decode(), timestamp
    
    def initiate_stk_push(self, phone_number, amount, account_reference, description="Payment"):
        """
        Initiate STK Push to customer's phone.
        
        Args:
            phone_number: Customer phone (254XXXXXXXXX format)
            amount: Amount to request
            account_reference: Loan/account reference
            description: Transaction description
        
        Returns:
            dict with checkout_request_id and response
        """
        access_token = self._get_access_token()
        password, timestamp = self._get_password()
        
        url = f"{self.base_url}/mpesa/stkpush/v1/processrequest"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "BusinessShortCode": self.settings.mpesa_shortcode,
            "Password": password,
            "Timestamp": timestamp,
            "TransactionType": "CustomerPayBillOnline",
            "Amount": int(amount),
            "PartyA": phone_number,
            "PartyB": self.settings.mpesa_shortcode,
            "PhoneNumber": phone_number,
            "CallBackURL": self.settings.mpesa_callback_url,
            "AccountReference": account_reference,
            "TransactionDesc": description
        }
        
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=30)
            response.raise_for_status()
            data = response.json()
            logger.info(f"STK Push initiated: {data}")
            return {
                "success": True,
                "checkout_request_id": data.get("CheckoutRequestID"),
                "response": data
            }
        except requests.RequestException as e:
            logger.error(f"STK Push failed: {e}")
            return {"success": False, "error": str(e)}
    
    def initiate_b2c_disbursement(self, phone_number, amount, remarks="Loan Disbursement"):
        """
        Initiate B2C payment to customer.
        
        Args:
            phone_number: Recipient phone (254XXXXXXXXX)
            amount: Amount to disburse
            remarks: Transaction remarks
        
        Returns:
            dict with conversation_id and response
        """
        access_token = self._get_access_token()
        
        url = f"{self.base_url}/mpesa/b2c/v1/paymentrequest"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "InitiatorName": self.settings.mpesa_initiator_name,
            "SecurityCredential": self.settings.mpesa_initiator_password,  # Should be encrypted
            "CommandID": "BusinessPayment",
            "Amount": int(amount),
            "PartyA": self.settings.mpesa_shortcode,
            "PartyB": phone_number,
            "Remarks": remarks,
            "QueueTimeOutURL": f"{self.settings.mpesa_callback_url}/timeout",
            "ResultURL": f"{self.settings.mpesa_callback_url}/result",
            "Occasion": "Loan Disbursement"
        }
        
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=30)
            response.raise_for_status()
            data = response.json()
            logger.info(f"B2C Disbursement initiated: {data}")
            return {
                "success": True,
                "conversation_id": data.get("ConversationID"),
                "originator_conversation_id": data.get("OriginatorConversationID"),
                "response": data
            }
        except requests.RequestException as e:
            logger.error(f"B2C Disbursement failed: {e}")
            return {"success": False, "error": str(e)}
    
    def query_stk_status(self, checkout_request_id):
        """Query the status of an STK Push transaction."""
        access_token = self._get_access_token()
        password, timestamp = self._get_password()
        
        url = f"{self.base_url}/mpesa/stkpushquery/v1/query"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "BusinessShortCode": self.settings.mpesa_shortcode,
            "Password": password,
            "Timestamp": timestamp,
            "CheckoutRequestID": checkout_request_id
        }
        
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=30)
            response.raise_for_status()
            return {"success": True, "response": response.json()}
        except requests.RequestException as e:
            logger.error(f"STK Query failed: {e}")
            return {"success": False, "error": str(e)}
