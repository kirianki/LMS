from rest_framework import viewsets, permissions
from .models import Collateral, Valuer, EmailConfiguration, ValuationRequest, ValuationReport
from .serializers import (
    CollateralSerializer, ValuerSerializer, EmailConfigurationSerializer, 
    ValuationRequestSerializer, ValuationReportSerializer
)

class CollateralViewSet(viewsets.ModelViewSet):
    queryset = Collateral.objects.all()
    serializer_class = CollateralSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['customer', 'collateral_type', 'status']

    def get_queryset(self):
        return super().get_queryset().select_related('customer')

class ValuerViewSet(viewsets.ModelViewSet):
    queryset = Valuer.objects.all()
    serializer_class = ValuerSerializer
    permission_classes = [permissions.IsAuthenticated]

class EmailConfigViewSet(viewsets.ModelViewSet):
    queryset = EmailConfiguration.objects.all()
    serializer_class = EmailConfigurationSerializer
    permission_classes = [permissions.IsAdminUser]

class ValuationRequestViewSet(viewsets.ModelViewSet):
    queryset = ValuationRequest.objects.all()
    serializer_class = ValuationRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

class ValuationReportViewSet(viewsets.ModelViewSet):
    queryset = ValuationReport.objects.all()
    serializer_class = ValuationReportSerializer
    permission_classes = [permissions.IsAuthenticated]
