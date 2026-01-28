from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import FileResponse
from .models import Investor, Investment, InvestorPayout
from .serializers import InvestorSerializer, InvestmentSerializer, InvestorPayoutSerializer
from apps.treasury.services.documents import generate_investor_statement


class InvestorViewSet(viewsets.ModelViewSet):
    queryset = Investor.objects.all()
    serializer_class = InvestorSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    @action(detail=True, methods=['get'])
    def statement(self, request, pk=None):
        """Download investor statement PDF."""
        investor = self.get_object()
        from django.db import connection
        tenant = connection.tenant
        
        pdf_buffer = generate_investor_statement(investor, tenant)
        return FileResponse(
            pdf_buffer,
            as_attachment=True,
            filename=f"investor_statement_{investor.investor_number}.pdf",
            content_type='application/pdf'
        )


class InvestmentViewSet(viewsets.ModelViewSet):
    queryset = Investment.objects.all()
    serializer_class = InvestmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['investor', 'status']
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class InvestorPayoutViewSet(viewsets.ModelViewSet):
    queryset = InvestorPayout.objects.all()
    serializer_class = InvestorPayoutSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['investment', 'payout_type']
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
