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
        
        if hasattr(user, 'role') and user.role and user.role.name in ['Admin', 'System Administrator', 'Admin_org']:
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
            queryset = queryset.filter(branch=user_branch)
        else:
            # Check for indirect links
            # 1. account__branch (Treasury Transactions)
            if any(field.name == 'account' for field in model._meta.fields):
                # We check if the related account model has a branch field
                account_field = model._meta.get_field('account')
                if hasattr(account_field.related_model._meta, 'fields') and \
                   any(f.name == 'branch' for f in account_field.related_model._meta.fields):
                    queryset = queryset.filter(account__branch=user_branch)
            
            # 2. parent__branch (for nested structures)
            elif any(field.name == 'parent' for field in model._meta.fields):
                queryset = queryset.filter(parent__branch=user_branch)
        
        # 3. Portfolio-level scoping for non-managerial staff
        # If the user is a Credit Officer or Field Officer, they should only see:
        # - Records they created
        # - Records where they are assigned (e.g., loan_officer)
        staff_roles = ['Credit Officer', 'Field Officer', 'Loan Officer']
        if hasattr(user, 'role') and user.role and user.role.name in staff_roles:
            q_filters = Q()
            
            # Check for created_by
            if any(field.name == 'created_by' for field in model._meta.fields):
                q_filters |= Q(created_by=user)
            
            # Check for loan_officer (customers)
            if any(field.name == 'loan_officer' for field in model._meta.fields):
                q_filters |= Q(loan_officer=user)
                
            # Check for borrower assignments (loans/applications)
            if any(field.name == 'borrower' for field in model._meta.fields):
                # Filter by borrower.loan_officer or borrower.created_by
                q_filters |= Q(borrower__loan_officer=user) | Q(borrower__created_by=user)

            # Check for direct assigned_to (collection cases)
            if any(field.name == 'assigned_to' for field in model._meta.fields):
                q_filters |= Q(assigned_to=user)

            if q_filters:
                queryset = queryset.filter(q_filters)
        
        # 4. Special cases for models that might still link indirectly
        if model._meta.model_name == 'savingsaccount':
            return queryset.filter(Q(branch=user_branch) | Q(borrower__branch=user_branch)).distinct()
            
        return queryset
