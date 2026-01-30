from rest_framework import serializers
from .models import (
    LoanProduct, LoanApplication, Loan, 
    RepaymentSchedule, LoanRepayment, LoanFee,
    CollectionCase, CollectionNote, PromiseToPay, RecoveryAction,
    CollateralDischarge, LoanDeduction, LoanGuarantor
)
from apps.collateral.models import Collateral
from apps.collateral.serializers import CollateralSerializer


class LoanProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoanProduct
        fields = '__all__'


class LoanDeductionSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoanDeduction
        fields = '__all__'


class LoanGuarantorSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoanGuarantor
        fields = '__all__'


class LoanApplicationSerializer(models.Model if False else serializers.ModelSerializer): # Type hint hack
    borrower_details = serializers.SerializerMethodField()
    product_details = serializers.SerializerMethodField()
    deductions = LoanDeductionSerializer(many=True, read_only=True)
    guarantors = LoanGuarantorSerializer(many=True, read_only=True)
    collateral_details = CollateralSerializer(source='collateral', read_only=True)
    status_display = serializers.ReadOnlyField(source='get_status_display')
    
    class Meta:
        model = LoanApplication
        fields = '__all__'
        read_only_fields = [
            'application_number', 'status', 'submitted_at', 'approved_at', 
            'rejected_at', 'approved_by', 'rejected_by', 'created_by',
            'offer_letter_file', 'disbursement_letter_file'
        ]
    
    def get_borrower_details(self, obj):
        name = obj.borrower.business_name if obj.borrower.borrower_type in ['company', 'institution'] else f"{obj.borrower.first_name} {obj.borrower.last_name}"
        return {
            'id': obj.borrower.id,
            'name': name,
            'borrower_number': obj.borrower.borrower_number,
            'phone_number': obj.borrower.phone_number,
            'email': obj.borrower.email,
            'id_number': obj.borrower.id_number,
            'hybrid_score': obj.borrower.hybrid_score,
            'internal_score': obj.borrower.internal_score,
            'borrower_type': obj.borrower.borrower_type,
        }

    def get_product_details(self, obj):
        return {
            'id': obj.product.id,
            'name': obj.product.name,
            'code': obj.product.code,
            'suggested_interest_rate': obj.product.suggested_interest_rate,
            'min_amount': obj.product.min_amount,
            'max_amount': obj.product.max_amount,
            'requires_collateral': obj.product.requires_collateral,
            'requires_guarantor': obj.product.requires_guarantor,
            'suggested_interest_period': obj.product.suggested_interest_period,
        }


class LoanApplicationApproveSerializer(serializers.Serializer):
    approved_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    approved_term = serializers.IntegerField(min_value=1)
    approved_interest_rate = serializers.DecimalField(max_digits=5, decimal_places=2)
    approved_interest_method = serializers.CharField()
    approved_interest_period = serializers.CharField(required=False, default='per_year')
    deductions = serializers.ListField(
        child=serializers.DictField(),
        required=False
    )
    notes = serializers.CharField(required=False, allow_blank=True)


class LoanApplicationRejectSerializer(serializers.Serializer):
    rejection_reason = serializers.CharField()


class LoanSerializer(serializers.ModelSerializer):
    borrower_name = serializers.SerializerMethodField()
    product_name = serializers.ReadOnlyField(source='product.name')
    status_display = serializers.ReadOnlyField(source='get_status_display')
    arrears_category_display = serializers.ReadOnlyField(source='get_arrears_category_display')
    
    class Meta:
        model = Loan
        fields = '__all__'
    
    def get_borrower_name(self, obj):
        if obj.borrower.borrower_type in ['company', 'institution']:
            return obj.borrower.business_name
        return f"{obj.borrower.first_name} {obj.borrower.last_name}"


class RepaymentScheduleSerializer(serializers.ModelSerializer):
    status_display = serializers.ReadOnlyField(source='get_status_display')
    total_due = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    
    class Meta:
        model = RepaymentSchedule
        fields = ['id', 'installment_number', 'due_date', 'principal_due', 'interest_due', 'fees_due', 'total_due', 'status', 'status_display']
        read_only_fields = ['id', 'status', 'status_display', 'total_due']


class LoanRepaymentSerializer(serializers.ModelSerializer):
    received_by_name = serializers.ReadOnlyField(source='received_by.get_full_name')
    
    class Meta:
        model = LoanRepayment
        fields = '__all__'
        read_only_fields = [
            'principal_paid', 'interest_paid', 'fee_paid', 
            'penalty_paid', 'received_by'
        ]


class LoanRepaymentCreateSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    payment_date = serializers.DateField()
    payment_method = serializers.ChoiceField(choices=LoanRepayment.PaymentMethod.choices)
    reference_number = serializers.CharField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)


class LoanFeeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoanFee
        fields = '__all__'


class DisburseSerializer(serializers.Serializer):
    disbursement_method = serializers.ChoiceField(choices=['cash', 'mpesa', 'bank_transfer', 'cheque'])
    disbursement_details = serializers.JSONField(required=False)
    cash_account_id = serializers.UUIDField(required=False, allow_null=True)
    disbursement_proof = serializers.FileField(required=False, allow_null=True, help_text="Receipt/screenshot for manual verification")
    disbursement_reference_manual = serializers.CharField(required=False, allow_blank=True, help_text="Manual transaction code/reference")


# ========== NEW ARREARS MANAGEMENT SERIALIZERS ==========

class CollectionNoteSerializer(serializers.ModelSerializer):
    created_by_name = serializers.ReadOnlyField(source='created_by.get_full_name')
    contact_method_display = serializers.ReadOnlyField(source='get_contact_method_display')
    
    class Meta:
        model = CollectionNote
        fields = '__all__'


class PromiseToPaySerializer(serializers.ModelSerializer):
    status_display = serializers.ReadOnlyField(source='get_status_display')
    created_by_name = serializers.ReadOnlyField(source='created_by.get_full_name')
    
    class Meta:
        model = PromiseToPay
        fields = '__all__'


class CollectionCaseSerializer(serializers.ModelSerializer):
    loan_number = serializers.ReadOnlyField(source='loan.loan_number')
    borrower_name = serializers.SerializerMethodField()
    status_display = serializers.ReadOnlyField(source='get_status_display')
    priority_display = serializers.ReadOnlyField(source='get_priority_display')
    assigned_to_name = serializers.ReadOnlyField(source='assigned_to.get_full_name')
    
    # Nested info
    notes = CollectionNoteSerializer(many=True, read_only=True)
    promises = PromiseToPaySerializer(many=True, read_only=True)
    
    class Meta:
        model = CollectionCase
        fields = '__all__'
        
    def get_borrower_name(self, obj):
        if obj.loan.borrower.borrower_type in ['company', 'institution']:
            return obj.loan.borrower.business_name
        return f"{obj.loan.borrower.first_name} {obj.loan.borrower.last_name}"


class RecoveryActionSerializer(serializers.ModelSerializer):
    action_type_display = serializers.ReadOnlyField(source='get_action_type_display')
    initiated_by_name = serializers.ReadOnlyField(source='initiated_by.get_full_name')
    
    class Meta:
        model = RecoveryAction
        fields = '__all__'


class CollateralDischargeSerializer(serializers.ModelSerializer):
    status_display = serializers.ReadOnlyField(source='get_status_display')
    loan_number = serializers.ReadOnlyField(source='loan.loan_number')
    borrower_name = serializers.SerializerMethodField()
    
    class Meta:
        model = CollateralDischarge
        fields = '__all__'
        
    def get_borrower_name(self, obj):
        if obj.loan.borrower.borrower_type in ['company', 'institution']:
            return obj.loan.borrower.business_name
        return f"{obj.loan.borrower.first_name} {obj.loan.borrower.last_name}"
