import os
import django
from decimal import Decimal
from datetime import date
from unittest.mock import MagicMock

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.loans.models import Loan, LoanRepayment
from django.contrib.auth import get_user_model

def test_signal():
    print("Testing Notification Signal V2...")
    
    from apps.notifications.signals import notify_loan_disbursement, notify_repayment_received
    from apps.notifications.models import Notification
    
    class MockBorrower:
        name = "John Doe"
        loan_officer = MagicMock() # Mock User
        
    class MockUser:
        id = 1
        
    class MockApp:
        created_by = MockUser()

    class MockLoan:
        id = "loan-123"
        loan_number = "LN-123"
        status = 'active'
        disbursement_date = date.today()
        borrower = MockBorrower()
        application = MockApp()
        # created_by removed
    
    instance = MockLoan()
    
    # Mock Notification.objects.create
    original_create = Notification.objects.create
    Notification.objects.create = MagicMock()
    
    try:
        print("Testing notify_loan_disbursement...")
        notify_loan_disbursement(sender=Loan, instance=instance, created=True)
        print("SUCCESS: notify_loan_disbursement executed without error.")
        Notification.objects.create.assert_called()
        
        # Test Repayment Signal
        Notification.objects.create.reset_mock()
        print("Testing notify_repayment_received...")
        
        class MockRepayment:
            loan = instance
            amount = Decimal('500.00')
            
        repayment = MockRepayment()
        notify_repayment_received(sender=LoanRepayment, instance=repayment, created=True)
        print("SUCCESS: notify_repayment_received executed without error.")
        Notification.objects.create.assert_called()
        
    except AttributeError as e:
        print(f"FAILED: AttributeError caught: {e}")
    except Exception as e:
        print(f"FAILED: Other error: {e}")
    finally:
        Notification.objects.create = original_create

if __name__ == '__main__':
    test_signal()
