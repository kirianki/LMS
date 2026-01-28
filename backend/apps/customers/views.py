from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db import transaction
import random  # Mocking external CRB API for now
from .models import Customer, CRBReport
from .serializers import CustomerSerializer

from apps.users.permissions import HasRolePermission

class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def verify_id(self, request, pk=None):
        """
        Verify customer ID. Supports automated (AI) and manual verification modes
        based on tenant settings.
        """
        customer = self.get_object()
        tenant_settings = request.tenant.settings
        
        mode = request.data.get('mode', 'auto') # 'auto' or 'manual'
        
        if mode == 'manual':
            if not request.user.is_staff:
                return Response({"error": "Only staff can perform manual verification."}, status=status.HTTP_403_FORBIDDEN)
            
            customer.verification_status = Customer.VerificationStatus.VERIFIED
            customer.is_verified = True
            customer.verified_by = request.user
            customer.verified_at = timezone.now()
            customer.verification_notes = request.data.get('notes', 'Manually verified by staff.')
            customer.save()
            return Response({"status": "Customer manually verified.", "verification_status": customer.verification_status})

        # Automated Mode
        if not tenant_settings.identity_enabled:
            return Response(
                {"error": "Automated identity verification is not enabled for this tenant. Please use manual verification."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not customer.id_document:
            return Response(
                {"error": "ID document required for automated verification."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Mock Automated Verification Logic (Smile Identity / AI Integration point)
        customer.verification_status = Customer.VerificationStatus.PENDING
        customer.save()
        
        # Simulate AI processing...
        import time 
        # In real world, this would be a background task or immediate API call
        is_valid = True # Mock success
        
        if is_valid:
            customer.verification_status = Customer.VerificationStatus.VERIFIED
            customer.is_verified = True
            customer.verified_at = timezone.now()
            customer.verification_notes = "Verified via automated identity provider."
        else:
            customer.verification_status = Customer.VerificationStatus.FAILED
            customer.verification_notes = "Automated verification failed: ID mismatch."
        
        customer.save()
        
        return Response({
            "status": "Automated verification completed.",
            "verification_status": customer.verification_status,
            "notes": customer.verification_notes
        })

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAdminUser])
    def fetch_crb_report(self, request, pk=None):
        """
        Manual trigger to fetch CRB score and update hybrid score.
        This is a 'charged' action.
        """
        customer = self.get_object()
        
        # 1. Mock External CRB API Request
        # In a real app, we would use a library like 'requests' to call Metropol/TransUnion/Creditinfo
        mock_external_score = random.randint(300, 850)
        mock_raw_data = {
            "provider": "MockCRB",
            "reference_id": f"CRB-{customer.id_number}-{random.randint(1000, 9999)}",
            "accounts": [
                {"bank": "KCB", "status": "performing", "balance": 5000},
                {"bank": "Equity", "status": "non-performing", "balance": 1500}
            ],
            "inquiries_last_30_days": 2,
            "score": mock_external_score
        }

        with transaction.atomic():
            # 2. Save CRB Report for Audit
            CRBReport.objects.create(
                customer=customer,
                raw_data=mock_raw_data,
                score=mock_external_score,
                performed_by=request.user
            )

            # 3. Update Customer Scoring Fields
            customer.crb_score = mock_external_score
            customer.last_crb_check = timezone.now()
            
            # 4. Calculate Hybrid Score
            # Formula: (CRB * 0.6) + (Internal * 0.4)
            # Internal score starts at 0 and grows with successful loan repayments
            internal_weight = 0.4
            crb_weight = 0.6
            
            customer.hybrid_score = int(
                (customer.crb_score * crb_weight) + 
                (customer.internal_score * internal_weight)
            )
            
            customer.save()

        return Response({
            "status": "CRB Report fetched and Hybrid Score updated.",
            "crb_score": customer.crb_score,
            "internal_score": customer.internal_score,
            "hybrid_score": customer.hybrid_score
        }, status=status.HTTP_200_OK)
