from rest_framework import serializers
from .models import SavingsProduct, SavingsAccount, SavingsTransaction

class SavingsProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavingsProduct
        fields = '__all__'

class SavingsAccountSerializer(serializers.ModelSerializer):
    customer_name = serializers.ReadOnlyField(source='customer.__str__')
    product_name = serializers.ReadOnlyField(source='product.name')
    
    class Meta:
        model = SavingsAccount
        fields = '__all__'
        read_only_fields = ['account_number', 'current_balance', 'accrued_interest', 'status']

class SavingsTransactionSerializer(serializers.ModelSerializer):
    performed_by_name = serializers.ReadOnlyField(source='performed_by.get_full_name')
    
    class Meta:
        model = SavingsTransaction
        fields = '__all__'
        read_only_fields = ['balance_after', 'performed_by']

class DepositWithdrawalSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0.01)
    reference = serializers.CharField(max_length=100, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
