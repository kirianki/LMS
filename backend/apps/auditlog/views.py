from apps.core.viewsets import TenantScopedMixin
from rest_framework import viewsets, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import ActivityLog
from .serializers import ActivityLogSerializer


class ActivityLogViewSet(TenantScopedMixin, viewsets.ReadOnlyModelViewSet):
    """
    Viewset for ActivityLog.
    """
    queryset = ActivityLog.objects.all()
    serializer_class = ActivityLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['action', 'module', 'user']
    search_fields = ['description', 'description', 'user__first_name', 'user__last_name']
    ordering_fields = ['timestamp']
    ordering = ['-timestamp']

    def get_queryset(self):
        # In a real multi-tenant app with django-tenants, the queryset 
        # is already filtered to the current tenant's schema.
        # We might want to restrict this further to only ADMIN users.
        return super().get_queryset()
