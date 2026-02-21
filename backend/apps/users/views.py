from rest_framework import viewsets, permissions, parsers, status
from .permissions import HasRolePermission
from rest_framework.decorators import action
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, extend_schema_view
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from .models import Role, StaffContract, PayrollRecord, StaffDocument, StaffAllowance, StaffDeduction
from .serializers import UserSerializer, RoleSerializer, StaffContractSerializer, PayrollRecordSerializer, StaffDocumentSerializer, StaffAllowanceSerializer, StaffDeductionSerializer, PermissionSerializer
from .utils.payroll import KenyanPayrollCalculator
from django.utils import timezone
from django.http import FileResponse
from django.db import transaction
from apps.treasury.models import CashAccount, Transaction
from apps.accounting.utils.pdf import generate_staff_payslip_pdf
from apps.core.viewsets import TenantScopedMixin, TenantScopedViewSet
import logging

logger = logging.getLogger(__name__)

User = get_user_model()

class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]


class StaffDocumentViewSet(TenantScopedViewSet):
    queryset = StaffDocument.objects.all()
    serializer_class = StaffDocumentSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    def perform_create(self, serializer):
        user_id = self.request.data.get('user')
        if hasattr(self.request.user, 'organization') and self.request.user.organization:
            if user_id:
                serializer.save(user_id=user_id, organization=self.request.user.organization)
            else:
                serializer.save(organization=self.request.user.organization)
        else:
            if user_id:
                serializer.save(user_id=user_id)
            else:
                serializer.save()


@extend_schema_view(
    list=extend_schema(description="List all users in the organization."),
    create=extend_schema(description="Register a new user in the organization."),
    retrieve=extend_schema(description="Get user details."),
    update=extend_schema(description="Update user profile."),
    destroy=extend_schema(description="Deactivate or remove a user."),
)
class UserViewSet(TenantScopedViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    parser_classes = [parsers.JSONParser, parsers.MultiPartParser, parsers.FormParser]

    @action(detail=False, methods=['post'], permission_classes=[permissions.AllowAny])
    def register(self, request):
        """Public registration for MFI admins."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Ensure no accidental staff/superuser escalation
        user = serializer.save(is_staff=False, is_superuser=False)
        
        # Create Organization if company_name is provided
        from apps.accounts.models import Organization
        company_name = request.data.get('name')
        if company_name:
            org = Organization.objects.create(company_name=company_name)
            user.organization = org
            user.save()
        
        # Assign Company Administrator role
        try:
            role = Role.objects.get(name='Company Administrator')
            user.role = role
            user.save()
        except Role.DoesNotExist:
            logger.error("Company Administrator role not found during registration")
            
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def change_password(self, request, pk=None):
        """Allow users to change their password."""
        user = self.get_object()
        
        # Ensure user can only change their own password unless they are superuser
        if request.user != user and not request.user.is_superuser:
            return Response(
                {"error": "You result not authorized to change this user's password."}, 
                status=status.HTTP_403_FORBIDDEN
            )
            
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')
        
        if not old_password or not new_password:
            return Response(
                {"error": "Both old and new passwords are required."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        if not user.check_password(old_password):
            return Response(
                {"error": "Invalid old password."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            from django.contrib.auth.password_validation import validate_password
            validate_password(new_password, user)
        except Exception as e:
            return Response(
                {"error": list(e.messages)}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        user.set_password(new_password)
        user.save()
        
        return Response({"message": "Password updated successfully."})


@extend_schema_view(
    list=extend_schema(description="List available roles."),
    create=extend_schema(description="Define a new role with approval limits."),
)
class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]


class StaffContractViewSet(TenantScopedViewSet):
    queryset = StaffContract.objects.all()
    serializer_class = StaffContractSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]


class PayrollRecordViewSet(TenantScopedViewSet):
    queryset = PayrollRecord.objects.all()
    serializer_class = PayrollRecordSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]

    @action(detail=False, methods=['post'], url_path='generate-monthly')
    def generate_monthly(self, request):
        """Bulk generate payroll records for all staff with active contracts in the organization."""
        from decimal import Decimal
        month = request.data.get('month')
        year = request.data.get('year')
        
        if not month or not year:
            return Response({"error": "Month and year are required."}, status=status.HTTP_400_BAD_REQUEST)
            
        # Filter contracts by the current user's organization
        contracts = StaffContract.objects.filter(
            status=StaffContract.Status.ACTIVE,
            organization=request.user.organization
        )
        created_count = 0
        skipped_count = 0
        
        for contract in contracts:
            # Check if payroll already exists
            if PayrollRecord.objects.filter(user=contract.user, month=month, year=year, organization=request.user.organization).exists():
                skipped_count += 1
                continue
                
            # Calculation logic using KenyanPayrollCalculator
            allowances = list(contract.allowances.values('name', 'calculation_type', 'amount', 'percentage_basis'))
            deductions = list(contract.deductions.values('name', 'calculation_type', 'amount', 'percentage_basis'))
            
            result = KenyanPayrollCalculator.calculate_payroll(
                basic_salary=contract.basic_salary,
                allowances_list=allowances,
                deductions_list=deductions
            )
            
            PayrollRecord.objects.create(
                organization=request.user.organization,
                user=contract.user,
                contract=contract,
                month=month,
                year=year,
                gross_pay=result['gross_pay'],
                nssf=result['nssf'],
                shif=result['shif'],
                paye=result['paye'],
                housing_levy=result['housing_levy'],
                other_deductions=result['other_deductions'],
                net_pay=result['net_pay'],
                processed_by=request.user,
                status=PayrollRecord.Status.DRAFT
            )
            created_count += 1
            
        return Response({
            "message": f"Payroll generation completed. Created: {created_count}, Skipped: {skipped_count}",
            "created": created_count,
            "skipped": skipped_count
        })

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a draft payroll record."""
        payroll = self.get_object()
        if payroll.status != PayrollRecord.Status.DRAFT:
            return Response({"error": "Only draft payrolls can be approved."}, status=status.HTTP_400_BAD_REQUEST)
        
        payroll.status = PayrollRecord.Status.APPROVED
        payroll.approved_by = request.user
        payroll.approved_at = timezone.now()
        payroll.save()
        return Response(self.get_serializer(payroll).data)

    @action(detail=True, methods=['post'])
    def pay(self, request, pk=None):
        """Mark an approved payroll as paid with treasury integration."""
        payroll = self.get_object()
        if payroll.status != PayrollRecord.Status.APPROVED:
            return Response({"error": "Only approved payrolls can be marked as paid."}, status=status.HTTP_400_BAD_REQUEST)
        
        account_id = request.data.get('account_id')
        if not account_id:
            return Response({"error": "Origin account_id is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            account = CashAccount.objects.get(id=account_id)
        except CashAccount.DoesNotExist:
            return Response({"error": "Selected cash account not found."}, status=status.HTTP_404_NOT_FOUND)

        # Check if account belongs to same organization
        if account.organization != request.user.organization:
             return Response({"error": "Unauthorized account access."}, status=status.HTTP_403_FORBIDDEN)

        with transaction.atomic():
            # Create treasury transaction
            reference = request.data.get('reference', f"PAY-{payroll.id.hex[:6].upper()}")
            
            Transaction.objects.create(
                organization=request.user.organization,
                account=account,
                transaction_type=Transaction.TransactionType.DEBIT,
                category=Transaction.Category.PAYROLL,
                amount=payroll.net_pay,
                description=f"Payroll payment for {payroll.user.get_full_name()} ({payroll.month}/{payroll.year})",
                reference=reference,
                created_by=request.user
            )

            # Update payroll record
            payroll.status = PayrollRecord.Status.PAID
            payroll.payment_date = timezone.now().date()
            payroll.reference = reference
            payroll.save()
            
        return Response(self.get_serializer(payroll).data)

    @action(detail=True, methods=['get'])
    def payslip(self, request, pk=None):
        """Generate and return a PDF payslip for the payroll record."""
        payroll = self.get_object()
        
        # Get organization for branding
        from apps.accounts.models import Organization
        organization = payroll.organization or Organization.objects.first()
        
        buffer = generate_staff_payslip_pdf(payroll, organization)
        
        filename = f"payslip_{payroll.user.last_name}_{payroll.month}_{payroll.year}.pdf"
        return FileResponse(
            buffer, 
            as_attachment=True, 
            filename=filename,
            content_type='application/pdf'
        )

class StaffAllowanceViewSet(viewsets.ModelViewSet):
    queryset = StaffAllowance.objects.all()
    serializer_class = StaffAllowanceSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]

class StaffDeductionViewSet(viewsets.ModelViewSet):
    queryset = StaffDeduction.objects.all()
    serializer_class = StaffDeductionSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
