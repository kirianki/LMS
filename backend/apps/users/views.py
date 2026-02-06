from rest_framework import viewsets, permissions, parsers
from .permissions import HasRolePermission
from rest_framework.decorators import action
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, extend_schema_view
from django.contrib.auth import get_user_model
from .models import Role, StaffContract, PayrollRecord
from .serializers import UserSerializer, RoleSerializer, StaffContractSerializer, PayrollRecordSerializer

User = get_user_model()

@extend_schema_view(
    list=extend_schema(description="List all users in the tenant."),
    create=extend_schema(description="Register a new user in the tenant."),
    retrieve=extend_schema(description="Get user details."),
    update=extend_schema(description="Update user profile."),
    destroy=extend_schema(description="Deactivate or remove a user."),
)
class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    parser_classes = [parsers.JSONParser, parsers.MultiPartParser, parsers.FormParser]

    @action(detail=False, methods=['get'])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

@extend_schema_view(
    list=extend_schema(description="List available roles."),
    create=extend_schema(description="Define a new role with approval limits."),
)
class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]

class StaffContractViewSet(viewsets.ModelViewSet):
    queryset = StaffContract.objects.all()
    serializer_class = StaffContractSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]

class PayrollRecordViewSet(viewsets.ModelViewSet):
    queryset = PayrollRecord.objects.all()
    serializer_class = PayrollRecordSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]

    @action(detail=False, methods=['post'], url_path='generate-monthly')
    def generate_monthly(self, request):
        """Bulk generate payroll records for all staff with active contracts."""
        from decimal import Decimal
        month = request.data.get('month')
        year = request.data.get('year')
        
        if not month or not year:
            return Response({"error": "Month and year are required."}, status=status.HTTP_400_BAD_REQUEST)
            
        contracts = StaffContract.objects.filter(status=StaffContract.Status.ACTIVE)
        created_count = 0
        skipped_count = 0
        
        for contract in contracts:
            # Check if payroll already exists
            if PayrollRecord.objects.filter(user=contract.user, month=month, year=year).exists():
                skipped_count += 1
                continue
                
            # Calculation logic
            gross_pay = contract.basic_salary + contract.housing_allowance + contract.transport_allowance + contract.other_allowances
            
            # Mock statutory deductions logic (Kenya Simplified)
            nssf = min(gross_pay * Decimal('0.06'), Decimal('2160'))
            nhif = Decimal('1700') 
            paye = gross_pay * Decimal('0.30') 
            housing_levy = gross_pay * Decimal('0.015')
            
            total_deductions = nssf + nhif + paye + housing_levy
            net_pay = gross_pay - total_deductions
            
            PayrollRecord.objects.create(
                user=contract.user,
                contract=contract,
                month=month,
                year=year,
                gross_pay=gross_pay,
                nssf=nssf,
                nhif=nhif,
                paye=paye,
                housing_levy=housing_levy,
                net_pay=net_pay,
                processed_by=request.user,
                status=PayrollRecord.Status.DRAFT
            )
            created_count += 1
            
        return Response({
            "message": f"Payroll generation completed. Created: {created_count}, Skipped: {skipped_count}",
            "created": created_count,
            "skipped": skipped_count
        })
