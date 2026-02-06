from rest_framework import viewsets, permissions
from .models import Collateral, Valuer, ValuationRequest, ValuationReport
from .serializers import (
    CollateralSerializer, ValuerSerializer, 
    ValuationRequestSerializer, ValuationReportSerializer
)

class CollateralViewSet(viewsets.ModelViewSet):
    queryset = Collateral.objects.all()
    serializer_class = CollateralSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['borrower', 'collateral_type', 'status']
    search_fields = [
        'borrower__first_name', 'borrower__last_name', 'borrower__business_name', 
        'reg_number', 'logbook_number', 'lr_number', 'tracker_device_id'
    ]
    ordering_fields = ['valuation_date', 'market_value', 'created_at']

    def get_queryset(self):
        return super().get_queryset().select_related('borrower')

class ValuerViewSet(viewsets.ModelViewSet):
    queryset = Valuer.objects.all()
    serializer_class = ValuerSerializer
    permission_classes = [permissions.IsAuthenticated]


class ValuationRequestViewSet(viewsets.ModelViewSet):
    queryset = ValuationRequest.objects.all()
    serializer_class = ValuationRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

class ValuationReportViewSet(viewsets.ModelViewSet):
    queryset = ValuationReport.objects.all()
    serializer_class = ValuationReportSerializer
    permission_classes = [permissions.IsAuthenticated]
