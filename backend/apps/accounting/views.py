from rest_framework import viewsets, permissions, status
from apps.users.permissions import HasRolePermission
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import ChartOfAccount, JournalEntry, LedgerEntry
from .serializers import ChartOfAccountSerializer, JournalEntrySerializer, LedgerEntrySerializer
from .reports import (
    generate_trial_balance, generate_balance_sheet, generate_profit_loss,
    generate_general_ledger, generate_cash_flow_statement
)
from .utils import seed_standard_coa


class ChartOfAccountViewSet(viewsets.ModelViewSet):
    queryset = ChartOfAccount.objects.all()
    serializer_class = ChartOfAccountSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    
    @action(detail=False, methods=['post'])
    def seed(self, request):
        """Seed standard Chart of Accounts."""
        seed_standard_coa()
        return Response({'status': 'Standard COA seeded successfully'})


class JournalEntryViewSet(viewsets.ModelViewSet):
    queryset = JournalEntry.objects.all()
    serializer_class = JournalEntrySerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class AccountingReportViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]

    @action(detail=False, methods=['get'])
    def trial_balance(self, request):
        date = request.query_params.get('date')
        data = generate_trial_balance(date)
        return Response(data)

    @action(detail=False, methods=['get'])
    def balance_sheet(self, request):
        date = request.query_params.get('date')
        data = generate_balance_sheet(date)
        return Response(data)

    @action(detail=False, methods=['get'])
    def profit_loss(self, request):
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if not start_date or not end_date:
            # Default to current month
            today = timezone.now().date()
            start_date = today.replace(day=1)
            end_date = today
            
        data = generate_profit_loss(start_date, end_date)
        return Response(data)

    @action(detail=False, methods=['get'])
    def general_ledger(self, request):
        account_id = request.query_params.get('account_id')
        if not account_id:
            return Response({'error': 'account_id is required'}, status=400)
            
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        data = generate_general_ledger(account_id, start_date, end_date)
        return Response(data)

    @action(detail=False, methods=['get'])
    def cash_flow(self, request):
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if not start_date or not end_date:
            today = timezone.now().date()
            start_date = today.replace(day=1)
            end_date = today
            
        data = generate_cash_flow_statement(start_date, end_date)
        return Response(data)
