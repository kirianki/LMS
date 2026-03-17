import os
import django
from decimal import Decimal
from django.utils import timezone
from datetime import timedelta
# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from rest_framework.test import APIClient, force_authenticate

from apps.loans.models import Loan, RepaymentSchedule, LoanRepayment, LoanProduct, LoanApplication
from apps.customers.models import Borrower
from apps.accounting.models import ChartOfAccount, JournalEntry, LedgerEntry
from apps.treasury.models import CashAccount, Transaction as TreasuryTransaction
from apps.accounts.models import Organization
from django.contrib.auth import get_user_model

User = get_user_model()

def setup_test_data():
    org = Organization.objects.filter(company_name="Test Org").first()
    if not org:
        org = Organization.objects.create(company_name="Test Org", slug="test-org")

    admin_user = User.objects.filter(email="admin@test.com").first()
    if not admin_user:
        admin_user = User.objects.create_superuser("admin@test.com", "password")
        admin_user.organization = org
        admin_user.save()

    coa_cash = ChartOfAccount.objects.filter(code="1110", organization=org).first()
    if not coa_cash:
        coa_cash = ChartOfAccount.objects.create(code="1110", name="Cash in Hand", account_type="asset", organization=org)

    coa_portfolio = ChartOfAccount.objects.filter(code="1210", organization=org).first()
    if not coa_portfolio:
        coa_portfolio = ChartOfAccount.objects.create(code="1210", name="Loan Portfolio", account_type="asset", organization=org)

    coa_interest = ChartOfAccount.objects.filter(code="4100", organization=org).first()
    if not coa_interest:
        coa_interest = ChartOfAccount.objects.create(code="4100", name="Interest Income", account_type="income", organization=org)

    coa_penalty = ChartOfAccount.objects.filter(code="4300", organization=org).first()
    if not coa_penalty:
        coa_penalty = ChartOfAccount.objects.create(code="4300", name="Penalty Income", account_type="income", organization=org)

    cash_acc = CashAccount.objects.filter(name="Main Cash", organization=org).first()
    if not cash_acc:
        cash_acc = CashAccount.objects.create(
            name="Main Cash", account_type="cash", coa_account=coa_cash, organization=org
        )

    borrower = Borrower.objects.filter(email="borrower@test.com").first()
    if not borrower:
        borrower = Borrower.objects.create(
            first_name="Test", last_name="Borrower", email="borrower@test.com", 
            id_number="ID-COA-TEST", phone_number="254700000000", organization=org
        )

    product = LoanProduct.objects.filter(name="Standard Product").first()
    if product:
        product.delete() # Recreate to ensure settings
    product = LoanProduct.objects.create(
        name="Standard Product", min_amount=1000, max_amount=100000,
        interest_rate=10, penalty_rate=5, penalty_grace_period=5, organization=org
    )

    return org, admin_user, cash_acc, borrower, product

def create_test_loan(org, borrower, product):
    app = LoanApplication.objects.create(
        borrower=borrower, loan_product=product, requested_amount=10000,
        approved_amount=10000, status='approved', organization=org
    )
    loan = Loan.objects.create(
        application=app, borrower=borrower, loan_product=product,
        principal_amount=10000, total_interest=1000, tenure_value=10, 
        tenure_type='months', status='active', organization=org,
        disbursement_date=timezone.now().date() - timedelta(days=60),
        penalty_grace_period=5
    )
    # Create one overdue schedule
    due_date = timezone.now().date() - timedelta(days=10)
    RepaymentSchedule.objects.create(
        loan=loan, installment_number=1, due_date=due_date,
        principal_due=1000, interest_due=100, total_due=1100,
        status='overdue', penalty_due=50
    )
    loan.outstanding_principal = 10000
    loan.outstanding_interest = 1000
    loan.outstanding_penalties = 50
    loan.outstanding_balance = 11050
    loan.save()
    return loan

def test_coa_integrity_on_delete():
    print("\n--- Testing COA Integrity on Deletion ---")
    org, admin_user, cash_acc, borrower, product = setup_test_data()
    loan = create_test_loan(org, borrower, product)

    initial_coa_cash_balance = ChartOfAccount.objects.get(code="1110", organization=org).balance
    initial_cash_acc_balance = cash_acc.current_balance

    # Record a payment
    from apps.loans.services.payment_processor import PaymentProcessor
    repayment = PaymentProcessor().record_manual_payment(
        loan_id=loan.id, amount=1150, payment_method='cash',
        reference="REF-DELETE-TEST", payment_date=timezone.now().date(),
        user=admin_user, cash_account_id=cash_acc.id
    )

    after_pay_coa_cash_balance = ChartOfAccount.objects.get(code="1110", organization=org).balance
    after_pay_cash_acc_balance = CashAccount.objects.get(id=cash_acc.id).current_balance

    print(f"COA Cash After Payment: {after_pay_coa_cash_balance}")
    print(f"Cash Account After Payment: {after_pay_cash_acc_balance}")

    # Delete the payment
    repayment.delete()

    final_coa_cash_balance = ChartOfAccount.objects.get(code="1110", organization=org).balance
    final_cash_acc_balance = CashAccount.objects.get(id=cash_acc.id).current_balance

    print(f"COA Cash After Deletion: {final_coa_cash_balance}")
    print(f"Cash Account After Deletion: {final_cash_acc_balance}")

    if final_coa_cash_balance == initial_coa_cash_balance and final_cash_acc_balance == initial_cash_acc_balance:
        print("SUCCESS: COA and Cash Account balances reversed correctly.")
    else:
        print("FAILURE: Balances were not reversed correctly.")
        print(f"Expected COA: {initial_coa_cash_balance}, Got: {final_coa_cash_balance}")
        print(f"Expected Cash: {initial_cash_acc_balance}, Got: {final_cash_acc_balance}")

def test_coa_integrity_on_update():
    print("\n--- Testing COA Integrity on Date Update (Reconciliation) ---")
    org, admin_user, cash_acc, borrower, product = setup_test_data()
    loan = create_test_loan(org, borrower, product)

    # Initial state: 1 overdue installment with 50 penalty.
    # We record a LATE payment on today's date.
    from apps.loans.services.payment_processor import PaymentProcessor
    repayment = PaymentProcessor().record_manual_payment(
        loan_id=loan.id, amount=1150, payment_method='cash',
        reference="REF-UPDATE-TEST", payment_date=timezone.now().date(),
        user=admin_user, cash_account_id=cash_acc.id
    )

    penalty_income_acc = ChartOfAccount.objects.get(code="4300", organization=org)
    print(f"Penalty Income After Late Payment: {penalty_income_acc.balance}")
    
    # Verify Treasury Transaction amount
    treasury_tx = TreasuryTransaction.objects.get(reference=repayment.reference_number)
    print(f"Treasury Tx Amount: {treasury_tx.amount}")

    # Now update the payment date to be "on-time" (back-dated)
    # This should trigger reconciliation via view (simulated here)
    repayment.payment_date = loan.disbursement_date + timedelta(days=1)
    repayment.save()
    
    from apps.loans.services.reconciler import LoanReconciler
    LoanReconciler().reconcile_loan(loan.id)

    # After reconciliation:
    # 1. Penalty should be waived.
    # 2. Payment should be re-allocated to principal/interest ONLY.
    # 3. JournalEntry for the payment should be updated (waiving penalty credit).
    # 4. Penalty Income COA should be reversed/updated.

    penalty_income_acc.refresh_from_db()
    print(f"Penalty Income After Update & Reconcile: {penalty_income_acc.balance}")

    if penalty_income_acc.balance == Decimal('0.00'):
        print("SUCCESS: Penalty income reversed correctly via reconciler.")
    else:
        print(f"FAILURE: Penalty income not updated correctly. Got: {penalty_income_acc.balance}")

    # Check if Journal Entry exists and is balanced
    je = JournalEntry.objects.get(reference=repayment.reference_number)
    print(f"Journal Entry balanced: {je.is_balanced()}")
    for le in je.ledger_entries.all():
        print(f"  {le.account.code} - {le.entry_type}: {le.amount}")

if __name__ == "__main__":
    try:
        test_coa_integrity_on_delete()
        test_coa_integrity_on_update()
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
