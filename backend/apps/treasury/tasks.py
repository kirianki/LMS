from celery import shared_task
from django.utils import timezone
from django.db.models import Sum, Q
from .models import CashAccount, DailySnapshot, Transaction
from apps.loans.models import Loan, RepaymentSchedule
from apps.investors.models import Investment, InvestorPayout
from apps.expenses.models import Expense
import logging

logger = logging.getLogger(__name__)


@shared_task
def create_daily_financial_snapshots():
    """Create daily financial snapshots for the system."""
    today = timezone.now().date()
    
    try:
        # 1. Total Cash across all accounts
        total_cash = CashAccount.objects.filter(is_active=True).aggregate(
            total=Sum('current_balance'))['total'] or 0
        
        # 2. Loan metrics
        loan_metrics = Loan.objects.filter(status='active').aggregate(
            principal=Sum('outstanding_principal'),
            interest=Sum('outstanding_interest')
        )
        
        # 3. Daily activity
        daily_activity = Transaction.objects.filter(created_at__date=today).aggregate(
            disbursed=Sum('amount', filter=Q(transaction_type=Transaction.TransactionType.DEBIT)),
            received=Sum('amount', filter=Q(transaction_type=Transaction.TransactionType.CREDIT))
        )
        
        # 4. Projections (expected next 30 days)
        from datetime import timedelta
        future_30d = today + timedelta(days=30)
        expected_collections = RepaymentSchedule.objects.filter(
            due_date__range=[today, future_30d],
            status__in=['pending', 'partial']
        ).aggregate(total=Sum('principal_due') + Sum('interest_due'))['total'] or 0
        
        # Create or update snapshot
        DailySnapshot.objects.update_or_create(
            date=today,
            defaults={
                'total_cash': total_cash,
                'outstanding_principal': loan_metrics['principal'] or 0,
                'outstanding_interest': loan_metrics['interest'] or 0,
                'total_disbursed': daily_activity['disbursed'] or 0,
                'total_received': daily_activity['received'] or 0,
                'expected_collections_30d': expected_collections,
            }
        )
        
        logger.info(f"Financial snapshot created for {today}")
        
    except Exception as e:
        logger.error(f"Error creating financial snapshot: {str(e)}")


@shared_task
def reconcile_treasury_coa():
    """
    Periodic reconciliation: ensures every Treasury CashAccount balance
    matches its linked COA account balance (derived from posted ledger entries).
    
    This is a safety net — the real-time sync happens via the post_save signal
    on Transaction. This task catches any drift that slipped through.
    """
    from decimal import Decimal
    from apps.accounting.models import LedgerEntry
    
    accounts = CashAccount.objects.filter(
        coa_account__isnull=False, is_active=True
    ).select_related('coa_account')
    
    discrepancies = []
    
    for ca in accounts:
        coa = ca.coa_account
        
        # Recalculate COA balance from ledger entries (source of truth)
        entries = LedgerEntry.objects.filter(account=coa, is_posted=True)
        debits = entries.filter(entry_type='debit').aggregate(
            total=Sum('amount'))['total'] or Decimal('0.00')
        credits = entries.filter(entry_type='credit').aggregate(
            total=Sum('amount'))['total'] or Decimal('0.00')
        
        if coa.account_type in ['asset', 'expense']:
            correct_balance = debits - credits
        else:
            correct_balance = credits - debits
        
        # Check for COA balance drift (vs ledger entries)
        if coa.balance != correct_balance:
            logger.warning(
                f"COA DRIFT: {coa.code} {coa.name} | "
                f"stored={coa.balance}, correct={correct_balance} "
                f"(diff={coa.balance - correct_balance})"
            )
            coa.balance = correct_balance
            coa.save(update_fields=['balance'])
            discrepancies.append({
                'account': coa.code,
                'type': 'coa_ledger_drift',
                'old': str(coa.balance),
                'corrected': str(correct_balance),
            })
        
        # Check Treasury vs corrected COA balance
        if ca.current_balance != correct_balance:
            logger.warning(
                f"TREASURY-COA MISMATCH: {ca.name} treasury={ca.current_balance}, "
                f"COA {coa.code}={correct_balance} "
                f"(diff={ca.current_balance - correct_balance})"
            )
            discrepancies.append({
                'account': ca.name,
                'type': 'treasury_coa_mismatch',
                'treasury': str(ca.current_balance),
                'coa': str(correct_balance),
            })
    
    if discrepancies:
        logger.warning(f"Reconciliation found {len(discrepancies)} discrepancies: {discrepancies}")
    else:
        logger.info("Reconciliation complete: all balances consistent.")
    
    return {'discrepancies': len(discrepancies), 'checked': accounts.count()}
