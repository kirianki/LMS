import os
import django
import json
from decimal import Decimal
from datetime import date

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.loans.models import Loan
from apps.loans.services.documents import generate_loan_statement

# Find a loan with schedules if possible, or just the first one
loan = Loan.objects.prefetch_related('schedules', 'repayments').first()

if not loan:
    print("No loans found in DB.")
    exit()

def serialize_decimal(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, (date,)):
        return obj.isoformat()
    return str(obj)

# Extract context logic from generate_loan_statement
def get_debug_context(loan):
    organization = loan.organization
    def format_money(val):
        try:
            return "{:,.2f}".format(val or Decimal('0.00'))
        except:
            return "0.00"
    
    def format_date_short(d):
        return d.strftime("%d %b %Y") if d else "N/A"

    borrower = loan.borrower
    today = date.today()
    schedules = loan.schedules.all().order_by('installment_number')
    
    fmt_installments = []
    total_principal_due = Decimal('0.00')
    total_interest_due = Decimal('0.00')
    total_penalty_due = Decimal('0.00')
    total_principal_paid = Decimal('0.00')
    total_interest_paid = Decimal('0.00')
    total_penalty_paid = Decimal('0.00')

    for s in schedules:
        principal_rem = max(Decimal('0.00'), s.principal_due - s.principal_paid)
        interest_rem = max(Decimal('0.00'), s.interest_due - s.interest_paid)
        penalty_rem = max(Decimal('0.00'), s.penalty_due - s.penalty_paid)
        total_rem = principal_rem + interest_rem + penalty_rem

        total_principal_due += s.principal_due
        total_interest_due += s.interest_due
        total_penalty_due += s.penalty_due
        total_principal_paid += s.principal_paid
        total_interest_paid += s.interest_paid
        total_penalty_paid += s.penalty_paid
        
        fmt_installments.append({'number': s.installment_number})

    total_repaid = sum(r.amount for r in loan.repayments.all())

    context = {
        'principal': format_money(loan.principal_amount),
        'outstanding_balance': format_money(loan.outstanding_balance),
        'total_repaid': format_money(total_repaid),
        'penalty_due': format_money(loan.outstanding_penalties),
        'installments_count': len(fmt_installments),
        'total_principal_due': format_money(total_principal_due),
        'total_interest_due': format_money(total_interest_due),
        'total_penalty_due': format_money(total_penalty_due),
    }
    return context

ctx = get_debug_context(loan)
print(json.dumps(ctx, indent=2, default=serialize_decimal))
