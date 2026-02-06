from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum
from .models import CashAccount, Transaction, DailySnapshot
from .serializers import CashAccountSerializer, TransactionSerializer, DailySnapshotSerializer


from apps.users.permissions import HasRolePermission

class CashAccountViewSet(viewsets.ModelViewSet):
    queryset = CashAccount.objects.all()
    serializer_class = CashAccountSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    filterset_fields = ['account_type', 'is_active']
    search_fields = ['name', 'bank_name', 'account_number']
    ordering_fields = ['name', 'current_balance']
    ordering = ['name']


class TransactionViewSet(viewsets.ModelViewSet):
    queryset = Transaction.objects.all()
    serializer_class = TransactionSerializer
    permission_classes = [permissions.IsAdminUser]
    filterset_fields = ['account', 'transaction_type', 'category']
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class DailySnapshotViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DailySnapshot.objects.all()
    serializer_class = DailySnapshotSerializer
    permission_classes = [permissions.IsAdminUser]
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get latest financial summary."""
        latest = DailySnapshot.objects.first()
        if not latest:
            return Response({'error': 'No snapshots available'}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = self.get_serializer(latest)
        return Response(serializer.data)
