from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AgentLogViewSet, AIAgentViewSet

router = DefaultRouter()
router.register(r'logs', AgentLogViewSet, basename='agent-logs')
router.register(r'ai', AIAgentViewSet, basename='ai-agents')

urlpatterns = [
    path('', include(router.urls)),
]
