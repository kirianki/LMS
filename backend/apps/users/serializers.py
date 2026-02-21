from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from .models import Role, Profile, StaffContract, PayrollRecord, StaffDocument, StaffAllowance, StaffDeduction
from apps.branches.models import Branch, BranchAssignment

from apps.branches.serializers import BranchSerializer

User = get_user_model()

from django.contrib.auth.models import Permission

class RoleSerializer(serializers.ModelSerializer):
    permissions_list = serializers.SerializerMethodField()
    permission_ids = serializers.PrimaryKeyRelatedField(
        queryset=Permission.objects.all(),
        many=True,
        source='permissions',
        required=False
    )

    class Meta:
        model = Role
        fields = ('id', 'name', 'description', 'approval_limit', 'permissions_list', 'permission_ids')
    
    def get_permissions_list(self, obj):
        return [f"{p.content_type.app_label}.{p.codename}" for p in obj.permissions.all()]

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ('employee_id', 'avatar', 'phone_number', 'bio', 'job_title', 'location', 'kra_pin', 'nssf_number', 'shif_number')

class StaffDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = StaffDocument
        fields = ('id', 'category', 'file', 'name', 'uploaded_at')
        read_only_fields = ('uploaded_at',)

class StaffAllowanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = StaffAllowance
        fields = ('id', 'name', 'calculation_type', 'amount', 'percentage_basis')

class StaffDeductionSerializer(serializers.ModelSerializer):
    class Meta:
        model = StaffDeduction
        fields = ('id', 'name', 'calculation_type', 'amount', 'percentage_basis')

class StaffContractSerializer(serializers.ModelSerializer):
    allowances = StaffAllowanceSerializer(many=True, read_only=True)
    deductions = StaffDeductionSerializer(many=True, read_only=True)
    
    class Meta:
        model = StaffContract
        fields = ('id', 'user', 'basic_salary', 'housing_allowance', 'transport_allowance', 'other_allowances', 'bank_name', 'bank_account', 'start_date', 'end_date', 'status', 'allowances', 'deductions')

class PayrollRecordSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = PayrollRecord
        fields = '__all__'

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)
    role = RoleSerializer(read_only=True)
    role_id = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(), 
        source='role', 
        write_only=True, 
        required=False,
        allow_null=True
    )
    branch = BranchSerializer(source='branch_assignment.branch', read_only=True)
    branch_id = serializers.PrimaryKeyRelatedField(
        queryset=Branch.objects.all(),
        write_only=True,
        required=False,
        allow_null=True
    )
    profile = ProfileSerializer(required=False)
    contracts = StaffContractSerializer(many=True, read_only=True)
    payroll_records = PayrollRecordSerializer(many=True, read_only=True)
    documents = StaffDocumentSerializer(many=True, read_only=True)
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'email', 'first_name', 'last_name', 'role', 'role_id', 'branch', 'branch_id', 'profile', 'contracts', 'payroll_records', 'documents', 'permissions', 'is_active', 'is_staff', 'is_superuser', 'password', 'date_joined')
        read_only_fields = ('date_joined',)
    
    def validate_is_staff(self, value):
        request = self.context.get('request')
        if not request or not request.user.is_superuser:
            return False
        return value

    def validate_is_superuser(self, value):
        request = self.context.get('request')
        if not request or not request.user.is_superuser:
            return False
        return value
    
    def get_permissions(self, obj):
        if obj.is_superuser:
            from django.contrib.auth.models import Permission
            return [f"{p.content_type.app_label}.{p.codename}" for p in Permission.objects.all()]
        if obj.role:
            return [f"{p.content_type.app_label}.{p.codename}" for p in obj.role.permissions.all()]
        return []

    def create(self, validated_data):
        branch = validated_data.pop('branch_id', None)
        password = validated_data.pop('password', None)
        
        user = User(**validated_data)
        if password:
            user.set_password(password)
        user.save()
        
        if branch:
            BranchAssignment.objects.create(user=user, branch=branch)
            
        return user

    def update(self, instance, validated_data):
        branch = validated_data.pop('branch_id', None)
        profile_data = validated_data.pop('profile', None)
        
        request = self.context.get('request')
        if not profile_data and request:
            profile_data = {}
            for key in ['phone_number', 'bio', 'job_title', 'location', 'avatar', 'kra_pin', 'nssf_number', 'shif_number']:
                flat_key = f'profile.{key}'
                if flat_key in request.data:
                    profile_data[key] = request.data[flat_key]
                elif key in request.data and key != 'avatar':
                    profile_data[key] = request.data[key]

        if 'password' in validated_data:
            password = validated_data.pop('password')
            instance.set_password(password)
            
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if branch:
            BranchAssignment.objects.update_or_create(
                user=instance,
                defaults={'branch': branch}
            )

        if profile_data:
            profile, _ = Profile.objects.get_or_create(user=instance)
            for attr, value in profile_data.items():
                setattr(profile, attr, value)
            profile.save()
            
        return instance
class PermissionSerializer(serializers.ModelSerializer):
    app_label = serializers.CharField(source='content_type.app_label', read_only=True)

    class Meta:
        model = Permission
        fields = ('id', 'name', 'codename', 'app_label')

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        # Add extra user data
        serializer = UserSerializer(self.user)
        data['user'] = serializer.data
        return data
