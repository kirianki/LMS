"""
Payment Processing Service

Handles payment allocation to loan installments and loan balance updates.
"""
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)


class PaymentProcessor:
    """Handle payment allocation to installments and loan balance updates."""
    
    @transaction.atomic
    def allocate_payment_to_installments(self, loan, amount, payment_date, repayment=None):
        """
        Allocate payment to installments.
        Priority: Penalties > Interest > Principal
        Order: Oldest overdue first
        
        Args:
            loan: Loan instance
            amount: Payment amount
            payment_date: Date of payment
            repayment: Optional LoanRepayment instance to update
        
        Returns:
            dict: Allocation breakdown
        """
        remaining = Decimal(str(amount))
        allocation = {
            'penalties': Decimal('0'),
            'interest': Decimal('0'),
            'principal': Decimal('0'),
            'fees': Decimal('0'),
            'overpayment': Decimal('0'),
            'installments_paid': []
        }
        
        # Get unpaid/partial installments ordered by due date (oldest first)
        installments = loan.schedules.filter(
            status__in=['pending', 'partial', 'overdue']
        ).order_by('due_date')
        
        for installment in installments:
            if remaining <= 0:
                break
            
            # Calculate what's still owed on this installment (considering previous payments)
            # Current logic: penalty_owed = installment.penalty_due. 
            # But the installment.paid_amount might have already covered some components.
            # We follow priority: Penalties > Interest > Principal.
            
            # 1. Penalties
            penalty_owed = max(Decimal('0'), installment.penalty_due)
            # Find out how much penalty is already paid. 
            # Since penalties are highest priority, we assume first part of paid_amount goes to penalties.
            penalty_paid_already = min(penalty_owed, installment.paid_amount)
            penalty_remaining = penalty_owed - penalty_paid_already
            
            penalty_payment = min(remaining, penalty_remaining)
            remaining -= penalty_payment
            allocation['penalties'] += penalty_payment
            
            # 2. Interest
            interest_owed = max(Decimal('0'), installment.interest_due)
            # Interest is second priority.
            interest_paid_already = min(interest_owed, max(Decimal('0'), installment.paid_amount - penalty_owed))
            interest_remaining = interest_owed - interest_paid_already
            
            if remaining > 0:
                interest_payment = min(remaining, interest_remaining)
                remaining -= interest_payment
                allocation['interest'] += interest_payment
            else:
                interest_payment = Decimal('0')
            
            # 3. Principal
            principal_owed = max(Decimal('0'), installment.principal_due)
            # Principal is third priority.
            principal_paid_already = min(principal_owed, max(Decimal('0'), installment.paid_amount - penalty_owed - interest_owed))
            principal_remaining = principal_owed - principal_paid_already
            
            if remaining > 0:
                principal_payment = min(remaining, principal_remaining)
                remaining -= principal_payment
                allocation['principal'] += principal_payment
            else:
                principal_payment = Decimal('0')
            
            # Update installment paid amount
            total_paid_this_installment = penalty_payment + interest_payment + principal_payment
            installment.paid_amount += total_paid_this_installment
            
            # Update installment status
            total_due = installment.total_due + installment.penalty_due
            if installment.paid_amount >= total_due:
                installment.status = 'paid'
            elif installment.paid_amount > 0:
                installment.status = 'partial'
            
            installment.save()
            
            allocation['installments_paid'].append({
                'installment_id': str(installment.id),
                'installment_number': installment.installment_number,
                'amount': float(total_paid_this_installment),
                'penalty': float(penalty_payment),
                'interest': float(interest_payment),
                'principal': float(principal_payment)
            })
        
        # Remaining funds after all unpaid installments are satisfied are treated as overpayment
        allocation['overpayment'] = remaining
        
        # Update loan balances
        loan.outstanding_principal = max(Decimal('0'), loan.outstanding_principal - allocation['principal'])
        loan.outstanding_interest = max(Decimal('0'), loan.outstanding_interest - allocation['interest'])
        loan.outstanding_penalties = max(Decimal('0'), loan.outstanding_penalties - allocation['penalties'])
        loan.outstanding_balance = (
            loan.outstanding_principal + 
            loan.outstanding_interest + 
            loan.outstanding_penalties
        )
        
        if loan.outstanding_balance <= Decimal('0.01'):  # Allow for rounding
            loan.status = 'paid_off'
            loan.closed_at = timezone.now()
        
        loan.last_payment_date = payment_date
        loan.save()
        
        # Trigger explicit schedule sync for consistency
        loan.sync_schedules()
        
        logger.info(f"Payment allocated for loan {loan.loan_number}: {allocation}")
        
        return allocation
    
    @transaction.atomic
    def record_manual_payment(self, loan_id, amount, payment_method, 
                             reference, payment_date, user, installment_id=None, notes='', 
                             cash_account_id=None):
        """
        Record manual payment from staff.
        
        Args:
            loan_id: UUID of the loan
            amount: Payment amount
            payment_method: Payment method (cash, bank, mpesa, cheque)
            reference: Payment reference number
            payment_date: Date of payment
            user: User recording the payment
            installment_id: Optional specific installment to pay
            notes: Optional notes
        
        Returns:
            LoanRepayment instance
        """
        from ..models import Loan, LoanRepayment, RepaymentSchedule
        
        loan = Loan.objects.get(id=loan_id)
        
        # 1. First, calculate allocation (Auto or Specific)
        if installment_id:
            # Pay specific installment
            installment = RepaymentSchedule.objects.get(id=installment_id, loan=loan)
            remaining = Decimal(str(amount))
            
            # Calculate breakdown for this specific installment
            # We follow the same priority: Penalties > Interest > Principal
            
            # 1. Penalties
            penalty_owed = max(Decimal('0'), installment.penalty_due)
            penalty_paid_already = min(penalty_owed, installment.paid_amount)
            penalty_remaining = penalty_owed - penalty_paid_already
            penalty_payment = min(remaining, penalty_remaining)
            remaining -= penalty_payment
            
            # 2. Interest
            interest_owed = max(Decimal('0'), installment.interest_due)
            interest_paid_already = min(interest_owed, max(Decimal('0'), installment.paid_amount - penalty_owed))
            interest_remaining = interest_owed - interest_paid_already
            interest_payment = min(remaining, interest_remaining)
            remaining -= interest_payment
            
            # 3. Principal
            principal_owed = max(Decimal('0'), installment.principal_due)
            principal_paid_already = min(principal_owed, max(Decimal('0'), installment.paid_amount - penalty_owed - interest_owed))
            principal_remaining = principal_owed - principal_paid_already
            principal_payment = min(remaining, principal_remaining)
            remaining -= principal_payment
            
            # Update installment paid amount
            installment.paid_amount += (penalty_payment + interest_payment + principal_payment)
            
            total_due = installment.total_due + installment.penalty_due
            if installment.paid_amount >= total_due:
                installment.status = 'paid'
            elif installment.paid_amount > 0:
                installment.status = 'partial'
            
            installment.save()
            
            allocation = {
                'principal': principal_payment,
                'interest': interest_payment,
                'penalties': penalty_payment,
                'fees': Decimal('0'),
                'overpayment': remaining # Treat leftover as overpayment if specific installment is overpaid
            }
            
            # Update loan balances
            loan.outstanding_principal = max(Decimal('0'), loan.outstanding_principal - allocation['principal'])
            loan.outstanding_interest = max(Decimal('0'), loan.outstanding_interest - allocation['interest'])
            loan.outstanding_penalties = max(Decimal('0'), loan.outstanding_penalties - allocation['penalties'])
            loan.outstanding_balance = (
                loan.outstanding_principal + 
                loan.outstanding_interest + 
                loan.outstanding_penalties
            )
            
            if loan.outstanding_balance <= Decimal('0.01'):
                loan.status = 'paid_off'
                loan.closed_at = timezone.now()
                
            loan.last_payment_date = payment_date
            loan.save()
            
            # Explicit schedule sync to handle status updates correctly
            loan.sync_schedules()
            
        else:
            # Auto-allocate to oldest overdue installments
            allocation = self.allocate_payment_to_installments(
                loan=loan,
                amount=amount,
                payment_date=payment_date
            )
        
        # 2. Create repayment record AT THE END with all values populated
        # This ensures signals (like GL sync) have the breakdown ready.
        repayment = LoanRepayment.objects.create(
            loan=loan,
            amount=amount,
            payment_date=payment_date,
            payment_method=payment_method,
            reference_number=reference,
            received_by=user,
            notes=notes,
            principal_paid=allocation['principal'],
            interest_paid=allocation['interest'],
            penalty_paid=allocation['penalties'],
            fee_paid=allocation['fees'],
            overpayment=allocation.get('overpayment', Decimal('0.00')),
            cash_account_id=cash_account_id
        )
        
        logger.info(f"Manual payment recorded for loan {loan.loan_number}: {amount}")
        
        return repayment
