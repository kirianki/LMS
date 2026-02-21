from apps.core.viewsets import TenantScopedViewSet
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
from .utils.docx import (
    generate_balance_sheet_docx, generate_profit_loss_docx, generate_cash_flow_docx,
    generate_generic_table_docx, generate_trial_balance_docx, generate_general_ledger_docx
)

class ChartOfAccountViewSet(TenantScopedViewSet):
    queryset = ChartOfAccount.objects.all()
    serializer_class = ChartOfAccountSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    filterset_fields = ['account_type', 'is_active', 'parent']
    search_fields = ['code', 'name', 'description']
    ordering_fields = ['code', 'name', 'account_type', 'balance']
    ordering = ['code']
    pagination_class = None  # Always load all accounts for dropdowns
    
    @action(detail=False, methods=['post'])
    def seed(self, request):
        """Seed standard Chart of Accounts for current organization."""
        if not request.user.organization:
            return Response({'error': 'User must be linked to an organization to seed COA.'}, status=status.HTTP_400_BAD_REQUEST)
        seed_standard_coa(organization=request.user.organization)
        return Response({'status': 'Standard COA seeded successfully'})


class JournalEntryViewSet(TenantScopedViewSet):
    queryset = JournalEntry.objects.all()
    serializer_class = JournalEntrySerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    
    def perform_create(self, serializer):
        super().perform_create(serializer)
        instance = serializer.instance
        if not instance.created_by:
            instance.created_by = self.request.user
            instance.save()


class AccountingReportViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    required_permission = 'accounting.view_ledgerentry'

    @action(detail=False, methods=['get'])
    def trial_balance(self, request):
        date = request.query_params.get('date')
        org = getattr(request.user, 'organization', None)
        tenant = getattr(request, 'tenant', org)
        data = generate_trial_balance(date, organization=org)
        
        if request.query_params.get('export_type') == 'pdf':
            pdf_buffer = generate_trial_balance_pdf(data, date or 'Today', tenant)
            response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="Trial_Balance_{date}.pdf"'
            return response

        if request.query_params.get('export_type') == 'docx':
            docx_buffer = generate_trial_balance_docx(data, date or 'Today', tenant)
            response = HttpResponse(docx_buffer.read(), content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document')
            response['Content-Disposition'] = f'attachment; filename="Trial_Balance_{date}.docx"'
            return response
            
        return Response(data)

    @action(detail=False, methods=['get'])
    def balance_sheet(self, request):
        date = request.query_params.get('date')
        org = getattr(request.user, 'organization', None)
        tenant = getattr(request, 'tenant', org)
        data = generate_balance_sheet(date, organization=org)
        
        if request.query_params.get('export_type') == 'pdf':
            pdf_buffer = generate_balance_sheet_pdf(data, date or 'Today', tenant)
            response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="Balance_Sheet_{date}.pdf"'
            return response

        if request.query_params.get('export_type') == 'docx':
            docx_buffer = generate_balance_sheet_docx(data, date or 'Today', tenant)
            response = HttpResponse(docx_buffer.read(), content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document')
            response['Content-Disposition'] = f'attachment; filename="Balance_Sheet_{date}.docx"'
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
            
        org = getattr(request.user, 'organization', None)
        tenant = getattr(request, 'tenant', org)
        data = generate_profit_loss(start_date, end_date, organization=org)
        
        if request.query_params.get('export_type') == 'pdf':
            pdf_buffer = generate_profit_loss_pdf(data, start_date, end_date, tenant)
            response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="Profit_Loss_{start_date}_{end_date}.pdf"'
            return response

        if request.query_params.get('export_type') == 'docx':
            docx_buffer = generate_profit_loss_docx(data, start_date, end_date, tenant)
            response = HttpResponse(docx_buffer.read(), content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document')
            response['Content-Disposition'] = f'attachment; filename="Profit_Loss_{start_date}_{end_date}.docx"'
            return response

        return Response(data)

    @action(detail=False, methods=['get'])
    def general_ledger(self, request):
        account_id = request.query_params.get('account_id')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        # account_id is now optional to allow "All Accounts"
        org = getattr(request.user, 'organization', None)
        tenant = getattr(request, 'tenant', org)
        data = generate_general_ledger(account_id, start_date, end_date, organization=org)
        
        if request.query_params.get('export_type') == 'pdf':
            # Use specific filename if single account, generic otherwise
            filename = data["account_code"] if "account_code" in data else "All_Accounts"
            pdf_buffer = generate_general_ledger_pdf(data, account_id, start_date, end_date, tenant)
            response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="General_Ledger_{filename}.pdf"'
            return response

        if request.query_params.get('export_type') == 'docx':
            filename = data["account_code"] if "account_code" in data else "All_Accounts"
            docx_buffer = generate_general_ledger_docx(data, account_id, start_date, end_date, tenant)
            response = HttpResponse(docx_buffer.read(), content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document')
            response['Content-Disposition'] = f'attachment; filename="General_Ledger_{filename}.docx"'
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
            
        org = getattr(request.user, 'organization', None)
        tenant = getattr(request, 'tenant', org)
        data = generate_cash_flow_statement(start_date, end_date, organization=org)
        
        if request.query_params.get('export_type') == 'pdf':
            pdf_buffer = generate_cash_flow_pdf(data, start_date, end_date, tenant)
            response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="Cash_Flow_{start_date}_{end_date}.pdf"'
            return response
            
        if request.query_params.get('export_type') == 'docx':
            docx_buffer = generate_cash_flow_docx(data, start_date, end_date, tenant)
            response = HttpResponse(docx_buffer.read(), content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document')
            response['Content-Disposition'] = f'attachment; filename="Cash_Flow_{start_date}_{end_date}.docx"'
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
            
        org = getattr(request.user, 'organization', None)
        tenant = getattr(request, 'tenant', org)
        data = generate_disbursements_report(start_date, end_date, organization=org)
        
        if request.query_params.get('export_type') == 'pdf':
            headers = [('loan_number', 'Loan #'), ('borrower', 'Borrower'), ('product', 'Product'), ('date', 'Date'), ('amount', 'Amount'), ('method', 'Method')]
            filters = {'Start Date': start_date, 'End Date': end_date}
            # Custom widths for better layout
            col_widths = [1, 2, 1.5, 1, 1, 1] 
            pdf_buffer = generate_generic_table_pdf("DISBURSEMENTS REPORT", data['data'], headers, filters, tenant, data['summary'], col_widths=col_widths)
            response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="Disbursements_{start_date}_{end_date}.pdf"'
            return response

        if request.query_params.get('export_type') == 'docx':
            headers = [('loan_number', 'Loan #'), ('borrower', 'Borrower'), ('product', 'Product'), ('date', 'Date'), ('amount', 'Amount'), ('method', 'Method')]
            filters = {'Start Date': start_date, 'End Date': end_date}
            docx_buffer = generate_generic_table_docx("DISBURSEMENTS REPORT", data['data'], headers, filters, tenant, data['summary'])
            response = HttpResponse(docx_buffer.read(), content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document')
            response['Content-Disposition'] = f'attachment; filename="Disbursements_{start_date}_{end_date}.docx"'
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
            
        org = getattr(request.user, 'organization', None)
        tenant = getattr(request, 'tenant', org)
        data = generate_collections_report(start_date, end_date, organization=org)
        
        if request.query_params.get('export_type') == 'pdf':
            headers = [('date', 'Date'), ('loan', 'Loan #'), ('borrower', 'Borrower'), ('amount', 'Total'), ('principal', 'Principal'), ('interest', 'Interest'), ('fees', 'Fees')]
            filters = {'Start Date': start_date, 'End Date': end_date}
            # Custom widths: borrower needs space, numbers are shorter
            col_widths = [1, 1, 2, 1, 1, 1, 1]
            pdf_buffer = generate_generic_table_pdf("COLLECTIONS REPORT", data['data'], headers, filters, tenant, data['summary'], col_widths=col_widths)
            response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="Collections_{start_date}_{end_date}.pdf"'
            return response

        if request.query_params.get('export_type') == 'docx':
            headers = [('date', 'Date'), ('loan', 'Loan #'), ('borrower', 'Borrower'), ('amount', 'Total'), ('principal', 'Principal'), ('interest', 'Interest'), ('fees', 'Fees')]
            filters = {'Start Date': start_date, 'End Date': end_date}
            docx_buffer = generate_generic_table_docx("COLLECTIONS REPORT", data['data'], headers, filters, tenant, data['summary'])
            response = HttpResponse(docx_buffer.read(), content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document')
            response['Content-Disposition'] = f'attachment; filename="Collections_{start_date}_{end_date}.docx"'
            return response

        return Response(data)

    @action(detail=False, methods=['get'])
    def portfolio_performance(self, request):
        org = getattr(request.user, 'organization', None)
        tenant = getattr(request, 'tenant', org)
        data = generate_portfolio_performance(organization=org)
        
        if request.query_params.get('export_type') == 'pdf':
            # Simplified output for portfolio
            headers = [('name', 'Product'), ('active_loans', 'Active Loans'), ('outstanding_balance', 'Outstanding Balance')]
            filters = {'Risk Level': data['risk_level']}
            col_widths = [3, 1, 2]
            pdf_buffer = generate_generic_table_pdf("PORTFOLIO PERFORMANCE", data['products'], headers, filters, tenant, data['par_metrics'], col_widths=col_widths)
            response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="Portfolio_Performance.pdf"'
            return response

        if request.query_params.get('export_type') == 'docx':
            headers = [('name', 'Product'), ('active_loans', 'Active Loans'), ('outstanding_balance', 'Outstanding Balance')]
            filters = {'Risk Level': data['risk_level']}
            docx_buffer = generate_generic_table_docx("PORTFOLIO PERFORMANCE", data['products'], headers, filters, tenant, data['par_metrics'])
            response = HttpResponse(docx_buffer.read(), content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document')
            response['Content-Disposition'] = f'attachment; filename="Portfolio_Performance.docx"'
            return response

        return Response(data)
