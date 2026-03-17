import os
import django
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

print(f"Testing with Loan: {loan.loan_number}")
print(f"Principal: {loan.principal_amount}")
print(f"Outstanding: {loan.outstanding_balance}")
print(f"Schedules count: {loan.schedules.count()}")
print(f"Repayments count: {loan.repayments.count()}")

# Manually trigger the context part of generate_loan_statement to see values
def format_money(val):
    return "{:,.2f}".format(val or Decimal('0.00'))

schedules = loan.schedules.all().order_by('installment_number')
total_principal_due = sum(s.principal_due for s in schedules)
total_repaid = sum(r.amount for r in loan.repayments.all())

print(f"Calculated Total Repaid: {total_repaid}")
print(f"Formatted Total Repaid: {format_money(total_repaid)}")

if not schedules:
    print("WARNING: No schedules found for this loan.")
else:
    print(f"First schedule: P Due={schedules[0].principal_due}, P Paid={schedules[0].principal_paid}")

# Now try to generate the PDF and see if it crashes or something
try:
    pdf = generate_loan_statement(loan)
    print("PDF generated successfully.")
    with open("debug_statement.pdf", "wb") as f:
        f.write(pdf.read())
    print("PDF saved to debug_statement.pdf")
except Exception as e:
    print(f"Error generating PDF: {e}")
