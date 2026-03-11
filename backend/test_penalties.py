import os
import django
import sys
from datetime import timedelta
from decimal import Decimal
from django.utils import timezone

sys.path.append("/app")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from apps.loans.models import Loan, RepaymentSchedule, LoanProduct, LoanApplication
from apps.customers.models import Borrower
from apps.accounts.models import Organization
from apps.loans.tasks import calculate_loan_penalties

org, _ = Organization.objects.get_or_create(id=1, defaults={"company_name": "Test Org"})
borrower, _ = Borrower.objects.get_or_create(email="testborrower_penalties@example.com", phone_number="+254700000001", organization=org, defaults={"first_name": "Penalty", "last_name": "Test", "id_number": "87654321"})
product, _ = LoanProduct.objects.get_or_create(
    code="TESTPENALTY", 
    organization=org, 
    defaults={
        "name": "Penalty Test Product",
        "min_amount": 1000, 
        "max_amount": 50000
    }
)

# Set predictable penalty scheme
product.penalty_grace_period = 3
product.penalty_type = 'fixed'
product.penalty_value = Decimal('50.00')
product.penalty_basis = 'per_day'
product.save()

now_date = timezone.now().date()
principal_amount = Decimal("10000")
total_interest = Decimal("3000")

application = LoanApplication.objects.create(
    organization=org,
    borrower=borrower,
    product=product,
    requested_amount=principal_amount,
    requested_term=3,
    status="approved",
    approved_amount=principal_amount,
    approved_term=3,
    approved_interest_rate=10
)

loan = Loan.objects.create(
    organization=org,
    borrower=borrower,
    product=product,
    application=application,
    loan_number="PENALTY-TEST-01",
    principal_amount=principal_amount,
    total_interest=total_interest,
    outstanding_balance=principal_amount + total_interest,
    outstanding_principal=principal_amount,
    outstanding_interest=total_interest,
    interest_rate=10,
    term=3,
    status="active",
    disbursed_amount=principal_amount,
    disbursement_date=now_date,
    maturity_date=now_date + timedelta(days=90),
    repayment_frequency="monthly"
)

# Create 1 overdue schedule exactly 10 days overdue
past_date = now_date - timedelta(days=10)
schedule = RepaymentSchedule.objects.create(
    loan=loan,
    installment_number=1,
    due_date=past_date,
    principal_due=Decimal("3333.33"),
    interest_due=Decimal("1000"),
    total_due=Decimal("4333.33"),
    status="overdue",
    penalty_due=Decimal("0.00")
)

print(f"Loan: {loan.loan_number} created.")
print(f"Initial: Days Overdue = {(timezone.now().date() - schedule.due_date).days}")
print(f"Initial: Schedule Penalty Due = {schedule.penalty_due}")
print(f"Initial: Loan Outstanding Penalties = {loan.outstanding_penalties}")

# Expected:
# Overdue = 10 days. Grace = 3 days. Penalty Days = 7 days.
# Rate = 50 fixed per day.
# Expected Total Penalty = 7 * 50 = 350.

# Run calculation
calculate_loan_penalties()

# Print after state
loan.refresh_from_db()
schedule.refresh_from_db()
print(f"After : Schedule Penalty Due = {schedule.penalty_due}")
print(f"After : Loan Outstanding Penalties = {loan.outstanding_penalties}")

if schedule.penalty_due == Decimal('350.00'):
    print("SUCCESS: Penalty calculated correctly.")
else:
    print("FAILED: Penalty calculation is incorrect.")
