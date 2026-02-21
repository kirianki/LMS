from rest_framework import serializers
from .models import Borrower, BorrowerContact, BorrowerPhone
import logging

from apps.branches.serializers import BranchSerializer
from apps.branches.models import Branch

logger = logging.getLogger(__name__)

class BorrowerContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = BorrowerContact
        fields = ['id', 'first_name', 'last_name', 'phone_number', 'email', 'designation', 'is_primary']

class BorrowerPhoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = BorrowerPhone
        fields = ['id', 'phone_number', 'description', 'is_mpesa']

class BorrowerSerializer(serializers.ModelSerializer):
    verified_by_name = serializers.ReadOnlyField(source='verified_by.get_full_name')
    contacts = BorrowerContactSerializer(many=True, required=False)
    additional_phones = BorrowerPhoneSerializer(many=True, required=False)
    branch_details = BranchSerializer(source='branch', read_only=True)
    branch_id = serializers.PrimaryKeyRelatedField(
        queryset=Branch.objects.all(),
        source='branch',
        write_only=True,
        required=False,
        allow_null=True
    )

    class Meta:
        model = Borrower
        fields = '__all__'
        read_only_fields = [
            'is_verified', 'verified_by', 'verified_at', 
            'crb_score', 'internal_score', 'hybrid_score', 'last_crb_check',
            'created_at', 'updated_at', 'borrower_number'
        ]
    
    def create(self, validated_data):
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            if 'created_by' not in validated_data:
                validated_data['created_by'] = request.user
            
            # Default branch to user's branch if not provided
            if 'branch' not in validated_data and hasattr(request.user, 'branch_assignment'):
                validated_data['branch'] = request.user.branch_assignment.branch
            
            # Also set loan_officer to creator by default if not set
            if 'loan_officer' not in validated_data:
                validated_data['loan_officer'] = request.user

        contacts_data = validated_data.pop('contacts', [])
        phones_data = validated_data.pop('additional_phones', [])
        borrower = Borrower.objects.create(**validated_data)
        
        for contact_data in contacts_data:
            BorrowerContact.objects.create(borrower=borrower, **contact_data)
            
        for phone_data in phones_data:
            BorrowerPhone.objects.create(borrower=borrower, **phone_data)
            
        return borrower

    def update(self, instance, validated_data):
        contacts_data = validated_data.pop('contacts', [])
        phones_data = validated_data.pop('additional_phones', [])
        instance = super().update(instance, validated_data)
        
        if contacts_data:
            for contact_data in contacts_data:
                cid = contact_data.get('id')
                if cid:
                    BorrowerContact.objects.filter(id=cid, borrower=instance).update(**contact_data)
                else:
                    BorrowerContact.objects.create(borrower=instance, **contact_data)
        
        if phones_data:
            # For simplicity, if phones are provided in update, we sync them
            # We'll keep existing ones and add new ones or update if id provided
            for phone_data in phones_data:
                pid = phone_data.get('id')
                if pid:
                    BorrowerPhone.objects.filter(id=pid, borrower=instance).update(**phone_data)
                else:
                    BorrowerPhone.objects.create(borrower=instance, **phone_data)
        
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

class BorrowerHistorySerializer(serializers.ModelSerializer):
    history_user_name = serializers.ReadOnlyField(source='history_user.get_full_name')
    history_type_display = serializers.SerializerMethodField()
    
    class Meta:
        model = Borrower.history.model
        fields = '__all__'


    def get_history_type_display(self, obj):
        mapping = {'+': 'Created', '~': 'Updated', '-': 'Deleted'}
        return mapping.get(obj.history_type, obj.history_type)

from .models import CustomerDocument, FinancialStatement

class CustomerDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.ReadOnlyField(source='uploaded_by.get_full_name')
    verified_by_name = serializers.ReadOnlyField(source='verified_by.get_full_name')

    class Meta:
        model = CustomerDocument
        fields = '__all__'
        read_only_fields = ['is_verified', 'verified_at', 'verified_by', 'uploaded_at', 'uploaded_by']

    def create(self, validated_data):
        # Auto-assign uploader
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['uploaded_by'] = request.user
        return super().create(validated_data)


class FinancialStatementSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.ReadOnlyField(source='uploaded_by.get_full_name')

    class Meta:
        model = FinancialStatement
        fields = '__all__'
        read_only_fields = ['extraction_status', 'extracted_data', 'analysis_results', 'uploaded_at', 'uploaded_by']

    def create(self, validated_data):
        # Auto-assign uploader
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['uploaded_by'] = request.user
        return super().create(validated_data)
