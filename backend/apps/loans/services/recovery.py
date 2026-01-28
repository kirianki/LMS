from django.utils import timezone
from datetime import date
from decimal import Decimal
from apps.loans.models import Loan, RecoveryAction, CollectionCase


def record_recovery_action(loan, action_type, details, user, cost=0, document=None):
    """
    Log a formal recovery action (Legal notice, seizure, etc.)
    """
    action = RecoveryAction.objects.create(
        loan=loan,
        action_type=action_type,
        action_date=date.today(),
        details=details,
        cost_incurred=Decimal(str(cost)),
        initiated_by=user,
        document=document
    )
    
    # If it's an escalation, update the collection case if it exists
    if hasattr(loan, 'collection_case'):
        case = loan.collection_case
        if action_type in [RecoveryAction.ActionType.LEGAL_NOTICE, RecoveryAction.ActionType.COURT_FILING]:
            case.status = CollectionCase.Status.ESCALATED
            case.save(update_fields=['status'])
            
    return action


def approve_loan_write_off(loan, reason, user):
    """
    Process a formal loan write-off.
    This marks the loan as written off and closes any active collection cases.
    """
    # 1. Update loan status
    loan.status = Loan.Status.WRITTEN_OFF
    loan.closed_at = timezone.now()
    loan.save(update_fields=['status', 'closed_at'])
    
    # 2. Record the recovery action
    record_recovery_action(
        loan=loan,
        action_type=RecoveryAction.ActionType.WRITE_OFF,
        details=f"Write-off approved: {reason}",
        user=user
    )
    
    # 3. Close the collection case if it exists
    if hasattr(loan, 'collection_case'):
        case = loan.collection_case
        case.status = CollectionCase.Status.WRITTEN_OFF
        case.resolved_at = timezone.now()
        case.save(update_fields=['status', 'resolved_at'])
        
    # Note: In a real system, this would also trigger an accounting entry 
    # to move the outstanding balance from Loan Portfolio to Bad Debt Expense.
        
    return True
