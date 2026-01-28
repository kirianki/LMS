from rest_framework import serializers
from .models import Collateral, Valuer, EmailConfiguration, ValuationRequest, ValuationReport

class CollateralSerializer(serializers.ModelSerializer):
    customer_name = serializers.ReadOnlyField(source='customer.first_name')
    customer_last_name = serializers.ReadOnlyField(source='customer.last_name')
    valuer_name = serializers.ReadOnlyField(source='valuer.name')
    
    class Meta:
        model = Collateral
        fields = '__all__'

    def validate(self, data):
        """
        Custom validation based on collateral type.
        """
        c_type = data.get('collateral_type')
        
        if c_type == Collateral.CollateralType.MOTOR_VEHICLE:
            required_fields = ['reg_number', 'logbook_number', 'make', 'model']
            for field in required_fields:
                if not data.get(field):
                    raise serializers.ValidationError({field: f"Required for {c_type}"})
                    
        elif c_type == Collateral.CollateralType.LAND_PROPERTY:
            if not data.get('lr_number'):
                raise serializers.ValidationError({"lr_number": "Required for land/property collateral"})
        
        # Phase 9: Lifecycle Validation
        status = data.get('status')
        if status == Collateral.CollateralStatus.PLEDGED:
            instance = getattr(self, 'instance', None)
            # If updating generic status to PLEDGED, check conditions
            if instance:
                if not instance.document_upload and not data.get('document_upload'):
                    raise serializers.ValidationError({"status": "Cannot pledge collateral without an uploaded ownership document."})
                if not instance.is_charged and not data.get('is_charged'):
                    raise serializers.ValidationError({"status": "Cannot pledge collateral until the Security Deed is verified (Charged)."})

        return data

class ValuerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Valuer
        fields = '__all__'

class EmailConfigurationSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailConfiguration
        fields = '__all__'
        extra_kwargs = {
            'smtp_password': {'write_only': True}
        }

class ValuationRequestSerializer(serializers.ModelSerializer):
    valuer_name = serializers.ReadOnlyField(source='valuer.name')
    
    class Meta:
        model = ValuationRequest
        fields = '__all__'

class ValuationReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = ValuationReport
        fields = '__all__'
