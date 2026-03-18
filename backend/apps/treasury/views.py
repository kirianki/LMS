from apps.core.viewsets import TenantScopedMixin, TenantScopedViewSet
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum
from .models import CashAccount, Transaction, DailySnapshot
from .serializers import CashAccountSerializer, TransactionSerializer, DailySnapshotSerializer


from apps.users.permissions import HasRolePermission

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from apps.users.filters import BranchScopingFilterBackend
from apps.branches.utils import get_user_branch

class CashAccountViewSet(TenantScopedViewSet):
    queryset = CashAccount.objects.all()
    serializer_class = CashAccountSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter, BranchScopingFilterBackend]
    filterset_fields = ['account_type', 'is_active']
    search_fields = ['name', 'bank_name', 'account_number']
    ordering_fields = ['name', 'current_balance']
    ordering = ['name']

    def perform_create(self, serializer):
        # Automatically assign organization and branch
        branch = get_user_branch(self.request.user)
        
        # We need to make sure organization is also set, 
        # TenantScopedMixin handles it but we are overriding perform_create
        org = getattr(self.request.user, 'organization', None)
        
        serializer.save(
            organization=org,
            branch=branch
        )

    @action(detail=True, methods=['post'])
    def top_up(self, request, pk=None):
        """Simplified account top-up with GL integration."""
        account = self.get_object()
        amount = request.data.get('amount')
        category = request.data.get('category', Transaction.Category.OTHER)
        counterparty_coa_code = request.data.get('counterparty_coa_code')
        description = request.data.get('description', f"Top up for {account.name}")
        reference = request.data.get('reference', '')

        if not amount:
            return Response({"error": "Amount is required"}, status=status.HTTP_400_BAD_REQUEST)

        from apps.accounting.models import ChartOfAccount
        counterparty_coa = None
        if counterparty_coa_code:
            counterparty_coa = ChartOfAccount.objects.filter(code=counterparty_coa_code, organization=account.organization).first()
        
        # Default counterparty to Capital/Equity (3100) if not provided for top-ups
        if not counterparty_coa:
            counterparty_coa = ChartOfAccount.objects.filter(code='3100', organization=account.organization).first()

        from django.db import transaction as db_transaction
        with db_transaction.atomic():
            # 1. Create Treasury Transaction
            trx = Transaction.objects.create(
                account=account,
                transaction_type=Transaction.TransactionType.CREDIT,
                category=category,
                amount=amount,
                description=description,
                reference=reference,
                counterparty_coa=counterparty_coa,
                created_by=request.user
            )

            # 2. GL Posting
            from .services.integrity import post_manual_treasury_transaction
            post_manual_treasury_transaction(trx)

        return Response({
            "status": "Top-up successful",
            "current_balance": account.current_balance,
            "transaction_id": trx.id
        })


class TransactionViewSet(TenantScopedViewSet):
    queryset = Transaction.objects.all()
    serializer_class = TransactionSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter, BranchScopingFilterBackend]
    filterset_fields = ['account', 'transaction_type', 'category']
    
    def perform_create(self, serializer):
        from .services.integrity import post_manual_treasury_transaction
        
        # Save the transaction first
        instance = serializer.save(created_by=self.request.user)
        
        # Then post to GL if counterparty_coa is provided
        try:
            post_manual_treasury_transaction(instance)
        except Exception as e:
            # We don't want to fail the transaction creation if GL posting fails,
            # but we should log it. In a production system, we might want more robust error handling.
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to post manual treasury transaction {instance.id} to GL: {str(e)}")



class DailySnapshotViewSet(TenantScopedMixin, viewsets.ReadOnlyModelViewSet):
    queryset = DailySnapshot.objects.all()
    serializer_class = DailySnapshotSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get latest financial summary."""
        latest = DailySnapshot.objects.first()
        if not latest:
            return Response({'error': 'No snapshots available'}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = self.get_serializer(latest)
        return Response(serializer.data)
