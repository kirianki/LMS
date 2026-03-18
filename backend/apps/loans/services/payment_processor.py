"""
Payment Processing Service

Handles payment allocation to loan installments and loan balance updates.

Allocation priority within each installment: Penalty → Interest → Principal
Installment order: oldest due-date first (chronic arrears cleared first).
"""
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
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
    def _save_installment(installment, penalty_payment, interest_payment, principal_payment, payment_date=None, loan=None):
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

    @staticmethod
    def _waive_on_time_penalties(installment, payment_date, loan):
        """
        Check if the payment was made on or before the arrears date (due_date + grace).
        If so, any remaining penalty for this specific installment should be waived.
        Returns the waived amount.
        """
        if payment_date and hasattr(loan, 'penalty_grace_period'):
            arrears_date = installment.due_date + timedelta(days=loan.penalty_grace_period)
            if payment_date <= arrears_date:
                remaining_penalty = max(Decimal('0'), installment.penalty_due - installment.penalty_paid)
                if remaining_penalty > 0:
                    waived_amount = remaining_penalty
                    installment.penalty_due = installment.penalty_paid
                    
                    # Also update loan-level outstanding penalties
                    loan.outstanding_penalties -= waived_amount
                    loan.outstanding_balance -= waived_amount
                    loan.save(update_fields=['outstanding_penalties', 'outstanding_balance'])
                    
                    logger.info(f"Waived {waived_amount} penalty for installment {installment.installment_number} due to on-time back-dated payment.")
                    return waived_amount
        return Decimal('0')

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @transaction.atomic
    def allocate_payment_to_installments(self, loan, amount, payment_date=None, repayment=None):
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

            # Waive penalties if payment is on-time (back-dated)
            self._waive_on_time_penalties(installment, payment_date, loan)

            result = self._apply_to_installment(installment, remaining)
            remaining = result['remaining']

            penalty_payment = result['penalty']
            interest_payment = result['interest']
            principal_payment = result['principal']
            total_paid_this = penalty_payment + interest_payment + principal_payment

            if total_paid_this > 0:
                self._save_installment(installment, penalty_payment, interest_payment, principal_payment, payment_date, loan)

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

        # ---- Back-dating Restriction ----
        today = timezone.now().date()
        if payment_date < today:
            is_admin = user.is_superuser or (
                hasattr(user, 'role') and user.role and user.role.name in ['Admin', 'Company Administrator', 'System Administrator', 'Admin_org']
            )
            if not is_admin:
                raise PermissionError("Only administrators can back-date transactions.")

        if installment_id:
            # ---- Pay a specific installment --------------------------------
            installment = RepaymentSchedule.objects.get(id=installment_id, loan=loan)
            remaining = Decimal(str(amount))

            # Waive penalties if payment is on-time (back-dated)
            self._waive_on_time_penalties(installment, payment_date, loan)

            result = self._apply_to_installment(installment, remaining)
            penalty_payment = result['penalty']
            interest_payment = result['interest']
            principal_payment = result['principal']
            overpayment = result['remaining']

            self._save_installment(installment, penalty_payment, interest_payment, principal_payment, payment_date, loan)

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

    @transaction.atomic
    def void_repayment(self, repayment_id, user, notes=''):
        """
        Void an existing repayment, reversing all balance impacts and creating
        a reversal journal entry in the GL.
        """
        from ..models import LoanRepayment, RepaymentSchedule
        from apps.accounting.services import create_double_entry
        from apps.accounting.models import JournalEntry, LedgerEntry

        repayment = LoanRepayment.objects.select_for_update().get(id=repayment_id)
        if repayment.status == 'voided':
            raise ValueError("Repayment is already voided.")

        loan = repayment.loan
        
        # 1. Reverse Loan Balances
        loan.outstanding_principal += repayment.principal_paid
        loan.outstanding_interest += repayment.interest_paid
        loan.outstanding_penalties += repayment.penalty_paid
        loan.outstanding_balance = (
            loan.outstanding_principal +
            loan.outstanding_interest +
            loan.outstanding_penalties
        )
        
        if loan.status == 'paid_off' and loan.outstanding_balance > 0:
            loan.status = 'active'
            loan.closed_at = None
            
        loan.save()

        # 2. Reverse Installment Progress
        # We need to find which installments this repayment touched. 
        # Since we don't have a direct M2M, we re-sync based on remaining balance
        # or we could have stored the allocation. 
        # For now, we restore the principal/interest/penalty paid on installments
        # that were likely touched (those with paid_amount > 0 and recently updated).
        # Actually, the most robust way is to re-sync all schedules for this loan.
        
        # We'll re-calculate installment 'paid' fields by subtracting the revoked amount
        # starting from the newest paid installments (Last-In-First-Out reversal).
        rev_p = repayment.principal_paid
        rev_i = repayment.interest_paid
        rev_pen = repayment.penalty_paid
        
        installments = loan.schedules.filter(paid_amount__gt=0).order_by('-due_date')
        for inst in installments:
            # Reverse Penalty
            p_to_rev = min(inst.penalty_paid, rev_pen)
            inst.penalty_paid -= p_to_rev
            rev_pen -= p_to_rev
            
            # Reverse Interest
            i_to_rev = min(inst.interest_paid, rev_i)
            inst.interest_paid -= i_to_rev
            rev_i -= i_to_rev
            
            # Reverse Principal
            pr_to_rev = min(inst.principal_paid, rev_p)
            inst.principal_paid -= pr_to_rev
            rev_p -= pr_to_rev
            
            inst.paid_amount = inst.principal_paid + inst.interest_paid + inst.penalty_paid
            if inst.paid_amount <= 0:
                inst.status = 'pending' # Or 'overdue' if due_date < today
                if inst.due_date < timezone.now().date():
                    inst.status = 'overdue'
            else:
                inst.status = 'partial'
            inst.save()

        # 3. Create Accounting Reversal
        # We find the original journal entry if possible, or just create an offsetting one.
        original_journal = JournalEntry.objects.filter(reference=repayment.reference_number).first()
        
        # Reversal: Debit Income/Receivable, Credit Cash
        # Actually: Debit 1210 (Principal), Debit 1220 (Interest), Credit Cash (1110)
        # Note: We use 1210 and 1220 as they are the receivables.
        debits = []
        if repayment.principal_paid > 0: debits.append(('1210', repayment.principal_paid))
        if repayment.interest_paid > 0: debits.append(('4100', repayment.interest_paid)) # Credit Income was used, so Debit Income to reverse
        if repayment.penalty_paid > 0: debits.append(('4300', repayment.penalty_paid))
        
        total_rev = sum(amt for _, amt in debits)
        
        if total_rev > 0:
            create_double_entry(
                date=timezone.now().date(),
                description=f"VOID REPAYMENT: {repayment.reference_number} for {loan.loan_number}",
                reference=f"VOID-{repayment.reference_number}",
                debits=debits,
                credits=[('1110', total_rev)],
                organization=loan.organization,
                created_by=user
            )

        # 4. Mark Repayment as Voided
        repayment.status = 'voided'
        repayment.voided_at = timezone.now()
        repayment.voided_by = user
        repayment.notes = f"{repayment.notes}\nVOIDED by {user.get_full_name()} on {timezone.now()}: {notes}"
        repayment.save()

        # Final Sync
        loan.sync_schedules()
        
        logger.info(f"Repayment {repayment.reference_number} voided by {user}")
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
