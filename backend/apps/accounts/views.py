from rest_framework import viewsets, permissions, status
from drf_spectacular.utils import extend_schema, extend_schema_view
from .models import Organization, DocumentTemplate
from .serializers import OrganizationSerializer, DocumentTemplateSerializer
from rest_framework.decorators import action
from rest_framework.response import Response
import logging

logger = logging.getLogger(__name__)

class OrganizationViewSet(viewsets.ModelViewSet):
    """
    Manage Organizations.
    """
    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    @action(detail=False, methods=['get'])
    def site(self, request):
        """Public endpoint to get the global settings (alias for frontend)."""
        return self.current(request)

    @action(detail=False, methods=['get', 'patch'])
    def current(self, request):
        """Get or update the current user's organization settings."""
        if request.user.is_authenticated and hasattr(request.user, 'organization') and request.user.organization:
            org = request.user.organization
        else:
            org = Organization.objects.first()
            
        if not org:
            org = Organization.objects.create(company_name="My MFI")
        
        if request.method == 'PATCH':
            serializer = self.get_serializer(org, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
            
        serializer = self.get_serializer(org)
        return Response(serializer.data)

class DocumentTemplateViewSet(viewsets.ModelViewSet):
    """Manage global document templates."""
    queryset = DocumentTemplate.objects.all()
    serializer_class = DocumentTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]

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
            {'key': '{{ app_ref }}', 'desc': 'Application reference number'},
            {'key': '{{ borrower_name }}', 'desc': 'Full name of the borrower'},
            {'key': '{{ product_name }}', 'desc': 'Loan product name'},
            {'key': '{{ approved_principal }}', 'desc': 'Approved loan amount'},
            {'key': '{{ company_name }}', 'desc': 'Organization name'},
        ]
        return Response(placeholders)
