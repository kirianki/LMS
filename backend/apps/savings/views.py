from apps.core.viewsets import TenantScopedMixin, TenantScopedViewSet
from rest_framework import viewsets, status, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend
from apps.users.filters import BranchScopingFilterBackend
from apps.users.permissions import HasRolePermission
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import SavingsProduct, SavingsAccount, SavingsTransaction
from .serializers import (
    SavingsProductSerializer, SavingsAccountSerializer, 
    SavingsTransactionSerializer, DepositWithdrawalSerializer
)
from .services import process_deposit, process_withdrawal, post_accrued_interest

class SavingsProductViewSet(TenantScopedViewSet):
    queryset = SavingsProduct.objects.all()
    serializer_class = SavingsProductSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]

class SavingsAccountViewSet(TenantScopedViewSet):
    queryset = SavingsAccount.objects.all()
    serializer_class = SavingsAccountSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    filter_backends = [DjangoFilterBackend, BranchScopingFilterBackend]
    filterset_fields = ['borrower', 'status']
    
    def perform_create(self, serializer):
        from apps.branches.utils import get_user_branch
        branch = get_user_branch(self.request.user)
        super().perform_create(serializer)
        instance = serializer.instance
        if not instance.branch:
            instance.branch = branch
            instance.save()

    @action(detail=True, methods=['post'])
    def deposit(self, request, pk=None):
        serializer = DepositWithdrawalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            txn = process_deposit(
                account_id=pk,
                amount=serializer.validated_data['amount'],
                reference=serializer.validated_data.get('reference', ''),
                description=serializer.validated_data.get('description', ''),
                user=request.user
            )
            return Response(SavingsTransactionSerializer(txn).data, status=status.HTTP_201_CREATED)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def withdraw(self, request, pk=None):
        serializer = DepositWithdrawalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            txn = process_withdrawal(
                account_id=pk,
                amount=serializer.validated_data['amount'],
                reference=serializer.validated_data.get('reference', ''),
                description=serializer.validated_data.get('description', ''),
                user=request.user
            )
            return Response(SavingsTransactionSerializer(txn).data, status=status.HTTP_201_CREATED)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def post_interest(self, request, pk=None):
        """Manual trigger to post accrued interest for this account."""
        post_accrued_interest(account_id=pk)
        return Response({"message": "Interest posted successfully"})

class SavingsTransactionViewSet(TenantScopedMixin, viewsets.ReadOnlyModelViewSet):
    queryset = SavingsTransaction.objects.all()
    serializer_class = SavingsTransactionSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]

    def get_queryset(self):
        queryset = super().get_queryset()
        account_id = self.request.query_params.get('account')
        if account_id:
            queryset = queryset.filter(account_id=account_id)
        return queryset
