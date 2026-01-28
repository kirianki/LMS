from rest_framework import serializers
from .models import Customer

class CustomerSerializer(serializers.ModelSerializer):
    verified_by_name = serializers.ReadOnlyField(source='verified_by.get_full_name')

    class Meta:
        model = Customer
        fields = '__all__'
        read_only_fields = [
            'is_verified', 'verified_by', 'verified_at', 
            'crb_score', 'internal_score', 'hybrid_score', 'last_crb_check',
            'created_at', 'updated_at'
        ]

class CustomerVerificationSerializer(serializers.Serializer):
    """Serializer for the verify_id action."""
    notes = serializers.CharField(required=False, allow_blank=True)
