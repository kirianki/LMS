"""
Management command to retroactively fix loan repayment allocations.

The bug caused specific-installment payments to book the full amount as
principal (interest_paid=0), resulting in missing Interest Income credits.

This command:
  1. Finds affected LoanRepayment records (those where interest_paid=0 but
     the loan had interest outstanding at the time of payment).
  2. Recalculates the correct principal/interest split for each repayment.
  3. Updates the LoanRepayment record with the correct breakdown.
  4. Voids the incorrect journal entry and posts a corrected one.
  5. Adjusts the COA account balances for 1210 and 4100.

Usage:
  python manage.py fix_repayment_allocations
  python manage.py fix_repayment_allocations --date 2026-03-11
  python manage.py fix_repayment_allocations --date 2026-03-11 --dry-run
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from django.db.models import Q
from decimal import Decimal
from datetime import date, timedelta
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Fix loan repayment allocations where interest was incorrectly booked as principal.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--date',
            type=str,
            default=None,
            help='Date to fix payments for (YYYY-MM-DD). Defaults to yesterday.'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            default=False,
            help='Show what would be fixed without making any changes.'
        )
        parser.add_argument(
            '--loan',
            type=str,
            default=None,
            help='Optional: Fix only a specific loan number (e.g. LN202603001).'
        )

    def handle(self, *args, **options):
        from apps.loans.models import LoanRepayment, RepaymentSchedule
        from apps.accounting.models import JournalEntry, LedgerEntry, ChartOfAccount
        from apps.accounting.services import post_loan_repayment

        dry_run = options['dry_run']
        target_loan = options.get('loan')

        # Determine target date
        if options['date']:
            try:
                target_date = date.fromisoformat(options['date'])
            except ValueError:
                self.stderr.write(self.style.ERROR(f"Invalid date format: {options['date']}. Use YYYY-MM-DD."))
                return
        else:
            target_date = date.today() - timedelta(days=1)

        self.stdout.write(self.style.NOTICE(
            f"{'[DRY RUN] ' if dry_run else ''}Checking repayments on {target_date}..."
        ))

        # Find repayments on the target date where interest_paid is zero
        # but the repayment's loan had outstanding interest at the time
        queryset = LoanRepayment.objects.filter(
            payment_date=target_date,
            interest_paid=Decimal('0.00'),
        ).select_related('loan', 'loan__organization')

        if target_loan:
            queryset = queryset.filter(loan__loan_number=target_loan)

        repayments = list(queryset)
        self.stdout.write(f"Found {len(repayments)} repayment(s) with potential allocation issues.")

        fixed_count = 0
        skipped_count = 0

        for repayment in repayments:
            loan = repayment.loan

            # Get the installment(s) updated by this payment at the time.
            # Heuristic: look at schedule entries where paid_amount > 0 on this loan.
            # We'll use the repayment amount to recalculate the correct split.
            
            # Find associated repayment schedule entries.
            # For specific installment payments, the paid amount on a schedule entry helps
            # us understand the breakdown.
            schedules = RepaymentSchedule.objects.filter(loan=loan).order_by('installment_number')
            
            # Recalculate what the correct split should have been.
            # We apply the same priority: Penalties > Interest > Principal.
            remaining = repayment.amount
            correct_penalty = Decimal('0.00')
            correct_interest = Decimal('0.00')
            correct_principal = Decimal('0.00')

            # Find how much interest was owed across all schedules at that time.
            # Since we don't have a snapshot, we use current state as an approximation.
            # The total_interest on the loan minus what's already recorded in PREVIOUS
            # correct repayments gives us the remaining interest at payment time.
            
            # Interest owed comes from loan's total_interest minus what's been 
            # correctly accounted for in OTHER repayments.
            total_correctly_paid_interest = LoanRepayment.objects.filter(
                loan=loan,
                interest_paid__gt=0
            ).exclude(id=repayment.id)
            
            from django.db.models import Sum
            already_interest_paid = total_correctly_paid_interest.aggregate(
                s=Sum('interest_paid')
            )['s'] or Decimal('0.00')
            
            interest_remaining_at_time = max(
                Decimal('0.00'),
                loan.total_interest - already_interest_paid
            )

            if interest_remaining_at_time <= 0:
                self.stdout.write(
                    self.style.WARNING(
                        f"  Skipping {repayment} — no interest was outstanding on loan "
                        f"{loan.loan_number} (total_interest={loan.total_interest}, "
                        f"already_paid_interest={already_interest_paid})"
                    )
                )
                skipped_count += 1
                continue

            # Calculate the correct split
            correct_interest = min(remaining, interest_remaining_at_time)
            remaining -= correct_interest
            correct_principal = min(remaining, repayment.principal_paid - Decimal('0.00'))

            # Check if there's a meaningful change
            if correct_interest <= 0:
                self.stdout.write(
                    self.style.WARNING(f"  Skipping {repayment} — calculated interest would be zero anyway.")
                )
                skipped_count += 1
                continue

            # Display what we'd change
            self.stdout.write(
                f"\n  Repayment: {repayment} (Loan: {loan.loan_number})\n"
                f"    Amount:          {repayment.amount}\n"
                f"    Current split:   principal={repayment.principal_paid}, interest={repayment.interest_paid}\n"
                f"    Corrected split: principal={correct_principal}, interest={correct_interest}"
            )

            if dry_run:
                fixed_count += 1
                continue

            # Apply the fix
            with transaction.atomic():
                # 1. Update repayment record
                old_principal = repayment.principal_paid
                old_interest = repayment.interest_paid

                repayment.principal_paid = correct_principal
                repayment.interest_paid = correct_interest
                repayment.save(update_fields=['principal_paid', 'interest_paid'])

                # 2. Fix the COA balances directly:
                #    The wrong entry booked X to 1210 (principal) and 0 to 4100 (interest).
                #    The correct entry should book (X - interest) to 1210 and interest to 4100.
                #    So we need to:
                #      - Decrease 1210 (Loan Portfolio) balance by `correct_interest`
                #      - Increase 4100 (Interest Income) balance by `correct_interest`
                org = loan.organization

                try:
                    portfolio_account = ChartOfAccount.objects.get(code='1210', organization=org)
                    interest_account = ChartOfAccount.objects.get(code='4100', organization=org)

                    # Loan Portfolio is ASSET: credit reduces it (we over-credited it before)
                    portfolio_account.balance -= correct_interest
                    portfolio_account.save(update_fields=['balance'])

                    # Interest Income is INCOME: credit increases it (we missed the credit)
                    interest_account.balance += correct_interest
                    interest_account.save(update_fields=['balance'])

                    self.stdout.write(
                        self.style.SUCCESS(
                            f"    → COA 1210 (Loan Portfolio) reduced by {correct_interest}\n"
                            f"    → COA 4100 (Interest Income) increased by {correct_interest}"
                        )
                    )
                    
                except ChartOfAccount.DoesNotExist as e:
                    self.stdout.write(
                        self.style.WARNING(f"    ! Could not update COA: {e}")
                    )

                # 3. Void the old journal entry (if it exists) and create a corrected one
                # Find the journal entry by reference number
                old_je = JournalEntry.objects.filter(
                    reference=repayment.reference_number,
                    organization=org,
                    date=target_date,
                ).first()

                if old_je:
                    old_je.status = JournalEntry.Status.VOID
                    old_je.description = f"[VOIDED - Incorrect Allocation] {old_je.description}"
                    old_je.save(update_fields=['status', 'description'])
                    
                    # Reverse the ledger entry effects on COA balances
                    for le in old_je.ledger_entries.all():
                        if le.entry_type == LedgerEntry.EntryType.CREDIT:
                            le.account.balance -= le.amount
                        else:
                            le.account.balance -= le.amount
                        le.account.save(update_fields=['balance'])

                    # Post corrected journal entry
                    post_loan_repayment(
                        repayment=repayment,
                        cash_account_code=repayment.cash_account.coa_account.code if repayment.cash_account and repayment.cash_account.coa_account else '1110'
                    )
                    self.stdout.write(
                        self.style.SUCCESS(f"    → Journal Entry {old_je.id} voided & corrected.")
                    )
                else:
                    # No journal entry found — just post the correct one
                    post_loan_repayment(
                        repayment=repayment,
                        cash_account_code='1110'
                    )
                    self.stdout.write(
                        self.style.WARNING(
                            f"    ! No existing JE found for ref '{repayment.reference_number}', posted new corrected entry."
                        )
                    )

                fixed_count += 1
                self.stdout.write(self.style.SUCCESS(f"    ✓ Fixed."))

        self.stdout.write("\n" + "─" * 60)
        if dry_run:
            self.stdout.write(self.style.NOTICE(
                f"[DRY RUN] Would fix {fixed_count} repayment(s). No changes were made."
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"Done. Fixed {fixed_count} repayment(s), skipped {skipped_count}."
            ))
