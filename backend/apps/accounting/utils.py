from django.db import transaction
from .models import ChartOfAccount

def seed_standard_coa():
    """Seed standard Chart of Accounts."""
    coa_data = [
        # ASSETS (1000)
        {'code': '1000', 'name': 'Assets', 'account_type': 'asset', 'parent': None},
        {'code': '1100', 'name': 'Current Assets', 'account_type': 'asset', 'parent': '1000'},
        {'code': '1110', 'name': 'Cash at Bank', 'account_type': 'asset', 'parent': '1100'},
        {'code': '1120', 'name': 'Petty Cash', 'account_type': 'asset', 'parent': '1100'},
        {'code': '1130', 'name': 'M-Pesa Float', 'account_type': 'asset', 'parent': '1100'},
        {'code': '1200', 'name': 'Loan Portfolio', 'account_type': 'asset', 'parent': '1000'},
        {'code': '1210', 'name': 'Outstanding Principal', 'account_type': 'asset', 'parent': '1200'},
        {'code': '1220', 'name': 'Interest Receivable', 'account_type': 'asset', 'parent': '1200'},
        
        # LIABILITIES (2000)
        {'code': '2000', 'name': 'Liabilities', 'account_type': 'liability', 'parent': None},
        {'code': '2100', 'name': 'Current Liabilities', 'account_type': 'liability', 'parent': '2000'},
        {'code': '2200', 'name': 'Investor Capital', 'account_type': 'liability', 'parent': '2000'},
        
        # EQUITY (3000)
        {'code': '3000', 'name': 'Equity', 'account_type': 'equity', 'parent': None},
        {'code': '3100', 'name': 'Owner Equity', 'account_type': 'equity', 'parent': '3000'},
        {'code': '3200', 'name': 'Retained Earnings', 'account_type': 'equity', 'parent': '3000'},
        
        # INCOME (4000)
        {'code': '4000', 'name': 'Income', 'account_type': 'income', 'parent': None},
        {'code': '4100', 'name': 'Interest Income', 'account_type': 'income', 'parent': '4000'},
        {'code': '4200', 'name': 'Fee Income', 'account_type': 'income', 'parent': '4000'},
        {'code': '4300', 'name': 'Penalty Income', 'account_type': 'income', 'parent': '4000'},
        
        # EXPENSES (5000)
        {'code': '5000', 'name': 'Expenses', 'account_type': 'expense', 'parent': None},
        {'code': '5100', 'name': 'Operating Expenses', 'account_type': 'expense', 'parent': '5000'},
        {'code': '5200', 'name': 'Staff Payroll', 'account_type': 'expense', 'parent': '5000'},
        {'code': '5300', 'name': 'Investor Interest Expense', 'account_type': 'expense', 'parent': '5000'},
    ]

    with transaction.atomic():
        for item in coa_data:
            parent_code = item.pop('parent')
            parent = None
            if parent_code:
                parent = ChartOfAccount.objects.get(code=parent_code)
            
            ChartOfAccount.objects.update_or_create(
                code=item['code'],
                defaults={
                    'name': item['name'],
                    'account_type': item['account_type'],
                    'parent': parent
                }
            )
