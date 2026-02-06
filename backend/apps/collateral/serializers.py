from rest_framework import serializers
from .models import Collateral, Valuer, ValuationRequest, ValuationReport

class CollateralSerializer(serializers.ModelSerializer):
    borrower_name = serializers.SerializerMethodField()

    def get_borrower_name(self, obj):
        if obj.borrower.borrower_type in ['company', 'institution']:
            return obj.borrower.business_name
        return f"{obj.borrower.first_name} {obj.borrower.last_name}"
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
        
        # Tracker Validation
        if c_type == Collateral.CollateralType.MOTOR_VEHICLE:
            tracker_installed = data.get('tracker_installed')
            if tracker_installed:
                if not data.get('tracker_company') or not data.get('tracker_device_id'):
                    raise serializers.ValidationError({"tracker_installed": "Tracker company and device ID are required if tracker is installed."})

        # Insurance Validation
        start_date = data.get('insurance_start_date')
        expiry_date = data.get('insurance_expiry_date')
        
        if (start_date and not expiry_date) or (expiry_date and not start_date):
            raise serializers.ValidationError("Both insurance start and expiry dates must be provided together.")
            
        if start_date and expiry_date and start_date > expiry_date:
            raise serializers.ValidationError({"insurance_start_date": "Start date cannot be after expiry date."})
        
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


class ValuationRequestSerializer(serializers.ModelSerializer):
    valuer_name = serializers.ReadOnlyField(source='valuer.name')
    
    class Meta:
        model = ValuationRequest
        fields = '__all__'

class ValuationReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = ValuationReport
        fields = '__all__'
