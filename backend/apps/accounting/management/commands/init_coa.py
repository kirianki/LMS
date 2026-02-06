from django.core.management.base import BaseCommand
from apps.accounting.models import ChartOfAccount


class Command(BaseCommand):
    help = 'Initialize Chart of Accounts with standard GL codes for MFI/SACCO operations'

    def handle(self, *args, **options):
        """
        Standard Chart of Accounts for Microfinance Institutions
        Based on common MFI accounting practices
        """
        
        accounts = [
            # ASSETS (1000-1999)
            {'code': '1000', 'name': 'ASSETS', 'account_type': 'asset', 'parent': None},
            
            # Current Assets (1100-1199)
            {'code': '1100', 'name': 'Current Assets', 'account_type': 'asset', 'parent': '1000'},
            {'code': '1110', 'name': 'Bank Account', 'account_type': 'asset', 'parent': '1100', 
             'description': 'Main bank account for operations'},
            {'code': '1120', 'name': 'Cash on Hand', 'account_type': 'asset', 'parent': '1100',
             'description': 'Physical cash in office/tills'},
            {'code': '1130', 'name': 'Mobile Money Account (M-Pesa)', 'account_type': 'asset', 'parent': '1100',
             'description': 'Mobile money wallet balance'},
            {'code': '1140', 'name': 'Petty Cash', 'account_type': 'asset', 'parent': '1100'},
            
            # Loan Portfolio (1200-1299)
            {'code': '1200', 'name': 'Loan Portfolio', 'account_type': 'asset', 'parent': '1000'},
            {'code': '1210', 'name': 'Loans Receivable - Principal', 'account_type': 'asset', 'parent': '1200',
             'description': 'Outstanding principal on active loans'},
            {'code': '1220', 'name': 'Accrued Interest Receivable', 'account_type': 'asset', 'parent': '1200',
             'description': 'Interest earned but not yet collected'},
            {'code': '1230', 'name': 'Loan Loss Provision', 'account_type': 'asset', 'parent': '1200',
             'description': 'Allowance for doubtful loans (contra-asset)'},
            
            # Fixed Assets (1300-1399)
            {'code': '1300', 'name': 'Fixed Assets', 'account_type': 'asset', 'parent': '1000'},
            {'code': '1310', 'name': 'Office Equipment', 'account_type': 'asset', 'parent': '1300'},
            {'code': '1320', 'name': 'Furniture & Fixtures', 'account_type': 'asset', 'parent': '1300'},
            {'code': '1330', 'name': 'Accumulated Depreciation', 'account_type': 'asset', 'parent': '1300',
             'description': 'Contra-asset account'},
            
            # LIABILITIES (2000-2999)
            {'code': '2000', 'name': 'LIABILITIES', 'account_type': 'liability', 'parent': None},
            
            # Current Liabilities (2100-2199)
            {'code': '2100', 'name': 'Current Liabilities', 'account_type': 'liability', 'parent': '2000'},
            {'code': '2110', 'name': 'Member Savings Deposits', 'account_type': 'liability', 'parent': '2100',
             'description': 'Customer savings account balances'},
            {'code': '2120', 'name': 'Accrued Interest Payable', 'account_type': 'liability', 'parent': '2100',
             'description': 'Interest owed on savings accounts'},
            {'code': '2130', 'name': 'Accounts Payable', 'account_type': 'liability', 'parent': '2100'},
            {'code': '2140', 'name': 'Payroll Payable', 'account_type': 'liability', 'parent': '2100'},
            
            # Long-term Liabilities (2200-2299)
            {'code': '2200', 'name': 'Long-term Liabilities', 'account_type': 'liability', 'parent': '2000'},
            {'code': '2210', 'name': 'Bank Loans Payable', 'account_type': 'liability', 'parent': '2200',
             'description': 'Loans from banks/financial institutions'},
            
            # EQUITY (3000-3999)
            {'code': '3000', 'name': 'EQUITY', 'account_type': 'equity', 'parent': None},
            {'code': '3100', 'name': 'Share Capital', 'account_type': 'equity', 'parent': '3000',
             'description': 'Member share contributions'},
            {'code': '3200', 'name': 'Retained Earnings', 'account_type': 'equity', 'parent': '3000'},
            {'code': '3300', 'name': 'Current Year Earnings', 'account_type': 'equity', 'parent': '3000'},
            
            # INCOME (4000-4999)
            {'code': '4000', 'name': 'INCOME', 'account_type': 'income', 'parent': None},
            
            # Operating Income (4100-4399)
            {'code': '4100', 'name': 'Interest Income on Loans', 'account_type': 'income', 'parent': '4000',
             'description': 'Interest earned from loan portfolio'},
            {'code': '4200', 'name': 'Fee Income', 'account_type': 'income', 'parent': '4000',
             'description': 'Processing fees, service charges, etc.'},
            {'code': '4300', 'name': 'Penalty Income', 'account_type': 'income', 'parent': '4000',
             'description': 'Late payment penalties and fines'},
            {'code': '4400', 'name': 'Other Income', 'account_type': 'income', 'parent': '4000'},
            
            # EXPENSES (5000-5999)
            {'code': '5000', 'name': 'EXPENSES', 'account_type': 'expense', 'parent': None},
            
            # Operating Expenses (5100-5399)
            {'code': '5100', 'name': 'Operating Expenses', 'account_type': 'expense', 'parent': '5000',
             'description': 'General business operating expenses'},
            {'code': '5200', 'name': 'Payroll Expenses', 'account_type': 'expense', 'parent': '5000',
             'description': 'Staff salaries and wages'},
            {'code': '5210', 'name': 'Interest Expense on Savings', 'account_type': 'expense', 'parent': '5000',
             'description': 'Interest paid to member savings accounts'},
            {'code': '5300', 'name': 'Loan Loss Expense', 'account_type': 'expense', 'parent': '5000',
             'description': 'Provision for bad debts'},
            {'code': '5400', 'name': 'Rent Expense', 'account_type': 'expense', 'parent': '5000'},
            {'code': '5500', 'name': 'Utilities Expense', 'account_type': 'expense', 'parent': '5000'},
            {'code': '5600', 'name': 'Depreciation Expense', 'account_type': 'expense', 'parent': '5000'},
        ]
        
        created_count = 0
        updated_count = 0
        
        # First pass: Create all accounts without parents
        for acc_data in accounts:
            code = acc_data['code']
            parent_code = acc_data.pop('parent', None)
            
            account, created = ChartOfAccount.objects.update_or_create(
                code=code,
                defaults={
                    'name': acc_data['name'],
                    'account_type': acc_data['account_type'],
                    'description': acc_data.get('description', ''),
                    'is_active': True
                }
            )
            
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'Created: {code} - {acc_data["name"]}'))
            else:
                updated_count += 1
                self.stdout.write(self.style.WARNING(f'Updated: {code} - {acc_data["name"]}'))
        
        # Second pass: Set parent relationships
        for acc_data in accounts:
            if 'parent' in str(acc_data):
                # Reconstruct parent from original data
                parent_code = None
                for original in accounts:
                    if original['code'] == acc_data['code']:
                        parent_code = original.get('parent')
                        break
                
                if parent_code:
                    try:
                        account = ChartOfAccount.objects.get(code=acc_data['code'])
                        parent = ChartOfAccount.objects.get(code=parent_code)
                        account.parent = parent
                        account.save()
                    except ChartOfAccount.DoesNotExist:
                        pass
        
        self.stdout.write(self.style.SUCCESS(f'\nSummary:'))
        self.stdout.write(self.style.SUCCESS(f'  Created: {created_count} accounts'))
        self.stdout.write(self.style.SUCCESS(f'  Updated: {updated_count} accounts'))
        self.stdout.write(self.style.SUCCESS(f'  Total: {created_count + updated_count} accounts'))
        self.stdout.write(self.style.SUCCESS(f'\n✓ Chart of Accounts initialization complete!'))
