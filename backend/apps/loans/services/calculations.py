from decimal import Decimal
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
from ..models import LoanProduct, RepaymentSchedule


def calculate_interest(principal, rate, term, term_unit, interest_type, interest_period='per_year', frequency='monthly'):
    """
    Calculate total interest for a loan.
    
    Args:
        principal: Loan principal amount
        rate: Interest rate (percentage)
        term: Loan term
        term_unit: 'days', 'weeks', or 'months'
        interest_type: 'flat' or 'reducing_balance'
        interest_period: 'per_month', 'per_day', or 'per_year'
        frequency: 'weekly', 'monthly', 'quarterly', 'bi_annually', 'annually', 'bullet'
    
    Returns:
        Total interest amount
    """
    rate = Decimal(str(rate))
    
    # Normalize rate to annual basis first
    if interest_period == 'per_month':
        annual_rate = rate * Decimal('12') / Decimal('100')
    elif interest_period == 'per_day':
        annual_rate = rate * Decimal('365') / Decimal('100')
    else:  # per_year or default
        annual_rate = rate / Decimal('100')
    
    # Convert term to years for calculation
    if term_unit == LoanProduct.TermUnit.DAYS:
        years = Decimal(term) / Decimal('365')
    elif term_unit == LoanProduct.TermUnit.WEEKS:
        years = Decimal(term) / Decimal('52')
    else:  # months
        years = Decimal(term) / Decimal('12')
    
    if interest_type == LoanProduct.InterestType.FLAT:
        # Simple interest: P * R * T
        return principal * annual_rate * years
    else:  # Reducing balance
        # For reducing balance, we calculate based on EMI for better accuracy
        # Determine number of installments and period rate
        
        # Determine installments (n)
        if frequency == 'weekly':
            if term_unit == 'months':
                n = int(Decimal(term) * Decimal('4.33'))
            elif term_unit == 'weeks':
                n = term
            else: # days
                n = term // 7
            r_period = annual_rate / Decimal('52')
        elif frequency == 'quarterly':
            n = max(1, term // 3) if term_unit == 'months' else term
            r_period = annual_rate / Decimal('4')
        elif frequency == 'bi_annually':
            n = max(1, term // 6) if term_unit == 'months' else term
            r_period = annual_rate / Decimal('2')
        elif frequency == 'annually':
            n = max(1, term // 12) if term_unit == 'months' else term
            r_period = annual_rate
        elif frequency == 'bullet':
            n = 1
            r_period = annual_rate * years
        else: # Default Monthly
            n = term if term_unit == 'months' else term
            r_period = annual_rate / Decimal('12')
            
        if r_period > 0 and n > 0:
            emi = principal * r_period * ((1 + r_period) ** n) / (((1 + r_period) ** n) - 1)
            total_repayment = emi * n
            return total_repayment - principal
        else:
            return Decimal('0.00')


def calculate_processing_fee(principal, fee_type, fee_value):
    """Calculate processing fee based on type."""
    if fee_type == LoanProduct.FeeType.FIXED:
        return Decimal(str(fee_value))
    else:  # Percentage
        return principal * Decimal(str(fee_value)) / Decimal('100')


def generate_repayment_schedule(loan_obj):
    """
    Generate repayment schedule entries for a loan or application.
    Supports flexible repayment frequencies (Weekly, Monthly, Quarterly, Bi-Annually, Annually, Bullet).
    """
    is_application = hasattr(loan_obj, 'requested_amount') and not hasattr(loan_obj, 'loan_number')
    
    product = loan_obj.product
    
    if is_application:
        principal = loan_obj.approved_amount or loan_obj.requested_amount
        term = loan_obj.approved_term or loan_obj.requested_term
        start_date = date.today() # Projected
        
        # Estimate interest
        interest_rate = loan_obj.approved_interest_rate or product.suggested_interest_rate or Decimal('0.00')
        interest_type = loan_obj.approved_interest_method or product.interest_type or LoanProduct.InterestType.FLAT
        
        # New Field
        frequency = getattr(loan_obj, 'approved_repayment_frequency', 'monthly')
    else:
        principal = loan_obj.principal_amount
        total_interest = loan_obj.total_interest
        term = loan_obj.term
        start_date = loan_obj.disbursement_date
        interest_rate = product.suggested_interest_rate # Not always stored on loan, ideally should be snapshot
        
        # New Field
        frequency = getattr(loan_obj, 'repayment_frequency', 'monthly')
        
        # Fallback if interest rate missing on loan processing (should exist on approved app)
        if hasattr(loan_obj, 'application') and loan_obj.application:
            interest_rate = loan_obj.application.approved_interest_rate
            interest_type = loan_obj.application.approved_interest_method
        else:
             interest_type = getattr(product, 'interest_type', LoanProduct.InterestType.FLAT)

    # Determine Delta and number of installments
    delta = relativedelta(months=1)
    frequency_divisor = 1 # Divisor for monthly terms
    
    if frequency == 'weekly':
        delta = timedelta(weeks=1)
        # If term is in months, convert to weeks approx
        if product.term_unit == 'months':
            num_installments = int(Decimal(term) * Decimal('4.33'))
        elif product.term_unit == 'weeks':
            num_installments = term
        else: # days
            num_installments = term // 7
            
    elif frequency == 'quarterly':
        delta = relativedelta(months=3)
        frequency_divisor = 3
        num_installments = max(1, term // 3) if product.term_unit == 'months' else term # Simplistic fallback
        
    elif frequency == 'bi_annually':
        delta = relativedelta(months=6)
        frequency_divisor = 6
        num_installments = max(1, term // 6) if product.term_unit == 'months' else term
        
    elif frequency == 'annually':
        delta = relativedelta(months=12)
        frequency_divisor = 12
        num_installments = max(1, term // 12) if product.term_unit == 'months' else term
        
    elif frequency == 'bullet':
        delta = relativedelta(months=term) if product.term_unit == 'months' else timedelta(days=term) # End of term
        num_installments = 1
        frequency_divisor = term
        
    else: # Default Monthly
        delta = relativedelta(months=1)
        frequency_divisor = 1
        num_installments = term if product.term_unit == 'months' else term # Assume 1-to-1 matching if units line up
    
    # Recalculate total interest based on correct term/frequency mechanics if needed
    # For now, we assume 'calculate_interest' helper returns the GLOBAL total interest for the term
    if is_application:
        total_interest = calculate_interest(
            principal,
            interest_rate or Decimal('0.00'),
            term,
            product.term_unit,
            interest_type,
            interest_period=getattr(loan_obj, 'approved_interest_period', 'per_year'),
            frequency=frequency
        )

    schedules = []
    
    if interest_type == LoanProduct.InterestType.FLAT:
        remaining_principal = principal
        remaining_interest = total_interest
        
        for i in range(1, num_installments + 1):
            due_date = start_date + (delta * i)

            p_due = round(principal / num_installments, 2)
            i_due = round(total_interest / num_installments, 2)
            
            # Final installment adjustment
            if i == num_installments:
                p_due = remaining_principal
                i_due = remaining_interest
            
            schedule = RepaymentSchedule(
                installment_number=i,
                due_date=due_date,
                principal_due=p_due,
                interest_due=i_due,
                total_due=p_due + i_due
            )
            if is_application:
                schedule.application = loan_obj
            else:
                schedule.loan = loan_obj
            
            schedules.append(schedule)
            remaining_principal -= p_due
            remaining_interest -= i_due
            
    else: # Reducing Balance
        # Recalculate PERIOD rate effectively
        # If term=12 months, rate=12% PA.
        # Monthly: rate = 1%. n = 12.
        # Bi-Annual: rate = 6%. n = 2.
        
        # Period rate Calculation
        # Normalize rate to annual basis first
        i_period_type = getattr(loan_obj, 'approved_interest_period', 'per_year') if is_application else getattr(product, 'suggested_interest_period', 'per_year')
        
        if i_period_type == 'per_month':
            r_annual = (interest_rate or Decimal('0.00')) * Decimal('12') / Decimal('100')
        elif i_period_type == 'per_day':
            r_annual = (interest_rate or Decimal('0.00')) * Decimal('365') / Decimal('100')
        else: # per_year
            r_annual = (interest_rate or Decimal('0.00')) / Decimal('100')
            
        # Period rate
        if frequency == 'weekly':
            r_period = r_annual / Decimal('52')
        elif frequency == 'quarterly':
            r_period = r_annual / Decimal('4')
        elif frequency == 'bi_annually':
            r_period = r_annual / Decimal('2')
        elif frequency == 'annually':
            r_period = r_annual
        elif frequency == 'bullet':
            r_period = r_annual * (Decimal(term) / Decimal('12')) if product.term_unit == 'months' else r_annual * (Decimal(term) / Decimal('365'))
        else: # Monthly
            r_period = r_annual / Decimal('12')
            
        n = num_installments
        
        if r_period > 0 and n > 0:
            emi = principal * r_period * ((1 + r_period) ** n) / (((1 + r_period) ** n) - 1)
        else:
            emi = principal / n if n > 0 else principal
            
        remaining_principal = principal
        
        for i in range(1, n + 1):
            due_date = start_date + (delta * i)
            
            interest_component = remaining_principal * r_period
            principal_component = emi - interest_component
            
            # Adjustment for final
            if i == n:
                principal_component = remaining_principal
                # Recalculate final interest on remaining
                interest_component = remaining_principal * r_period 
            
            p_comp = round(principal_component, 2)
            i_comp = round(interest_component, 2)
            
            schedule = RepaymentSchedule(
                installment_number=i,
                due_date=due_date,
                principal_due=p_comp,
                interest_due=i_comp,
                total_due=p_comp + i_comp
            )
            if is_application:
                schedule.application = loan_obj
            else:
                schedule.loan = loan_obj
            
            schedules.append(schedule)
            remaining_principal -= principal_component

    return schedules


def allocate_payment(loan, amount):
    """
    Allocate a payment to outstanding balances.
    Order: Penalties -> Fees -> Interest -> Principal
    
    Returns dict with allocation breakdown.
    """
    remaining = Decimal(str(amount))
    allocation = {
        'penalty_paid': Decimal('0.00'),
        'fee_paid': Decimal('0.00'),
        'interest_paid': Decimal('0.00'),
        'principal_paid': Decimal('0.00'),
    }
    
    # 1. Penalties first
    if remaining > 0 and loan.outstanding_penalties > 0:
        pay = min(remaining, loan.outstanding_penalties)
        allocation['penalty_paid'] = pay
        remaining -= pay
    
    # 2. Then fees
    if remaining > 0 and loan.total_fees > 0:
        unpaid_fees = sum(f.amount for f in loan.fees.filter(is_paid=False))
        pay = min(remaining, unpaid_fees)
        allocation['fee_paid'] = pay
        remaining -= pay
    
    # 3. Then interest
    if remaining > 0 and loan.outstanding_interest > 0:
        pay = min(remaining, loan.outstanding_interest)
        allocation['interest_paid'] = pay
        remaining -= pay
    
    # 4. Finally principal
    if remaining > 0 and loan.outstanding_principal > 0:
        pay = min(remaining, loan.outstanding_principal)
        allocation['principal_paid'] = pay
        remaining -= pay
    
    return allocation
