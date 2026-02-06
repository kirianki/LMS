from rest_framework import viewsets, permissions
from drf_spectacular.utils import extend_schema, extend_schema_view
from .models import Tenant, Subscription, Module, DocumentTemplate
from .serializers import TenantSerializer, SubscriptionSerializer, ModuleSerializer, DocumentTemplateSerializer

from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import connection
import logging

logger = logging.getLogger(__name__)

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

    def perform_create(self, serializer):
        import logging
        logger = logging.getLogger(__name__)
        try:
            instance = serializer.save()
            logger.info(f"Successfully provisioned tenant: {instance.name} (schema: {instance.schema_name})")
        except Exception as e:
            logger.error(f"Failed to provision tenant: {str(e)}")
            raise

    @action(detail=False, methods=['get', 'patch'])
    def current(self, request):
        """
        Identify the tenant based on the current schema/hostname.
        Supports PATCH to update settings (Authenticated users only).
        """
        import logging
        logger = logging.getLogger(__name__)
        
        tenant = connection.tenant
        schema_name = getattr(tenant, 'schema_name', None) if tenant else None
        
        # Log the request details for debugging
        logger.info(f"Tenant discovery attempt - Host: {request.META.get('HTTP_HOST')}, "
                   f"X-Tenant-Domain: {request.META.get('HTTP_X_TENANT_DOMAIN')}, "
                   f"Resolved schema: {schema_name}")
        
        if not tenant or schema_name == 'public':
            logger.warning(f"Tenant discovery failed - tenant={tenant}, schema_name={schema_name}, "
                          f"Host={request.META.get('HTTP_HOST')}, "
                          f"X-Tenant-Domain={request.META.get('HTTP_X_TENANT_DOMAIN')}")
            return Response({
                "error": "No tenant identified",
                "detail": "Unable to resolve tenant from the current request. Ensure you're accessing via a valid tenant domain or subdomain.",
                "schema": schema_name,
                "host": request.META.get('HTTP_HOST')
            }, status=404)
        
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
@extend_schema_view(
    list=extend_schema(description="Get list of all document templates for the current tenant."),
    create=extend_schema(description="Create a new document template."),
    update=extend_schema(description="Update a document template."),
    destroy=extend_schema(description="Delete a document template."),
)
class DocumentTemplateViewSet(viewsets.ModelViewSet):
    queryset = DocumentTemplate.objects.all()
    serializer_class = DocumentTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        from django.db import connection
        return super().get_queryset().filter(tenant=connection.tenant)

    @action(detail=True, methods=['post'])
    def reset_to_default(self, request, pk=None):
        """Reset template content to default from filesystem."""
        import os
        from django.conf import settings
        
        template = self.get_object()
        template_map = {
            'offer_letter': 'default_offer_letter.html',
            'disbursement_letter': 'default_disbursement_letter.html',
            'loan_statement': 'default_loan_statement.html',
        }
        
        filename = template_map.get(template.template_type)
        if not filename:
            return Response({'error': 'No default template available for this type.'}, status=400)
        
        template_path = os.path.join(settings.BASE_DIR, 'apps', 'loans', 'templates', filename)
        if not os.path.exists(template_path):
            return Response({'error': f'Default template file not found: {filename}'}, status=404)
        
        with open(template_path, 'r') as f:
            default_content = f.read()
        
        template.content = default_content
        template.save()
        
        serializer = self.get_serializer(template)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def placeholders(self, request):
        """Return a list of all available placeholders for document templates."""
        placeholders = [
            {'key': '{{ date_letter }}', 'desc': 'Date the letter was generated'},
            {'key': '{{ expiry_date }}', 'desc': 'Offer validity expiry date'},
            {'key': '{{ app_ref }}', 'desc': 'Application reference number'},
            {'key': '{{ borrower_name }}', 'desc': 'Full name of the borrower (uppercase)'},
            {'key': '{{ borrower_id }}', 'desc': 'ID/Passport with type label'},
            {'key': '{{ borrower_phone }}', 'desc': 'Primary phone number'},
            {'key': '{{ borrower_address }}', 'desc': 'Physical address'},
            {'key': '{{ borrower_email }}', 'desc': 'Email address'},
            {'key': '{{ product_name }}', 'desc': 'Loan product name (uppercase)'},
            {'key': '{{ approved_principal }}', 'desc': 'Approved loan amount (formatted)'},
            {'key': '{{ interest_rate_str }}', 'desc': 'Interest rate with period'},
            {'key': '{{ interest_method }}', 'desc': 'Interest calculation method'},
            {'key': '{{ term_str }}', 'desc': 'Loan term with unit'},
            {'key': '{{ installment_amount }}', 'desc': 'Monthly/periodic installment'},
            {'key': '{{ frequency }}', 'desc': 'Repayment frequency'},
            {'key': '{{ repayment_channel }}', 'desc': 'Payment channel'},
            {'key': '{{ net_disbursement }}', 'desc': 'Amount after deductions'},
            {'key': '{{ total_repayable }}', 'desc': 'Total amount to repay'},
            {'key': '{{ amount_words }}', 'desc': 'Principal in words'},
            {'key': '{{ deductions_list }}', 'desc': 'List of fee deductions (loop)'},
            {'key': '{{ schedules_list }}', 'desc': 'Repayment schedule (loop)'},
            {'key': '{{ has_collateral }}', 'desc': 'Boolean for collateral presence'},
            {'key': '{{ collateral_desc }}', 'desc': 'Collateral description'},
            {'key': '{{ collateral_id }}', 'desc': 'Collateral ID/Reg number'},
            {'key': '{{ company_name }}', 'desc': 'Lender/Tenant organization name'},
            {'key': '{{ company_address }}', 'desc': 'Lender address'},
            {'key': '{{ company_phone }}', 'desc': 'Lender phone'},
            {'key': '{{ company_email }}', 'desc': 'Lender email'},
            {'key': '{{ company_tagline }}', 'desc': 'Organization tagline'},
            {'key': '{{ primary_color }}', 'desc': 'Brand primary color'},
            {'key': '{{ secondary_color }}', 'desc': 'Brand secondary color'},
            {'key': '{{ loan_officer_name }}', 'desc': 'Assigned loan officer'},
        ]
        return Response(placeholders)
