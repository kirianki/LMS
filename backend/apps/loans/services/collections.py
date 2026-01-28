from django.utils import timezone
from datetime import date
from decimal import Decimal
from apps.loans.models import Loan, CollectionCase, CollectionNote, PromiseToPay


def auto_create_collection_cases():
    """
    Automatically create collection cases for loans that have just entered arrears.
    Typically run as part of the daily arrears update task.
    """
    # Find active/defaulted loans that are in arrears but don't have an active case
    overdue_loans = Loan.objects.filter(
        days_in_arrears__gt=0,
        status__in=['active', 'defaulted']
    ).exclude(
        collection_case__status__in=['active', 'escalated']
    )
    
    cases_created = 0
    for loan in overdue_loans:
        # Determine priority based on days in arrears
        priority = CollectionCase.Priority.LOW
        if loan.days_in_arrears > 90:
            priority = CollectionCase.Priority.CRITICAL
        elif loan.days_in_arrears > 60:
            priority = CollectionCase.Priority.HIGH
        elif loan.days_in_arrears > 30:
            priority = CollectionCase.Priority.MEDIUM
            
        # Calculate overdue amount
        from apps.loans.models import RepaymentSchedule
        overdue_amt = RepaymentSchedule.objects.filter(
            loan=loan,
            due_date__lt=date.today(),
            status__in=['pending', 'partial', 'overdue']
        ).aggregate(
            amt=models.Sum('total_due') + models.Sum('penalty_due') - models.Sum('paid_amount')
        )['amt'] or Decimal('0.00')

        CollectionCase.objects.create(
            loan=loan,
            priority=priority,
            days_overdue=loan.days_in_arrears,
            overdue_amount=overdue_amt,
            status=CollectionCase.Status.ACTIVE
        )
        cases_created += 1
        
    return cases_created


def log_collection_interaction(case, user, method, note, response=''):
    """
    Record a collection activity for a case.
    """
    interaction = CollectionNote.objects.create(
        case=case,
        created_by=user,
        contact_method=method,
        note=note,
        customer_response=response
    )
    
    # Update case's last interaction info if we had fields for it, 
    # but for now we just use the note history.
    return interaction


def record_payment_promise(case, amount, promised_date, user, notes=''):
    """
    Record a customer's Promise to Pay (PTP).
    """
    promise = PromiseToPay.objects.create(
        case=case,
        promised_amount=amount,
        promised_date=promised_date,
        created_by=user,
        notes=notes,
        status=PromiseToPay.Status.PENDING
    )
    
    # Set next follow up for the case to the day after the promised date
    case.next_follow_up = promised_date
    case.save(update_fields=['next_follow_up'])
    
    return promise


def check_broken_promises():
    """
    Find execution of promises past their due date and mark them as broken.
    """
    today = date.today()
    pending_promises = PromiseToPay.objects.filter(
        status=PromiseToPay.Status.PENDING,
        promised_date__lt=today
    )
    
    broken_count = 0
    for promise in pending_promises:
        # Check if any payments were actually made by the customer since the promise was made
        # (Simplified: in a real system we'd check if the sum of payments equals promised amt)
        promise.status = PromiseToPay.Status.BROKEN
        promise.save(update_fields=['status'])
        
        # Escalate case priority if a promise is broken
        case = promise.case
        if case.priority == CollectionCase.Priority.LOW:
            case.priority = CollectionCase.Priority.MEDIUM
        elif case.priority == CollectionCase.Priority.MEDIUM:
            case.priority = CollectionCase.Priority.HIGH
        case.save(update_fields=['priority'])
        
        broken_count += 1
        
    return broken_count
