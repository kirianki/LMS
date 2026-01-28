from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TenantViewSet, SubscriptionViewSet, ModuleViewSet

router = DefaultRouter()
router.register(r'tenants', TenantViewSet)
router.register(r'subscriptions', SubscriptionViewSet)
router.register(r'modules', ModuleViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
