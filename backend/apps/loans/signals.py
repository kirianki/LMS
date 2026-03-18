from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from .models import LoanRepayment

@receiver(post_save, sender=LoanRepayment)
def update_customer_scoring_on_repayment(sender, instance, created, **kwargs):
    """
    Update internal and hybrid scores when a repayment is recorded.
    Each successful repayment adds 5 points to the internal score.
    """
    if created:
        borrower = instance.loan.borrower
        
        # Increment internal score
        borrower.internal_score += 5
        
        # Recalculate hybrid score if CRB score exists
        # Formula: (CRB * 0.6) + (Internal * 0.4)
        if borrower.crb_score is not None:
            internal_weight = 0.4
            crb_weight = 0.6
            
            borrower.hybrid_score = int(
                (borrower.crb_score * crb_weight) + 
                (borrower.internal_score * internal_weight)
            )
        else:
            # If no CRB score yet, hybrid score is just the internal score (for now)
            # or we leave it as None until first CRB check
            pass
            
        borrower.save()
@receiver(post_save, sender=LoanRepayment)
def sync_loan_on_repayment(sender, instance, created, **kwargs):
    """
    Ensure all loan metrics, schedules, and COA are updated in real-time.
    """
    if created:
        loan = instance.loan
        # 1. Sync Repayment Schedules
        loan.sync_schedules()
        
        # 2. Recalculate Arrears
        from .services.arrears import calculate_loan_arrears_status
        calculate_loan_arrears_status(loan)
        
        # 3. Hard-sync COA Balances
        loan.sync_balances_to_coa()

from .models import Loan
@receiver(post_save, sender=Loan)
def sync_coa_on_loan_change(sender, instance, created, **kwargs):
    """
    Ensure COA is updated if loan status or balances change manually.
    """
    if not created:
        # Only sync for active/defaulted loans
        if instance.status in ['active', 'defaulted']:
            instance.sync_balances_to_coa()
