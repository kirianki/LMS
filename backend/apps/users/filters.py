from rest_framework import filters
from django.db.models import Q

class BranchScopingFilterBackend(filters.BaseFilterBackend):
    """
    Filter backend that scopes data based on the user's assigned branch.
    
    Logic:
    1. Superusers and System Admins see everything.
    2. Branch Managers and Staff see only data from their assigned branch.
    3. If a user is not assigned to a branch, they see nothing by default 
       (unless they are superusers).
    """

    def filter_queryset(self, request, queryset, view):
        user = request.user

        # 1. Bypass for superusers and high-level admins
        if user.is_superuser:
            return queryset
        
        if hasattr(user, 'role') and user.role and user.role.name in ['Admin', 'System Administrator']:
            return queryset

        # 2. Identify the branch field on the model
        model = queryset.model
        
        # Check if model has a 'branch' field
        has_branch_field = any(field.name == 'branch' for field in model._meta.fields)
        
        # Get user's assigned branch
        # We assume BranchAssignment exists as a OneToOne with User
        try:
            branch_assignment = getattr(user, 'branch_assignment', None)
            if not branch_assignment:
                # No branch assignment means no access to scoped data
                return queryset.none()
            
            user_branch = branch_assignment.branch
        except Exception:
            return queryset.none()

        if has_branch_field:
            return queryset.filter(branch=user_branch)
        
        # 3. Special cases for models that might still link indirectly
        if model._meta.model_name == 'savingsaccount':
            # Direct field now exists, but keeping link as backup
            return queryset.filter(Q(branch=user_branch) | Q(borrower__branch=user_branch)).distinct()
            
        return queryset
