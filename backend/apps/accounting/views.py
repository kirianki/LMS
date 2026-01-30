from rest_framework import viewsets, permissions, status
from apps.users.permissions import HasRolePermission
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import ChartOfAccount, JournalEntry, LedgerEntry
from .serializers import ChartOfAccountSerializer, JournalEntrySerializer, LedgerEntrySerializer
from .reports import (
    generate_trial_balance, generate_balance_sheet, generate_profit_loss,
    generate_general_ledger, generate_cash_flow_statement,
    generate_disbursements_report, generate_collections_report,
    generate_portfolio_performance
)
from .utils import seed_standard_coa
from django.http import HttpResponse
from .utils.pdf import (
    generate_balance_sheet_pdf, generate_profit_loss_pdf, generate_cash_flow_pdf,
    generate_generic_table_pdf, generate_trial_balance_pdf, generate_general_ledger_pdf
)

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
        
        if request.query_params.get('format') == 'pdf':
            pdf_buffer = generate_trial_balance_pdf(data, date or 'Today', request.tenant)
            response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="Trial_Balance_{date}.pdf"'
            return response
            
        return Response(data)

    @action(detail=False, methods=['get'])
    def balance_sheet(self, request):
        date = request.query_params.get('date')
        data = generate_balance_sheet(date)
        
        if request.query_params.get('format') == 'pdf':
            pdf_buffer = generate_balance_sheet_pdf(data, date or 'Today', request.tenant)
            response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="Balance_Sheet_{date}.pdf"'
            return response

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
        
        if request.query_params.get('format') == 'pdf':
            pdf_buffer = generate_profit_loss_pdf(data, start_date, end_date, request.tenant)
            response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="Profit_Loss_{start_date}_{end_date}.pdf"'
            return response

        return Response(data)

    @action(detail=False, methods=['get'])
    def general_ledger(self, request):
        account_id = request.query_params.get('account_id')
        if not account_id:
            return Response({'error': 'account_id is required'}, status=400)
            
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        data = generate_general_ledger(account_id, start_date, end_date)
        
        if request.query_params.get('format') == 'pdf':
            pdf_buffer = generate_general_ledger_pdf(data, account_id, start_date, end_date, request.tenant)
            response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="General_Ledger_{data["account_code"]}.pdf"'
            return response

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
        
        if request.query_params.get('format') == 'pdf':
            pdf_buffer = generate_cash_flow_pdf(data, start_date, end_date, request.tenant)
            response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="Cash_Flow_{start_date}_{end_date}.pdf"'
            return response
            
        return Response(data)

    @action(detail=False, methods=['get'])
    def disbursements(self, request):
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if not start_date or not end_date:
            today = timezone.now().date()
            start_date = today.replace(day=1)
            end_date = today
            
        data = generate_disbursements_report(start_date, end_date)
        
        if request.query_params.get('format') == 'pdf':
            headers = [('loan_number', 'Loan #'), ('borrower', 'Borrower'), ('product', 'Product'), ('date', 'Date'), ('amount', 'Amount'), ('method', 'Method')]
            filters = {'Start Date': start_date, 'End Date': end_date}
            pdf_buffer = generate_generic_table_pdf("DISBURSEMENTS REPORT", data['data'], headers, filters, request.tenant, data['summary'])
            response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="Disbursements_{start_date}_{end_date}.pdf"'
            return response

        return Response(data)

    @action(detail=False, methods=['get'])
    def collections(self, request):
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if not start_date or not end_date:
            today = timezone.now().date()
            start_date = today.replace(day=1)
            end_date = today
            
        data = generate_collections_report(start_date, end_date)
        
        if request.query_params.get('format') == 'pdf':
            headers = [('date', 'Date'), ('loan', 'Loan #'), ('borrower', 'Borrower'), ('amount', 'Total'), ('principal', 'Principal'), ('interest', 'Interest'), ('fees', 'Fees')]
            filters = {'Start Date': start_date, 'End Date': end_date}
            pdf_buffer = generate_generic_table_pdf("COLLECTIONS REPORT", data['data'], headers, filters, request.tenant, data['summary'])
            response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="Collections_{start_date}_{end_date}.pdf"'
            return response

        return Response(data)

    @action(detail=False, methods=['get'])
    def portfolio_performance(self, request):
        data = generate_portfolio_performance()
        
        if request.query_params.get('format') == 'pdf':
            # Simplified output for portfolio
            headers = [('name', 'Product'), ('active_loans', 'Active Loans'), ('outstanding_balance', 'Outstanding Balance')]
            filters = {'Risk Level': data['risk_level']}
            pdf_buffer = generate_generic_table_pdf("PORTFOLIO PERFORMANCE", data['products'], headers, filters, request.tenant, data['par_metrics'])
            response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="Portfolio_Performance.pdf"'
            return response

        return Response(data)
