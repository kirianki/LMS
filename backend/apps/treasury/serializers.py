from rest_framework import serializers
from .models import CashAccount, Transaction, DailySnapshot


class CashAccountSerializer(serializers.ModelSerializer):
    coa_account_code = serializers.ReadOnlyField(source='coa_account.code')
    coa_account_name = serializers.ReadOnlyField(source='coa_account.name')
    
    class Meta:
        model = CashAccount
        fields = '__all__'
        read_only_fields = ('current_balance',)


class TransactionSerializer(serializers.ModelSerializer):
    account_name = serializers.ReadOnlyField(source='account.name')
    category_display = serializers.ReadOnlyField(source='get_category_display')
    transaction_type_display = serializers.ReadOnlyField(source='get_transaction_type_display')
    
    class Meta:
        model = Transaction
        fields = '__all__'
        read_only_fields = ('balance_after', 'created_by', 'created_at')


class DailySnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailySnapshot
        fields = '__all__'
