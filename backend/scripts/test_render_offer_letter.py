import os
import django
import sys
from django.template.loader import render_to_string
from decimal import Decimal
from datetime import date

# Setup Django
sys.path.append('/home/sammy/Desktop/LMS/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

def test_rendering():
    context = {
        'company_name': 'SALENE TEST',
        'primary_color': '#2EAD8F',
        'secondary_color': '#475569',
        'borrower_name': 'JOHN DOE',
        'borrower_id': '12345678',
        'borrower_id_label': 'ID Number',
        'borrower_number': 'BOR-001',
        'borrower_address': 'Nairobi',
        'date_letter': '18th FEBRUARY 2026',
        'approved_principal': '100,000.00',
        'amount_words': 'ONE HUNDRED THOUSAND SHILLINGS',
        'interest_rate_str': '12%',
        'interest_method': 'Reducing Balance',
        'term_str': '12 Months',
        'frequency': 'Monthly',
        'repayment_channel': 'Bank Transfer',
        'installment_amount': '10,000.00',
        'installment_amount_words': 'TEN THOUSAND SHILLINGS',
        'deductions_list': [],
        'net_disbursement': '100,000.00',
        'schedules_list': [{'number': 1, 'due_date': '18 Mar 2026', 'total': '10,000.00'}],
        'has_guarantors': True,
        'guarantors_list': [
            {'name': 'GUARANTOR ONE', 'id_number': 'ID-001', 'phone': '0711111111', 'amount': '50,000.00'},
            {'name': 'GUARANTOR TWO', 'id_number': 'ID-002', 'phone': '0722222222', 'amount': '50,000.00'}
        ],
        'has_collateral': False,
        'organization': {'report_footer_text': 'System generated'},
        'loan_officer_name': 'OFFICER TEST',
    }

    print("Testing salene_offer_letter.html...")
    html_salene = render_to_string('salene_offer_letter.html', context)
    
    # Check for ID Number in table
    if 'ID Number' in html_salene and 'ID-001' in html_salene:
        print("✓ Guarantor ID found in table")
    else:
        print("✗ Guarantor ID NOT found in table")
        
    # Check for Signature section
    if 'GUARANTOR ACKNOWLEDGEMENT &amp; SIGNATURES' in html_salene or 'GUARANTOR ACKNOWLEDGEMENT & SIGNATURES' in html_salene:
        print("✓ Guarantor Signature section found")
    else:
        print("✗ Guarantor Signature section NOT found")

    if 'GUARANTOR 1:' in html_salene and 'ID Number: ID-001' in html_salene:
        print("✓ Guarantor 1 details found in signature section")
    else:
        print("✗ Guarantor 1 details NOT found in signature section")

    print("\nTesting default_offer_letter.html...")
    html_default = render_to_string('default_offer_letter.html', context)
    
    if 'ID Number' in html_default and 'ID-001' in html_default:
        print("✓ Guarantor ID found in table")
    else:
        print("✗ Guarantor ID NOT found in table")

    if 'GUARANTOR SIGNATURES' in html_default:
        print("✓ Guarantor Signature section found")
    else:
        print("✗ Guarantor Signature section NOT found")

    if 'GUARANTOR 1:' in html_default and 'ID Number: ID-001' in html_default:
        print("✓ Guarantor 1 details found in signature section")
    else:
        print("✗ Guarantor 1 details NOT found in signature section")

    # Save to temp file for visual check
    with open('/tmp/test_salene.html', 'w') as f:
        f.write(html_salene)
    print("\nSalene HTML saved to /tmp/test_salene.html")

if __name__ == "__main__":
    test_rendering()
