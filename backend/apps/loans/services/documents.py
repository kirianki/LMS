from io import BytesIO
from datetime import date
import os
from django.template.loader import render_to_string
from django.conf import settings
try:
    from xhtml2pdf import pisa
except ImportError:
    pisa = None
from apps.tenants.models import DocumentTemplate

def amount_to_words(amount):
    """Simple number to words converter for Kenyan Shillings."""
    # This is a basic implementation. For production, consider 'num2words' library.
    units = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]
    teens = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"]
    tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]
    thousands = ["", "thousand", "million", "billion"]

    def _convert_segment(num):
        res = ""
        if num >= 100:
            res += units[num // 100] + " hundred "
            num %= 100
        if num >= 10 and num <= 19:
            res += teens[num - 10]
        else:
            if num >= 20:
                res += tens[num // 10] + " "
                num %= 10
            if num > 0:
                res += units[num]
        return res.strip()

    try:
        whole_part = int(amount)
        if whole_part == 0:
            return "zero shillings"
            
        words = []
        seg_idx = 0
        while whole_part > 0:
            seg = whole_part % 1000
            if seg > 0:
                seg_words = _convert_segment(seg)
                if thousands[seg_idx]:
                    seg_words += " " + thousands[seg_idx]
                words.insert(0, seg_words)
            whole_part //= 1000
            seg_idx += 1
            
        return " ".join(words).strip() + " shillings"
    except:
        return str(amount)


def generate_offer_letter(loan_application, tenant):
    """
    Generate a branded PDF offer letter using HTML templates.
    Returns: BytesIO buffer containing PDF
    """
    if not pisa:
        raise ImportError("xhtml2pdf is not installed.")

    from decimal import Decimal
    from dateutil.relativedelta import relativedelta
    
    # Try to find an active custom template in DB
    custom_template = DocumentTemplate.objects.filter(
        tenant=tenant,
        template_type='offer_letter',
        is_active=True
    ).first()
    
    # Prepare context data
    borrower = loan_application.borrower
    product = loan_application.product
    deductions = loan_application.deductions.all()
    
    total_deductions = sum(d.calculated_amount for d in deductions) if deductions else Decimal('0.00')
    net_disbursement = loan_application.approved_amount - total_deductions
    total_repayable = loan_application.approved_amount + loan_application.calculated_interest
    
    if product.term_unit == 'months':
        payment_frequency = 'Monthly'
        first_payment_date = date.today() + relativedelta(months=1)
        final_payment_date = date.today() + relativedelta(months=loan_application.approved_term)
    elif product.term_unit == 'weeks':
        payment_frequency = 'Weekly'
        first_payment_date = date.today() + relativedelta(weeks=1)
        final_payment_date = date.today() + relativedelta(weeks=loan_application.approved_term)
    else:  # days
        payment_frequency = 'Daily'
        first_payment_date = date.today() + relativedelta(days=1)
        final_payment_date = date.today() + relativedelta(days=loan_application.approved_term)
    
    first_schedule = loan_application.provisional_schedules.order_by('due_date').first()
    if first_schedule:
        # Calculate dynamically to ensure correctness even if DB total_due is 0
        installment_amount = first_schedule.principal_due + first_schedule.interest_due
    else:
        installment_amount = (total_repayable / loan_application.approved_term if loan_application.approved_term > 0 else Decimal('0.00'))
    
    def format_money(val):
        return "{:,.2f}".format(val or Decimal('0.00'))
    
    def format_date_long(d):
        if not d: return "N/A"
        # 29th JANUARY 2026
        day = d.day
        suffix = "th" if 11 <= day <= 13 else {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")
        return f"{day}{suffix} {d.strftime('%B %Y').upper()}"

    def format_date_short(d):
        # 29 Jan 2026
        return d.strftime("%d %b %Y") if d else "N/A"

    # Pre-calculate ALL scalar strings
    ctx_today = format_date_long(date.today())
    ctx_borrower_name = (borrower.name or "Valued Customer").upper()
    ctx_borrower_id = f"{borrower.id_number or 'N/A'}"
    if borrower.borrower_type in ['company', 'institution']:
        ctx_borrower_id += f" ({borrower.get_borrower_type_display().upper()})"
    else:
        ctx_borrower_id += f" ({borrower.get_id_type_display().upper()})"
        
    ctx_address = borrower.physical_address or "As per application records"
    
    # Pre-calculate lists (Deductions)
    fmt_deductions = []
    for d in deductions:
        fmt_deductions.append({
            'name': d.name or "Fee",
            'method': d.get_charge_method_display(),
            'amount': format_money(d.calculated_amount)
        })
        
    # Pre-calculate lists (Schedules)
    provisional_schedules = loan_application.provisional_schedules.all().order_by('due_date')
    fmt_schedules = []
    for s in provisional_schedules:
        total_val = s.principal_due + s.interest_due
        fmt_schedules.append({
            'number': str(s.installment_number),
            'due_date': format_date_short(s.due_date),
            'principal': format_money(s.principal_due),
            'interest': format_money(s.interest_due),
            'total': format_money(total_val)
        })

    # Collateral
    collateral = getattr(loan_application, 'collateral', None)
    if collateral:
        # Build description based on available fields
        c_name = "Asset"
        if collateral.make and collateral.model:
            c_name = f"{collateral.make} {collateral.model}"
        elif collateral.description:
            c_name = collateral.description
        
        ctx_collateral_desc = f"{collateral.get_collateral_type_display()} - {c_name.upper()}"
        ctx_collateral_id = collateral.reg_number or collateral.lr_number or collateral.registration_number or "N/A"
    else:
        ctx_collateral_desc = "UNSECURED"
        ctx_collateral_id = "N/A"

    # Institutional Contact
    primary_contact = None
    is_company = borrower.borrower_type in ['company', 'institution', 'group']
    if is_company:
        primary_contact = borrower.contacts.filter(is_primary=True).first()

    # Pre-formatted Strings (Zero Logic)
    loan_officer = getattr(borrower, 'loan_officer', None)
    officer_name = f"{loan_officer.first_name} {loan_officer.last_name}".upper() if loan_officer else "AUTHORIZED SIGNATORY"
    
    context = {
        # Raw objects (only for simple lookups if absolutely needed, but prefer strings)
        'tenant': tenant,
        'tenant_settings': getattr(tenant, 'settings', None),
        
        # PRE-FORMATTED STRINGS (ZERO LOGIC)
        'date_letter': ctx_today,
        'app_ref': loan_application.application_number or "N/A",
        
        'loan_officer_name': officer_name,
        
        'borrower_name': ctx_borrower_name,
        'borrower_id': ctx_borrower_id,
        'footer_id_val': ctx_borrower_id, # explicit alias for footer
        'borrower_phone': borrower.phone_number or "Not Provided",
        'borrower_address': ctx_address,
        'borrower_email': borrower.email or "N/A",
        
        'product_name': product.name.upper(),
        'approved_principal': format_money(loan_application.approved_amount),
        'interest_rate_str': f"{loan_application.approved_interest_rate or 0}% {loan_application.get_approved_interest_period_display()}",
        'interest_method': loan_application.get_approved_interest_method_display().title(),
        'term_str': f"{loan_application.approved_term} {product.get_term_unit_display()}",
        'installment_amount': format_money(installment_amount),
        'frequency': payment_frequency,
        'repayment_channel': loan_application.get_repayment_channel_display().upper(),
        
        'deductions_list': fmt_deductions,
        'net_disbursement': format_money(net_disbursement),
        'total_repayable': format_money(total_repayable),
        'amount_words': amount_to_words(loan_application.approved_amount).upper(),
        
        'schedules_list': fmt_schedules,
        
        'has_collateral': bool(collateral),
        'collateral_desc': ctx_collateral_desc,
        'collateral_id': ctx_collateral_id,
        
        'is_company': is_company,
        'contact_name': f"{primary_contact.first_name} {primary_contact.last_name}".upper() if primary_contact else "AUTHORIZED SIGNATORY",
        'contact_designation': (primary_contact.designation or "Director").upper() if primary_contact else "DIRECTOR",
        
        'company_name': (getattr(tenant, 'name', '') or 'LENDER').upper(),
        # Add settings fallbacks if tenant_settings is missing
    }
    
    # Mix in tenant settings defaults safely
    ts = context['tenant_settings']
    context.update({
        'company_name': (ts.company_name if ts and ts.company_name else tenant.name).upper(),
        'company_address': ts.company_address if ts and ts.company_address else "Address Not Provided",
        'company_phone': ts.company_phone if ts and ts.company_phone else "N/A",
        'company_email': ts.company_email if ts and ts.company_email else "N/A",
        'company_tagline': ts.company_tagline if ts and ts.company_tagline else "Your Financial Growth Partner",
        'primary_color': ts.primary_color if ts and ts.primary_color else '#1a365d',
        'secondary_color': ts.secondary_color if ts and ts.secondary_color else '#475569',
        'logo_path': ts.logo.path if ts and ts.logo else '',
    })
    
    if custom_template:
        from django.template import Template, Context
        template = Template(custom_template.content)
        html_content = template.render(Context(context))
    else:
        # Use default filesystem template
        html_content = render_to_string('default_offer_letter.html', context)
    
    buffer = BytesIO()
    pisa_status = pisa.CreatePDF(html_content, dest=buffer)
    
    if not pisa_status.err:
        buffer.seek(0)
        return buffer
    else:
        raise Exception(f"PDF generation failed: {pisa_status.err}")


def generate_loan_statement(loan, tenant):
    """
    Generate a branded PDF loan statement using HTML templates.
    """
    if not pisa:
        raise ImportError("xhtml2pdf is not installed.")

    def format_money(val):
        return "{:,.2f}".format(val or Decimal('0.00'))
    
    def format_date_short(d):
        return d.strftime("%d %b %Y") if d else "N/A"

    borrower = loan.borrower
    
    # Pre-calculate Lists (Transactions)
    fmt_repayments = []
    for p in loan.repayments.all().order_by('payment_date'):
        fmt_repayments.append({
            'date': format_date_short(p.payment_date),
            'description': "Loan Repayment",
            'reference': p.reference_number or "-",
            'amount': f"({format_money(p.amount)})"
        })

    context = {
        'tenant': tenant,
        'tenant_settings': getattr(tenant, 'settings', None),
        
        # Zero Logic Variables
        'today_date': date.today().strftime("%d %b %Y"),
        'borrower_name': (borrower.name or "Valued Customer").upper(),
        'loan_number': loan.loan_number or "N/A",
        
        'principal': format_money(loan.principal_amount),
        'disbursed_date': format_date_short(loan.disbursement_date),
        'outstanding_balance': format_money(loan.outstanding_balance),
        
        'disb_date_str': format_date_short(loan.disbursement_date),
        'disb_ref': loan.disbursement_reference or "Initial Account",
        'disb_amount': format_money(loan.principal_amount),
        
        'repayments_list': fmt_repayments,
    }
    
    # Mix in tenant settings defaults safely
    ts = context['tenant_settings']
    context.update({
        'company_name': (ts.company_name if ts and ts.company_name else tenant.name).upper(),
        'company_phone': ts.company_phone if ts and ts.company_phone else "N/A",
        'footer_text': ts.report_footer_text if ts and ts.report_footer_text else "Financial Excellence & Integrity",
        'primary_color': ts.primary_color if ts and ts.primary_color else '#1a365d',
        'logo_path': ts.logo.path if ts and ts.logo else '',
    })
    
    html_content = render_to_string('default_loan_statement.html', context)
    buffer = BytesIO()
    pisa_status = pisa.CreatePDF(html_content, dest=buffer)
    
    if not pisa_status.err:
        buffer.seek(0)
        return buffer
    else:
        raise Exception(f"PDF generation failed: {pisa_status.err}")


def generate_disbursement_letter(loan_obj, tenant):
    """
    Generate a branded PDF disbursement letter using HTML templates.
    Handles both Loan (final) and LoanApplication (provisional authorization).
    """
    if not pisa:
        raise ImportError("xhtml2pdf is not installed.")

    def format_money(val):
        return "{:,.2f}".format(val or Decimal('0.00'))
    
    def format_date_long(d):
        if not d: return "N/A"
        day = d.day
        suffix = "th" if 11 <= day <= 13 else {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")
        return f"{day}{suffix} {d.strftime('%B %Y').upper()}"

    def format_date_short(d):
        return d.strftime("%d %b %Y") if d else "N/A"

    is_app = hasattr(loan_obj, 'requested_amount')
    borrower = loan_obj.borrower
    
    if is_app:
        first_schedule = loan_obj.provisional_schedules.all().order_by('due_date').first()
        disb_date = date.today() # Projected
        net_amount = (loan_obj.approved_amount or Decimal('0.00')) - sum(d.calculated_amount for d in loan_obj.deductions.all())
        method_str = "TBD"
        loan_ref = loan_obj.application_number
    else:
        first_schedule = loan_obj.schedules.all().order_by('due_date').first()
        disb_date = loan_obj.disbursement_date
        net_amount = loan_obj.disbursed_amount
        method_str = loan_obj.get_disbursement_method_display().upper()
        loan_ref = loan_obj.loan_number or "N/A"

    # Resolve Name and ID based on type
    is_company = borrower.borrower_type in ['company', 'institution']
    if is_company:
        ctx_borrower_name = (borrower.business_name or borrower.name or "Valued Institution").upper()
        ctx_borrower_id = borrower.tax_id or borrower.id_number or "N/A"
    else:
        ctx_borrower_name = f"{borrower.first_name} {borrower.last_name}".upper()
        ctx_borrower_id = f"{borrower.id_number} (NATIONAL ID)" if borrower.id_number else "N/A"

    # Get Primary contact for companies
    contact_name = "____________________"
    contact_designation = "____________________"
    if is_company:
        primary_contact = borrower.contacts.filter(is_primary=True).first()
        if primary_contact:
            contact_name = f"{primary_contact.first_name} {primary_contact.last_name}".upper()
            contact_designation = (primary_contact.designation or "Director").upper()

    # Get Loan Officer
    loan_officer = getattr(borrower, 'loan_officer', None)
    officer_name = f"{loan_officer.first_name} {loan_officer.last_name}".upper() if loan_officer else "AUTHORIZED SIGNATORY"

    # Dynamic installment calculation
    if first_schedule:
        inst_val = first_schedule.principal_due + first_schedule.interest_due
    else:
        inst_val = Decimal('0.00')

    context = {
        'tenant': tenant,
        'tenant_settings': getattr(tenant, 'settings', None),
        
        # PRE-FORMATTED STRINGS
        'letter_date': format_date_long(date.today()),
        'loan_ref': loan_ref,
        'borrower_name': ctx_borrower_name,
        'borrower_id': ctx_borrower_id,
        'footer_id_val': ctx_borrower_id,
        
        'is_company': is_company,
        'contact_name': contact_name,
        'contact_designation': contact_designation,
        'loan_officer_name': officer_name,
        
        'disb_date': format_date_short(disb_date),
        'method': method_str,
        'net_amount': format_money(net_amount),
        'installment_amount': format_money(inst_val),
        'first_due_date': format_date_long(first_schedule.due_date) if first_schedule else "N/A",
        'repayment_channel': loan_obj.get_repayment_channel_display().upper(),
    }
    
    # Mix in tenant settings defaults safely
    ts = context['tenant_settings']
    context.update({
        'company_name': (ts.company_name if ts and ts.company_name else tenant.name).upper(),
        'company_address': ts.company_address if ts and ts.company_address else "Address Not Provided",
        'company_phone': ts.company_phone if ts and ts.company_phone else "N/A",
        'company_email': ts.company_email if ts and ts.company_email else "support@" + tenant.name.lower().replace(' ', '') + ".com",
        'company_tagline': ts.company_tagline if ts and ts.company_tagline else "Your Financial Growth Partner",
        'primary_color': ts.primary_color if ts and ts.primary_color else '#1a365d',
        'secondary_color': ts.secondary_color if ts and ts.secondary_color else '#64748b',
        'logo_path': ts.logo.path if ts and ts.logo else '',
    })
    
    html_content = render_to_string('default_disbursement_letter.html', context)
    buffer = BytesIO()
    pisa_status = pisa.CreatePDF(html_content, dest=buffer)
    
    if not pisa_status.err:
        buffer.seek(0)
        return buffer
    else:
        raise Exception(f"PDF generation failed: {pisa_status.err}")


def render_document_preview(template_obj, tenant):
    """
    Generate a preview of a document template using mock data.
    """
    if not pisa:
        return None

    from decimal import Decimal
    from datetime import date
    from dateutil.relativedelta import relativedelta
    from django.template import Template, Context
    
    # Mock context data
    context = {
        'application': {
            'application_number': 'APP202601-PREVIEW',
            'submitted_at': date.today(),
            'approved_amount': Decimal('500000.00'),
            'approved_term': 12,
            'approved_interest_rate': Decimal('12.50'),
            'get_approved_interest_method_display': 'Reducing Balance',
            'get_approved_interest_period_display': 'Per Annum',
            'purpose': 'Business Expansion & Inventory Purchase',
            'disbursement_method': 'Bank Transfer',
        },
        'borrower': {
            'name': 'JOHN DOE ENTERPRISES',
            'physical_address': 'Plot 123, Financial District, Nairobi',
            'id_number': 'PVT-ABC12345',
            'phone_number': '+254 711 222 333',
        },
        'product': {
            'name': 'SME Platinum Loan',
            'get_term_unit_display': 'Months',
        },
        'tenant': tenant,
        'tenant_settings': getattr(tenant, 'settings', None),
        'today': date.today(),
        'deductions': [
            {'name': 'Processing Fee', 'calculated_amount': Decimal('5000.00')},
            {'name': 'Insurance Premium', 'calculated_amount': Decimal('2500.00')},
        ],
        'total_deductions': Decimal('7500.00'),
        'net_disbursement': Decimal('492500.00'),
        'total_repayable': Decimal('562500.00'),
        'installment_amount': Decimal('46875.00'),
        'payment_frequency': 'Monthly',
        'approved_amount_words': 'five hundred thousand shillings only',
        'first_payment_date': date.today() + relativedelta(months=1),
        'final_payment_date': date.today() + relativedelta(months=12),
    }
    
    # Handle object conversion for template
    class MockObj:
        def __init__(self, **entries):
            self.__dict__.update(entries)
    
    context['application'] = MockObj(**context['application'])
    context['borrower'] = MockObj(**context['borrower'])
    context['product'] = MockObj(**context['product'])
    
    # Render template
    template = Template(template_obj.content)
    html_content = template.render(Context(context))
    
    # Convert HTML to PDF
    buffer = BytesIO()
    pisa_status = pisa.CreatePDF(html_content, dest=buffer)
    if not pisa_status.err:
        buffer.seek(0)
        return buffer
    return None
