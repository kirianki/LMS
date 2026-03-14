from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.contrib.contenttypes.models import ContentType
from .models import ActivityLog

# Import models to track
from apps.customers.models import Borrower
from apps.loans.models import LoanApplication, LoanProduct, Loan, LoanRepayment

def get_client_ip(request):
    if not request:
        return None
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip

def log_activity(instance, action, module, description, data=None):
    from apps.users.middleware import get_current_user, get_current_request
    user = get_current_user()
    request = get_current_request()
    
    # Extract organization from instance if it exists
    organization = getattr(instance, 'organization', None)
    
    # If instance doesn't have organization, check related loan (e.g., for LoanRepayment)
    if not organization and hasattr(instance, 'loan'):
        organization = getattr(instance.loan, 'organization', None)

    ct = ContentType.objects.get_for_model(instance)
    
    ActivityLog.objects.create(
        organization=organization,
        user=user if user and not user.is_anonymous else None,
        action=action,
        module=module,
        description=description,
        content_type=ct,
        object_id=str(instance.pk),
        data=data or {},
        ip_address=get_client_ip(request)
    )

@receiver(post_save, sender=Borrower)
def log_borrower_save(sender, instance, created, **kwargs):
    action = ActivityLog.Action.CREATE if created else ActivityLog.Action.UPDATE
    desc = f"{'Created' if created else 'Updated'} borrower: {instance}"
    log_activity(instance, action, 'Customers', desc)

@receiver(post_save, sender=LoanApplication)
def log_application_save(sender, instance, created, **kwargs):
    action = ActivityLog.Action.CREATE if created else ActivityLog.Action.UPDATE
    desc = f"{'Created' if created else 'Updated'} loan application: {instance.application_number} for {instance.borrower}"
    
    # Capture status changes specifically
    if not created:
        desc = f"Updated loan application {instance.application_number} status to {instance.get_status_display()}"
        
    log_activity(instance, action, 'Loans', desc)

@receiver(post_save, sender=Loan)
def log_loan_save(sender, instance, created, **kwargs):
    action = ActivityLog.Action.CREATE if created else ActivityLog.Action.UPDATE
    desc = f"{'Disbursed' if created else 'Updated'} loan: {instance.loan_number}"
    log_activity(instance, action, 'Loans', desc)

@receiver(post_save, sender=LoanRepayment)
def log_repayment_save(sender, instance, created, **kwargs):
    if created:
        desc = f"Recorded repayment of KES {instance.amount} for loan {instance.loan.loan_number}"
        log_activity(instance, ActivityLog.Action.REPAY, 'Loans', desc)

@receiver(post_save, sender=LoanProduct)
def log_product_save(sender, instance, created, **kwargs):
    action = ActivityLog.Action.CREATE if created else ActivityLog.Action.UPDATE
    desc = f"{'Created' if created else 'Updated'} loan product: {instance.name}"
    log_activity(instance, action, 'Configuration', desc)

@receiver(post_delete, sender=LoanApplication)
def log_application_delete(sender, instance, **kwargs):
    desc = f"Deleted loan application: {instance.application_number}"
    log_activity(instance, ActivityLog.Action.DELETE, 'Loans', desc)
