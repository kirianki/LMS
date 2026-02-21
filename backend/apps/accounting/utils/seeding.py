from apps.accounting.models import ChartOfAccount

def seed_default_coa():
    """
    Seeds the default Chart of Accounts for a new tenant.
    This should be called inside a tenant schema context.
    """
    
    # 1. Assets (1000-1999)
    assets = [
        ('1110', 'Cash on Hand / Bank', 'asset'),
        ('1120', 'Petty Cash', 'asset'),
        ('1130', 'Mobile Money (M-Pesa)', 'asset'),
        ('1210', 'Loan Portfolio', 'asset'),
        ('1510', 'Furniture & Equipment', 'asset'),
    ]
    
    # 2. Liabilities (2000-2999)
    liabilities = [
        ('2110', 'Savings Deposits', 'liability'),
        ('2140', 'Loan Overpayments', 'liability'),
        ('2200', 'Accounts Payable', 'liability'),
        ('2300', 'Tax Payable', 'liability'),
    ]
    
    # 3. Equity (3000-3999)
    equity = [
        ('3100', 'Owner\'s Equity', 'equity'),
        ('3200', 'Retained Earnings', 'equity'),
    ]
    
    # 4. Income (4000-4999)
    income = [
        ('4100', 'Interest Income', 'income'),
        ('4200', 'Fee Income', 'income'),
        ('4300', 'Penalty Income', 'income'),
        ('4400', 'Other Income', 'income'),
    ]
    
    # 5. Expenses (5000-5999)
    expenses = [
        ('5100', 'Operating Expenses', 'expense'),
        ('5110', 'Office Rent', 'expense'),
        ('5120', 'Utilities', 'expense'),
        ('5130', 'Internet & Communication', 'expense'),
        ('5140', 'Stationery & Printing', 'expense'),
        ('5150', 'Transport & Travel', 'expense'),
        ('5160', 'Marketing & Advertising', 'expense'),
        ('5200', 'Salaries & Wages', 'expense'),
        ('5210', 'Savings Interest Expense', 'expense'),
        ('5300', 'Bad Debt Expense', 'expense'),
        ('5400', 'Bank Charges', 'expense'),
        ('5500', 'Legal & Professional Fees', 'expense'),
        ('5900', 'Miscellaneous Expenses', 'expense'),
    ]
    
    all_accounts = assets + liabilities + equity + income + expenses
    
    created_count = 0
    for code, name, type_ in all_accounts:
        _, created = ChartOfAccount.objects.get_or_create(
            code=code,
            defaults={
                'name': name,
                'account_type': type_,
                'is_active': True
            }
        )
        if created:
            created_count += 1
            
    return created_count
