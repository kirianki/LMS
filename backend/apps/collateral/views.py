from apps.core.viewsets import TenantScopedViewSet
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Collateral, Valuer, ValuationRequest, ValuationReport
from .serializers import (
    CollateralSerializer, ValuerSerializer, 
    ValuationRequestSerializer, ValuationReportSerializer
)

class CollateralViewSet(TenantScopedViewSet):
    queryset = Collateral.objects.all()
    serializer_class = CollateralSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['borrower', 'collateral_type', 'status', 'is_charged']
    search_fields = [
        'borrower__first_name', 'borrower__last_name', 'borrower__business_name', 
        'reg_number', 'logbook_number', 'lr_number', 'tracker_device_id'
    ]

    def get_queryset(self):
        queryset = super().get_queryset().select_related('borrower')
        
        # Support for Refinancing: If a refinance_loan_id is provided, 
        # include pledged collaterals from that specific loan.
        refinance_loan_id = self.request.query_params.get('refinance_loan_id')
        if refinance_loan_id:
            from apps.loans.models import Loan
            from django.db import models
            try:
                old_loan = Loan.objects.get(id=refinance_loan_id)
                # Include AVAILABLE items AND items PLEDGED to the loan being refinanced
                queryset = queryset.filter(
                    models.Q(status='available') | 
                    models.Q(loans=old_loan) | 
                    models.Q(loans_m2m=old_loan)
                ).distinct()
            except (Loan.DoesNotExist, ValueError):
                pass
        
        return queryset
    ordering_fields = ['valuation_date', 'market_value', 'created_at']
    
    def perform_create(self, serializer):
        from apps.branches.utils import get_user_branch
        branch = get_user_branch(self.request.user)
        super().perform_create(serializer)
        instance = serializer.instance
        if not instance.branch:
            instance.branch = branch
            instance.save()

    @action(detail=True, methods=['post'])
    def discharge(self, request, pk=None):
        """Manually discharge a collateral, returning it to 'available' status."""
        collateral = self.get_object()
        
        # Check exposure - only discharge if not securing any active/overdue loans
        from apps.loans.models import Loan
        from django.db.models import Q
        active_loans = Loan.objects.filter(
            Q(collateral=collateral) | Q(collaterals=collateral),
            status__in=[Loan.Status.ACTIVE, Loan.Status.DEFAULTED]
        ).exists()
        
        if active_loans:
            return Response(
                {'error': 'Cannot discharge collateral while it still secures active or overdue loans.'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        from django.db import transaction
        with transaction.atomic():
            collateral.status = Collateral.CollateralStatus.AVAILABLE
            collateral.save()
            
            # Optional audit log
            from apps.auditlog.models import ActivityLog
            ActivityLog.objects.create(
                organization=collateral.organization,
                user=request.user,
                action=ActivityLog.Action.UPDATE,
                module='Collateral',
                description=f"Manually discharged collateral {collateral}.",
                content_object=collateral
            )
            
        return Response({'status': 'Collateral successfully discharged.'}, status=status.HTTP_200_OK)

class ValuerViewSet(TenantScopedViewSet):
    queryset = Valuer.objects.all()
    serializer_class = ValuerSerializer
    permission_classes = [permissions.IsAuthenticated]


class ValuationRequestViewSet(TenantScopedViewSet):
    queryset = ValuationRequest.objects.all()
    serializer_class = ValuationRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

class ValuationReportViewSet(TenantScopedViewSet):
    queryset = ValuationReport.objects.all()
    serializer_class = ValuationReportSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        super().perform_create(serializer)
        report = serializer.instance
        
        # Cascade valuation back to the primary Collateral object
        collateral = report.collateral
        if report.market_value:
            collateral.market_value = report.market_value
        if report.forced_sale_value:
            collateral.forced_sale_value = report.forced_sale_value
        if getattr(report, 'valuation_date', None):
            collateral.valuation_date = report.valuation_date
        if getattr(report, 'valuer', None):
            collateral.valuer = report.valuer
            
        collateral.save()
