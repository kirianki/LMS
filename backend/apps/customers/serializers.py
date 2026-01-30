from rest_framework import serializers
from .models import Borrower, BorrowerContact
import logging

logger = logging.getLogger(__name__)

class BorrowerContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = BorrowerContact
        fields = ['id', 'first_name', 'last_name', 'phone_number', 'email', 'designation', 'is_primary']

class BorrowerSerializer(serializers.ModelSerializer):
    verified_by_name = serializers.ReadOnlyField(source='verified_by.get_full_name')
    contacts = BorrowerContactSerializer(many=True, required=False)

    class Meta:
        model = Borrower
        fields = '__all__'
        read_only_fields = [
            'is_verified', 'verified_by', 'verified_at', 
            'crb_score', 'internal_score', 'hybrid_score', 'last_crb_check',
            'created_at', 'updated_at', 'borrower_number'
        ]
    
    def create(self, validated_data):
        contacts_data = validated_data.pop('contacts', [])
        borrower = Borrower.objects.create(**validated_data)
        for contact_data in contacts_data:
            BorrowerContact.objects.create(borrower=borrower, **contact_data)
        return borrower

    def update(self, instance, validated_data):
        contacts_data = validated_data.pop('contacts', [])
        instance = super().update(instance, validated_data)
        
        if contacts_data:
            # Simple approach: clear and recreate or match by ID. 
            # For now, let's just add new ones if no ID, or update.
            # But simpler for this demo is to replace if provided.
            # Actually, standard practice for nested writable is to handle it carefully.
            for contact_data in contacts_data:
                cid = contact_data.get('id')
                if cid:
                    BorrowerContact.objects.filter(id=cid, borrower=instance).update(**contact_data)
                else:
                    BorrowerContact.objects.create(borrower=instance, **contact_data)
        
        return instance

    def to_internal_value(self, data):
        # Sanitize contacts: filter out entries that are effectively empty
        if 'contacts' in data and isinstance(data['contacts'], list):
            sanitized_contacts = []
            for contact in data['contacts']:
                # A contact is considered "empty" if it lacks meaningful names and phone
                if not any([contact.get('first_name'), contact.get('last_name'), contact.get('phone_number')]):
                    continue
                sanitized_contacts.append(contact)
            data['contacts'] = sanitized_contacts
        
        return super().to_internal_value(data)

    def validate(self, data):
        """
        Validate conditional fields based on borrower_type.
        """
        borrower_type = data.get('borrower_type', self.instance.borrower_type if self.instance else Borrower.BorrowerType.INDIVIDUAL)
        
        if borrower_type == Borrower.BorrowerType.INDIVIDUAL:
            if not data.get('first_name') and not (self.instance and self.instance.first_name):
                raise serializers.ValidationError({"first_name": "First name is required for individuals."})
            if not data.get('last_name') and not (self.instance and self.instance.last_name):
                raise serializers.ValidationError({"last_name": "Last name is required for individuals."})
        elif borrower_type in [Borrower.BorrowerType.COMPANY, Borrower.BorrowerType.INSTITUTION]:
            if not data.get('business_name') and not (self.instance and self.instance.business_name):
                raise serializers.ValidationError({"business_name": "Business name is required for companies/institutions."})

        return data

class CustomerVerificationSerializer(serializers.Serializer):
    """Serializer for the verify_id action."""
    notes = serializers.CharField(required=False, allow_blank=True)
