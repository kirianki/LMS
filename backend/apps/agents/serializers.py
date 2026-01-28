from rest_framework import serializers
from .models import AgentLog

class AgentLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentLog
        fields = '__all__'

class AIParseRequestSerializer(serializers.Serializer):
    text = serializers.CharField(required=True)
