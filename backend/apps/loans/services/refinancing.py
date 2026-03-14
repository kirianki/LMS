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
        # 4. Sync repayment schedules to paid status
        old_loan.sync_schedules()

        # 5. Auto-release collateral if not ported/used elsewhere
        from apps.collateral.utils import auto_release_loan_collateral
        auto_release_loan_collateral(old_loan)
        
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


@transaction.atomic
def restructure_loan_in_place(
    loan,
    new_term,
    new_interest_rate,
    new_frequency,
    capitalize_arrears,
    waive_penalties,
    waive_interest=False,
    user=None,
    notes=''
):
    """
    Restructure an existing loan in-place.

    Industry-Standard Flow:
    1. Validate eligibility.
    2. Snapshot current arrears state for audit trail.
    3. Waive penalties (and optionally interest) before any capitalization.
    4. Capitalize remaining arrears into principal if elected.
    5. Clean up existing future unpaid/partial schedules correctly.
    6. Calculate FRESH new interest from scratch (never additive).
    7. Generate a brand-new repayment schedule starting from today.
    8. Recalculate outstanding_balance from final components.
    9. Post GL journal entries for waivers and/or capitalizations.
    10. Save loan with restructure metadata; reset arrears counters.
    """
    from apps.loans.models import RepaymentSchedule
    from apps.loans.services.calculations import calculate_interest
    from dateutil.relativedelta import relativedelta
    from datetime import date, timedelta
    import logging
    logger = logging.getLogger(__name__)

    # -------------------------------------------------------------------
    # STEP 1 | Eligibility
    # -------------------------------------------------------------------
    if loan.status not in ['active', 'overdue', 'defaulted']:
        raise ValueError(f"Cannot restructure a loan with status '{loan.get_status_display()}'.")

    # -------------------------------------------------------------------
    # STEP 2 | Snapshot for audit trail / preserve original term
    # -------------------------------------------------------------------
    snap_principal = loan.outstanding_principal
    snap_interest  = loan.outstanding_interest
    snap_penalties = loan.outstanding_penalties

    if not loan.is_restructured:
        loan.original_term = loan.term

    # -------------------------------------------------------------------
    # STEP 3 | Waive before capitalize (waive takes precedence)
    # -------------------------------------------------------------------
    waived_penalties = Decimal('0.00')
    waived_interest  = Decimal('0.00')

    if waive_penalties:
        waived_penalties = loan.outstanding_penalties
        loan.outstanding_penalties = Decimal('0.00')

    if waive_interest:
        waived_interest = loan.outstanding_interest
        loan.outstanding_interest = Decimal('0.00')

    # -------------------------------------------------------------------
    # STEP 4 | Capitalize remaining arrears into principal
    # -------------------------------------------------------------------
    capitalized_amount = Decimal('0.00')

    if capitalize_arrears:
        capitalized_amount = loan.outstanding_interest + loan.outstanding_penalties
        if capitalized_amount > 0:
            loan.outstanding_principal += capitalized_amount
            loan.outstanding_interest   = Decimal('0.00')
            loan.outstanding_penalties  = Decimal('0.00')

    # -------------------------------------------------------------------
    # STEP 5 | Clean existing future schedules
    # -------------------------------------------------------------------
    unpaid_schedules = loan.schedules.filter(
        status__in=['pending', 'partial', 'overdue']
    ).order_by('installment_number')

    for schedule in unpaid_schedules:
        if schedule.paid_amount > 0:
            # Partially paid: keep only what was paid
            schedule.principal_due = schedule.principal_paid
            schedule.interest_due  = schedule.interest_paid
            schedule.penalty_due   = schedule.penalty_paid
            schedule.total_due     = schedule.principal_paid + schedule.interest_paid + schedule.penalty_paid
            schedule.status        = 'paid'
            schedule.save()
        else:
            schedule.delete()

    # -------------------------------------------------------------------
    # STEP 6 | Calculate FRESH interest from scratch (NOT additive)
    # -------------------------------------------------------------------
    principal_to_schedule = loan.outstanding_principal
    product     = loan.product
    term_unit   = product.term_unit

    interest_method = loan.interest_method or product.interest_type
    interest_period = getattr(loan, 'interest_period', None) or getattr(product, 'suggested_interest_period', 'per_year')

    new_interest_amount = calculate_interest(
        principal=principal_to_schedule,
        rate=new_interest_rate,
        term=new_term,
        term_unit=term_unit,
        interest_type=interest_method,
        interest_period=interest_period,
        frequency=new_frequency,
    )

    # Replace outstanding interest with the fresh calculation
    loan.outstanding_interest = new_interest_amount
    loan.total_interest = (loan.total_interest or Decimal('0.00')) + new_interest_amount

    # -------------------------------------------------------------------
    # STEP 7 | Generate new repayment schedule from today
    # -------------------------------------------------------------------
    start_date = date.today()

    frequency_map = {
        'weekly':      timedelta(weeks=1),
        'monthly':     relativedelta(months=1),
        'quarterly':   relativedelta(months=3),
        'bi_annually': relativedelta(months=6),
        'annually':    relativedelta(months=12),
        'bullet':      None,
    }
    delta = frequency_map.get(new_frequency, relativedelta(months=1))

    if new_frequency == 'weekly':
        if term_unit == 'months':
            num_installments = int(Decimal(str(new_term)) * Decimal('4.33'))
        elif term_unit == 'weeks':
            num_installments = new_term
        else:
            num_installments = new_term // 7
    elif new_frequency == 'quarterly':
        num_installments = max(1, new_term // 3) if term_unit == 'months' else new_term
    elif new_frequency == 'bi_annually':
        num_installments = max(1, new_term // 6) if term_unit == 'months' else new_term
    elif new_frequency == 'annually':
        num_installments = max(1, new_term // 12) if term_unit == 'months' else new_term
    elif new_frequency == 'bullet':
        delta = relativedelta(months=new_term) if term_unit == 'months' else timedelta(days=new_term)
        num_installments = 1
    else:  # monthly
        num_installments = new_term

    if num_installments <= 0:
        num_installments = 1

    last_paid   = loan.schedules.order_by('installment_number').last()
    start_idx   = (last_paid.installment_number + 1) if last_paid else 1

    if interest_method == 'flat':
        p_per = round(principal_to_schedule / num_installments, 2)
        i_per = round(new_interest_amount / num_installments, 2)
        rem_p = principal_to_schedule
        rem_i = new_interest_amount

        for i in range(num_installments):
            due_date = start_date + (delta * (i + 1))
            cur_p = rem_p if i == num_installments - 1 else p_per
            cur_i = rem_i if i == num_installments - 1 else i_per

            RepaymentSchedule.objects.create(
                loan=loan,
                installment_number=start_idx + i,
                due_date=due_date,
                principal_due=cur_p,
                interest_due=cur_i,
                total_due=cur_p + cur_i,
                status='pending'
            )
            rem_p -= cur_p
            rem_i -= cur_i

    else:  # Reducing balance
        r_annual = Decimal(str(new_interest_rate))
        if interest_period == 'per_month':
            r_annual = r_annual * 12
        elif interest_period == 'per_day':
            r_annual = r_annual * 365
        r_annual = r_annual / Decimal('100')

        period_divisors = {
            'weekly': Decimal('52'), 'quarterly': Decimal('4'),
            'bi_annually': Decimal('2'), 'annually': Decimal('1'),
        }
        r_period = r_annual / period_divisors.get(new_frequency, Decimal('12'))

        if r_period > 0:
            n = Decimal(str(num_installments))
            emi = (principal_to_schedule * r_period * (1 + r_period) ** n) / ((1 + r_period) ** n - 1)
        else:
            emi = principal_to_schedule / num_installments

        rem_p = principal_to_schedule
        for i in range(num_installments):
            due_date = start_date + (delta * (i + 1))
            i_comp = round(rem_p * r_period, 2)
            p_comp = round(emi - i_comp, 2)

            if i == num_installments - 1:
                p_comp = rem_p
                i_comp = round(rem_p * r_period, 2)

            RepaymentSchedule.objects.create(
                loan=loan,
                installment_number=start_idx + i,
                due_date=due_date,
                principal_due=p_comp,
                interest_due=i_comp,
                total_due=p_comp + i_comp,
                status='pending'
            )
            rem_p -= p_comp

    # -------------------------------------------------------------------
    # STEP 8 | Recalculate outstanding_balance from final components
    # -------------------------------------------------------------------
    loan.outstanding_balance = (
        loan.outstanding_principal +
        loan.outstanding_interest +
        loan.outstanding_penalties
    )

    last_schedule = loan.schedules.order_by('installment_number').last()
    if last_schedule:
        loan.maturity_date = last_schedule.due_date

    # -------------------------------------------------------------------
    # STEP 9 | Post GL Journal Entries
    # -------------------------------------------------------------------
    try:
        from apps.accounting.services import create_double_entry
        org  = loan.organization
        today = date.today()

        if waived_penalties > 0 or waived_interest > 0:
            total_waiver = waived_penalties + waived_interest
            create_double_entry(
                date=today,
                description=f"Loan Restructure Waiver: {loan.loan_number}",
                reference=f"RESTR-WAIVE-{loan.loan_number}",
                debits=[('4300', total_waiver)],
                credits=[('1210', total_waiver)],
                created_by=user,
                organization=org,
            )

        if capitalized_amount > 0:
            create_double_entry(
                date=today,
                description=f"Loan Restructure Capitalization: {loan.loan_number}",
                reference=f"RESTR-CAP-{loan.loan_number}",
                debits=[('1210', capitalized_amount)],
                credits=[('4300', capitalized_amount)],
                created_by=user,
                organization=org,
            )
    except Exception as gl_err:
        logger.warning(f"GL posting failed for restructure {loan.loan_number}: {gl_err}")

    # -------------------------------------------------------------------
    # STEP 10 | Save loan with updated metadata
    # -------------------------------------------------------------------
    loan.status             = 'active'
    loan.days_in_arrears    = 0
    loan.arrears_category   = 'current'
    loan.is_restructured    = True
    loan.restructured_at    = timezone.now()
    loan.restructured_by    = user
    loan.restructure_notes  = notes
    loan.term               = new_term
    loan.interest_rate      = new_interest_rate
    loan.repayment_frequency = new_frequency
    loan.save()

    # Resolve any open collection cases
    try:
        if hasattr(loan, 'collection_case') and loan.collection_case.status in ['active', 'escalated']:
            case = loan.collection_case
            case.status           = 'resolved'
            case.resolved_at      = timezone.now()
            case.days_overdue     = 0
            case.overdue_amount   = Decimal('0.00')
            case.resolution_notes = "Resolved via in-place loan restructuring."
            case.save()
    except Exception:
        pass

    return loan, {
        'snap_principal':   snap_principal,
        'snap_interest':    snap_interest,
        'snap_penalties':   snap_penalties,
        'waived_penalties': waived_penalties,
        'waived_interest':  waived_interest,
        'capitalized':      capitalized_amount,
        'new_interest':     new_interest_amount,
        'new_installments': num_installments,
    }

