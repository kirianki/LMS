from rest_framework import viewsets, status, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend
from apps.users.filters import BranchScopingFilterBackend
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db import transaction
import random  # Mocking external CRB API for now
from .models import Borrower, CRBReport, CustomerDocument, FinancialStatement
from .serializers import BorrowerSerializer, BorrowerHistorySerializer
from apps.loans.models import LoanApplication, Loan

from apps.users.permissions import HasRolePermission

class BorrowerViewSet(viewsets.ModelViewSet):
    queryset = Borrower.objects.all()
    serializer_class = BorrowerSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter, BranchScopingFilterBackend]
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

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def history(self, request, pk=None):
        """
        Legacy: Fetch change history for this borrower.
        """
        borrower = self.get_object()
        history = borrower.history.all().order_by('-history_date')
        serializer = BorrowerHistorySerializer(history, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def activity_feed(self, request, pk=None):
        """
        Comprehensive activity feed aggregating profile changes, 
        loan applications, and document uploads.
        """
        borrower = self.get_object()
        activities = []
        
        import logging
        logger = logging.getLogger(__name__)

        # 1. Profile History
        try:
            for h in borrower.history.all():
                try:
                    activities.append({
                        "id": f"profile_{h.history_id}",
                        "date": h.history_date,
                        "type": "profile",
                        "display": "Profile Update" if h.prev_record else "Profile Created",
                        "description": f"Changed: {', '.join(h.diff_against(h.prev_record).changed_fields)}" if h.prev_record else "Customer profile created",
                        "user": h.history_user.get_full_name() if h.history_user else "System",
                        "icon": "user"
                    })
                except Exception as e:
                    logger.warning(f"Error processing profile history {h.history_id}: {str(e)}")
        except Exception as e:
            logger.error(f"Error accessing borrower history: {str(e)}")

        # 2. Loan Application History
        try:
            loan_apps = LoanApplication.history.filter(borrower=borrower)
            for h in loan_apps:
                try:
                    # We want to capture status changes mainly
                    desc = "Loan Application Updated"
                    if h.history_type == '+':
                        # Safely access product name
                        product_name = getattr(h.product, 'name', 'Unknown Product') if hasattr(h, 'product') else 'Unknown Product'
                        desc = f"Applied for {product_name} (KES {h.requested_amount})"
                    elif h.prev_record and h.status != h.prev_record.status:
                        desc = f"Application status changed to {h.get_status_display()}"
                    
                    activities.append({
                        "id": f"loan_app_{h.history_id}",
                        "date": h.history_date,
                        "type": "loan_application",
                        "display": "Loan Application",
                        "description": desc,
                        "user": h.history_user.get_full_name() if h.history_user else "System",
                        "icon": "file-text"
                    })
                except Exception as e:
                    logger.warning(f"Error processing loan app history {h.history_id}: {str(e)}")
        except Exception as e:
            logger.error(f"Error accessing loan application history: {str(e)}")

        # 3. Documents
        try:
            docs = CustomerDocument.objects.filter(borrower=borrower)
            for d in docs:
                try:
                    activities.append({
                        "id": f"doc_{d.id}",
                        "date": d.uploaded_at,
                        "type": "document",
                        "display": "Document Uploaded",
                        "description": f"Uploaded {d.get_document_type_display()}",
                        "user": d.uploaded_by.get_full_name() if d.uploaded_by else "System",
                        "icon": "upload"
                    })
                except Exception as e:
                    logger.warning(f"Error processing document {d.id}: {str(e)}")
        except Exception as e:
             logger.error(f"Error accessing customer documents: {str(e)}")

        # 4. Financial Statements
        try:
            stmts = FinancialStatement.objects.filter(borrower=borrower)
            for s in stmts:
                try:
                    activities.append({
                        "id": f"stmt_{s.id}",
                        "date": s.uploaded_at,
                        "type": "statement",
                        "display": "Statement Uploaded",
                        "description": f"Uploaded {s.get_statement_type_display()} ({s.period_start or '?'} to {s.period_end or '?'})",
                        "user": s.uploaded_by.get_full_name() if s.uploaded_by else "System",
                        "icon": "bar-chart"
                    })
                except Exception as e:
                    logger.warning(f"Error processing statement {s.id}: {str(e)}")
        except Exception as e:
            logger.error(f"Error accessing financial statements: {str(e)}")

        # Sort by date descending
        try:
            activities.sort(key=lambda x: x['date'], reverse=True)
        except Exception as e:
            logger.error(f"Error sorting activities: {str(e)}")

        return Response(activities)

from .models import CustomerDocument, FinancialStatement
from .serializers import CustomerDocumentSerializer, FinancialStatementSerializer
from .tasks import process_financial_statement

class CustomerDocumentViewSet(viewsets.ModelViewSet):
    queryset = CustomerDocument.objects.all()
    serializer_class = CustomerDocumentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, BranchScopingFilterBackend]
    filterset_fields = ['borrower', 'document_type', 'is_verified']
    ordering_fields = ['uploaded_at', 'document_type']
    ordering = ['-uploaded_at']

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAdminUser])
    def verify(self, request, pk=None):
        """
        Manually verify a customer document.
        """
        document = self.get_object()
        
        document.is_verified = True
        document.verified_by = request.user
        document.verified_at = timezone.now()
        document.save()
        
        return Response({
            "status": "Document verified",
            "is_verified": document.is_verified,
            "verified_at": document.verified_at
        })


class FinancialStatementViewSet(viewsets.ModelViewSet):
    queryset = FinancialStatement.objects.all()
    serializer_class = FinancialStatementSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, BranchScopingFilterBackend]
    filterset_fields = ['borrower', 'statement_type', 'extraction_status']
    ordering_fields = ['uploaded_at', 'period_end']
    ordering = ['-uploaded_at']

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)

    @action(detail=True, methods=['post'])
    def analyze(self, request, pk=None):
        """
        Trigger the analysis pipeline via Celery.
        """
        statement = self.get_object()
        
        # 1. Check if already processed
        if statement.extraction_status == FinancialStatement.ExtractionStatus.COMPLETED:
             return Response({"status": "Analysis already completed.", "results": statement.analysis_results})
        
        # 2. Mark as processing
        statement.extraction_status = FinancialStatement.ExtractionStatus.PROCESSING
        statement.save()
        
        # 3. Trigger Background Task
        process_financial_statement.delay(statement.id)
            
        return Response({
            "status": "Analysis queued.",
            "message": "The statement is being processed in the background. Please check back shortly."
        })
