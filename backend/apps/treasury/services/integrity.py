import logging
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from apps.treasury.models import Transaction as TreasuryTransaction, CashAccount
from apps.accounting.services import (
    post_loan_disbursement, post_loan_repayment, post_external_expense, 
    post_fee_income, post_investment_received, post_investor_payout
)
from apps.accounting.models import JournalEntry

logger = logging.getLogger(__name__)

def record_money_event(event_type, instance, cash_account_id=None, user=None):
    """
    Main entry point for recording money movements.
    Wraps both Treasury and Accounting in a single atomic transaction.
    """
    with transaction.atomic():
        try:
            if event_type == 'loan_disbursement':
                _handle_loan_disbursement(instance, cash_account_id, user)
            elif event_type == 'loan_repayment':
                _handle_loan_repayment(instance, cash_account_id, user)
            elif event_type == 'expense_paid':
                _handle_expense_paid(instance, cash_account_id, user)
            elif event_type == 'payroll_paid':
                _handle_payroll_paid(instance, cash_account_id, user)
            elif event_type == 'investment_received':
                _handle_investment_received(instance, cash_account_id, user)
            elif event_type == 'investor_payout':
                _handle_investor_payout(instance, cash_account_id, user)
        except Exception as e:
            logger.error(f"Financial sync error for {event_type} on {instance}: {str(e)}", exc_info=True)
            raise e

def _get_account(instance, cash_account_id=None, default_type=CashAccount.AccountType.BANK, organization=None):
    """Refined account selection logic, scoped by organization."""
    if cash_account_id:
        return CashAccount.objects.get(id=cash_account_id)
    
    org_filter = {'organization': organization} if organization else {}
    
    # Try to match based on method (M-Pesa etc.)
    method = getattr(instance, 'disbursement_method', getattr(instance, 'payment_method', None))
    if method == 'mpesa':
        account = CashAccount.objects.filter(account_type=CashAccount.AccountType.MOBILE_MONEY, is_active=True, **org_filter).first()
        if account: return account
        
    # Default to first active account of preferred type
    account = CashAccount.objects.filter(account_type=default_type, is_active=True, **org_filter).first()
    if not account:
        # Final fallback within org
        account = CashAccount.objects.filter(is_active=True, **org_filter).first()
        
    if not account:
        raise ValueError("No active cash account found for transaction.")
    return account

def _handle_loan_disbursement(loan, cash_account_id=None, user=None):
    """Synchronize Treasury and GL for disbursement, including withheld fees and refinancing."""
    account = _get_account(loan, cash_account_id, organization=loan.organization)
    application = loan.application
    
    # 1. State/Refinancing Logic (Calculate final cash movement)
    is_refinancing = bool(application.refinances_loan)
    payoff_amount = Decimal('0.00')
    if is_refinancing:
        old_loan = application.refinances_loan
        payoff_amount = (
            old_loan.outstanding_principal +
            old_loan.outstanding_interest +
            old_loan.outstanding_penalties
        )
        
        # Apply state changes (Closing old loan, link and metadata)
        from apps.loans.services.refinancing import apply_refinancing_state_changes
        apply_refinancing_state_changes(
            new_loan=loan,
            old_loan=old_loan,
            payoff_amount=payoff_amount,
            net_to_customer=loan.disbursed_amount
        )
        
        # Update application metadata for audit trail
        application.payoff_amount = payoff_amount
        application.net_disbursement = loan.disbursed_amount
        application.save()
    
    # Final cash out is the amount remaining after fees (disbursed_amount)
    net_cash_out = loan.disbursed_amount
    
    # 2. Treasury Recording (Actual Money Movement)
    if not TreasuryTransaction.objects.filter(
        related_loan=loan, 
        category=TreasuryTransaction.Category.LOAN_DISBURSEMENT
    ).exists():
        # Destination info
        details = loan.disbursement_details or {}
        dest_info = ""
        if loan.disbursement_method == 'mpesa':
            dest_info = f" to {details.get('phone_number', 'Unknown')}"
        elif loan.disbursement_method == 'bank_transfer':
            dest_info = f" to {details.get('bank_name', '')} {details.get('account_number', '')}"

        desc = f"Disbursement of loan {loan.loan_number} to {loan.borrower}{dest_info}"
        if is_refinancing:
            desc = f"Net Refinancing Disbursement: {loan.loan_number} pays off {application.refinances_loan.loan_number}"

        TreasuryTransaction.objects.create(
            account=account,
            transaction_type=TreasuryTransaction.TransactionType.DEBIT,
            category=TreasuryTransaction.Category.LOAN_DISBURSEMENT,
            amount=loan.principal_amount - payoff_amount,
            description=desc,
            reference=loan.disbursement_reference or loan.loan_number,
            related_loan=loan,
            created_by=user,
            created_at=timezone.now()
        )

    # 3. Record Withheld Deductions as Fee Income
    withheld_deductions = application.deductions.filter(is_withheld=True)
    total_fees = sum(d.calculated_amount for d in withheld_deductions)
    
    if total_fees > 0 and not TreasuryTransaction.objects.filter(
        related_loan=loan, 
        category=TreasuryTransaction.Category.FEE_INCOME
    ).exists():
        TreasuryTransaction.objects.create(
            account=account,
            transaction_type=TreasuryTransaction.TransactionType.CREDIT,
            category=TreasuryTransaction.Category.FEE_INCOME,
            amount=total_fees,
            description=f"Withheld fees from Loan {loan.loan_number}",
            reference=loan.loan_number,
            related_loan=loan,
            created_by=user,
            created_at=timezone.now()
        )

    # 4. Accounting (GL Sync)
    # Mapping for GL
    gl_code = '1130' if account.account_type == CashAccount.AccountType.MOBILE_MONEY else '1110'
    
    if not JournalEntry.objects.filter(reference=loan.loan_number).exists():
        payoff_details = None
        if is_refinancing:
            old_loan = application.refinances_loan
            payoff_details = {
                'old_loan_number': old_loan.loan_number,
                'principal': old_loan.outstanding_principal,
                'interest': old_loan.outstanding_interest,
                'penalties': old_loan.outstanding_penalties
            }
            
        post_loan_disbursement(
            loan, 
            cash_account_code=gl_code,
            payoff_details=payoff_details
        )
        
    if total_fees > 0 and not JournalEntry.objects.filter(reference=f"FEE-{loan.loan_number}").exists():
        # Group deductions by COA code
        breakdown = {}
        for d in withheld_deductions:
            # Fallback to 4200 if no specific COA linked
            coa_code = d.coa_account.code if d.coa_account else '4200'
            breakdown[coa_code] = breakdown.get(coa_code, Decimal('0.00')) + d.calculated_amount
            
        deductions_list = [{'coa_code': code, 'amount': amt} for code, amt in breakdown.items()]
        post_fee_income(loan, deductions_list, cash_account_code=gl_code)

def _handle_loan_repayment(repayment, cash_account_id=None, user=None):
    """Synchronize Treasury and GL for repayment."""
    # Prioritize the cash_account linked directly to the repayment (set during creation)
    account = repayment.cash_account
    if not account:
        account = _get_account(repayment, cash_account_id, organization=repayment.loan.organization)
    
    if not TreasuryTransaction.objects.filter(reference=repayment.reference_number).exists():
        TreasuryTransaction.objects.create(
            account=account,
            transaction_type=TreasuryTransaction.TransactionType.CREDIT,
            category=TreasuryTransaction.Category.LOAN_REPAYMENT,
            amount=repayment.amount,
            description=f"Repayment for loan {repayment.loan.loan_number} from {repayment.loan.borrower}",
            reference=repayment.reference_number,
            related_loan=repayment.loan,
            created_by=user,
            created_at=timezone.now()
        )
        
    # Accounting (GL)
    gl_code = '1130' if account.account_type == CashAccount.AccountType.MOBILE_MONEY else '1110'
    if not JournalEntry.objects.filter(reference=repayment.reference_number).exists():
        post_loan_repayment(repayment, cash_account_code=gl_code)

def void_repayment_financials(repayment):
    """
    Remove all financial records associated with a repayment.
    This is called when a repayment is deleted or before re-syncing.
    """
    with transaction.atomic():
        # 1. Void Ledger Entries and Journal Entry
        # Since we have CASCADE on LedgerEntry and our model-level delete override handles balance reversal,
        # we can just delete the Journal Entry.
        JournalEntry.objects.filter(reference=repayment.reference_number).delete()

        # 2. Void Treasury Transactions
        # Our model-level delete override on Transaction handles CashAccount balance reversal.
        TreasuryTransaction.objects.filter(reference=repayment.reference_number, related_loan=repayment.loan).delete()
        
        logger.info(f"Voided financial records for repayment {repayment.reference_number}")

def sync_repayment_financials(repayment):
    """
    Ensure accounting and treasury records match the repayment data.
    Usually called during reconciliation.
    """
    void_repayment_financials(repayment)
    _handle_loan_repayment(repayment)
    logger.info(f"Synchronized financial records for repayment {repayment.reference_number}")

def _handle_expense_paid(expense, cash_account_id=None, user=None):
    """Synchronize Treasury and GL for expenses."""
    account = _get_account(expense, cash_account_id, default_type=CashAccount.AccountType.CASH, organization=expense.organization)
    
    if not TreasuryTransaction.objects.filter(related_expense=expense).exists():
        TreasuryTransaction.objects.create(
            account=account,
            transaction_type=TreasuryTransaction.TransactionType.DEBIT,
            category=TreasuryTransaction.Category.EXPENSE,
            amount=expense.amount,
            description=f"Expense payment: {expense.description}",
            reference=expense.payment_reference or expense.expense_number,
            related_expense=expense,
            created_by=user,
            created_at=timezone.now()
        )
        
    # Accounting (GL)
    gl_code = '1120' if account.account_type == CashAccount.AccountType.CASH else '1110'
    if not JournalEntry.objects.filter(reference=expense.expense_number).exists():
        post_external_expense(expense, cash_account_code=gl_code)

def _handle_payroll_paid(payroll, cash_account_id=None, user=None):
    """Synchronize Treasury and GL for payroll payments."""
    account = _get_account(payroll, cash_account_id, organization=getattr(payroll.staff, 'organization', None))
    
    # 1. Treasury Recording
    desc = f"Payroll payment: {payroll.staff.employee_number} for {payroll.period}"
    if not TreasuryTransaction.objects.filter(
        reference=payroll.payment_reference,
        category=TreasuryTransaction.Category.PAYROLL
    ).exists():
        TreasuryTransaction.objects.create(
            account=account,
            transaction_type=TreasuryTransaction.TransactionType.DEBIT,
            category=TreasuryTransaction.Category.PAYROLL,
            amount=payroll.net_pay,
            description=desc,
            reference=payroll.payment_reference,
            created_by=user,
            created_at=timezone.now()
        )
        
    # 2. Accounting (GL)
    # Debit: Payroll Expense (5200)
    # Credit: Cash/Bank (1110)
    gl_code = '1120' if account.account_type == CashAccount.AccountType.CASH else '1110'
    if not JournalEntry.objects.filter(reference=payroll.payment_reference).exists():
        from apps.accounting.services import create_double_entry
        create_double_entry(
            date=payroll.payment_date or timezone.now().date(),
            description=desc,
            reference=payroll.payment_reference,
            debits=[('5200', payroll.net_pay)],
            credits=[(gl_code, payroll.net_pay)],
            organization=getattr(payroll, 'organization', None)
        )

def _handle_investment_received(investment, cash_account_id=None, user=None):
    """Synchronize Treasury and GL for investment received."""
    org = investment.investor.organization
    account = _get_account(investment, cash_account_id, organization=org)
    
    # 1. Treasury Recording
    if not TreasuryTransaction.objects.filter(reference=investment.investment_number).exists():
        TreasuryTransaction.objects.create(
            account=account,
            transaction_type=TreasuryTransaction.TransactionType.CREDIT,
            category=TreasuryTransaction.Category.INVESTMENT_RECEIVED,
            amount=investment.principal_amount,
            description=f"Investment received from {investment.investor.name}",
            reference=investment.investment_number,
            related_investment=investment,
            created_by=user,
            created_at=timezone.now()
        )
    
    # 2. Accounting (GL)
    gl_code = '1130' if account.account_type == CashAccount.AccountType.MOBILE_MONEY else '1110'
    if not JournalEntry.objects.filter(reference=investment.investment_number).exists():
        post_investment_received(investment, cash_account_code=gl_code)

def _handle_investor_payout(payout, cash_account_id=None, user=None):
    """Synchronize Treasury and GL for investor payout."""
    org = payout.investment.investor.organization
    account = _get_account(payout, cash_account_id, organization=org)
    ref = payout.reference or f"PAYOUT-{payout.id}"
    
    # 1. Treasury Recording
    if not TreasuryTransaction.objects.filter(reference=ref).exists():
        TreasuryTransaction.objects.create(
            account=account,
            transaction_type=TreasuryTransaction.TransactionType.DEBIT,
            category=TreasuryTransaction.Category.INVESTOR_PAYOUT,
            amount=payout.amount,
            description=f"{payout.get_payout_type_display()} payout for investment {payout.investment.investment_number}",
            reference=ref,
            related_investment=payout.investment,
            created_by=user,
            created_at=timezone.now()
        )
    
    # 2. Accounting (GL)
    gl_code = '1130' if account.account_type == CashAccount.AccountType.MOBILE_MONEY else '1110'
    if not JournalEntry.objects.filter(reference=ref).exists():
        post_investor_payout(payout, cash_account_code=gl_code)


def sync_treasury_coa_balance(cash_account):
    """
    Sync a CashAccount's linked COA account balance to match the treasury balance.
    Called after every treasury transaction to keep them in lockstep.
    """
    if not cash_account.coa_account:
        return
    
    coa = cash_account.coa_account
    if coa.balance != cash_account.current_balance:
        logger.info(
            f"Syncing COA {coa.code} balance: {coa.balance} → {cash_account.current_balance} "
            f"(treasury account: {cash_account.name})"
        )
        coa.balance = cash_account.current_balance
        coa.save(update_fields=['balance'])


def post_manual_treasury_transaction(transaction_instance):
    """
    Creates double-entry GL postings for manual treasury transactions.
    This is used when a user manually Adds or Withdraws money via the Treasury UI.
    """
    if not transaction_instance.counterparty_coa:
        return

    from apps.accounting.services import create_double_entry
    
    cash_coa = transaction_instance.account.coa_account
    if not cash_coa:
        logger.warning(f"Manual transaction {transaction_instance.id} skipped GL posting: CashAccount {transaction_instance.account.name} has no linked COA.")
        return

    description = transaction_instance.description or f"Treasury {transaction_instance.get_transaction_type_display()}: {transaction_instance.get_category_display()}"
    
    if transaction_instance.transaction_type == TreasuryTransaction.TransactionType.CREDIT:
        # Money In: Debit Cash (Asset Up) / Credit Counterparty (Liability/Equity Up or Income Up)
        debits = [(cash_coa.code, transaction_instance.amount)]
        credits = [(transaction_instance.counterparty_coa.code, transaction_instance.amount)]
    else:
        # Money Out: Debit Counterparty (Asset Down or Expense Up) / Credit Cash (Asset Down)
        debits = [(transaction_instance.counterparty_coa.code, transaction_instance.amount)]
        credits = [(cash_coa.code, transaction_instance.amount)]

    create_double_entry(
        date=transaction_instance.created_at.date() if transaction_instance.created_at else timezone.now().date(),
        description=description,
        reference=transaction_instance.reference or f"TRX-{str(transaction_instance.id)[:8].upper()}",
        debits=debits,
        credits=credits,
        organization=transaction_instance.organization
    )

