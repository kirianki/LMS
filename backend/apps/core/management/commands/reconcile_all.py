from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Sum
from decimal import Decimal
from django.utils import timezone
from apps.loans.models import Loan, LoanRepayment
from apps.accounting.models import ChartOfAccount, LedgerEntry, JournalEntry
from apps.accounts.models import Organization
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Hard-reconcile all loan balances, GL accounts, and interest accruals'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Check without making changes')

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        with transaction.atomic():
            self.stdout.write(self.style.MIGRATE_HEADING("--- Starting System-Wide Reconciliation ---"))

            # 1. Loan Balances Check & Fix (Previously missing)
            self.reconcile_loan_balances(dry_run)

            # 2. Interest Accrual Sync
            self.sync_interest_accruals(dry_run)

            # 3. COA Balance Recalculation
            self.recalculate_coa_balances(dry_run)

            if dry_run:
                self.stdout.write(self.style.WARNING("DRY RUN: No changes were committed."))
            else:
                self.stdout.write(self.style.SUCCESS("--- Reconciliation Complete and Committed ---"))

    def reconcile_loan_balances(self, dry_run):
        self.stdout.write("Checking Loan Balances...")
        loans = Loan.objects.filter(status__in=['active', 'defaulted'])
        count = 0
        for loan in loans:
            repayments_sum_p = LoanRepayment.objects.filter(loan=loan, status='completed').aggregate(p=Sum('principal_paid'))['p'] or Decimal('0.00')
            repayments_sum_i = LoanRepayment.objects.filter(loan=loan, status='completed').aggregate(i=Sum('interest_paid'))['i'] or Decimal('0.00')
            repayments_sum_pen = LoanRepayment.objects.filter(loan=loan, status='completed').aggregate(pen=Sum('penalty_paid'))['pen'] or Decimal('0.00')
            
            correct_principal = max(Decimal('0'), loan.principal_amount - repayments_sum_p)
            correct_interest = max(Decimal('0'), loan.total_interest - repayments_sum_i)
            
            total_penalties_due = sum(s.penalty_due for s in loan.schedules.all())
            correct_penalties = max(Decimal('0'), total_penalties_due - repayments_sum_pen)
            
            needs_update = (
                abs(loan.outstanding_principal - correct_principal) > Decimal('0.01') or
                abs(loan.outstanding_interest - correct_interest) > Decimal('0.01') or
                abs(loan.outstanding_penalties - correct_penalties) > Decimal('0.01')
            )
            
            if needs_update:
                self.stdout.write(f"  Fixing {loan.loan_number} Balances")
                if not dry_run:
                    loan.outstanding_principal = correct_principal
                    loan.outstanding_interest = correct_interest
                    loan.outstanding_penalties = correct_penalties
                    loan.outstanding_balance = correct_principal + correct_interest + correct_penalties
                    loan.save()
                    count += 1
        self.stdout.write(self.style.SUCCESS(f"Adjusted {count} loans."))

    def reverse_unhandled_voids(self, dry_run):
        self.stdout.write("Checking for unhandled VOIDED entries in GL...")
        voided_journals = JournalEntry.objects.filter(description__icontains="VOIDED")
        count = 0
        from apps.accounting.services import create_double_entry
        
        for journal in voided_journals:
            # Reversal check: search for an entry that reverses this journal's impact
            reference = f"REV-{journal.reference}"
            if not JournalEntry.objects.filter(reference=reference).exists():
                principal_credit = LedgerEntry.objects.filter(journal_entry=journal, account__code='1210', entry_type='credit').first()
                if principal_credit:
                    self.stdout.write(f"  Reversing un-offset VOID: {journal.reference} ({principal_credit.amount})")
                    if not dry_run:
                        create_double_entry(
                            date=journal.date,
                            description=f"REVERSAL of VOIDED: {journal.description}",
                            reference=reference,
                            debits=[('1210', principal_credit.amount)],
                            credits=[('1110', principal_credit.amount)],
                            organization=journal.organization
                        )
                        count += 1
        self.stdout.write(self.style.SUCCESS(f"Reversed {count} voided transactions."))

    def sync_interest_accruals(self, dry_run):
        self.stdout.write("Syncing Interest Accruals (GL 1220 vs Dashboard)...")
        from apps.accounting.services import create_double_entry
        for org in Organization.objects.all():
            total_interest = Loan.objects.filter(organization=org, status__in=['active', 'defaulted']).aggregate(i=Sum('outstanding_interest'))['i'] or Decimal('0.00')
            try:
                coa_1220 = ChartOfAccount.objects.get(code='1220', organization=org)
            except: continue
            
            diff = total_interest - coa_1220.balance
            if abs(diff) > Decimal('0.01'):
                self.stdout.write(f"  Adjusting 1220 for {org.company_name}: {coa_1220.balance} -> {total_interest}")
                if not dry_run:
                    create_double_entry(
                        date=timezone.now().date(),
                        description=f"Interest Accrual Sync",
                        reference=f"ACCRUE-{timezone.now().strftime('%Y%m%d')}",
                        debits=[('1220', diff)],
                        credits=[('4100', diff)],
                        organization=org
                    )
        self.stdout.write(self.style.SUCCESS("Interest sync complete."))

    def recalculate_coa_balances(self, dry_run):
        self.stdout.write("Recalculating all COA Balances from Ledger...")
        accounts = ChartOfAccount.objects.all()
        for account in accounts:
            debits = LedgerEntry.objects.filter(account=account, entry_type='debit').aggregate(s=Sum('amount'))['s'] or Decimal('0.00')
            credits = LedgerEntry.objects.filter(account=account, entry_type='credit').aggregate(s=Sum('amount'))['s'] or Decimal('0.00')
            
            if account.account_type in ['asset', 'expense']:
                correct_balance = debits - credits
            else:
                correct_balance = credits - debits
                
            if abs(account.balance - correct_balance) > Decimal('0.01'):
                if not dry_run:
                    account.balance = correct_balance
                    account.save()
        self.stdout.write(self.style.SUCCESS("COA balance recalculation complete."))
