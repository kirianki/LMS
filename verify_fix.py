
import os
import django
import uuid
from decimal import Decimal

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.customers.models import Borrower, BorrowerPhone
from apps.customers.serializers import BorrowerSerializer
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

def verify_fix():
    print("Starting verification for Borrower Phone Duplication fix...")
    
    # 1. Create a borrower with a phone
    phone_number = f"+254700{uuid.uuid4().hex[:6]}"
    borrower = Borrower.objects.create(
        first_name="Test",
        last_name="Borrower",
        phone_number=phone_number,
        id_number=str(uuid.uuid4().hex[:10])
    )
    
    phone1 = BorrowerPhone.objects.create(
        borrower=borrower,
        phone_number="+254711111111",
        description="Initial Phone"
    )
    
    print(f"Created borrower {borrower.id} with phone {phone1.id}")
    
    # 2. Prepare update data (mimicking what frontend sends)
    # The crucial part is including the ID
    update_data = {
        "first_name": "Updated Name",
        "additional_phones": [
            {
                "id": str(phone1.id),
                "phone_number": "+254711111111",
                "description": "Updated Description"
            }
        ]
    }
    
    # 3. Perform update via serializer
    factory = APIRequestFactory()
    request = factory.patch('/', update_data, format='json')
    
    serializer = BorrowerSerializer(instance=borrower, data=update_data, partial=True)
    if serializer.is_valid():
        serializer.save()
        print("Serializer update successful.")
    else:
        print(f"Serializer errors: {serializer.errors}")
        return False
        
    # 4. Verify results
    phones = BorrowerPhone.objects.filter(borrower=borrower)
    print(f"Total phones for borrower: {phones.count()}")
    
    for p in phones:
        print(f"  Phone ID: {p.id}, Number: {p.phone_number}, Desc: {p.description}")
        
    if phones.count() == 1:
        if phones[0].id == phone1.id and phones[0].description == "Updated Description":
            print("SUCCESS: Phone was updated correctly without creating a duplicate.")
            return True
        else:
            print("FAILURE: Phone ID mismatch or description failed to update.")
    else:
        print("FAILURE: Multiple phones found (duplication still occurring).")
    
    return False

if __name__ == "__main__":
    success = verify_fix()
    if not success:
        exit(1)
