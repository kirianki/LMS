from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Sum, Q
from decimal import Decimal
import logging

from apps.treasury.models import Transaction, CashAccount
from apps.loans.models import Loan

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Fix historical Treasury data drift caused by the old disbursement math bug.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Starting Historical Treasury Audit & Repair..."))
        
        with transaction.atomic():
            # Step 1: Fix bad Treasury Transactions
            disbursement_txns = Transaction.objects.filter(
                category=Transaction.Category.LOAN_DISBURSEMENT,
                related_loan__isnull=False
            )
            
            fixed_txns = 0
            for t in disbursement_txns:
                loan = t.related_loan
                # Calculate correct disbursement net outflow
                payoff_amount = Decimal('0.00')
                if loan.application and loan.application.refinances_loan:
                    old_loan = loan.application.refinances_loan
                    payoff_amount = (
                        old_loan.outstanding_principal +
                        old_loan.outstanding_interest +
                        old_loan.outstanding_penalties
                    )
                correct_amount = loan.principal_amount - payoff_amount
                
                if t.amount != correct_amount:
                    old_amount = t.amount
                    t.amount = correct_amount
                    t.save(update_fields=['amount'])
                    fixed_txns += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"Fixed Txn {t.id} (Loan {loan.loan_number}): "
                            f"{old_amount} -> {correct_amount}"
                        )
                    )
            
            self.stdout.write(self.style.SUCCESS(f"\nPhase 1 Complete: {fixed_txns} Transaction(s) repaired."))
            
            # Step 2: Recalculate CashAccount Balances
            fixed_accounts = 0
            accounts = CashAccount.objects.filter(is_active=True)
            for ca in accounts:
                txns = Transaction.objects.filter(account=ca)
                
                total_credits = txns.filter(transaction_type=Transaction.TransactionType.CREDIT).aggregate(
                    total=Sum('amount'))['total'] or Decimal('0.00')
                    
                total_debits = txns.filter(transaction_type=Transaction.TransactionType.DEBIT).aggregate(
                    total=Sum('amount'))['total'] or Decimal('0.00')
                
                correct_balance = ca.opening_balance + total_credits - total_debits
                
                if ca.current_balance != correct_balance:
                    old_bal = ca.current_balance
                    ca.current_balance = correct_balance
                    ca.save(update_fields=['current_balance'])
                    fixed_accounts += 1
                    self.stdout.write(
                        self.style.WARNING(
                            f"Recalculated CashAccount '{ca.name}': "
                            f"{old_bal} -> {correct_balance}"
                        )
                    )
                
                # Verify match with COA
                if ca.coa_account:
                    if ca.current_balance != ca.coa_account.balance:
                        self.stdout.write(
                            self.style.ERROR(
                                f"CRITICAL: {ca.name} Treasury ({ca.current_balance}) "
                                f"still does not match COA {ca.coa_account.code} ({ca.coa_account.balance})"
                            )
                        )
                    else:
                        self.stdout.write(
                            self.style.SUCCESS(f"Account '{ca.name}' perfectly matches its GL Ledger!")
                        )
                        
            self.stdout.write(self.style.SUCCESS(f"\nPhase 2 Complete: {fixed_accounts} CashAccount(s) recalculated."))
            self.stdout.write(self.style.SUCCESS("Audit & Repair Finished Successfully!"))
