"""
Service functions for loan refinancing operations.
"""
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from apps.accounting.services import create_double_entry


def apply_refinancing_state_changes(new_loan, old_loan, payoff_amount, net_to_customer):
    """
    Update metadata and statuses for loans involved in a refinancing.
    Records a settlement payment on the old loan for audit trail.
    """
    from apps.loans.models import LoanRepayment
    
    with transaction.atomic():
        # 1. Capture payoff breakdown before clearing
        p_paid = old_loan.outstanding_principal
        i_paid = old_loan.outstanding_interest
        pen_paid = old_loan.outstanding_penalties
        
        # 2. Record the payoff as a repayment on the old loan
        LoanRepayment.objects.create(
            loan=old_loan,
            amount=payoff_amount,
            payment_date=timezone.now().date(),
            payment_method='transfer', # Refinance transfer
            reference_number=f"REFI-SETTLE-{new_loan.loan_number}",
            principal_paid=p_paid,
            interest_paid=i_paid,
            penalty_paid=pen_paid,
            notes=f"Settled via refinancing into new loan {new_loan.loan_number}"
        )

        # 3. Close old loan with refinancing markers
        old_loan.status = 'paid_off'
        old_loan.is_refinanced = True
        old_loan.refinanced_at = timezone.now()
        old_loan.refinanced_by_loan = new_loan
        old_loan.outstanding_balance = Decimal('0.00')
        old_loan.outstanding_principal = Decimal('0.00')
        old_loan.outstanding_interest = Decimal('0.00')
        old_loan.outstanding_penalties = Decimal('0.00')
        old_loan.closed_at = timezone.now()
        old_loan.save()
        
        # 4. Sync repayment schedules to paid status
        old_loan.sync_schedules()
        
        # 2. Update new loan metadata
        new_loan.disbursed_amount = net_to_customer
        new_loan.save()


def process_loan_refinancing(new_loan, old_loan, cash_account_code='1110', post_to_gl=True):
    """
    Process a loan refinancing transaction.
    
    This function handles both accounting and state management.
    Args:
        post_to_gl: If False, skip double-entry (useful when handled by parent service)
    """
    with transaction.atomic():
        # 1. Calculate exact payoff amount
        payoff_amount = (
            old_loan.outstanding_principal +
            old_loan.outstanding_interest +
            old_loan.outstanding_penalties
        )
        
        # 2. Calculate net disbursement (Principal - Payoff)
        # Note: In a real system, fees might also be deducted here.
        # This function assumes 'principal' is the gross new loan.
        net_to_customer = new_loan.principal_amount - payoff_amount
        
        # Validation: ensure new loan covers the payoff
        if net_to_customer < 0:
            raise ValueError(
                f"New loan principal ({new_loan.principal_amount}) must be >= "
                f"payoff amount ({payoff_amount})"
            )
        
        # 3. Create accounting entries if requested
        if post_to_gl:
            create_double_entry(
                date=new_loan.disbursement_date,
                description=f"Loan Refinancing: {new_loan.loan_number} pays off {old_loan.loan_number}",
                reference=f"REFI-{new_loan.loan_number}",
                debits=[('1210', new_loan.principal_amount)],
                credits=[
                    ('1210', payoff_amount),  # Reduce old loan portfolio
                    (cash_account_code, net_to_customer)  # Net cash out to customer
                ]
            )
        
        # 4. Apply state changes
        apply_refinancing_state_changes(new_loan, old_loan, payoff_amount, net_to_customer)
        
        return payoff_amount, net_to_customer


def validate_refinancing_eligibility(application):
    """
    Validate that a loan application is eligible for refinancing.
    """
    if not application.refinances_loan:
        return True, None
    
    old_loan = application.refinances_loan
    
    # Check 1: Old loan must be active
    if old_loan.status != 'active':
        return False, f"Cannot refinance loan {old_loan.loan_number} - status is {old_loan.get_status_display()}"
    
    # Check 2: Old loan cannot already be refinanced
    if old_loan.is_refinanced:
        return False, f"Loan {old_loan.loan_number} has already been refinanced"
    
    # Check 3: Calculate payoff and ensure new loan covers it
    payoff_amount = (
        old_loan.outstanding_principal +
        old_loan.outstanding_interest +
        old_loan.outstanding_penalties
    )
    
    if application.approved_amount < payoff_amount:
        return False, (
            f"New loan amount (KES {application.approved_amount:,.2f}) must be at least "
            f"KES {payoff_amount:,.2f} to cover existing balance"
        )
    
    # Check 4: Ensure borrower is the same
    if old_loan.borrower.id != application.borrower.id:
        return False, "Cannot refinance a loan for a different customer"
    
    return True, None
