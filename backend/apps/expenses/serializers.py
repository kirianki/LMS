from rest_framework import serializers
from .models import ExpenseCategory, Expense, Staff, Payroll, PayrollItem, StaffAllowance, StaffDeduction


class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = '__all__'


class ExpenseSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')
    status_display = serializers.ReadOnlyField(source='get_status_display')
    
    class Meta:
        model = Expense
        fields = '__all__'
        read_only_fields = ('expense_number', 'approved_by', 'approved_at', 'created_by', 'created_at')


class StaffAllowanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = StaffAllowance
        fields = '__all__'


class StaffDeductionSerializer(serializers.ModelSerializer):
    class Meta:
        model = StaffDeduction
        fields = '__all__'


class StaffSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()
    allowances = StaffAllowanceSerializer(many=True, read_only=True)
    deductions = StaffDeductionSerializer(many=True, read_only=True)
    
    class Meta:
        model = Staff
        fields = '__all__'
        read_only_fields = ('employee_number',)


class PayrollItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollItem
        fields = '__all__'


class PayrollSerializer(serializers.ModelSerializer):
    staff_name = serializers.ReadOnlyField(source='staff.__str__')
    items = PayrollItemSerializer(many=True, read_only=True)
    status_display = serializers.ReadOnlyField(source='get_status_display')
    
    class Meta:
        model = Payroll
        fields = '__all__'
        read_only_fields = ('gross_pay', 'net_pay', 'total_allowances', 'total_deductions', 'approved_by', 'created_at')
