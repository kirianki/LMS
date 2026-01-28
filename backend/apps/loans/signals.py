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
        customer = instance.loan.customer
        
        # Increment internal score
        customer.internal_score += 5
        
        # Recalculate hybrid score if CRB score exists
        # Formula: (CRB * 0.6) + (Internal * 0.4)
        if customer.crb_score is not None:
            internal_weight = 0.4
            crb_weight = 0.6
            
            customer.hybrid_score = int(
                (customer.crb_score * crb_weight) + 
                (customer.internal_score * internal_weight)
            )
        else:
            # If no CRB score yet, hybrid score is just the internal score (for now)
            # or we leave it as None until first CRB check
            pass
            
        customer.save()
