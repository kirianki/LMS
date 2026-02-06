"""
URL configuration for core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    # API Schema & Docs (Tenant-specific)
    path('api/schema/', SpectacularAPIView.as_view(urlconf='core.urls'), name='tenant-schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='tenant-schema'), name='tenant-swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='tenant-schema'), name='tenant-redoc'),
    # Users & Auth
    path('api/v1/', include('apps.users.urls')),
    # Tenant Info (Self)
    path('api/v1/', include('apps.tenants.urls')),
    # Customers
    path('api/v1/customers/', include('apps.customers.urls')),
    path('api/v1/collateral/', include('apps.collateral.urls')),
    path('api/v1/agents/', include('apps.agents.urls')),
    path('api/v1/loans/', include('apps.loans.urls')),
    path('api/v1/treasury/', include('apps.treasury.urls')),
    path('api/v1/investors/', include('apps.investors.urls')),
    path('api/v1/expenses/', include('apps.expenses.urls')),
    path('api/v1/accounting/', include('apps.accounting.urls')),
    path('api/v1/savings/', include('apps.savings.urls')),
    path('api/v1/branches/', include('apps.branches.urls')),
    path('api/v1/auditlog/', include('apps.auditlog.urls')),
    path('api/v1/notifications/', include('apps.notifications.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
