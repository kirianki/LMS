from decimal import Decimal
from django.db import transaction
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)

class LoanReconciler:
    """
    Service to rebuild a loan's financial state from its repayment history.
    This effectively "replays" all payments to ensure consistency across schedule buckets.
    """

    @transaction.atomic
    def reconcile_loan(self, loan_id):
        from ..models import Loan, RepaymentSchedule, LoanRepayment
        from .payment_processor import PaymentProcessor

        loan = Loan.objects.get(id=loan_id)
        repayments = loan.repayments.all().order_by('payment_date', 'created_at')

        logger.info(f"Reconciling loan {loan.loan_number}. Found {repayments.count()} repayments.")

        # 1. Reset everything to baseline (original values from disbursement)
        self._reset_loan_state(loan)

        # 2. Re-apply each payment using the standard processor
        processor = PaymentProcessor()
        for repayment in repayments:
            # Note: We need to manually update the repayment fields because 
            # allocate_payment_to_installments updates loan balances but we want to 
            # capture the specific breakdown for this repayment record too.
            
            # We bypass record_manual_payment because we already have the record,
            # we just want to re-calculate its allocation.
            allocation = processor.allocate_payment_to_installments(
                loan=loan,
                amount=repayment.amount,
                payment_date=repayment.payment_date,
                repayment=repayment
            )

            # Update the repayment record with the new allocation
            repayment.principal_paid = allocation['principal']
            repayment.interest_paid = allocation['interest']
            repayment.penalty_paid = allocation['penalties']
            repayment.fee_paid = allocation['fees']
            repayment.overpayment = allocation.get('overpayment', Decimal('0.00'))
            repayment.save()

            # 3. Synchronize Accounting and Treasury for this repayment
            from apps.treasury.services.integrity import sync_repayment_financials
            sync_repayment_financials(repayment)

        # 4. Final synchronization
        loan.sync_schedules()
        
        # Recalculate balances one last time for safety
        total_principal_paid = sum(r.principal_paid for r in loan.repayments.all())
        total_interest_paid = sum(r.interest_paid for r in loan.repayments.all())
        total_penalties_paid = sum(r.penalty_paid for r in loan.repayments.all())

        loan.outstanding_principal = max(Decimal('0'), loan.principal_amount - total_principal_paid)
        loan.outstanding_interest = max(Decimal('0'), loan.total_interest - total_interest_paid)
        
        # Penalties are dynamic, so we recalculate outstanding based on schedule
        total_penalties_due = sum(s.penalty_due for s in loan.schedules.all())
        loan.outstanding_penalties = max(Decimal('0'), total_penalties_due - total_penalties_paid)
        
        loan.outstanding_balance = (
            loan.outstanding_principal +
            loan.outstanding_interest +
            loan.outstanding_penalties
        )

        if loan.outstanding_balance <= Decimal('0.01'):
            loan.status = 'paid_off'
        else:
            # If it was paid_off but now has balance, move back to active
            # (arrears calculation will pick up 'overdue' if necessary)
            if loan.status == 'paid_off':
                loan.status = 'active'
        
        loan.save()
        logger.info(f"Reconciliation complete for {loan.loan_number}. Status: {loan.status}, Balance: {loan.outstanding_balance}")

    def _reset_loan_state(self, loan):
        """Resets schedule buckets and loan balances to original post-disbursement state."""
        # Reset schedules
        for schedule in loan.schedules.all():
            schedule.penalty_paid = Decimal('0.00')
            schedule.interest_paid = Decimal('0.00')
            schedule.principal_paid = Decimal('0.00')
            schedule.paid_amount = Decimal('0.00')
            schedule.status = 'pending'
            schedule.save()

        # Reset loan balances
        loan.outstanding_principal = loan.principal_amount
        loan.outstanding_interest = loan.total_interest
        loan.outstanding_penalties = Decimal('0.00')
        loan.outstanding_balance = loan.principal_amount + loan.total_interest
        loan.save()
