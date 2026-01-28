from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from .models import AgentLog
from .serializers import AgentLogSerializer, AIParseRequestSerializer
from .services import ValuationParsingAgent

class AgentLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AgentLog.objects.all()
    serializer_class = AgentLogSerializer
    permission_classes = [permissions.IsAuthenticated]

class AIAgentViewSet(viewsets.ViewSet):
    """
    Endpoints for manual interaction with AI Agents.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    @action(detail=False, methods=['post'], url_path='parse-valuation')
    def parse_valuation(self, request):
        from django.db import connection
        tenant = connection.tenant
        if hasattr(tenant, 'settings') and not tenant.settings.is_ai_enabled:
            return Response({"error": "AI features are not enabled for this tenant."}, status=status.HTTP_403_FORBIDDEN)

        serializer = AIParseRequestSerializer(data=request.data)
        if serializer.is_valid():
            text = serializer.validated_data['text']
            agent = ValuationParsingAgent()
            result = agent.parse_report_text(text)
            
            # Log the action
            AgentLog.objects.create(
                agent_name="ValuationParsingAgent",
                action="manual_parse",
                input_data={"text_length": len(text)},
                output_data=result,
                status="success" if result.get('success') else "failure"
            )
            
            return Response(result, status=status.HTTP_200_OK if result.get('success') else status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
