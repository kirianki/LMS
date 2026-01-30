from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Collateral, Valuer, ValuationRequest, ValuationReport
from apps.agents.utils import send_tenant_email
import logging

logger = logging.getLogger(__name__)

@receiver(post_save, sender=Collateral)
def trigger_collateral_valuation_workflow(sender, instance, created, **kwargs):
    if created:
        # Check if automation is enabled for this tenant
        from apps.tenants.models import Tenant
        from django.db import connection
        tenant = connection.tenant
        
        tenant_settings = getattr(tenant, 'settings', None)
        if tenant_settings:
            if not tenant_settings.is_automation_enabled:
                logger.info(f"Automation disabled for tenant {tenant.name}. Skipping valuation workflow.")
                return
        
        logger.info(f"New collateral {instance.id} created. Triggering valuation workflow.")
        
        # 1. Check Email Config
        if not tenant_settings or not tenant_settings.smtp_host:
            logger.warning("No Email configuration found for tenant. Skipping automation.")
            return
            
        # 2. Find a Valuer for this type
        valuer = Valuer.objects.filter(valuation_types__contains=[instance.collateral_type], is_active=True).first()
        if not valuer:
            logger.warning(f"No active valuer found for type {instance.collateral_type}. Skipping automation.")
            return

        # 3. Create Valuation Request
        request = ValuationRequest.objects.create(
            collateral=instance,
            valuer=valuer,
            status=ValuationRequest.RequestStatus.SENT
        )

        # 4. Notify Borrower
        borrower = instance.borrower
        name = borrower.business_name if borrower.borrower_type in ['company', 'institution'] and borrower.business_name else borrower.first_name
        
        borrower_subject = f"Valuation Request for your {instance.get_collateral_type_display()}"
        borrower_message = f"""
        Dear {name},
        
        We have initiated a valuation request for your collateral: {instance}.
        Please follow up with our trusted valuer:
        Name: {valuer.name}
        Email: {valuer.email}
        Phone: {valuer.phone}
        
        Regards,
        Management
        """
        send_tenant_email(tenant_settings, borrower_subject, borrower_message, [borrower.email])

        # 5. Notify Valuer
        valuer_subject = f"NEW VALUATION REQUEST: {instance.id}"
        valuer_message = f"""
        Dear {valuer.name},
        
        Please provide a valuation report for the following asset:
        Type: {instance.get_collateral_type_display()}
        Details: {instance.description}
        Reference: {instance.reg_number or instance.lr_number}
        
        Please reply to this email with the report attached or in the body.
        Tracking ID: {request.request_token}
        
        Regards,
        System Agent
        """
        send_tenant_email(tenant_settings, valuer_subject, valuer_message, [valuer.email])
        
        logger.info(f"Valuation emails sent for collateral {instance.id}")

@receiver(post_save, sender=ValuationReport)
def auto_update_collateral_on_report(sender, instance, created, **kwargs):
    """
    When a ValuationReport is created (manually or via AI), update the parent Collateral
    with the new market values.
    """
    if created:
        collateral = instance.collateral
        
        # 1. Update Metrics
        collateral.market_value = instance.market_value
        collateral.forced_sale_value = instance.forced_sale_value
        collateral.valuation_date = instance.valuation_date
        
        # Update valuer info if available as free text (for manual entry)
        if instance.valuer_company:
            # Note: Ideally we link to a real valuer object, but if manual entry used a company name string,
            # we might want to store that in description or a legacy field if needed. 
            # For now, let's just log it or update description.
            pass

        collateral.save()
        logger.info(f"Collateral {collateral.id} auto-updated from Valuation Report {instance.id}")
        
        # 2. If this report was linked to a Request, mark it Completed
        if instance.valuation_request:
            instance.valuation_request.status = ValuationRequest.RequestStatus.COMPLETED
            instance.valuation_request.save()
