"""
Celery tasks for loan reminders and M-Pesa operations.
"""
from celery import shared_task
from django.db import connection
from django.utils import timezone
from datetime import date, timedelta
from django_tenants.utils import tenant_context
import logging

logger = logging.getLogger(__name__)


@shared_task
def send_upcoming_payment_reminders():
    """
    Periodic task to send reminders for upcoming loan payments.
    Runs daily, checks all tenants.
    """
    from apps.tenants.models import Tenant
    from apps.loans.models import RepaymentSchedule, Loan
    from apps.loans.services.sms import send_loan_reminder_sms
    
    today = date.today()
    processed_count = 0
    
    # Iterate through all active tenants
    for tenant in Tenant.objects.filter(status='active'):
        with tenant_context(tenant):
            try:
                settings = getattr(tenant, 'settings', None)
                if not settings or not settings.reminder_enabled:
                    continue
                
                reminder_date = today + timedelta(days=settings.reminder_days_before)
                
                # Find upcoming payments
                upcoming_schedules = RepaymentSchedule.objects.filter(
                    due_date=reminder_date,
                    status__in=['pending', 'partial'],
                    loan__status='active'
                ).select_related('loan', 'loan__customer')
                
                for schedule in upcoming_schedules:
                    loan = schedule.loan
                    customer = loan.customer
                    
                    result = send_loan_reminder_sms(settings, customer, loan, schedule)
                    if result.get('success'):
                        processed_count += 1
                        logger.info(f"Sent reminder for {loan.loan_number} to {customer.phone_number}")
                    else:
                        logger.warning(f"Failed to send reminder for {loan.loan_number}: {result.get('error')}")
                        
            except Exception as e:
                logger.error(f"Error processing reminders for tenant {tenant.schema_name}: {e}")
    
    logger.info(f"Sent {processed_count} payment reminders")
    return processed_count


@shared_task
def send_overdue_payment_reminders():
    """
    Periodic task to send reminders for overdue loan payments.
    Runs daily, updates overdue statuses and sends reminders.
    """
    from apps.tenants.models import Tenant
    from apps.loans.models import RepaymentSchedule
    from apps.loans.services.sms import send_overdue_reminder_sms
    
    today = date.today()
    processed_count = 0
    
    for tenant in Tenant.objects.filter(status='active'):
        with tenant_context(tenant):
            try:
                settings = getattr(tenant, 'settings', None)
                if not settings or not settings.overdue_reminder_enabled:
                    continue
                
                # Find overdue payments and update status
                overdue_schedules = RepaymentSchedule.objects.filter(
                    due_date__lt=today,
                    status__in=['pending', 'partial'],
                    loan__status='active'
                ).select_related('loan', 'loan__customer')
                
                for schedule in overdue_schedules:
                    # Update status to overdue
                    if schedule.status != 'overdue':
                        schedule.status = 'overdue'
                        schedule.save()
                    
                    loan = schedule.loan
                    customer = loan.customer
                    days_overdue = (today - schedule.due_date).days
                    
                    # Send reminder every 3 days for overdue
                    if days_overdue % 3 == 0:
                        result = send_overdue_reminder_sms(settings, customer, loan, schedule, days_overdue)
                        if result.get('success'):
                            processed_count += 1
                            
            except Exception as e:
                logger.error(f"Error processing overdue for tenant {tenant.schema_name}: {e}")
    
    logger.info(f"Sent {processed_count} overdue reminders")
    return processed_count


@shared_task
def calculate_loan_penalties():
    """
    Daily task to calculate and apply penalties for overdue loans.
    """
    from apps.tenants.models import Tenant
    from apps.loans.models import RepaymentSchedule, LoanFee
    from decimal import Decimal
    
    today = date.today()
    
    for tenant in Tenant.objects.filter(status='active'):
        with tenant_context(tenant):
            try:
                # Find overdue schedules past grace period
                overdue_schedules = RepaymentSchedule.objects.filter(
                    status='overdue',
                    loan__status='active'
                ).select_related('loan', 'loan__product')
                
                for schedule in overdue_schedules:
                    loan = schedule.loan
                    product = loan.product
                    
                    # Check grace period
                    days_overdue = (today - schedule.due_date).days
                    if days_overdue <= product.grace_period_days:
                        continue
                    
                    # Calculate daily penalty
                    penalty_days = days_overdue - product.grace_period_days
                    daily_penalty = (schedule.total_due - schedule.paid_amount) * (product.penalty_rate / Decimal('100'))
                    total_penalty = daily_penalty * penalty_days
                    
                    # Update penalty due on schedule
                    if total_penalty > schedule.penalty_due:
                        additional_penalty = total_penalty - schedule.penalty_due
                        schedule.penalty_due = total_penalty
                        schedule.save()
                        
                        # Update loan outstanding penalties
                        loan.outstanding_penalties += additional_penalty
                        loan.outstanding_balance += additional_penalty
                        loan.save()
                        
                        logger.info(f"Applied penalty of {additional_penalty} to {loan.loan_number}")
                        
            except Exception as e:
                logger.error(f"Error calculating penalties for tenant {tenant.schema_name}: {e}")


@shared_task
def process_mpesa_callback(tenant_schema, callback_data):
    """
    Process M-Pesa callback data.
    
    Args:
        tenant_schema: Schema name for tenant context
        callback_data: Callback payload from M-Pesa
    """
    from apps.tenants.models import Tenant
    from apps.loans.models import Loan, LoanRepayment
    from apps.loans.services import allocate_payment
    
    try:
        tenant = Tenant.objects.get(schema_name=tenant_schema)
        
        with tenant_context(tenant):
            # Parse callback data
            result_code = callback_data.get('Body', {}).get('stkCallback', {}).get('ResultCode')
            
            if result_code != 0:
                logger.warning(f"M-Pesa transaction failed: {callback_data}")
                return
            
            callback_metadata = callback_data.get('Body', {}).get('stkCallback', {}).get('CallbackMetadata', {}).get('Item', [])
            
            amount = None
            mpesa_ref = None
            phone = None
            
            for item in callback_metadata:
                if item['Name'] == 'Amount':
                    amount = item['Value']
                elif item['Name'] == 'MpesaReceiptNumber':
                    mpesa_ref = item['Value']
                elif item['Name'] == 'PhoneNumber':
                    phone = str(item['Value'])
            
            if not all([amount, mpesa_ref]):
                logger.error("Missing required callback data")
                return
            
            # Find loan by phone number (simplified - could use account reference)
            from apps.customers.models import Customer
            customer = Customer.objects.filter(phone_number__endswith=phone[-9:]).first()
            if not customer:
                logger.warning(f"Customer not found for phone: {phone}")
                return
            
            loan = Loan.objects.filter(customer=customer, status='active').first()
            if not loan:
                logger.warning(f"No active loan found for customer: {customer}")
                return
            
            # Record payment
            from apps.users.models import User
            system_user = User.objects.filter(is_staff=True).first()
            
            allocation = allocate_payment(loan, amount)
            
            LoanRepayment.objects.create(
                loan=loan,
                amount=amount,
                payment_date=date.today(),
                payment_method='mpesa',
                reference_number=mpesa_ref,
                received_by=system_user,
                notes="Auto-recorded from M-Pesa callback",
                **allocation
            )
            
            # Update loan balances
            loan.outstanding_principal -= allocation['principal_paid']
            loan.outstanding_interest -= allocation['interest_paid']
            loan.outstanding_penalties -= allocation['penalty_paid']
            loan.outstanding_balance = (
                loan.outstanding_principal + 
                loan.outstanding_interest + 
                loan.outstanding_penalties
            )
            loan.last_payment_date = date.today()
            
            if loan.outstanding_balance <= 0:
                loan.status = 'paid_off'
                loan.closed_at = timezone.now()
            
            loan.save()
            logger.info(f"Recorded M-Pesa payment of {amount} for {loan.loan_number}")
            
    except Exception as e:
        logger.error(f"Error processing M-Pesa callback: {e}")


# ========== NEW ARREARS MANAGEMENT TASKS ==========

@shared_task
def update_arrears_status():
    """
    Daily task to update all loan arrears statuses.
    Calculates buckets and creates collection cases.
    """
    from apps.tenants.models import Tenant
    from apps.loans.models import Loan
    from apps.loans.services.arrears import calculate_loan_arrears_status
    from apps.loans.services.collections import auto_create_collection_cases
    
    processed_count = 0
    cases_created = 0
    
    for tenant in Tenant.objects.filter(status='active'):
        with tenant_context(tenant):
            try:
                # 1. Update status for all active/defaulted loans
                active_loans = Loan.objects.filter(status__in=['active', 'defaulted'])
                for loan in active_loans:
                    calculate_loan_arrears_status(loan)
                    processed_count += 1
                
                # 2. Automatically create collection cases for new arrears
                cases_created += auto_create_collection_cases()
                
            except Exception as e:
                logger.error(f"Error updating arrears for tenant {tenant.schema_name}: {e}")
                
    logger.info(f"Updated {processed_count} loans and created {cases_created} collection cases across all tenants")
    return processed_count


@shared_task
def check_payment_promises():
    """
    Periodic task to check and update promise-to-pay statuses.
    """
    from apps.tenants.models import Tenant
    from apps.loans.services.collections import check_broken_promises
    
    total_broken = 0
    
    for tenant in Tenant.objects.filter(status='active'):
        with tenant_context(tenant):
            try:
                total_broken += check_broken_promises()
            except Exception as e:
                logger.error(f"Error checking promises for tenant {tenant.schema_name}: {e}")
                
    logger.info(f"Checked promises across all tenants. {total_broken} promises marked as BROKEN.")
    return total_broken
