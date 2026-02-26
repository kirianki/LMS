from celery import shared_task
from django.utils import timezone
from datetime import date, timedelta
import logging

logger = logging.getLogger(__name__)

@shared_task
def send_upcoming_payment_reminders():
    """
    Periodic task to send reminders for upcoming loan payments across all organizations.
    """
    from apps.accounts.models import Organization
    from apps.loans.models import RepaymentSchedule
    from apps.loans.services.sms import send_loan_reminder_sms
    from apps.loans.services.email import send_loan_reminder_email
    
    today = date.today()
    total_processed = 0
    
    for org in Organization.objects.filter(reminder_enabled=True):
        reminder_date = today + timedelta(days=org.reminder_days_before)
        
        # Find upcoming payments for this organization
        upcoming_schedules = RepaymentSchedule.objects.filter(
            loan__organization=org,
            due_date=reminder_date,
            status__in=['pending', 'partial'],
            loan__status='active'
        ).select_related('loan', 'loan__borrower')
        
        for schedule in upcoming_schedules:
            loan = schedule.loan
            borrower = loan.borrower
            
            # Send SMS
            result = send_loan_reminder_sms(org, borrower, loan, schedule)
            
            # Send Email if borrower has email
            if borrower.email:
                send_loan_reminder_email(org, borrower, loan, schedule)
            if result.get('success'):
                total_processed += 1
                logger.info(f"Sent reminder for {loan.loan_number} in {org.company_name} to {borrower.phone_number}")
            else:
                logger.warning(f"Failed to send reminder for {loan.loan_number} in {org.company_name}: {result.get('error')}")
                
    return total_processed

@shared_task
def send_overdue_payment_reminders():
    """
    Periodic task to send reminders for overdue loan payments across all organizations.
    """
    from apps.accounts.models import Organization
    from apps.loans.models import RepaymentSchedule
    from apps.loans.services.sms import send_overdue_reminder_sms
    from apps.loans.services.email import send_overdue_reminder_email
    
    today = date.today()
    total_processed = 0
    
    for org in Organization.objects.filter(overdue_reminder_enabled=True):
        # Find overdue payments for this organization
        overdue_schedules = RepaymentSchedule.objects.filter(
            loan__organization=org,
            due_date__lt=today,
            status__in=['pending', 'partial'],
            loan__status='active'
        ).select_related('loan', 'loan__borrower')
        
        for schedule in overdue_schedules:
            # Update status to overdue
            if schedule.status != 'overdue':
                schedule.status = 'overdue'
                schedule.save()
            
            loan = schedule.loan
            borrower = loan.borrower
            days_overdue = (today - schedule.due_date).days
            
            # Send reminder every 3 days for overdue
            if days_overdue % 3 == 0:
                # Send SMS
                result = send_overdue_reminder_sms(org, borrower, loan, schedule, days_overdue)
                
                # Send Email if borrower has email
                if borrower.email:
                    send_overdue_reminder_email(org, borrower, loan, schedule, days_overdue)
                if result.get('success'):
                    total_processed += 1
                                
    return total_processed

@shared_task
def calculate_loan_penalties():
    """
    Daily task to calculate and apply penalties for overdue loans.
    Now automatically handles all organizations via the schedule's relation.
    """
    from apps.loans.models import RepaymentSchedule
    from decimal import Decimal
    
    today = date.today()
    
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
        if days_overdue <= product.penalty_grace_period:
            continue
        
        # Calculate penalty using both type and basis
        penalty_days = days_overdue - product.penalty_grace_period

        # Determine the penalty base amount
        if product.penalty_type == 'percentage':
            # Always calculated on the arrears principal
            arrears_principal = schedule.principal_due
            rate = product.penalty_value / Decimal('100')
            base_penalty = arrears_principal * rate
        else:  # fixed
            base_penalty = product.penalty_value

        # Apply the basis (how often it accrues)
        basis = getattr(product, 'penalty_basis', 'per_day')
        if basis == 'per_installment':
            # One-off flat fee — does NOT multiply by days
            total_penalty = base_penalty
        elif basis == 'per_week':
            weeks_overdue = Decimal(penalty_days) / Decimal('7')
            total_penalty = base_penalty * weeks_overdue
        elif basis == 'per_month':
            months_overdue = Decimal(penalty_days) / Decimal('30')
            total_penalty = base_penalty * months_overdue
        else:  # per_day (default)
            total_penalty = base_penalty * Decimal(penalty_days)

        total_penalty = total_penalty.quantize(Decimal('0.01'))

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


@shared_task
def process_mpesa_callback(callback_data, organization_id=None):
    """
    Process M-Pesa callback data. 
    organization_id should be passed when calling this task if possible,
    otherwise we might have to infer it from the data if phone numbers are unique system-wide.
    """
    from apps.accounts.models import Organization
    from apps.loans.models import Loan, LoanRepayment
    from apps.loans.services import allocate_payment
    
    try:
        # Resolve organization
        organization = None
        if organization_id:
            organization = Organization.objects.filter(id=organization_id).first()
            
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
        
        # Find loan by phone number. In multi-MFI we filter by borrower phone.
        from apps.customers.models import Borrower
        borrower_qs = Borrower.objects.filter(phone_number__endswith=phone[-9:])
        if organization:
            borrower_qs = borrower_qs.filter(organization=organization)
            
        borrower = borrower_qs.first()
        if not borrower:
            logger.warning(f"Borrower not found for phone: {phone}")
            return
        
        # If we didn't have organization, get it from borrower
        organization = borrower.organization
        
        loan = Loan.objects.filter(borrower=borrower, status='active', organization=organization).first()
        if not loan:
            logger.warning(f"No active loan found for borrower: {borrower} in organization {organization}")
            return
        
        # Record payment
        from apps.users.models import User
        # System user for this organization or any staff
        system_user = User.objects.filter(organization=organization, is_staff=True).first()
        
        allocation = allocate_payment(loan, amount)
        
        LoanRepayment.objects.create(
            organization=organization,
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
        logger.info(f"Recorded M-Pesa payment of {amount} for {loan.loan_number} (Org: {organization.company_name})")
            
    except Exception as e:
        logger.error(f"Error processing M-Pesa callback: {e}")

@shared_task
def update_arrears_status():
    """
    Daily task to update all loan arrears statuses.
    """
    from apps.loans.models import Loan
    from apps.loans.services.arrears import calculate_loan_arrears_status
    from apps.loans.services.collections import auto_create_collection_cases
    
    processed_count = 0
    
    # 1. Update status for all active/defaulted loans across all orgs
    active_loans = Loan.objects.filter(status__in=['active', 'defaulted'])
    for loan in active_loans:
        calculate_loan_arrears_status(loan)
        processed_count += 1
    
    # 2. Automatically create collection cases for new arrears
    # This service should handle multiple orgs if it iterates over all loans correctly
    cases_created = auto_create_collection_cases()
                
    logger.info(f"Updated {processed_count} loans and created {cases_created} collection cases")
    return processed_count

@shared_task
def check_payment_promises():
    """
    Periodic task to check and update promise-to-pay statuses.
    """
    from apps.loans.services.collections import check_broken_promises
    total_broken = check_broken_promises()
    logger.info(f"Checked promises. {total_broken} promises marked as BROKEN.")
    return total_broken

@shared_task
def process_mpesa_c2b_payment(transaction_id):
    """
    Process M-Pesa C2B payment and allocate to loan installments.
    """
    from apps.loans.models import MpesaC2BTransaction, Loan, LoanRepayment
    from apps.loans.services.payment_processor import PaymentProcessor
    
    try:
        transaction = MpesaC2BTransaction.objects.get(id=transaction_id)
        
        # Find loan by bill reference number
        try:
            # Note: loan numbers should be unique or we need more context
            loan = Loan.objects.get(loan_number=transaction.bill_ref_number)
            transaction.loan = loan
            organization = loan.organization
        except Loan.DoesNotExist:
            transaction.status = 'failed'
            transaction.error_message = f"Loan not found: {transaction.bill_ref_number}"
            transaction.save()
            return
        
        # Create loan repayment record
        repayment = LoanRepayment.objects.create(
            organization=organization,
            loan=loan,
            amount=transaction.trans_amount,
            payment_date=transaction.trans_time.date(),
            payment_method='mpesa',
            reference_number=transaction.trans_id,
            notes=f"M-Pesa C2B payment from {transaction.msisdn}"
        )
        
        transaction.repayment = repayment
        
        # Allocate payment
        processor = PaymentProcessor()
        allocation = processor.allocate_payment_to_installments(
            loan=loan,
            amount=transaction.trans_amount,
            payment_date=transaction.trans_time.date(),
            repayment=repayment
        )
        
        repayment.principal_paid = allocation['principal']
        repayment.interest_paid = allocation['interest']
        repayment.penalty_paid = allocation['penalties']
        repayment.fee_paid = allocation['fees']
        repayment.save()
        
        transaction.status = 'confirmed'
        transaction.processed_at = timezone.now()
        transaction.save()
        
        # Send confirmation SMS
        send_payment_confirmation_sms.delay(
            phone=transaction.msisdn,
            amount=float(transaction.trans_amount),
            loan_number=loan.loan_number,
            receipt=transaction.trans_id,
            new_balance=float(loan.outstanding_balance),
            organization_id=organization.id
        )
        
    except Exception as e:
        logger.error(f"Error processing M-Pesa C2B payment {transaction_id}: {str(e)}")
        try:
            transaction = MpesaC2BTransaction.objects.get(id=transaction_id)
            transaction.status = 'failed'
            transaction.error_message = str(e)
            transaction.save()
        except:
            pass

@shared_task
def send_payment_confirmation_sms(phone, amount, loan_number, receipt, new_balance, organization_id=None):
    """
    Send SMS confirmation to borrower after successful payment.
    """
    try:
        from apps.accounts.models import Organization
        from apps.loans.services.sms import SMSService
        
        if not organization_id:
            # Try to find organization from loan_number if not provided
            from apps.loans.models import Loan
            loan = Loan.objects.filter(loan_number=loan_number).first()
            if loan:
                organization = loan.organization
            else:
                return
        else:
            organization = Organization.objects.filter(id=organization_id).first()
            
        if not organization or not organization.sms_api_key:
            return
        
        message = (
            f"Payment of KES {amount:,.2f} received for loan {loan_number}. "
            f"Receipt: {receipt}. New balance: KES {new_balance:,.2f}. Thank you!"
        )
        
        sms_service = SMSService(organization)
        sms_service.send_sms(phone, message)
            
    except Exception as e:
        logger.error(f"Error sending payment confirmation SMS: {str(e)}")
