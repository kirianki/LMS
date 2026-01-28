from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView
from apps.tenants.views import TenantViewSet, SubscriptionViewSet, ModuleViewSet
from apps.users.views import UserViewSet, RoleViewSet

router = DefaultRouter()
router.register(r'tenants', TenantViewSet)
router.register(r'subscriptions', SubscriptionViewSet)
router.register(r'modules', ModuleViewSet)
router.register(r'users', UserViewSet)
router.register(r'roles', RoleViewSet)

from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    # JWT Auth
    path('api/v1/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/v1/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    # API Schema & Docs
    path('api/schema/', SpectacularAPIView.as_view(urlconf='core.urls_public'), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    # Management API
    path('api/v1/', include(router.urls)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
