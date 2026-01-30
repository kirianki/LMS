from rest_framework import viewsets, status, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db import transaction
import random  # Mocking external CRB API for now
from .models import Borrower, CRBReport
from .serializers import BorrowerSerializer

from apps.users.permissions import HasRolePermission

class BorrowerViewSet(viewsets.ModelViewSet):
    queryset = Borrower.objects.all()
    serializer_class = BorrowerSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['borrower_type', 'is_verified', 'verification_status', 'employment_status']
    search_fields = ['first_name', 'last_name', 'business_name', 'id_number', 'borrower_number', 'phone_number', 'email']
    ordering_fields = ['created_at', 'hybrid_score', 'first_name', 'last_name', 'business_name']
    ordering = ['-created_at']

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def verify_id(self, request, pk=None):
        """
        Verify borrower ID. Supports automated (AI) and manual verification modes
        based on tenant settings.
        """
        borrower = self.get_object()
        tenant_settings = request.tenant.settings
        
        mode = request.data.get('mode', 'auto') # 'auto' or 'manual'
        
        if mode == 'manual':
            if not request.user.is_staff:
                return Response({"error": "Only staff can perform manual verification."}, status=status.HTTP_403_FORBIDDEN)
            
            borrower.verification_status = Borrower.VerificationStatus.VERIFIED
            borrower.is_verified = True
            borrower.verified_by = request.user
            borrower.verified_at = timezone.now()
            borrower.verification_notes = request.data.get('notes', 'Manually verified by staff.')
            borrower.save()
            return Response({"status": "Borrower manually verified.", "verification_status": borrower.verification_status})

        # Automated Mode
        if not tenant_settings.identity_enabled:
            return Response(
                {"error": "Automated identity verification is not enabled for this tenant. Please use manual verification."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not borrower.id_document:
            return Response(
                {"error": "ID document required for automated verification."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Mock Automated Verification Logic (Smile Identity / AI Integration point)
        borrower.verification_status = Borrower.VerificationStatus.PENDING
        borrower.save()
        
        # Simulate AI processing...
        import time 
        # In real world, this would be a background task or immediate API call
        is_valid = True # Mock success
        
        if is_valid:
            borrower.verification_status = Borrower.VerificationStatus.VERIFIED
            borrower.is_verified = True
            borrower.verified_at = timezone.now()
            borrower.verification_notes = "Verified via automated identity provider."
        else:
            borrower.verification_status = Borrower.VerificationStatus.FAILED
            borrower.verification_notes = "Automated verification failed: ID mismatch."
        
        borrower.save()
        
        return Response({
            "status": "Automated verification completed.",
            "verification_status": borrower.verification_status,
            "notes": borrower.verification_notes
        })

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAdminUser])
    def fetch_crb_report(self, request, pk=None):
        """
        Manual trigger to fetch CRB score and update hybrid score.
        This is a 'charged' action.
        """
        borrower = self.get_object()
        
        # 1. Mock External CRB API Request
        # In a real app, we would use a library like 'requests' to call Metropol/TransUnion/Creditinfo
        mock_external_score = random.randint(300, 850)
        mock_raw_data = {
            "provider": "MockCRB",
            "reference_id": f"CRB-{borrower.id_number}-{random.randint(1000, 9999)}",
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
                borrower=borrower,
                raw_data=mock_raw_data,
                score=mock_external_score,
                performed_by=request.user
            )

            # 3. Update Borrower Scoring Fields
            borrower.crb_score = mock_external_score
            borrower.last_crb_check = timezone.now()
            
            # 4. Calculate Hybrid Score
            # Formula: (CRB * 0.6) + (Internal * 0.4)
            # Internal score starts at 0 and grows with successful loan repayments
            internal_weight = 0.4
            crb_weight = 0.6
            
            borrower.hybrid_score = int(
                (borrower.crb_score * crb_weight) + 
                (borrower.internal_score * internal_weight)
            )
            
            borrower.save()

        return Response({
            "status": "CRB Report fetched and Hybrid Score updated.",
            "crb_score": borrower.crb_score,
            "internal_score": borrower.internal_score,
            "hybrid_score": borrower.hybrid_score
        }, status=status.HTTP_200_OK)
