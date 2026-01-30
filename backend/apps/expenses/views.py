from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import FileResponse
from django.utils import timezone
from .models import ExpenseCategory, Expense, Staff, Payroll, PayrollItem
from .serializers import (
    ExpenseCategorySerializer, ExpenseSerializer, StaffSerializer,
    PayrollSerializer, PayrollItemSerializer
)
from apps.treasury.services.documents import generate_payslip


class ExpenseCategoryViewSet(viewsets.ModelViewSet):
    queryset = ExpenseCategory.objects.all()
    serializer_class = ExpenseCategorySerializer
    permission_classes = [permissions.IsAuthenticated]


class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['category', 'status']
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
        
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        expense = self.get_object()
        expense.status = Expense.Status.APPROVED
        expense.approved_by = request.user
        expense.approved_at = timezone.now()
        expense.save()
        return Response({'status': 'approved'})


class StaffViewSet(viewsets.ModelViewSet):
    queryset = Staff.objects.all()
    serializer_class = StaffSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['user', 'employee_number']


class PayrollViewSet(viewsets.ModelViewSet):
    queryset = Payroll.objects.select_related('staff').prefetch_related('items').all()
    serializer_class = PayrollSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['staff', 'period', 'status']

    def perform_create(self, serializer):
        payroll = serializer.save()
        
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
        from django.db import connection
        tenant = connection.tenant
        
        pdf_buffer = generate_payslip(payroll, tenant)
        return FileResponse(
            pdf_buffer,
            as_attachment=True,
            filename=f"payslip_{payroll.staff.employee_number}_{payroll.period}.pdf",
            content_type='application/pdf'
        )
