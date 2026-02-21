from django.db import transaction

def seed_standard_coa(organization):
    """Seed standard Chart of Accounts for a specific organization."""
    # Move import inside the function to break circular dependency
    from ..models import ChartOfAccount 

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
        {'code': '1230', 'name': 'Penalty Receivable', 'account_type': 'asset', 'parent': '1200'},
        {'code': '1240', 'name': 'Fee Receivable', 'account_type': 'asset', 'parent': '1200'},
        {'code': '1300', 'name': 'Fixed Assets', 'account_type': 'asset', 'parent': '1000'},
        {'code': '1310', 'name': 'Office Equipment', 'account_type': 'asset', 'parent': '1300'},
        {'code': '1320', 'name': 'Furniture & Fittings', 'account_type': 'asset', 'parent': '1300'},
        {'code': '1330', 'name': 'Accumulated Depreciation', 'account_type': 'asset', 'parent': '1300'},
        
        # LIABILITIES (2000)
        {'code': '2000', 'name': 'Liabilities', 'account_type': 'liability', 'parent': None},
        {'code': '2100', 'name': 'Current Liabilities', 'account_type': 'liability', 'parent': '2000'},
        {'code': '2110', 'name': 'Accounts Payable', 'account_type': 'liability', 'parent': '2100'},
        {'code': '2120', 'name': 'Tax Payable', 'account_type': 'liability', 'parent': '2100'},
        {'code': '2130', 'name': 'Accrued Expenses', 'account_type': 'liability', 'parent': '2100'},
        {'code': '2140', 'name': 'Customer Overpayments', 'account_type': 'liability', 'parent': '2100'},
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
        {'code': '4400', 'name': 'Other Income', 'account_type': 'income', 'parent': '4000'},
        
        # EXPENSES (5000)
        {'code': '5000', 'name': 'Expenses', 'account_type': 'expense', 'parent': None},
        {'code': '5100', 'name': 'Operating Expenses', 'account_type': 'expense', 'parent': '5000'},
        {'code': '5110', 'name': 'Rent Expense', 'account_type': 'expense', 'parent': '5100'},
        {'code': '5120', 'name': 'Utilities (Water/Elec)', 'account_type': 'expense', 'parent': '5100'},
        {'code': '5130', 'name': 'Communication (Internet/Airtime)', 'account_type': 'expense', 'parent': '5100'},
        {'code': '5140', 'name': 'Office Supplies', 'account_type': 'expense', 'parent': '5100'},
        {'code': '5150', 'name': 'Travel & Subsistence', 'account_type': 'expense', 'parent': '5100'},
        {'code': '5160', 'name': 'Marketing & Advertising', 'account_type': 'expense', 'parent': '5100'},
        {'code': '5170', 'name': 'Legal & Professional Fees', 'account_type': 'expense', 'parent': '5100'},
        {'code': '5180', 'name': 'Insurance Expense', 'account_type': 'expense', 'parent': '5100'},
        {'code': '5190', 'name': 'Repairs & Maintenance', 'account_type': 'expense', 'parent': '5100'},
        {'code': '5200', 'name': 'Staff Payroll', 'account_type': 'expense', 'parent': '5000'},
        {'code': '5210', 'name': 'Salaries & Wages', 'account_type': 'expense', 'parent': '5200'},
        {'code': '5220', 'name': 'Staff Benefits & Training', 'account_type': 'expense', 'parent': '5200'},
        {'code': '5300', 'name': 'Financial Expenses', 'account_type': 'expense', 'parent': '5000'},
        {'code': '5310', 'name': 'Bank Charges', 'account_type': 'expense', 'parent': '5300'},
        {'code': '5320', 'name': 'Investor Interest Expense', 'account_type': 'expense', 'parent': '5300'},
        {'code': '5330', 'name': 'Bad Debt Expense', 'account_type': 'expense', 'parent': '5300'},
        {'code': '5400', 'name': 'Depreciation & Amortization', 'account_type': 'expense', 'parent': '5000'},
        
        # OTHERS
        {'code': '9000', 'name': 'Suspense Account', 'account_type': 'asset', 'parent': None},
    ]

    with transaction.atomic():
        for item in coa_data:
            parent_code = item.pop('parent')
            parent = None
            if parent_code:
                # Use filter().first() with organization
                parent = ChartOfAccount.objects.filter(code=parent_code, organization=organization).first()
            
            ChartOfAccount.objects.update_or_create(
                code=item['code'],
                organization=organization,
                defaults={
                    'name': item['name'],
                    'account_type': item['account_type'],
                    'parent': parent
                }
            )