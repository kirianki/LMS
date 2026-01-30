import os
import django
from decimal import Decimal

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django_tenants.utils import schema_context
from apps.tenants.models import Tenant
from apps.customers.models import Borrower
from apps.loans.models import LoanApplication, LoanProduct
from rest_framework.test import APIRequestFactory, force_authenticate
from apps.customers.views import BorrowerViewSet
from apps.loans.views import LoanApplicationViewSet
from django.contrib.auth import get_user_model

User = get_user_model()

def verify():
    tenant = Tenant.objects.exclude(schema_name='public').first()
    if not tenant:
        print("No tenant found.")
        return

    with schema_context(tenant.schema_name):
        print(f"--- Verifying List Page Refinements for {tenant.name} ---")
        user = User.objects.filter(is_superuser=True).first()
        factory = APIRequestFactory()

        # 1. Verify Borrower Search
        print("\n[1] Testing Borrower Search...")
        b = Borrower.objects.first()
        if b:
            search_term = b.first_name if b.first_name else b.business_name
            view = BorrowerViewSet.as_view({'get': 'list'})
            request = factory.get(f'/api/borrowers/?search={search_term}', HTTP_HOST='localhost')
            force_authenticate(request, user=user)
            request.tenant = tenant
            response = view(request)
            results = response.data.get('results', [])
            if any(search_term.lower() in str(res).lower() for res in results):
                 print(f"SUCCESS: Search for '{search_term}' returned matching results.")
            else:
                 print(f"FAILURE: Search for '{search_term}' returned unexpected results.")
        else:
            print("No borrowers found to test search.")

        # 2. Verify Borrower Filtering
        print("\n[2] Testing Borrower Filtering...")
        view = BorrowerViewSet.as_view({'get': 'list'})
        request = factory.get('/api/borrowers/?borrower_type=individual', HTTP_HOST='localhost')
        force_authenticate(request, user=user)
        request.tenant = tenant
        response = view(request)
        results = response.data.get('results', [])
        if all(res['borrower_type'] == 'individual' for res in results):
            print("SUCCESS: Filtered by 'individual' correctly.")
        else:
            print("FAILURE: Filtered results contain non-individual types.")

        # 3. Verify Loan Application Search
        print("\n[3] Testing Loan Application Search...")
        app = LoanApplication.objects.first()
        if app:
            search_term = app.application_number
            view = LoanApplicationViewSet.as_view({'get': 'list'})
            request = factory.get(f'/api/loans/applications/?search={search_term}', HTTP_HOST='localhost')
            force_authenticate(request, user=user)
            request.tenant = tenant
            response = view(request)
            results = response.data.get('results', [])
            if any(res['application_number'] == search_term for res in results):
                print(f"SUCCESS: Search for '{search_term}' found application.")
            else:
                print(f"FAILURE: Search for '{search_term}' did not find application.")
        else:
            print("No applications found to test search.")

        # 4. Verify Loan Application Filtering
        print("\n[4] Testing Loan Application Filtering...")
        product = LoanProduct.objects.first()
        if product:
             view = LoanApplicationViewSet.as_view({'get': 'list'})
             request = factory.get(f'/api/loans/applications/?product={product.id}', HTTP_HOST='localhost')
             force_authenticate(request, user=user)
             request.tenant = tenant
             response = view(request)
             results = response.data.get('results', [])
             if all(res['product_details']['name'] == product.name for res in results):
                 print(f"SUCCESS: Filtered by product '{product.name}' correctly.")
             else:
                 print(f"FAILURE: Filtered results contain incorrect products.")
        else:
            print("No products found to test filtering.")

if __name__ == "__main__":
    verify()
