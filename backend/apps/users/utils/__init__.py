from django.db.models import Q

def scope_queryset(user, queryset):
    """
    Helper to scope a queryset based on the user's role and branch assignment.
    """
    if user.is_superuser:
        return queryset
    
    if hasattr(user, 'role') and user.role and user.role.name in ['Admin', 'System Administrator', 'Admin_org']:
        return queryset

    # Get user's assigned branch
    branch_assignment = getattr(user, 'branch_assignment', None)
    if not branch_assignment:
        # Fallback: check if the user is linked to any branch via BranchAssignment
        from apps.branches.models import BranchAssignment
        branch_assignment = BranchAssignment.objects.filter(user=user).first()
    
    if not branch_assignment:
        return queryset.none()
    
    user_branch = branch_assignment.branch
    model = queryset.model
    
    # Loan Officer Portfolio Scoping
    is_loan_officer = hasattr(user, 'role') and user.role and user.role.name == 'Loan Officer'
    
    # Check if model has a 'branch' field
    has_branch_field = any(field.name == 'branch' for field in model._meta.fields)
    
    if has_branch_field:
        qs = queryset.filter(branch=user_branch)
    else:
        qs = queryset
        
    model_name = model._meta.model_name
    if model_name == 'savingsaccount':
        qs = qs.filter(Q(branch=user_branch) | Q(borrower__branch=user_branch)).distinct()
    elif model_name == 'loan' or model_name == 'loanapplication':
        qs = qs.filter(borrower__branch=user_branch)
        
    # Apply Loan Officer specific filtering
    if is_loan_officer:
        if hasattr(model, 'loan_officer'):
            qs = qs.filter(loan_officer=user)
        elif model_name in ['loan', 'loanapplication', 'savingsaccount', 'financialstatement', 'customerdocument']:
            qs = qs.filter(borrower__loan_officer=user)
            
    return qs
