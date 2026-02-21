from apps.core.viewsets import TenantScopedViewSet
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import FileResponse
from .models import Investor, Investment, InvestorPayout
from .serializers import InvestorSerializer, InvestmentSerializer, InvestorPayoutSerializer
from apps.treasury.services.documents import generate_investor_statement


class InvestorViewSet(TenantScopedViewSet):
    queryset = Investor.objects.all()
    serializer_class = InvestorSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def perform_create(self, serializer):
        from apps.branches.utils import get_user_branch
        branch = get_user_branch(self.request.user)
        super().perform_create(serializer)
        instance = serializer.instance
        if not instance.branch:
            instance.branch = branch
            instance.save()
    
    @action(detail=True, methods=['get'])
    def statement(self, request, pk=None):
        """Download investor statement PDF."""
        investor = self.get_object()
        
        pdf_buffer = generate_investor_statement(investor, request.user.organization)
        return FileResponse(
            pdf_buffer,
            as_attachment=True,
            filename=f"investor_statement_{investor.investor_number}.pdf",
            content_type='application/pdf'
        )


class InvestmentViewSet(TenantScopedViewSet):
    queryset = Investment.objects.all()
    serializer_class = InvestmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['investor', 'status']
    
    def perform_create(self, serializer):
        super().perform_create(serializer)
        instance = serializer.instance
        if not instance.created_by:
            instance.created_by = self.request.user
            instance.save()


class InvestorPayoutViewSet(TenantScopedViewSet):
    queryset = InvestorPayout.objects.all()
    serializer_class = InvestorPayoutSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['investment', 'payout_type']
    
    def perform_create(self, serializer):
        super().perform_create(serializer)
        instance = serializer.instance
        if not instance.created_by:
            instance.created_by = self.request.user
            instance.save()
