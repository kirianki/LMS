from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin
from .models import ExpenseCategory, Expense, Staff, Payroll, PayrollItem


@admin.register(ExpenseCategory)
class ExpenseCategoryAdmin(SimpleHistoryAdmin):
    list_display = ('name', 'is_payroll', 'is_active')
    list_filter = ('is_payroll', 'is_active')
    search_fields = ('name',)


@admin.register(Expense)
class ExpenseAdmin(SimpleHistoryAdmin):
    list_display = ('expense_number', 'category', 'amount', 'date', 'status')
    list_filter = ('status', 'category', 'date')
    search_fields = ('expense_number', 'description', 'vendor')
    readonly_fields = ('expense_number', 'approved_by', 'approved_at', 'created_by', 'created_at')
    date_hierarchy = 'date'


@admin.register(Staff)
class StaffAdmin(SimpleHistoryAdmin):
    list_display = ('employee_number', 'first_name', 'last_name', 'department', 'position', 'is_active')
    list_filter = ('department', 'is_active')
    search_fields = ('first_name', 'last_name', 'employee_number', 'id_number')


class PayrollItemInline(admin.TabularInline):
    model = PayrollItem
    extra = 1


@admin.register(Payroll)
class PayrollAdmin(SimpleHistoryAdmin):
    list_display = ('period', 'staff', 'gross_pay', 'net_pay', 'status')
    list_filter = ('status', 'period')
    search_fields = ('staff__first_name', 'staff__last_name', 'period')
    readonly_fields = ('gross_pay', 'net_pay', 'total_allowances', 'total_deductions')
    inlines = [PayrollItemInline]
