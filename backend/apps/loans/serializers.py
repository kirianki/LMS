from rest_framework import serializers
from .models import (
    LoanProduct, LoanApplication, Loan, 
    RepaymentSchedule, LoanRepayment, LoanFee,
    CollectionCase, CollectionNote, PromiseToPay, RecoveryAction,
    CollateralDischarge, LoanDeduction, LoanGuarantor, LoanComment
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


from apps.branches.serializers import BranchSerializer
from apps.branches.models import Branch

class LoanApplicationSerializer(models.Model if False else serializers.ModelSerializer): # Type hint hack
    borrower_details = serializers.SerializerMethodField()
    product_details = serializers.SerializerMethodField()
    branch_details = BranchSerializer(source='branch', read_only=True)
    branch_id = serializers.PrimaryKeyRelatedField(
        queryset=Branch.objects.all(),
        source='branch',
        write_only=True,
        required=False,
        allow_null=True
    )
    deductions = LoanDeductionSerializer(many=True, read_only=True)
    guarantors = LoanGuarantorSerializer(many=True, read_only=True)
    collateral_details = CollateralSerializer(source='collateral', read_only=True)
    status_display = serializers.ReadOnlyField(source='get_status_display')
    refinances_loan_details = serializers.SerializerMethodField()
    
    class Meta:
        model = LoanApplication
        fields = '__all__'
        read_only_fields = [
            'application_number', 'status', 'submitted_at', 'approved_at', 
            'rejected_at', 'approved_by', 'rejected_by', 'created_by',
            'offer_letter_file', 'disbursement_letter_file', 'offer_expires_at',
            'payoff_amount', 'net_disbursement'
        ]

    def validate(self, data):
        """Perform early validation for refinancing."""
        refinances_loan = data.get('refinances_loan')
        if refinances_loan:
            from .services import validate_refinancing_eligibility
            # Create a mock object for validation if it's the viewset create/update
            # or use the data directly. validate_refinancing_eligibility expects an instance.
            # I'll adapt the service to handle data or modify it here.
            
            # Since the service expects a LoanApplication instance, I'll do the core checks here
            # or refactor the service later. For now, let's do the core checks.
            
            borrower = data.get('borrower')
            requested_amount = data.get('requested_amount')
            
            # Check 1: Old loan must be active
            if refinances_loan.status != 'active':
                raise serializers.ValidationError(
                    {'refinances_loan': f"Cannot refinance loan {refinances_loan.loan_number} - status is {refinances_loan.get_status_display()}"}
                )
            
            # Check 2: Old loan cannot already be refinanced
            if refinances_loan.is_refinanced:
                raise serializers.ValidationError(
                    {'refinances_loan': f"Loan {refinances_loan.loan_number} has already been refinanced"}
                )
            
            # Check 3: Ensure borrower is the same
            if borrower and refinances_loan.borrower.id != borrower.id:
                raise serializers.ValidationError(
                    {'refinances_loan': "Cannot refinance a loan for a different customer"}
                )
                
            # Check 4: Amount check (preliminary, approval check still holds)
            payoff_amount = (
                refinances_loan.outstanding_principal +
                refinances_loan.outstanding_interest +
                refinances_loan.outstanding_penalties
            )
            if requested_amount and requested_amount < payoff_amount:
                raise serializers.ValidationError(
                    {'requested_amount': f"Requested amount must cover payoff (KES {payoff_amount:,.2f})"}
                )
        
        return data

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
    
    def get_refinances_loan_details(self, obj):
        if obj.refinances_loan:
            # Dynamically calculate current payoff if not disbursed yet
            payoff = obj.payoff_amount
            if obj.status != LoanApplication.Status.DISBURSED:
                payoff = (
                    obj.refinances_loan.outstanding_principal +
                    obj.refinances_loan.outstanding_interest +
                    obj.refinances_loan.outstanding_penalties
                )
            
            return {
                'loan_number': obj.refinances_loan.loan_number,
                'outstanding_balance': str(obj.refinances_loan.outstanding_balance),
                'outstanding_principal': str(obj.refinances_loan.outstanding_principal),
                'outstanding_interest': str(obj.refinances_loan.outstanding_interest),
                'outstanding_penalties': str(obj.refinances_loan.outstanding_penalties),
                'current_payoff': str(payoff)
            }
        return None

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        # Inject dynamic payoff/net for the frontend modal
        if instance.refinances_loan and instance.status != LoanApplication.Status.DISBURSED:
            payoff = (
                instance.refinances_loan.outstanding_principal +
                instance.refinances_loan.outstanding_interest +
                instance.refinances_loan.outstanding_penalties
            )
            total_deductions = sum(d.calculated_amount for d in instance.deductions.filter(is_withheld=True))
            net = instance.approved_amount - total_deductions - payoff
            
            ret['payoff_amount'] = str(payoff)
            ret['net_disbursement'] = str(net)
        return ret


class LoanApplicationApproveSerializer(serializers.Serializer):
    approved_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    approved_term = serializers.IntegerField(min_value=1)
    approved_interest_rate = serializers.DecimalField(max_digits=5, decimal_places=2)
    approved_interest_method = serializers.CharField()
    approved_interest_period = serializers.CharField(required=False, default='per_year')
    approved_repayment_frequency = serializers.CharField(required=False, default='monthly')
    
    # Penalty Config
    penalty_type = serializers.CharField(required=False, default='fixed')
    penalty_value = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0)
    penalty_grace_period = serializers.IntegerField(required=False, default=0)
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
    treasury_account_code = serializers.CharField(required=True, help_text="COA code for the treasury account (e.g., 1110 for Bank)")
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


class LoanCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    author_initials = serializers.SerializerMethodField()
    
    class Meta:
        model = LoanComment
        fields = [
            'id', 'loan', 'author', 'author_name', 'author_initials',
            'comment', 'comment_type', 'is_internal',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'loan', 'author', 'created_at', 'updated_at']
    
    def get_author_name(self, obj):
        if obj.author:
            return obj.author.get_full_name() or obj.author.username
        return 'System'
    
    def get_author_initials(self, obj):
        if obj.author:
            name = obj.author.get_full_name() or obj.author.username
            return ''.join([n[0].upper() for n in name.split()[:2]])
        return 'SY'
