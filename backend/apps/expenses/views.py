from apps.core.viewsets import TenantScopedViewSet
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import FileResponse
from django.utils import timezone
from .models import Expense, Staff, Payroll, PayrollItem
from .serializers import (
    ExpenseSerializer, StaffSerializer,
    PayrollSerializer, PayrollItemSerializer
)
from apps.treasury.services.documents import generate_payslip


class ExpenseViewSet(TenantScopedViewSet):
    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['account', 'status']
    
    def perform_create(self, serializer):
        super().perform_create(serializer)
        instance = serializer.instance
        if not instance.created_by:
            instance.created_by = self.request.user
            instance.save()
        
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        expense = self.get_object()
        expense.status = Expense.Status.APPROVED
        expense.approved_by = request.user
        expense.approved_at = timezone.now()
        expense.save()
        return Response({'status': 'approved'})

    @action(detail=True, methods=['post'])
    def pay(self, request, pk=None):
        expense = self.get_object()
        if expense.status != Expense.Status.APPROVED:
            return Response({'error': 'Only approved expenses can be paid'}, status=status.HTTP_400_BAD_REQUEST)
            
        payment_account_id = request.data.get('payment_account_id')
        if not payment_account_id:
            return Response({'error': 'Payment account (Treasury) is required'}, status=status.HTTP_400_BAD_REQUEST)

        from apps.accounting.services import post_external_expense
        from apps.treasury.models import CashAccount, Transaction as TreasuryTransaction
        from django.db import transaction
        
        try:
            cash_account = CashAccount.objects.get(id=payment_account_id)
            if not cash_account.coa_account:
                return Response({'error': 'Selected treasury account is not linked to Chart of Accounts'}, status=status.HTTP_400_BAD_REQUEST)
            
            with transaction.atomic():
                expense.status = Expense.Status.PAID
                expense.paid_date = timezone.now().date()
                expense.payment_reference = request.data.get('reference', f"PAY-{expense.expense_number}")
                expense.save()
                
                # 1. Create Treasury Transaction (Cash Flow)
                TreasuryTransaction.objects.create(
                    account=cash_account,
                    transaction_type='debit', # Money Out
                    category='expense',
                    amount=expense.amount,
                    description=f"Expense Payment: {expense.expense_number}",
                    related_expense=expense,
                    reference=expense.payment_reference,
                    created_by=request.user
                )

                # 2. Post to General Ledger
                post_external_expense(expense, cash_account.coa_account.code)
                
            return Response({'status': 'paid'})
        except CashAccount.DoesNotExist:
            return Response({'error': 'Treasury account not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            import traceback
            print(traceback.format_exc())
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class StaffViewSet(TenantScopedViewSet):
    queryset = Staff.objects.all()
    serializer_class = StaffSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['user', 'employee_number']


class PayrollViewSet(TenantScopedViewSet):
    queryset = Payroll.objects.select_related('staff').prefetch_related('items').all()
    serializer_class = PayrollSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['staff', 'period', 'status']

    def perform_create(self, serializer):
        super().perform_create(serializer)
        payroll = serializer.instance
        
        # 1. Generate items from staff standard allowances
        for allowance in payroll.staff.allowances.filter(is_active=True):
            PayrollItem.objects.create(
                payroll=payroll,
                item_type=PayrollItem.ItemType.ALLOWANCE,
                name=allowance.name,
                amount=allowance.amount
            )
            
        # 2. Generate items from staff standard deductions
        for deduction in payroll.staff.deductions.filter(is_active=True):
            PayrollItem.objects.create(
                payroll=payroll,
                item_type=PayrollItem.ItemType.DEDUCTION,
                name=deduction.name,
                amount=deduction.amount
            )
            
        # 3. Recalculate totals
        payroll.calculate_totals()
        payroll.save()
    
    @action(detail=True, methods=['post'])
    def calculate(self, request, pk=None):
        payroll = self.get_object()
        payroll.calculate_totals()
        payroll.save()
        return Response(self.get_serializer(payroll).data)
    
    @action(detail=True, methods=['get'])
    def payslip(self, request, pk=None):
        """Download staff payslip PDF."""
        payroll = self.get_object()
        pdf_buffer = generate_payslip(payroll, request.user.organization)
        return FileResponse(
            pdf_buffer,
            as_attachment=True,
            filename=f"payslip_{payroll.staff.employee_number}_{payroll.period}.pdf",
            content_type='application/pdf'
        )
