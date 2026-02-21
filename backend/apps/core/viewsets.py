from rest_framework import viewsets

class TenantScopedMixin:
    """
    Mixin that automatically filters querysets by the logged-in user's organization
    and assigns the organization on create.
    """
    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        
        # 1. Filter by user's organization if they have one assigned
        # This takes precedence over staff status for strict SaaS isolation
        if hasattr(user, 'organization') and user.organization:
            return queryset.filter(organization=user.organization)
            
        # 2. Only global system admins (staff/superuser) without an assigned org can see everything
        if user.is_staff or user.is_superuser:
            return queryset
            
        # 3. If no organization and not staff, return empty
        return queryset.none()

    def perform_create(self, serializer):
        """Automatically assign the user's organization on creation."""
        user = self.request.user
        if hasattr(user, 'organization') and user.organization:
            serializer.save(organization=user.organization)
        else:
            serializer.save()

class TenantScopedViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    """
    Legacy ViewSet for convenience, using the new Mixin.
    """
    pass
