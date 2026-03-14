"""
Management command to retroactively fix per-installment payment allocation fields.

After the fix, RepaymentSchedule now tracks:
  - penalty_paid    (how much penalty was collected on this installment)
  - interest_paid   (how much interest was collected on this installment)
  - principal_paid  (how much principal was collected on this installment)

Historic records have these at 0 because the fields didn't exist before.

This command:
  1. Finds all RepaymentSchedule records with paid_amount > 0 but zeroed buckets.
  2. Re-plays payments chronologically (oldest first) for each loan, applying the
     Penalty → Interest → Principal priority per installment.
  3. Writes the corrected bucket values to the schedule rows.
  4. Also corrects LoanRepayment.interest_paid / principal_paid / penalty_paid where
     the totals don't match the schedule breakdown.
  5. Adjusts COA account balances where Interest Income (4100) was under-recorded.

Usage:
  python manage.py fix_installment_allocations
  python manage.py fix_installment_allocations --dry-run
  python manage.py fix_installment_allocations --loan LN202603001
  python manage.py fix_installment_allocations --all
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Sum, Q
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Backfill per-installment payment allocation buckets (penalty_paid, interest_paid, principal_paid).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            default=False,
            help='Show what would change without saving anything.',
        )
        parser.add_argument(
            '--loan',
            type=str,
            default=None,
            help='Fix only a specific loan by loan_number (e.g. LN202603001).',
        )
        parser.add_argument(
            '--all',
            action='store_true',
            default=False,
            help='Process ALL loans even if they appear correct (useful for full re-sync).',
        )

    def handle(self, *args, **options):
        from apps.loans.models import Loan, RepaymentSchedule, LoanRepayment
        from apps.accounting.models import ChartOfAccount

        dry_run = options['dry_run']
        specific_loan = options.get('loan')
        process_all = options.get('all')

        self.stdout.write(self.style.NOTICE(
            f"{'[DRY RUN] ' if dry_run else ''}Starting installment allocation fix..."
        ))

        # ------------------------------------------------------------------ #
        # 1. Build query of loans to fix                                       #
        # ------------------------------------------------------------------ #
        loan_qs = Loan.objects.all().order_by('disbursement_date')

        if specific_loan:
            loan_qs = loan_qs.filter(loan_number=specific_loan)
        elif not process_all:
            # Only loans that have at least one schedule with paid_amount > 0 but zeroed buckets
            affected_loan_ids = RepaymentSchedule.objects.filter(
                loan__isnull=False,
                paid_amount__gt=0,
                interest_paid=Decimal('0'),
                principal_paid=Decimal('0'),
            ).values_list('loan_id', flat=True).distinct()
            loan_qs = loan_qs.filter(id__in=affected_loan_ids)

        total_loans = loan_qs.count()
        self.stdout.write(f"Found {total_loans} loan(s) to process.")

        fixed_schedules = 0
        fixed_repayments = 0
        coa_adjustments = []  # list of (org, delta_interest)

        for loan in loan_qs:
            result = self._fix_loan(loan, dry_run)
            fixed_schedules += result['schedules_fixed']
            fixed_repayments += result['repayments_fixed']
            if result['interest_delta'] != 0:
                coa_adjustments.append((loan.organization, result['interest_delta']))

        # ------------------------------------------------------------------ #
        # 2. Apply COA balance corrections                                     #
        # ------------------------------------------------------------------ #
        if not dry_run and coa_adjustments:
            self._apply_coa_corrections(coa_adjustments)

        # ------------------------------------------------------------------ #
        # 3. Summary                                                           #
        # ------------------------------------------------------------------ #
        self.stdout.write('\n' + '─' * 60)
        if dry_run:
            self.stdout.write(self.style.NOTICE(
                f"[DRY RUN] Would fix {fixed_schedules} schedule(s) across {total_loans} loan(s)."
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"Done. Fixed {fixed_schedules} schedule bucket(s) and {fixed_repayments} repayment record(s) "
                f"across {total_loans} loan(s)."
            ))

    # ---------------------------------------------------------------------- #

    def _fix_loan(self, loan, dry_run: bool) -> dict:
        """Re-play all payments for a loan and fix installment bucket fields."""
        from apps.loans.models import RepaymentSchedule, LoanRepayment

        schedules = list(
            loan.schedules.order_by('due_date', 'installment_number')
        )
        repayments = list(
            loan.repayments.order_by('payment_date', 'created_at')
        )

        if not schedules or not repayments:
            return {'schedules_fixed': 0, 'repayments_fixed': 0, 'interest_delta': Decimal('0')}

        # Reset in-memory buckets (we'll re-compute from scratch)
        for s in schedules:
            s._new_penalty_paid = Decimal('0')
            s._new_interest_paid = Decimal('0')
            s._new_principal_paid = Decimal('0')

        new_repayment_interest = {}   # repayment_id -> correct interest_paid
        new_repayment_principal = {}  # repayment_id -> correct principal_paid
        new_repayment_penalty = {}    # repayment_id -> correct penalty_paid

        for repayment in repayments:
            remaining = repayment.amount
            rep_interest = Decimal('0')
            rep_principal = Decimal('0')
            rep_penalty = Decimal('0')

            for s in schedules:
                if remaining <= 0:
                    break

                # Remaining capacity in each bucket for this installment
                penalty_cap = max(Decimal('0'), s.penalty_due - s._new_penalty_paid)
                interest_cap = max(Decimal('0'), s.interest_due - s._new_interest_paid)
                principal_cap = max(Decimal('0'), s.principal_due - s._new_principal_paid)

                total_cap = penalty_cap + interest_cap + principal_cap
                if total_cap <= 0:
                    continue  # installment fully paid

                # Apply: Penalty → Interest → Principal
                p_pay = min(remaining, penalty_cap)
                remaining -= p_pay
                s._new_penalty_paid += p_pay
                rep_penalty += p_pay

                i_pay = min(remaining, interest_cap) if remaining > 0 else Decimal('0')
                remaining -= i_pay
                s._new_interest_paid += i_pay
                rep_interest += i_pay

                pr_pay = min(remaining, principal_cap) if remaining > 0 else Decimal('0')
                remaining -= pr_pay
                s._new_principal_paid += pr_pay
                rep_principal += pr_pay

            new_repayment_interest[repayment.id] = rep_interest
            new_repayment_principal[repayment.id] = rep_principal
            new_repayment_penalty[repayment.id] = rep_penalty

        # ---- Calculate deltas ---------------------------------------------- #
        schedules_fixed = 0
        repayments_fixed = 0
        interest_delta = Decimal('0')

        for s in schedules:
            changed = (
                s._new_penalty_paid != s.penalty_paid or
                s._new_interest_paid != s.interest_paid or
                s._new_principal_paid != s.principal_paid
            )
            if changed:
                schedules_fixed += 1
                self.stdout.write(
                    f"  Schedule {loan.loan_number} #{s.installment_number}: "
                    f"penalty_paid {s.penalty_paid}→{s._new_penalty_paid}, "
                    f"interest_paid {s.interest_paid}→{s._new_interest_paid}, "
                    f"principal_paid {s.principal_paid}→{s._new_principal_paid}"
                )
                if not dry_run:
                    s.penalty_paid = s._new_penalty_paid
                    s.interest_paid = s._new_interest_paid
                    s.principal_paid = s._new_principal_paid
                    # Recompute aggregate paid_amount from buckets
                    s.paid_amount = s.penalty_paid + s.interest_paid + s.principal_paid
                    s.save(update_fields=['penalty_paid', 'interest_paid', 'principal_paid', 'paid_amount'])

        for repayment in repayments:
            correct_i = new_repayment_interest.get(repayment.id, Decimal('0'))
            correct_p = new_repayment_principal.get(repayment.id, Decimal('0'))
            correct_pen = new_repayment_penalty.get(repayment.id, Decimal('0'))

            changed = (
                abs(repayment.interest_paid - correct_i) > Decimal('0.01') or
                abs(repayment.principal_paid - correct_p) > Decimal('0.01') or
                abs(repayment.penalty_paid - correct_pen) > Decimal('0.01')
            )
            if changed:
                interest_delta += (correct_i - repayment.interest_paid)
                repayments_fixed += 1
                self.stdout.write(
                    f"  Repayment {repayment} on {repayment.payment_date}: "
                    f"interest {repayment.interest_paid}→{correct_i}, "
                    f"principal {repayment.principal_paid}→{correct_p}, "
                    f"penalty {repayment.penalty_paid}→{correct_pen}"
                )
                if not dry_run:
                    repayment.interest_paid = correct_i
                    repayment.principal_paid = correct_p
                    repayment.penalty_paid = correct_pen
                    repayment.save(update_fields=['interest_paid', 'principal_paid', 'penalty_paid'])

        return {
            'schedules_fixed': schedules_fixed,
            'repayments_fixed': repayments_fixed,
            'interest_delta': interest_delta,
        }

    def _apply_coa_corrections(self, adjustments):
        """Adjust Interest Income (4100) and Loan Portfolio (1210) COA balances."""
        from apps.accounting.models import ChartOfAccount
        from collections import defaultdict

        # Aggregate per org
        org_deltas = defaultdict(Decimal)
        for org, delta in adjustments:
            if org:
                org_deltas[org.id] = (org_deltas[org.id] + delta, org)

        for org_id, (delta, org) in org_deltas.items():
            if delta == 0:
                continue
            try:
                with transaction.atomic():
                    # Interest Income (4100) — income account: credit increases balance
                    interest_coa = ChartOfAccount.objects.get(code='4100', organization=org)
                    interest_coa.balance += delta
                    interest_coa.save(update_fields=['balance'])

                    # Loan Portfolio (1210) — asset account: was over-credited
                    portfolio_coa = ChartOfAccount.objects.get(code='1210', organization=org)
                    portfolio_coa.balance -= delta
                    portfolio_coa.save(update_fields=['balance'])

                    self.stdout.write(self.style.SUCCESS(
                        f"  COA org={org}: 4100 (Interest Income) {'+' if delta > 0 else ''}{delta}, "
                        f"1210 (Portfolio) {'-' if delta > 0 else '+'}{abs(delta)}"
                    ))
            except ChartOfAccount.DoesNotExist as e:
                self.stdout.write(self.style.WARNING(f"  Could not update COA for org {org}: {e}"))
