from io import BytesIO
from datetime import date
from decimal import Decimal
import os
from django.template.loader import render_to_string
from django.conf import settings
try:
    from xhtml2pdf import pisa
except ImportError:
    pisa = None
from apps.accounts.models import DocumentTemplate, Organization
import logging

logger = logging.getLogger(__name__)


def amount_to_words(amount):
    """Convert number to words for Kenyan Shillings with cents."""
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
        amount_dec = Decimal(str(amount))
        whole_part = int(amount_dec)
        cents = int((amount_dec - whole_part) * 100)
        
        if whole_part == 0:
            words_str = "zero shillings"
        else:
            words = []
            seg_idx = 0
            temp_whole = whole_part
            while temp_whole > 0:
                seg = temp_whole % 1000
                if seg > 0:
                    seg_words = _convert_segment(seg)
                    if thousands[seg_idx]:
                        seg_words += " " + thousands[seg_idx]
                    words.insert(0, seg_words)
                temp_whole //= 1000
                seg_idx += 1
            words_str = " ".join(words).strip() + " shillings"
            
        if cents > 0:
            cents_str = _convert_segment(cents)
            words_str += f" and {cents_str} cents"
            
        return words_str
    except Exception as e:
        logger.error(f"amount_to_words error: {e}")
        return str(amount)


def generate_offer_letter(loan_application):
    """
    Generate a branded PDF offer letter scoped to the organization.
    """
    if not pisa:
        raise ImportError("xhtml2pdf is not installed.")

    from dateutil.relativedelta import relativedelta
    
    organization = loan_application.organization
    
    def format_money(val):
        return "{:,.2f}".format(val or Decimal('0.00'))
    
    def format_date_long(d):
        if not d: return "N/A"
        day = d.day
        suffix = "th" if 11 <= day <= 13 else {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")
        return f"{day}{suffix} {d.strftime('%B %Y').upper()}"

    def format_date_short(d):
        return d.strftime("%d %b %Y") if d else "N/A"

    # Try to find an active custom template in DB for this organization
    # Note: If DocumentTemplate doesn't have organization yet, we might need to add it.
    # For now, we use global templates.
    custom_template = DocumentTemplate.objects.filter(
        template_type='offer_letter',
        is_active=True
    ).first()
    
    # Prepare context data
    borrower = loan_application.borrower
    product = loan_application.product
    deductions = loan_application.deductions.all()
    
    total_deductions = sum(d.calculated_amount for d in deductions.filter(is_withheld=True)) if deductions else Decimal('0.00')
    
    is_refinancing = bool(loan_application.refinances_loan)
    payoff_amount = loan_application.payoff_amount or Decimal('0.00')
    refinanced_loan_number = loan_application.refinances_loan.loan_number if is_refinancing else None
    
    payoff_note = ""
    if is_refinancing:
        old = loan_application.refinances_loan
        calc_payoff = old.outstanding_principal + old.outstanding_interest + old.outstanding_penalties
        if payoff_amount == 0:
            payoff_amount = calc_payoff
        payoff_note = f"Covers outstanding principal (KES {format_money(old.outstanding_principal)}), interest (KES {format_money(old.outstanding_interest)}), and penalties (KES {format_money(old.outstanding_penalties)})"

    net_disbursement = loan_application.approved_amount - total_deductions - payoff_amount
    total_repayable = loan_application.approved_amount + loan_application.calculated_interest
    
    freq_raw = getattr(loan_application, 'approved_repayment_frequency', 'monthly')
    payment_frequency = freq_raw.replace('_', '-').title()
    
    first_schedule = loan_application.provisional_schedules.order_by('due_date').first()
    if first_schedule:
        installment_amount = first_schedule.principal_due + first_schedule.interest_due
    else:
        installment_amount = (total_repayable / loan_application.approved_term if loan_application.approved_term > 0 else Decimal('0.00'))
    
    ctx_today = format_date_long(date.today())
    
    is_company = borrower.borrower_type in ['company', 'institution', 'group']
    if is_company:
        ctx_borrower_name = (borrower.business_name or borrower.name or "Valued Institution").upper()
        ctx_borrower_id = borrower.tax_id or borrower.id_number or "N/A"
    else:
        ctx_borrower_name = f"{borrower.first_name} {borrower.last_name}".upper()
        if not borrower.first_name and not borrower.last_name:
             ctx_borrower_name = (borrower.name or "Valued Customer").upper()
        ctx_borrower_id = borrower.id_number or "N/A"
        
    ctx_address = borrower.physical_address or "As per application records"
    
    fmt_deductions = []
    for d in deductions:
        fmt_deductions.append({
            'name': d.name or "Fee",
            'method': d.get_charge_method_display(),
            'amount': format_money(d.calculated_amount)
        })
        
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

    collaterals = loan_application.collaterals.all()
    # Fallback to single collateral field if M2M is empty (for legacy support during transition)
    if not collaterals.exists() and loan_application.collateral:
        collaterals = [loan_application.collateral]

    fmt_collaterals = []
    for collateral in collaterals:
        c_name = "Asset"
        if collateral.make and collateral.model:
            c_name = f"{collateral.make} {collateral.model}"
        elif collateral.description:
            c_name = collateral.description
        
        desc = f"{collateral.get_collateral_type_display()} - {c_name.upper()}"
        if collateral.collateral_type == 'motor_vehicle':
             desc += f" (CHASSIS: {collateral.chassis_number or 'N/A'}, ENGINE: {collateral.engine_number or 'N/A'})"
        
        fmt_collaterals.append({
            'desc': desc,
            'id': collateral.reg_number or collateral.lr_number or collateral.registration_number or "N/A",
            'details': {
                'make_model': f"{collateral.make} {collateral.model}".upper() if collateral.make else "N/A",
                'reg_no': collateral.reg_number or "N/A",
                'chassis_no': collateral.chassis_number or "N/A",
                'engine_no': collateral.engine_number or "N/A",
                'year': collateral.year_of_manufacture or "N/A",
                'color': collateral.color.upper() if collateral.color else "N/A",
            }
        })

    primary_contact = None
    if is_company:
        primary_contact = borrower.contacts.filter(is_primary=True).first()

    guarantors = loan_application.guarantors.all()
    fmt_guarantors = []
    for g in guarantors:
        fmt_guarantors.append({
            'name': g.name.upper(),
            'id_number': g.id_number,
            'phone': g.phone_number,
            'relationship': g.relationship or 'Guarantor',
            'amount': format_money(g.amount_guaranteed)
        })

    loan_officer = getattr(borrower, 'loan_officer', None)
    officer_name = f"{loan_officer.first_name} {loan_officer.last_name}".upper() if loan_officer else "AUTHORIZED SIGNATORY"

    # Detailed fee extraction for Salene template
    fees_map = loan_application.other_fees or {}
    
    # Helper to get fee by name (case-insensitive)
    def get_fee(name, default="0"):
        val = fees_map.get(name) or fees_map.get(name.lower()) or fees_map.get(name.replace(" ", "_").lower()) or default
        try:
            return format_money(Decimal(str(val)))
        except:
            return "0"

    context = {
        'organization': organization,
        'date_letter': ctx_today,
        'expiry_date': format_date_long(loan_application.offer_expires_at) if loan_application.offer_expires_at else "N/A",
        'app_ref': loan_application.application_number or "N/A",
        'loan_officer_name': officer_name,
        'borrower_name': ctx_borrower_name,
        'borrower_id': ctx_borrower_id,
        'borrower_number': borrower.borrower_number or loan_application.application_number or "N/A",
        'borrower_id_label': 'ID.NO' if not is_company else 'REG.NO',
        'borrower_phone': borrower.phone_number or "Not Provided",
        'borrower_address': ctx_address,
        'borrower_email': borrower.email or "N/A",
        'borrower_postal': f"P. O BOX {borrower.postal_code}-{borrower.city}".upper() if borrower.postal_code else "N/A",
        'product_name': product.name.upper(),
        'approved_principal': format_money(loan_application.approved_amount),
        'interest_rate_str': f"{loan_application.approved_interest_rate or 0}% {loan_application.get_approved_interest_period_display()}",
        'interest_method': loan_application.get_approved_interest_method_display().title(),
        'term_str': f"{loan_application.approved_term} {product.get_term_unit_display()}",
        'installment_amount': format_money(installment_amount),
        'installment_amount_words': amount_to_words(installment_amount).upper(),
        'frequency': payment_frequency,
        'repayment_channel': loan_application.get_repayment_channel_display().upper(),
        'deductions_list': fmt_deductions,
        'net_disbursement': format_money(net_disbursement),
        'total_repayable': format_money(total_repayable),
        'amount_words': amount_to_words(loan_application.approved_amount).upper(),
        'payoff_amount': format_money(payoff_amount),
        'payoff_note': payoff_note,
        'is_refinancing': is_refinancing,
        'refinanced_loan_number': refinanced_loan_number,
        'schedules_list': fmt_schedules,
        'has_guarantors': bool(guarantors.exists()),
        'guarantors_list': fmt_guarantors,
        'has_collateral': bool(fmt_collaterals),
        'collaterals_list': fmt_collaterals,
        # Legacy single collateral fields for old templates
        'collateral_desc': fmt_collaterals[0]['desc'] if fmt_collaterals else "UNSECURED",
        'collateral_id': fmt_collaterals[0]['id'] if fmt_collaterals else "N/A",
        'collateral_details': fmt_collaterals[0]['details'] if fmt_collaterals else {
            'make_model': "N/A",
            'reg_no': "N/A",
            'chassis_no': "N/A",
            'engine_no': "N/A",
            'year': "N/A",
            'color': "N/A",
        },
        'fees': {
            'application': get_fee('Loan application fee'),
            'maintenance': get_fee('Maintenance fees'),
            'tracker_maintenance': get_fee('Tracker maintenance fee'),
            'tracker_installation': get_fee('Tracker installation fee'),
            'pfr': get_fee('Provision for Recovery'),
            'insurance': get_fee('Motor vehicle insurance fee'),
            'chattels_insurance': get_fee('Chattels and stock insurance'),
        },
        'is_company': is_company,
        'contact_name': f"{primary_contact.first_name} {primary_contact.last_name}".upper() if primary_contact else "AUTHORIZED SIGNATORY",
        'contact_designation': (primary_contact.designation or "Director").upper() if primary_contact else "DIRECTOR",
    }
    
    ts = organization
    context.update({
        'company_name': (ts.company_name if ts and ts.company_name else "LENDER").upper(),
        'company_postal': ts.company_postal_address if ts and ts.company_postal_address else "",
        'company_city': ts.company_city if ts and ts.company_city else "",
        'company_address': ts.company_address if ts and ts.company_address else "Address Not Provided",
        'company_phone': ts.company_phone if ts and ts.company_phone else "N/A",
        'company_email': ts.company_email if ts and ts.company_email else "N/A",
        'company_tagline': ts.company_tagline if ts and ts.company_tagline else "Your Financial Growth Partner",
        'primary_color': ts.primary_color if ts and ts.primary_color else '#2EAD8F',
        'secondary_color': ts.secondary_color if ts and ts.secondary_color else '#475569',
        'logo_path': ts.logo.path if ts and ts.logo else '',
    })
    
    if custom_template:
        from django.template import Template, Context
        template = Template(custom_template.content)
        html_content = template.render(Context(context))
    else:
        # Use specialized template for Salene or default
        template_name = 'default_offer_letter.html'
        if "salene" in context.get('company_name', '').lower():
            template_name = 'salene_offer_letter.html'
            
        html_content = render_to_string(template_name, context)
    
    buffer = BytesIO()
    pisa_status = pisa.CreatePDF(html_content, dest=buffer)
    
    if not pisa_status.err:
        buffer.seek(0)
        return buffer
    else:
        raise Exception(f"PDF generation failed: {pisa_status.err}")


def generate_loan_statement(loan):
    """
    Generate a branded PDF loan statement scoped to the organization.
    """
    if not pisa:
        raise ImportError("xhtml2pdf is not installed.")

    organization = loan.organization

    def format_money(val):
        return "{:,.2f}".format(val or Decimal('0.00'))
    
    def format_date_short(d):
        return d.strftime("%d %b %Y") if d else "N/A"

    borrower = loan.borrower
    
    fmt_repayments = []
    for p in loan.repayments.all().order_by('payment_date'):
        fmt_repayments.append({
            'date': format_date_short(p.payment_date),
            'description': "Loan Repayment",
            'reference': p.reference_number or "-",
            'amount': f"({format_money(p.amount)})"
        })

    today = date.today()
    
    # Calculate totals
    total_repaid = sum(r.amount for r in loan.repayments.all())
    
    # Derived charges (Interest + Penalties + Fees) needed to balance the equation:
    # Outstanding = Principal + Charges - Repaid
    # => Charges = Outstanding + Repaid - Principal
    # Note: simple logic, assumes Principal Amount is the starting balance.
    charges_applied = loan.outstanding_balance + total_repaid - loan.principal_amount
    
    # Sort out transactions
    transactions = []
    transactions.append({
        'date': loan.disbursement_date,
        'description': "Principal Disbursement",
        'ref': loan.disbursement_reference or "disb",
        'debit': loan.principal_amount,
        'credit': Decimal('0.00'),
    })
    
    # Add Repayments
    for r in loan.repayments.all():
         transactions.append({
            'date': r.payment_date,
            'description': "Repayment Received",
            'ref': r.reference_number or "-",
            'debit': Decimal('0.00'),
            'credit': r.amount,
        })

    # Add Charges if positive
    # We don't have exact dates for interest accrual in this model, so we append it as "Accrued Interest & Fees"
    if charges_applied > 0:
         transactions.append({
            'date': today,
            'description': "Interest & Fees Accrued",
            'ref': "-",
            'debit': charges_applied,
            'credit': Decimal('0.00'),
        })
    elif charges_applied < 0:
        # This implies overpayment or data inconsistency
         transactions.append({
            'date': today,
            'description': "Balance Adjustment",
            'ref': "ADJ",
            'debit': Decimal('0.00'),
            'credit': abs(charges_applied),
        })

    transactions.sort(key=lambda x: x['date'])
    
    # Running Balance
    balance = Decimal('0.00')
    fmt_transactions = []
    
    for t in transactions:
        balance += t['debit']
        balance -= t['credit']
        fmt_transactions.append({
            'date': format_date_short(t['date']),
            'description': t['description'],
            'reference': t['ref'],
            'debit': format_money(t['debit']) if t['debit'] > 0 else "-",
            'credit': format_money(t['credit']) if t['credit'] > 0 else "-",
            'balance': format_money(balance)
        })

    context = {
        'organization': organization,
        'today_date': today.strftime("%d %b %Y"),
        'borrower_name': (borrower.name or "Valued Customer").upper(),
        'borrower_id': borrower.id_number or borrower.tax_id or "N/A",
        'borrower_address': borrower.physical_address or "Address Not Provided",
        'borrower_phone': borrower.phone_number or "N/A",
        'loan_number': loan.loan_number or "N/A",
        'product_name': loan.product.name.upper(),
        'principal': format_money(loan.principal_amount),
        'interest_rate': f"{loan.interest_rate or 0}% {loan.get_interest_period_display() or ''}",
        'term': f"{loan.term} {loan.repayment_frequency.title()}",
        'disbursed_date': format_date_short(loan.disbursement_date),
        'outstanding_balance': format_money(loan.outstanding_balance),
        'arrears_days': loan.days_in_arrears,
        'penalty_due': format_money(loan.outstanding_penalties),
        'transactions': fmt_transactions,
        'total_debits': format_money(loan.principal_amount + (charges_applied if charges_applied > 0 else 0)),
        'total_credits': format_money(total_repaid + (abs(charges_applied) if charges_applied < 0 else 0)),
    }
    
    ts = organization
    context.update({
        'company_name': (ts.company_name if ts and ts.company_name else "LENDER").upper(),
        'company_phone': ts.company_phone if ts and ts.company_phone else "N/A",
        'footer_text': ts.report_footer_text if ts and ts.report_footer_text else "Financial Excellence & Integrity",
        'primary_color': ts.primary_color if ts and ts.primary_color else '#2EAD8F',
        'logo_path': ts.logo.path if ts and ts.logo else '',
    })
    
    try:
        custom_template = DocumentTemplate.objects.filter(
            template_type='loan_statement',
            is_active=True
        ).first()
        
        if custom_template:
            from django.template import Template, Context as DjangoContext
            template = Template(custom_template.content)
            html_content = template.render(DjangoContext(context))
        else:
            html_content = render_to_string('default_loan_statement.html', context)
    except Exception as e:
        logger.error(f"Error rendering loan statement: {str(e)}")
        html_content = render_to_string('default_loan_statement.html', context)

    buffer = BytesIO()
    pisa_status = pisa.CreatePDF(html_content, dest=buffer)
    
    if not pisa_status.err:
        buffer.seek(0)
        return buffer
    else:
        raise Exception(f"PDF generation failed: {pisa_status.err}")


def generate_disbursement_letter(loan_obj):
    """
    Generate a branded PDF disbursement letter scoped to the organization.
    """
    if not pisa:
        raise ImportError("xhtml2pdf is not installed.")

    organization = loan_obj.organization

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
        disb_date = date.today()
        is_refinancing = bool(loan_obj.refinances_loan)
        payoff_amount = loan_obj.payoff_amount or Decimal('0.00')
        refinanced_loan_number = loan_obj.refinances_loan.loan_number if is_refinancing else None

        payoff_note = ""
        if is_refinancing:
            old = loan_obj.refinances_loan
            calc_payoff = old.outstanding_principal + old.outstanding_interest + old.outstanding_penalties
            if payoff_amount == 0:
                payoff_amount = calc_payoff
            payoff_note = f"Covers principal (KES {format_money(old.outstanding_principal)}), interest (KES {format_money(old.outstanding_interest)}), and penalties (KES {format_money(old.outstanding_penalties)})"
        
        total_deductions = sum(d.calculated_amount for d in loan_obj.deductions.filter(is_withheld=True))
        net_amount = (loan_obj.approved_amount or Decimal('0.00')) - total_deductions - payoff_amount
        method_str = "TBD"
        loan_ref = loan_obj.application_number
    else:
        first_schedule = loan_obj.schedules.all().order_by('due_date').first()
        disb_date = loan_obj.disbursement_date
        app = loan_obj.application
        is_refinancing = bool(app.refinances_loan)
        payoff_amount = app.payoff_amount or Decimal('0.00')
        refinanced_loan_number = app.refinances_loan.loan_number if is_refinancing else None

        payoff_note = ""
        if is_refinancing:
            old = app.refinances_loan
            calc_payoff = old.outstanding_principal + old.outstanding_interest + old.outstanding_penalties
            if payoff_amount == 0:
                payoff_amount = calc_payoff
            payoff_note = f"Covers principal (KES {format_money(old.outstanding_principal)}), interest (KES {format_money(old.outstanding_interest)}), and penalties (KES {format_money(old.outstanding_penalties)})"
        
        net_amount = loan_obj.disbursed_amount
        method_str = loan_obj.get_disbursement_method_display().upper()
        loan_ref = loan_obj.loan_number or "N/A"

    is_company = borrower.borrower_type in ['company', 'institution', 'group']
    if is_company:
        ctx_borrower_name = (borrower.business_name or borrower.name or "Valued Institution").upper()
        ctx_borrower_id = borrower.tax_id or borrower.id_number or "N/A"
    else:
        ctx_borrower_name = f"{borrower.first_name} {borrower.last_name}".upper()
        ctx_borrower_id = f"{borrower.id_number} (NATIONAL ID)" if borrower.id_number else "N/A"

    contact_name = "____________________"
    contact_designation = "____________________"
    if is_company:
        primary_contact = borrower.contacts.filter(is_primary=True).first()
        if primary_contact:
            contact_name = f"{primary_contact.first_name} {primary_contact.last_name}".upper()
            contact_designation = (primary_contact.designation or "Director").upper()

    loan_officer = getattr(borrower, 'loan_officer', None)
    officer_name = f"{loan_officer.first_name} {loan_officer.last_name}".upper() if loan_officer else "AUTHORIZED SIGNATORY"

    context = {
        'organization': organization,
        'letter_date': format_date_long(date.today()),
        'loan_ref': loan_ref,
        'borrower_name': ctx_borrower_name,
        'borrower_id': ctx_borrower_id,
        'borrower_number': borrower.borrower_number or loan_obj.application_number or "N/A",
        'footer_id_val': ctx_borrower_id,
        'is_company': is_company,
        'contact_name': contact_name,
        'contact_designation': contact_designation,
        'loan_officer_name': officer_name,
        'disb_date': format_date_short(disb_date),
        'method': method_str,
        'net_amount': format_money(net_amount),
        'installment_amount': format_money(first_schedule.principal_due + first_schedule.interest_due if first_schedule else Decimal('0.00')),
        'first_due_date': format_date_long(first_schedule.due_date) if first_schedule else "N/A",
        'repayment_channel': loan_obj.get_repayment_channel_display().upper() if hasattr(loan_obj, 'repayment_channel') else "N/A",
        'payoff_amount': format_money(payoff_amount),
        'payoff_note': payoff_note,
        'refinanced_loan_number': refinanced_loan_number,
        'payment_details': loan_obj.disbursement_details if hasattr(loan_obj, 'disbursement_details') else {},
    }
    
    ts = organization
    context.update({
        'company_name': (ts.company_name if ts and ts.company_name else "LENDER").upper(),
        'company_address': ts.company_address if ts and ts.company_address else "Address Not Provided",
        'company_phone': ts.company_phone if ts and ts.company_phone else "N/A",
        'company_email': ts.company_email if ts and ts.company_email else "support@lms.com",
        'company_tagline': ts.company_tagline if ts and ts.company_tagline else "Your Financial Growth Partner",
        'primary_color': ts.primary_color if ts and ts.primary_color else '#2EAD8F',
        'secondary_color': ts.secondary_color if ts and ts.secondary_color else '#64748b',
        'logo_path': ts.logo.path if ts and ts.logo else '',
    })
    
    try:
        custom_template = DocumentTemplate.objects.filter(
            template_type='disbursement_letter',
            is_active=True
        ).first()
        
        if custom_template:
            from django.template import Template, Context as DjangoContext
            template = Template(custom_template.content)
            html_content = template.render(DjangoContext(context))
        else:
            html_content = render_to_string('default_disbursement_letter.html', context)
    except Exception as e:
        logger.error(f"Error rendering disbursement letter: {str(e)}")
        html_content = render_to_string('default_disbursement_letter.html', context)

    buffer = BytesIO()
    pisa_status = pisa.CreatePDF(html_content, dest=buffer)
    
    if not pisa_status.err:
        buffer.seek(0)
        return buffer
    else:
        raise Exception(f"PDF generation failed: {pisa_status.err}")


def render_document_preview(template_obj):
    """
    Generate a preview of a document template using mock data.
    """
    if not pisa:
        return None

    from dateutil.relativedelta import relativedelta
    from django.template import Template, Context
    
    organization = Organization.objects.first()
    
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
        'organization': organization,
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
    
    class MockObj:
        def __init__(self, **entries):
            self.__dict__.update(entries)
    
    context['application'] = MockObj(**context['application'])
    context['borrower'] = MockObj(**context['borrower'])
    context['product'] = MockObj(**context['product'])
    
    template = Template(template_obj.content)
    html_content = template.render(Context(context))
    
    buffer = BytesIO()
    pisa_status = pisa.CreatePDF(html_content, dest=buffer)
    if not pisa_status.err:
        buffer.seek(0)
        return buffer
    return None
