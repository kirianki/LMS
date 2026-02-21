from apps.branches.models import Branch


def get_hq_branch():
    """
    Get the HQ branch for the current tenant.
    Returns the first active branch with code starting with 'HQ'.
    """
    return Branch.objects.filter(code__startswith='HQ', is_active=True).first()


def get_user_branch(user):
    """
    Get the branch for a given user.
    - If user has a branch assignment, return that branch
    - If user is an administrator (no branch assignment), return HQ branch
    - Otherwise, return None
    """
    if hasattr(user, 'branch_assignment') and user.branch_assignment:
        return user.branch_assignment.branch
    
    # Administrator or user without branch assignment -> use HQ
    if user.is_staff or user.is_superuser or user.role and user.role.name == 'Administrator':
        return get_hq_branch()
    
    return None
