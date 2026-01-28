from io import BytesIO
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from django.conf import settings
from datetime import date
import os


def get_tenant_branding(tenant):
    """Get comprehensive tenant branding info from TenantSettings."""
    # Default branding
    branding = {
        'company_name': getattr(tenant, 'name', 'Financial Institution'),
        'tagline': '',
        'address': 'P.O. Box 12345, Nairobi, Kenya',
        'postal_address': '',
        'city': 'Nairobi',
        'country': 'Kenya',
        'phone': '+254 700 000 000',
        'email': 'info@company.co.ke',
        'website': '',
        'registration_number': '',
        'tax_id': '',
        'logo_path': None,
        'primary_color': colors.HexColor('#1E3A8A'),  # Default blue
        'secondary_color': colors.HexColor('#3B82F6'),  # Lighter blue
        'footer_text': 'This is a computer-generated document. No signature is required.',
    }
    
    # Get from tenant settings if available
    if hasattr(tenant, 'settings'):
        s = tenant.settings
        
        # Company information
        if s.company_name:
            branding['company_name'] = s.company_name
        if s.company_tagline:
            branding['tagline'] = s.company_tagline
        if s.registration_number:
            branding['registration_number'] = s.registration_number
        if s.tax_identification:
            branding['tax_id'] = s.tax_identification
        if s.website:
            branding['website'] = s.website
            
        # Contact information
        if s.company_address:
            branding['address'] = s.company_address
        if s.company_postal_address:
            branding['postal_address'] = s.company_postal_address
        if s.company_city:
            branding['city'] = s.company_city
        if s.company_country:
            branding['country'] = s.company_country
        if s.company_phone:
            branding['phone'] = s.company_phone
        if s.company_email:
            branding['email'] = s.company_email
            
        # Branding assets
        if s.logo and hasattr(s.logo, 'path'):
            branding['logo_path'] = s.logo.path
        if s.primary_color:
            try:
                branding['primary_color'] = colors.HexColor(s.primary_color)
            except:
                pass  # Keep default if invalid color
        if s.secondary_color:
            try:
                branding['secondary_color'] = colors.HexColor(s.secondary_color)
            except:
                pass
        if s.report_footer_text:
            branding['footer_text'] = s.report_footer_text
    
    return branding


def add_branded_header(story, branding, styles, title="DOCUMENT"):
    """Add a branded header to the PDF story."""
    # Logo if available
    if branding['logo_path'] and os.path.exists(branding['logo_path']):
        try:
            logo = Image(branding['logo_path'], width=2*inch, height=0.8*inch)
            story.append(logo)
            story.append(Spacer(1, 0.2*inch))
        except:
            pass  # Skip logo if there's an error
    
    # Company name and tagline
    company_style = ParagraphStyle(
        'CompanyName',
        parent=styles['Heading1'],
        alignment=TA_CENTER,
        textColor=branding['primary_color'],
    )
    story.append(Paragraph(f"<b>{branding['company_name']}</b>", company_style))
    
    if branding['tagline']:
        tagline_style = ParagraphStyle('Tagline', parent=styles['Normal'], alignment=TA_CENTER, fontSize=9, italic=True)
        story.append(Paragraph(branding['tagline'], tagline_style))
    
    # Contact information
    contact_info = f"{branding['address']}"
    if branding['postal_address']:
        contact_info += f" | {branding['postal_address']}"
    
    contact_style = ParagraphStyle('Contact', parent=styles['Normal'], alignment=TA_CENTER, fontSize=9)
    story.append(Paragraph(contact_info, contact_style))
    story.append(Paragraph(
        f"Tel: {branding['phone']} | Email: {branding['email']}" + 
        (f" | Web: {branding['website']}" if branding['website'] else ""),
        contact_style
    ))
    
    if branding['registration_number'] or branding['tax_id']:
        reg_info = ""
        if branding['registration_number']:
            reg_info += f"Reg No: {branding['registration_number']}"
        if branding['tax_id']:
            reg_info += f" | TIN: {branding['tax_id']}" if reg_info else f"TIN: {branding['tax_id']}"
        story.append(Paragraph(reg_info, contact_style))
    
    story.append(Spacer(1, 0.3*inch))
    
    # Title
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading2'],
        alignment=TA_CENTER,
        textColor=branding['primary_color'],
    )
    story.append(Paragraph(f"<b>{title}</b>", title_style))
    story.append(Spacer(1, 0.3*inch))


def add_branded_footer(canvas, doc, branding):
    """Add a branded footer to each page."""
    canvas.saveState()
    canvas.setFont('Times-Roman', 8)
    canvas.setFillGray(0.5)
    
    # Footer text
    footer_text = branding['footer_text']
    canvas.drawCentredString(A4[0] / 2, 0.5*cm, footer_text)
    
    # Page number
    page_num = canvas.getPageNumber()
    canvas.drawRightString(A4[0] - 1*cm, 0.5*cm, f"Page {page_num}")
    
    canvas.restoreState()


def generate_offer_letter(loan_application, tenant):
    """
    Generate a branded PDF offer letter for an approved loan application.
    
    Returns: BytesIO buffer containing PDF
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=1*cm, bottomMargin=1.5*cm)
    
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='Center', alignment=TA_CENTER))
    styles.add(ParagraphStyle(name='Right', alignment=TA_RIGHT))
    
    branding = get_tenant_branding(tenant)
    story = []
    
    # Add branded header
    add_branded_header(story, branding, styles, "LOAN OFFER LETTER")
    
    # Date and Reference
    story.append(Paragraph(f"Date: {date.today().strftime('%d %B %Y')}", styles['Right']))
    story.append(Paragraph(f"Ref: {loan_application.application_number}", styles['Normal']))
    story.append(Spacer(1, 0.2*inch))
    
    # Customer details
    customer = loan_application.customer
    story.append(Paragraph(f"<b>To:</b> {customer.first_name} {customer.last_name}", styles['Normal']))
    story.append(Paragraph(f"ID: {customer.id_number}", styles['Normal']))
    story.append(Spacer(1, 0.3*inch))
    
    # Salutation
    story.append(Paragraph(f"Dear {customer.first_name},", styles['Normal']))
    story.append(Spacer(1, 0.2*inch))
    
    # Body
    story.append(Paragraph(
        f"We are pleased to inform you that your loan application has been <b>APPROVED</b>. "
        f"Please find below the details of your loan offer:",
        styles['Normal']
    ))
    story.append(Spacer(1, 0.3*inch))
    
    # Loan details table with branding colors
    product = loan_application.product
    data = [
        ['Loan Product', product.name],
        ['Approved Amount', f"KES {loan_application.approved_amount:,.2f}"],
        ['Loan Term', f"{loan_application.approved_term} {product.get_term_unit_display()}"],
        ['Interest Rate', f"{loan_application.approved_interest_rate}% {loan_application.get_approved_interest_period_display()} ({loan_application.get_approved_interest_method_display()})"],
        ['Total Interest', f"KES {loan_application.calculated_interest:,.2f}"],
        ['Processing Fee', f"KES {loan_application.processing_fee:,.2f}"],
    ]
    
    table = Table(data, colWidths=[2.5*inch, 3*inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), branding['secondary_color']),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.white),
        ('GRID', (0, 0), (-1, -1), 1, branding['primary_color']),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(table)
    story.append(Spacer(1, 0.3*inch))
    
    # Deductions section
    deductions = loan_application.deductions.all()
    if deductions:
        story.append(Spacer(1, 0.2*inch))
        story.append(Paragraph("<b>Deductions & Fees:</b>", styles['Normal']))
        
        deduction_data = [['Description', 'Method', 'Amount']]
        for d in deductions:
            deduction_data.append([
                d.name,
                d.get_charge_method_display(),
                f"KES {d.calculated_amount:,.2f}"
            ])
        
        total_deduction = sum(d.calculated_amount for d in deductions)
        deduction_data.append(['<b>Total Deductions</b>', '', f"<b>KES {total_deduction:,.2f}</b>"])
        deduction_data.append(['<b>Net Disbursement</b>', '', f"<b>KES {loan_application.approved_amount - total_deduction:,.2f}</b>"])
        
        deduction_table = Table(deduction_data, colWidths=[2.5*inch, 1.5*inch, 1.5*inch])
        deduction_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), branding['secondary_color']),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
            ('PADDING', (0, 0), (-1, -1), 6),
            ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
        ]))
        story.append(deduction_table)
    
    story.append(Spacer(1, 0.3*inch))
    
    # Terms and conditions
    story.append(Paragraph("<b>Terms and Conditions:</b>", styles['Normal']))
    story.append(Paragraph("1. This offer is valid for 14 days from the date of this letter.", styles['Normal']))
    story.append(Paragraph("2. Loan disbursement is subject to completion of all required documentation.", styles['Normal']))
    story.append(Paragraph("3. Late payments will attract a penalty as stated in the product guide.", styles['Normal']))
    story.append(Paragraph("4. The borrower agrees to the loan terms upon acceptance.", styles['Normal']))
    story.append(Spacer(1, 0.4*inch))
    
    # Acceptance section
    story.append(Paragraph("<b>ACCEPTANCE</b>", styles['Heading3']))
    story.append(Paragraph(
        "I, the undersigned, hereby accept the above loan offer and agree to abide by the terms and conditions.",
        styles['Normal']
    ))
    story.append(Spacer(1, 0.4*inch))
    
    # Signature lines
    sig_data = [
        ['_________________________', '_________________________'],
        ['Borrower Signature', 'Date'],
        ['', ''],
        ['_________________________', '_________________________'],
        ['Witness Signature', 'Date'],
    ]
    sig_table = Table(sig_data, colWidths=[2.5*inch, 2.5*inch])
    story.append(sig_table)
    
    # Build PDF with footer
    doc.build(story, onFirstPage=lambda c, d: add_branded_footer(c, d, branding),
              onLaterPages=lambda c, d: add_branded_footer(c, d, branding))
    buffer.seek(0)
    return buffer


def generate_loan_statement(loan, tenant):
    """
    Generate a branded PDF loan statement showing payment history.
    
    Returns: BytesIO buffer containing PDF
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=1*cm, bottomMargin=1.5*cm)
    
    styles = getSampleStyleSheet()
    branding = get_tenant_branding(tenant)
    story = []
    
    # Add branded header
    add_branded_header(story, branding, styles, "LOAN STATEMENT")
    
    story.append(Paragraph(f"Generated: {date.today().strftime('%d %B %Y')}", styles['Normal']))
    story.append(Spacer(1, 0.2*inch))
    
    # Loan summary
    customer = loan.customer
    story.append(Paragraph(f"<b>Borrower:</b> {customer.first_name} {customer.last_name}", styles['Normal']))
    story.append(Paragraph(f"<b>Loan Number:</b> {loan.loan_number}", styles['Normal']))
    story.append(Paragraph(f"<b>Disbursement Date:</b> {loan.disbursement_date.strftime('%d %B %Y')}", styles['Normal']))
    story.append(Paragraph(f"<b>Maturity Date:</b> {loan.maturity_date.strftime('%d %B %Y')}", styles['Normal']))
    story.append(Spacer(1, 0.2*inch))
    
    # Balance summary with branding colors
    summary_data = [
        ['Principal Amount', f"KES {loan.principal_amount:,.2f}"],
        ['Total Interest', f"KES {loan.total_interest:,.2f}"],
        ['Total Fees', f"KES {loan.total_fees:,.2f}"],
        ['Outstanding Balance', f"KES {loan.outstanding_balance:,.2f}"],
    ]
    summary_table = Table(summary_data, colWidths=[2.5*inch, 2*inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), branding['secondary_color']),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.white),
        ('GRID', (0, 0), (-1, -1), 1, branding['primary_color']),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 0.3*inch))
    
    # Payment history
    story.append(Paragraph("<b>Payment History</b>", styles['Heading3']))
    
    payments = loan.repayments.all().order_by('payment_date')
    if payments:
        payment_data = [['Date', 'Amount', 'Method', 'Reference']]
        for p in payments:
            payment_data.append([
                p.payment_date.strftime('%d/%m/%Y'),
                f"KES {p.amount:,.2f}",
                p.get_payment_method_display(),
                p.reference_number or '-',
            ])
        
        payment_table = Table(payment_data, colWidths=[1.2*inch, 1.5*inch, 1.5*inch, 1.5*inch])
        payment_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), branding['primary_color']),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('GRID', (0, 0), (-1, -1), 1, branding['primary_color']),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(payment_table)
    else:
        story.append(Paragraph("No payments recorded yet.", styles['Normal']))
    
    # Build PDF with footer
    doc.build(story, onFirstPage=lambda c, d: add_branded_footer(c, d, branding),
              onLaterPages=lambda c, d: add_branded_footer(c, d, branding))
    buffer.seek(0)
    return buffer


def generate_disbursement_letter(loan, tenant):
    """
    Generate a branded PDF disbursement letter confirming the funds release.
    
    Returns: BytesIO buffer containing PDF
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=1*cm, bottomMargin=1.5*cm)
    
    styles = getSampleStyleSheet()
    branding = get_tenant_branding(tenant)
    story = []
    
    # Add branded header
    add_branded_header(story, branding, styles, "LOAN DISBURSEMENT ADVICE")
    
    # Date and Reference
    story.append(Paragraph(f"Date: {date.today().strftime('%d %B %Y')}", styles['Right'] if 'Right' in styles else styles['Normal']))
    story.append(Paragraph(f"Loan No: {loan.loan_number}", styles['Normal']))
    story.append(Spacer(1, 0.2*inch))
    
    # Customer details
    customer = loan.customer
    story.append(Paragraph(f"<b>Borrower:</b> {customer.first_name} {customer.last_name}", styles['Normal']))
    story.append(Spacer(1, 0.3*inch))
    
    story.append(Paragraph(
        f"This is to confirm that the following loan has been disbursed as per your accepted offer letter. "
        f"The funds have been released via <b>{loan.get_disbursement_method_display()}</b>.",
        styles['Normal']
    ))
    story.append(Spacer(1, 0.3*inch))
    
    # Disbursement Breakdown
    data = [
        ['Principal Amount', f"KES {loan.principal_amount:,.2f}"],
        ['Total Fees & Deductions', f"KES {loan.total_fees:,.2f}"],
        ['Net Disbursed Amount', f"KES {loan.disbursed_amount:,.2f}"],
        ['Disbursement Date', loan.disbursement_date.strftime('%d %B %Y')],
        ['First Payment Date', loan.schedules.all().order_by('due_date').first().due_date.strftime('%d %B %Y')],
    ]
    
    table = Table(data, colWidths=[2.5*inch, 3*inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), branding['secondary_color']),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.white),
        ('GRID', (0, 0), (-1, -1), 1, branding['primary_color']),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(table)
    story.append(Spacer(1, 0.4*inch))
    
    story.append(Paragraph(
        "Please ensure timely repayments to maintain a good credit score and qualify for future facilities.",
        styles['Normal']
    ))
    story.append(Spacer(1, 0.4*inch))
    
    story.append(Paragraph("Authorized Signature:", styles['Normal']))
    story.append(Spacer(1, 0.5*inch))
    story.append(Paragraph("_________________________", styles['Normal']))
    story.append(Paragraph(f"Loans Department, {branding['company_name']}", styles['Normal']))
    
    # Build PDF with footer
    doc.build(story, onFirstPage=lambda c, d: add_branded_footer(c, d, branding),
              onLaterPages=lambda c, d: add_branded_footer(c, d, branding))
    buffer.seek(0)
    return buffer
