from django.db.models import Q

def scope_queryset(user, queryset):
    """
    Helper to scope a queryset based on the user's role and branch assignment.
    """
    if user.is_superuser:
        return queryset
    
    if hasattr(user, 'role') and user.role and user.role.name in ['Admin', 'System Administrator']:
        return queryset

    # Get user's assigned branch
    branch_assignment = getattr(user, 'branch_assignment', None)
    if not branch_assignment:
        return queryset.none()
    
    user_branch = branch_assignment.branch
    model = queryset.model
    
    # Check if model has a 'branch' field
    has_branch_field = any(field.name == 'branch' for field in model._meta.fields)
    
    if has_branch_field:
        return queryset.filter(branch=user_branch)
    
    # Special cases for indirect links (if any remain)
    if model._meta.model_name == 'savingsaccount':
        return queryset.filter(Q(branch=user_branch) | Q(borrower__branch=user_branch)).distinct()
        
    return queryset
