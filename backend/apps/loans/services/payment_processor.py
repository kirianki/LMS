"""
Payment Processing Service

Handles payment allocation to loan installments and loan balance updates.

Allocation priority within each installment: Penalty → Interest → Principal
Installment order: oldest due-date first (chronic arrears cleared first).
"""
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)


class PaymentProcessor:
    """Handle payment allocation to installments and loan balance updates."""

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _apply_to_installment(installment, remaining: Decimal) -> dict:
        """
        Allocate `remaining` amount to a single installment following the
        Penalty → Interest → Principal priority.

        Uses the installment's own `penalty_paid`, `interest_paid`,
        `principal_paid` fields so multi-payment scenarios are handled
        correctly without any heuristics.

        Returns a dict with keys: penalty, interest, principal, remaining.
        """
        # --- Penalty ---
        penalty_remaining = max(Decimal('0'), installment.penalty_due - installment.penalty_paid)
        penalty_payment = min(remaining, penalty_remaining)
        remaining -= penalty_payment

        # --- Interest ---
        interest_remaining = max(Decimal('0'), installment.interest_due - installment.interest_paid)
        interest_payment = min(remaining, interest_remaining) if remaining > 0 else Decimal('0')
        remaining -= interest_payment

        # --- Principal ---
        principal_remaining = max(Decimal('0'), installment.principal_due - installment.principal_paid)
        principal_payment = min(remaining, principal_remaining) if remaining > 0 else Decimal('0')
        remaining -= principal_payment

        return {
            'penalty': penalty_payment,
            'interest': interest_payment,
            'principal': principal_payment,
            'remaining': remaining,
        }

    @staticmethod
    def _save_installment(installment, penalty_payment, interest_payment, principal_payment):
        """Persist per-bucket amounts and recompute aggregate + status."""
        installment.penalty_paid += penalty_payment
        installment.interest_paid += interest_payment
        installment.principal_paid += principal_payment
        installment.paid_amount = (
            installment.penalty_paid +
            installment.interest_paid +
            installment.principal_paid
        )

        total_due = installment.total_due + installment.penalty_due
        if installment.paid_amount >= total_due:
            installment.status = 'paid'
        elif installment.paid_amount > 0:
            installment.status = 'partial'

        installment.save()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @transaction.atomic
    def allocate_payment_to_installments(self, loan, amount, payment_date, repayment=None):
        """
        Allocate payment to installments (oldest-first).
        Priority per installment: Penalty → Interest → Principal.

        Returns dict: allocation breakdown totals.
        """
        remaining = Decimal(str(amount))
        allocation = {
            'penalties': Decimal('0'),
            'interest': Decimal('0'),
            'principal': Decimal('0'),
            'fees': Decimal('0'),
            'overpayment': Decimal('0'),
            'installments_paid': []
        }

        installments = loan.schedules.filter(
            status__in=['pending', 'partial', 'overdue']
        ).order_by('due_date')

        for installment in installments:
            if remaining <= 0:
                break

            result = self._apply_to_installment(installment, remaining)
            remaining = result['remaining']

            penalty_payment = result['penalty']
            interest_payment = result['interest']
            principal_payment = result['principal']
            total_paid_this = penalty_payment + interest_payment + principal_payment

            if total_paid_this > 0:
                self._save_installment(installment, penalty_payment, interest_payment, principal_payment)

            allocation['penalties'] += penalty_payment
            allocation['interest'] += interest_payment
            allocation['principal'] += principal_payment

            allocation['installments_paid'].append({
                'installment_id': str(installment.id),
                'installment_number': installment.installment_number,
                'amount': float(total_paid_this),
                'penalty': float(penalty_payment),
                'interest': float(interest_payment),
                'principal': float(principal_payment),
            })

        allocation['overpayment'] = remaining

        self._update_loan_balances(loan, allocation, payment_date)
        logger.info(f"Payment allocated for loan {loan.loan_number}: {allocation}")
        return allocation

    @transaction.atomic
    def record_manual_payment(self, loan_id, amount, payment_method,
                              reference, payment_date, user, installment_id=None, notes='',
                              cash_account_id=None):
        """
        Record manual payment from staff.

        Args:
            loan_id: UUID of the loan
            amount: Payment amount
            payment_method: cash | bank | mpesa | cheque
            reference: Payment reference number
            payment_date: Date of payment
            user: User recording the payment
            installment_id: Optional — pay a specific installment only
            notes: Optional notes
            cash_account_id: Treasury cash account id

        Returns:
            LoanRepayment instance
        """
        from ..models import Loan, LoanRepayment, RepaymentSchedule

        loan = Loan.objects.get(id=loan_id)

        if installment_id:
            # ---- Pay a specific installment --------------------------------
            installment = RepaymentSchedule.objects.get(id=installment_id, loan=loan)
            remaining = Decimal(str(amount))

            result = self._apply_to_installment(installment, remaining)
            penalty_payment = result['penalty']
            interest_payment = result['interest']
            principal_payment = result['principal']
            overpayment = result['remaining']

            self._save_installment(installment, penalty_payment, interest_payment, principal_payment)

            allocation = {
                'principal': principal_payment,
                'interest': interest_payment,
                'penalties': penalty_payment,
                'fees': Decimal('0'),
                'overpayment': overpayment,
            }

            self._update_loan_balances(loan, allocation, payment_date)

        else:
            # ---- Auto-allocate to oldest overdue installments --------------
            allocation = self.allocate_payment_to_installments(
                loan=loan,
                amount=amount,
                payment_date=payment_date,
            )

        repayment = LoanRepayment.objects.create(
            loan=loan,
            amount=amount,
            payment_date=payment_date,
            payment_method=payment_method,
            reference_number=reference,
            received_by=user,
            notes=notes,
            principal_paid=allocation['principal'],
            interest_paid=allocation['interest'],
            penalty_paid=allocation['penalties'],
            fee_paid=allocation['fees'],
            overpayment=allocation.get('overpayment', Decimal('0.00')),
            cash_account_id=cash_account_id,
        )

        logger.info(f"Manual payment recorded for loan {loan.loan_number}: {amount}")
        return repayment

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _update_loan_balances(loan, allocation, payment_date):
        """Update loan-level outstanding balances and status."""
        loan.outstanding_principal = max(Decimal('0'), loan.outstanding_principal - allocation['principal'])
        loan.outstanding_interest = max(Decimal('0'), loan.outstanding_interest - allocation['interest'])
        loan.outstanding_penalties = max(Decimal('0'), loan.outstanding_penalties - allocation['penalties'])
        loan.outstanding_balance = (
            loan.outstanding_principal +
            loan.outstanding_interest +
            loan.outstanding_penalties
        )

        if loan.outstanding_balance <= Decimal('0.01'):
            loan.status = 'paid_off'
            loan.closed_at = timezone.now()

            # --- AUTO-RELEASE COLLATERAL ---
            from apps.collateral.utils import auto_release_loan_collateral
            auto_release_loan_collateral(loan)

        loan.last_payment_date = payment_date
        loan.save()

        # Sync schedule statuses for consistency
        loan.sync_schedules()
