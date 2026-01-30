from decimal import Decimal
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
from ..models import LoanProduct, RepaymentSchedule


def calculate_interest(principal, rate, term, term_unit, interest_type):
    """
    Calculate total interest for a loan.
    
    Args:
        principal: Loan principal amount
        rate: Annual interest rate (percentage)
        term: Loan term
        term_unit: 'days', 'weeks', or 'months'
        interest_type: 'flat' or 'reducing_balance'
    
    Returns:
        Total interest amount
    """
    annual_rate = Decimal(str(rate)) / Decimal('100')
    
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
        # For reducing balance, we calculate via amortization
        # Total interest = sum of all monthly interest payments
        # This is approximated here; actual is computed in schedule
        return principal * annual_rate * years * Decimal('0.55')  # Approximation


def calculate_processing_fee(principal, fee_type, fee_value):
    """Calculate processing fee based on type."""
    if fee_type == LoanProduct.FeeType.FIXED:
        return Decimal(str(fee_value))
    else:  # Percentage
        return principal * Decimal(str(fee_value)) / Decimal('100')


def generate_repayment_schedule(loan_obj):
    """
    Generate repayment schedule entries for a loan or application.
    
    Args:
        loan_obj: Loan or LoanApplication instance
    
    Returns:
        List of RepaymentSchedule instances (not saved)
    """
    is_application = hasattr(loan_obj, 'requested_amount') and not hasattr(loan_obj, 'loan_number')
    
    product = loan_obj.product
    
    if is_application:
        principal = loan_obj.approved_amount or loan_obj.requested_amount
        term = loan_obj.approved_term or loan_obj.requested_term
        start_date = date.today() # Projected
        
        # Estimate interest
        interest_rate = loan_obj.approved_interest_rate or product.interest_rate
        interest_type = loan_obj.approved_interest_method or product.interest_type
        
        total_interest = calculate_interest(
            principal,
            interest_rate,
            term,
            product.term_unit,
            interest_type
        )
    else:
        principal = loan_obj.principal_amount
        total_interest = loan_obj.total_interest
        term = loan_obj.term
        start_date = loan_obj.disbursement_date
    
    schedules = []
    
    # Determine interest type with robust fallback
    interest_type = getattr(product, 'interest_type', LoanProduct.InterestType.FLAT)
    if is_application:
        interest_type = loan_obj.approved_interest_method or interest_type

    if interest_type == LoanProduct.InterestType.FLAT:
        remaining_principal = principal
        remaining_interest = total_interest
        
        for i in range(1, term + 1):
            if product.term_unit == LoanProduct.TermUnit.DAYS:
                due_date = start_date + timedelta(days=i)
            elif product.term_unit == LoanProduct.TermUnit.WEEKS:
                due_date = start_date + timedelta(weeks=i)
            else:  # months
                due_date = start_date + relativedelta(months=i)
            
            p_due = round(principal / term, 2)
            i_due = round(total_interest / term, 2)
            
            # Final installment adjustment
            if i == term:
                p_due = remaining_principal
                i_due = remaining_interest
            
            schedule = RepaymentSchedule(
                installment_number=i,
                due_date=due_date,
                principal_due=p_due,
                interest_due=i_due,
                total_due=p_due + i_due  # Explicitly calculate total
            )
            if is_application:
                schedule.application = loan_obj
            else:
                schedule.loan = loan_obj
            
            schedules.append(schedule)
            remaining_principal -= p_due
            remaining_interest -= i_due
    
    else:  # Reducing balance (amortization)
        # Calculate monthly rate
        if product.term_unit == LoanProduct.TermUnit.DAYS:
            period_rate = (interest_rate / Decimal('100')) / Decimal('365')
        elif product.term_unit == LoanProduct.TermUnit.WEEKS:
            period_rate = (interest_rate / Decimal('100')) / Decimal('52')
        else:
            period_rate = (interest_rate / Decimal('100')) / Decimal('12')
        
        # Calculate EMI using formula: P * r * (1+r)^n / ((1+r)^n - 1)
        if period_rate > 0:
            r = period_rate
            n = term
            emi = principal * r * ((1 + r) ** n) / (((1 + r) ** n) - 1)
        else:
            emi = principal / term
        
        remaining_principal = principal
        
        for i in range(1, term + 1):
            if product.term_unit == LoanProduct.TermUnit.DAYS:
                due_date = start_date + timedelta(days=i)
            elif product.term_unit == LoanProduct.TermUnit.WEEKS:
                due_date = start_date + timedelta(weeks=i)
            else:
                due_date = start_date + relativedelta(months=i)
            
            interest_component = remaining_principal * period_rate
            principal_component = emi - interest_component
            
            # Handle final installment rounding
            if i == term:
                principal_component = remaining_principal
            
            p_comp = round(principal_component, 2)
            i_comp = round(interest_component, 2)
            
            schedule = RepaymentSchedule(
                installment_number=i,
                due_date=due_date,
                principal_due=p_comp,
                interest_due=i_comp,
                total_due=p_comp + i_comp  # Explicitly calculate total
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
