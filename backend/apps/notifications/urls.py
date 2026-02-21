from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import NotificationViewSet, CommunicationLogViewSet

router = DefaultRouter()
router.register(r'logs', CommunicationLogViewSet, basename='communication-log')
router.register(r'', NotificationViewSet, basename='notification')

urlpatterns = [
    path('', include(router.urls)),
]
