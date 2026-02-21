from rest_framework import serializers
from rest_framework import serializers
from .models import Notification, CommunicationLog

class NotificationSerializer(serializers.ModelSerializer):
    notification_type_display = serializers.CharField(source='get_notification_type_display', read_only=True)

    class Meta:
        model = Notification
        fields = [
            'id', 'title', 'message', 'notification_type', 
            'notification_type_display', 'link', 'is_read', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class CommunicationLogSerializer(serializers.ModelSerializer):
    borrower_name = serializers.ReadOnlyField(source='related_borrower.first_name')
    loan_number = serializers.ReadOnlyField(source='related_loan.loan_number')

    class Meta:
        model = CommunicationLog
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'sent_at', 'provider_response']
