from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TenantViewSet, SubscriptionViewSet, ModuleViewSet, DocumentTemplateViewSet

router = DefaultRouter()
router.register(r'tenants', TenantViewSet)
router.register(r'subscriptions', SubscriptionViewSet)
router.register(r'modules', ModuleViewSet)
router.register(r'document-templates', DocumentTemplateViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
