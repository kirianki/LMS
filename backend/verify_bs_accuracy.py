
import os
import django
import datetime
from decimal import Decimal

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()


from apps.accounting.reports import generate_balance_sheet, generate_trial_balance

def verify_historical_accuracy():
    print("--- Verifying Historical Balance Sheet Accuracy ---")
    
    # 1. Test current balance
    today = datetime.date.today()
    bs_today = generate_balance_sheet(today.strftime('%Y-%m-%d'))
    print(f"Report for Today ({today}): Balanced={bs_today['is_balanced']}")
    
    # 2. Test historical balance (start of year)
    jan_1 = today.replace(month=1, day=1)
    bs_jan_1 = generate_balance_sheet(jan_1.strftime('%Y-%m-%d'))
    print(f"Report for Jan 1 ({jan_1}): Balanced={bs_jan_1['is_balanced']}")
    
    if not bs_today['is_balanced']:
        a = bs_today['assets']['total']
        l = bs_today['liabilities']['total']
        e = bs_today['equity']['total']
        print(f"Today Mismatch: Assets={a}, L+E={l+e}")

    if not bs_jan_1['is_balanced']:
        a = bs_jan_1['assets']['total']
        l = bs_jan_1['liabilities']['total']
        e = bs_jan_1['equity']['total']
        print(f"Jan 1 Mismatch: Assets={a}, L+E={l+e}")

    # 3. Check Net Profit Row
    equity_details = bs_today['equity']['details']
    net_profit_row = next((row for row in equity_details if row['id'] == 'REPORT_PL'), None)
    if net_profit_row:
        print(f"Net Profit Row Found: {net_profit_row['name']} = {net_profit_row['balance']}")
        print(f"Drill-down Dates: {net_profit_row.get('start_date')} to {net_profit_row.get('end_date')}")
    else:
        print("CRITICAL: Net Profit Row NOT found in Equity details.")

if __name__ == "__main__":
    verify_historical_accuracy()
