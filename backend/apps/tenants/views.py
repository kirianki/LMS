from rest_framework import viewsets, permissions
from drf_spectacular.utils import extend_schema, extend_schema_view
from .models import Tenant, Subscription, Module
from .serializers import TenantSerializer, SubscriptionSerializer, ModuleSerializer

from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import connection

@extend_schema_view(
    list=extend_schema(description="Get a list of all tenants in the platform."),
    retrieve=extend_schema(description="Get detailed profile of a specific tenant."),
    create=extend_schema(description="Provision a new tenant and its associated PostgreSQL schema."),
    update=extend_schema(description="Update tenant profile details."),
    partial_update=extend_schema(description="Partially update tenant profile details."),
    destroy=extend_schema(description="Decommission a tenant (DANGEROUS)."),
)
class TenantViewSet(viewsets.ModelViewSet):
    queryset = Tenant.objects.all()
    serializer_class = TenantSerializer
    permission_classes = [permissions.AllowAny] # Allow discovery during auth

    @action(detail=False, methods=['get', 'patch'])
    def current(self, request):
        """
        Identify the tenant based on the current schema/hostname.
        Supports PATCH to update settings (Authenticated users only).
        """
        tenant = connection.tenant
        if not tenant or tenant.schema_name == 'public':
            return Response({"error": "No tenant identified"}, status=404)
        
        if request.method == 'PATCH':
            if not request.user.is_authenticated:
                return Response({"error": "Authentication required"}, status=401)
            
            serializer = self.get_serializer(tenant, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        
        serializer = self.get_serializer(tenant)
        return Response(serializer.data)

@extend_schema_view(
    list=extend_schema(description="Get list of all active/expired subscriptions."),
    create=extend_schema(description="Assign a new subscription plan to a tenant."),
)
class SubscriptionViewSet(viewsets.ModelViewSet):
    queryset = Subscription.objects.all()
    serializer_class = SubscriptionSerializer
    permission_classes = [permissions.IsAdminUser]

@extend_schema_view(
    list=extend_schema(description="Get list of all functional modules available on the platform."),
)
class ModuleViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Module.objects.all()
    serializer_class = ModuleSerializer
    permission_classes = [permissions.IsAdminUser]
