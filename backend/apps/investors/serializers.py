from rest_framework import serializers
from .models import Investor, Investment, InvestorPayout


class InvestorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Investor
        fields = '__all__'
        read_only_fields = ('investor_number',)


class InvestorPayoutSerializer(serializers.ModelSerializer):
    payout_type_display = serializers.ReadOnlyField(source='get_payout_type_display')
    
    class Meta:
        model = InvestorPayout
        fields = '__all__'
        read_only_fields = ('created_by', 'created_at')


class InvestmentSerializer(serializers.ModelSerializer):
    investor_name = serializers.ReadOnlyField(source='investor.name')
    status_display = serializers.ReadOnlyField(source='get_status_display')
    payouts = InvestorPayoutSerializer(many=True, read_only=True)
    
    class Meta:
        model = Investment
        fields = '__all__'
        read_only_fields = ('investment_number', 'total_expected_return', 'total_paid_out', 'created_by', 'created_at')
