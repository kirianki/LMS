from rest_framework import serializers
from .models import ActivityLog


class ActivityLogSerializer(serializers.ModelSerializer):
    user_name = serializers.ReadOnlyField(source='user.get_full_name')
    action_display = serializers.ReadOnlyField(source='get_action_display')

    class Meta:
        model = ActivityLog
        fields = [
            'id', 'user', 'user_name', 'action', 'action_display', 
            'module', 'description', 'object_id', 'timestamp', 'data'
        ]
