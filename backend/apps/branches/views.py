from rest_framework import viewsets
from .models import Branch, BranchAssignment
from .serializers import BranchSerializer, BranchAssignmentSerializer

class BranchViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing branches within a tenant schema.
    """
    queryset = Branch.objects.all()
    serializer_class = BranchSerializer
    filterset_fields = ['is_active', 'code']
    search_fields = ['name', 'code', 'address']
    ordering_fields = ['name', 'created_at']

class BranchAssignmentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing branch assignments.
    """
    queryset = BranchAssignment.objects.all()
    serializer_class = BranchAssignmentSerializer
    filterset_fields = ['branch']
    search_fields = ['user__email', 'branch__name']
