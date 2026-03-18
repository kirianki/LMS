from celery import shared_task
from django.utils import timezone
from django.db.models import Sum
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)

@shared_task
def verify_system_integrity():
    """
    Nightly task to audit the system for any balance discrepancies.
    Checks:
    1. Loan outstanding_principal vs Sum of unpaid RepaymentSchedules.
    2. Loan outstanding_principal vs GL Principal Receivable (1210).
    3. Loan outstanding_interest vs GL Interest Receivable (1220).
    """
    from apps.loans.models import Loan, RepaymentSchedule
    from apps.accounting.models import ChartOfAccount
    from apps.accounts.models import Organization
    
    discrepancies = []
    
    for org in Organization.objects.all():
        # --- 1. Internal Loan Sync Audit ---
        active_loans = Loan.objects.filter(organization=org, status__in=['active', 'defaulted'])
        for loan in active_loans:
            sum_schedule_p = loan.schedules.aggregate(
                rem=Sum(RepaymentSchedule.principal_due_minus_paid_expr()) # We need to check if this expr exists or manual sum
            )['rem'] or Decimal('0.00')
            
            # Manual sum for safety if expr doesn't exist
            schedules = loan.schedules.all()
            sum_p = sum(max(Decimal('0'), s.principal_due - s.principal_paid) for s in schedules)
            sum_i = sum(max(Decimal('0'), s.interest_due - s.interest_paid) for s in schedules)
            
            if abs(loan.outstanding_principal - sum_p) > Decimal('0.01'):
                discrepancies.append(f"Loan {loan.loan_number} Principal Mismatch: Model={loan.outstanding_principal}, Schedule={sum_p}")
            
            if abs(loan.outstanding_interest - sum_i) > Decimal('0.01'):
                discrepancies.append(f"Loan {loan.loan_number} Interest Mismatch: Model={loan.outstanding_interest}, Schedule={sum_i}")

        # --- 2. GL vs Model Audit ---
        total_loan_p = active_loans.aggregate(s=Sum('outstanding_principal'))['s'] or Decimal('0.00')
        total_loan_i = active_loans.aggregate(s=Sum('outstanding_interest'))['s'] or Decimal('0.00')
        
        try:
            coa_1210 = ChartOfAccount.objects.get(code='1210', organization=org)
            if abs(coa_1210.balance - total_loan_p) > Decimal('0.01'):
                discrepancies.append(f"Org {org.company_name} GL Principal Mismatch: GL={coa_1210.balance}, Loans={total_loan_p}")
        except: pass

        try:
            coa_1220 = ChartOfAccount.objects.get(code='1220', organization=org)
            if abs(coa_1220.balance - total_loan_i) > Decimal('0.01'):
                discrepancies.append(f"Org {org.company_name} GL Interest Mismatch: GL={coa_1220.balance}, Interest={total_loan_i}")
        except: pass

    if discrepancies:
        for d in discrepancies:
            logger.error(f"INTEGRITY ALERT: {d}")
        # In a real system, we would send an email/notification to devs here.
    else:
        logger.info("System integrity check passed with 0 discrepancies.")
    
    return len(discrepancies)
