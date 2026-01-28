from rest_framework import permissions

class HasRolePermission(permissions.BasePermission):
    """
    Custom permission to check if the user has the required permission via their Role.
    """
    def has_permission(self, request, view):
        # 1. Allow if user is superuser
        if request.user.is_superuser:
            return True
            
        # 2. Check if user has a role
        if not hasattr(request.user, 'role') or not request.user.role:
            return False
            
        # 3. Determine the required permission string
        # format: app_label.action_model_name
        # e.g., loans.add_loanapplication
        
        # Get model from queryset if available
        if hasattr(view, 'get_queryset'):
            model = view.get_queryset().model
        elif hasattr(view, 'queryset') and view.queryset is not None:
            model = view.queryset.model
        else:
            # Fallback for views without explicit querysets
            return False

        app_label = model._meta.app_label
        model_name = model._meta.model_name
        
        # Map view actions to Django permission prefixes
        action_map = {
            'create': 'add',
            'list': 'view',
            'retrieve': 'view',
            'update': 'change',
            'partial_update': 'change',
            'destroy': 'delete',
        }
        
        action_prefix = action_map.get(view.action, 'view')
        permission_str = f"{app_label}.{action_prefix}_{model_name}"
        
        # 4. Check if the role has this permission
        return request.user.role.permissions.filter(
            content_type__app_label=app_label,
            codename=f"{action_prefix}_{model_name}"
        ).exists()
