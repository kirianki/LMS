import os
import django
import sys
from decimal import Decimal

# Set up Django
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.loans.models import Loan, LoanRepayment, RepaymentSchedule
from apps.accounting.models import ChartOfAccount, LedgerEntry, JournalEntry
from django.db.models import Sum
from django.db import transaction

def reconcile():
    with transaction.atomic():
        print("Starting Portfolio and GL Reconciliation...")

        # 1. Identify 1210 Principal Receivable accounts
        coa_principal_accounts = ChartOfAccount.objects.filter(code='1210')
        print(f"Found {coa_principal_accounts.count()} Principal Receivable accounts (1210).")

        # 2. Reconcile Loans one by one
        all_loans = Loan.objects.filter(status__in=['active', 'defaulted'])
        total_loan_p_adj = 0
        
        for loan in all_loans:
            repayments_sum = LoanRepayment.objects.filter(loan=loan).aggregate(p=Sum('principal_paid'))['p'] or Decimal('0.00')
            correct_outstanding = loan.principal_amount - repayments_sum
            
            if loan.outstanding_principal != correct_outstanding:
                diff = correct_outstanding - loan.outstanding_principal
                print(f"Loan {loan.loan_number}: Current={loan.outstanding_principal}, Correct={correct_outstanding}, Diff={diff}")
                loan.outstanding_principal = correct_outstanding
                loan.outstanding_balance = correct_outstanding + loan.outstanding_interest + loan.outstanding_penalties
                loan.save()
                total_loan_p_adj += 1
        
        print(f"Adjusted {total_loan_p_adj} loans.")

        # 3. Handle VOIDED GL entries
        # Previous investigation showed 3 VOIDED entries totaling 107k
        voided_journals = JournalEntry.objects.filter(description__icontains="VOIDED")
        total_voided_reversal = 0
        
        for journal in voided_journals:
            # We check if this journal has a credit to 1210
            principal_ledger = LedgerEntry.objects.filter(journal_entry=journal, account__code='1210', entry_type='credit')
            for entry in principal_ledger:
                print(f"Found VOIDED Credit to 1210: {journal.description}, Amount: {entry.amount}")
                # To reverse it, we can either delete it or create a debit. 
                # Since it's a VOIDED entry that shouldn't have been there, deleting or offsetting is fine.
                # Let's create an offsetting Debit in a new Journal Entry to fix the balance properly.
                
                # Check if already reversed
                reversal_ref = f"REV-{journal.reference}"
                if not JournalEntry.objects.filter(reference=reversal_ref).exists():
                    from apps.accounting.services import create_double_entry
                    # Debit 1210 (restore receivable), Credit Cash (repay bank)
                    # NOTE: We assume the cash account was 1110 as per standard.
                    try:
                        create_double_entry(
                            date=journal.date,
                            description=f"REVERSAL of VOIDED: {journal.description}",
                            reference=reversal_ref,
                            debits=[('1210', entry.amount)],
                            credits=[('1110', entry.amount)],
                            organization=journal.organization
                        )
                        print(f"Created REVERSAL for {journal.reference}")
                        total_voided_reversal += 1
                    except Exception as e:
                        print(f"Error reversing {journal.reference}: {e}")

        print(f"Reversed {total_voided_reversal} voided transactions.")

        # 4. Reconcile COA balance field
        for account in ChartOfAccount.objects.all():
            ledger_debits = LedgerEntry.objects.filter(account=account, entry_type='debit').aggregate(s=Sum('amount'))['s'] or Decimal('0.00')
            ledger_credits = LedgerEntry.objects.filter(account=account, entry_type='credit').aggregate(s=Sum('amount'))['s'] or Decimal('0.00')
            
            # Asset/Expense: Debit - Credit
            # Liability/Equity/Income: Credit - Debit
            if account.account_type in ['asset', 'expense']:
                correct_balance = ledger_debits - ledger_credits
            else:
                correct_balance = ledger_credits - ledger_debits
                
            if account.balance != correct_balance:
                print(f"COA {account.code} ({account.name}): Current Balance={account.balance}, Correct={correct_balance}")
                account.balance = correct_balance
                account.save()

        print("Reconciliation Complete.")

if __name__ == "__main__":
    reconcile()
