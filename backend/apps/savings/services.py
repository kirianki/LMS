from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from .models import SavingsAccount, SavingsTransaction, SavingsProduct

def process_deposit(account_id, amount, reference='', description='', user=None):
    """
    Process a deposit into a savings account.
    """
    amount = Decimal(str(amount))
    if amount <= 0:
        raise ValueError("Deposit amount must be positive")

    with transaction.atomic():
        account = SavingsAccount.objects.select_for_update().get(id=account_id)
        
        # Update balance
        account.current_balance += amount
        account.last_transaction_date = timezone.now()
        account.save()
        
        # Create transaction record
        txn = SavingsTransaction.objects.create(
            account=account,
            transaction_type=SavingsTransaction.TransactionType.DEPOSIT,
            amount=amount,
            balance_after=account.current_balance,
            reference=reference,
            description=description,
            performed_by=user
        )
        
        return txn

def process_withdrawal(account_id, amount, reference='', description='', user=None):
    """
    Process a withdrawal from a savings account.
    """
    amount = Decimal(str(amount))
    if amount <= 0:
        raise ValueError("Withdrawal amount must be positive")

    with transaction.atomic():
        account = SavingsAccount.objects.select_for_update().get(id=account_id)
        product = account.product
        
        # Check sufficient balance (including minimum balance requirement)
        available_balance = account.current_balance - product.minimum_balance
        if amount > available_balance:
            raise ValueError(f"Insufficient funds. Available: {available_balance}")
            
        # Update balance
        account.current_balance -= amount
        account.last_transaction_date = timezone.now()
        account.save()
        
        # Create transaction record
        txn = SavingsTransaction.objects.create(
            account=account,
            transaction_type=SavingsTransaction.TransactionType.WITHDRAWAL,
            amount=amount,
            balance_after=account.current_balance,
            reference=reference,
            description=description,
            performed_by=user
        )
        
        return txn

def calculate_daily_interest():
    """
    Periodic task to calculate daily interest accrual.
    Should be run daily (e.g., at midnight).
    """
    accounts = SavingsAccount.objects.filter(status=SavingsAccount.Status.ACTIVE)
    
    for account in accounts:
        product = account.product
        if product.interest_rate <= 0:
            continue
            
        # Daily rate = (Annual Rate / 100) / 365
        daily_rate = (product.interest_rate / Decimal('100')) / Decimal('365')
        
        # Calculate interest on current balance (simplified for daily_min for now)
        # In a full system, we might track the day's min balance specifically.
        daily_interest = account.current_balance * daily_rate
        
        # Accrue interest (not yet posted to current_balance)
        account.accrued_interest += daily_interest
        account.save()

def post_accrued_interest(account_id=None):
    """
    Post accumulated interest to the account balance.
    Usually run monthly.
    """
    accounts = SavingsAccount.objects.filter(accrued_interest__gt=0)
    if account_id:
        accounts = accounts.filter(id=account_id)
        
    for account in accounts:
        interest_to_post = account.accrued_interest
        
        with transaction.atomic():
            account.current_balance += interest_to_post
            account.accrued_interest = 0
            account.save()
            
            # Create transaction record
            SavingsTransaction.objects.create(
                account=account,
                transaction_type=SavingsTransaction.TransactionType.INTEREST,
                amount=interest_to_post,
                balance_after=account.current_balance,
                description=f"Interest posted for period"
            )
