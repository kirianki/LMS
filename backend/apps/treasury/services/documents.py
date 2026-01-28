from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from io import BytesIO
from decimal import Decimal
import datetime
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
        'primary_color': colors.HexColor('#1E3A8A'),
        'secondary_color': colors.HexColor('#3B82F6'),
        'footer_text': 'This is a computer-generated document. No signature is required.',
    }
    
    # Get from tenant settings if available
    if hasattr(tenant, 'settings'):
        s = tenant.settings
        
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
            
        if s.logo and hasattr(s.logo, 'path'):
            branding['logo_path'] = s.logo.path
        if s.primary_color:
            try:
                branding['primary_color'] = colors.HexColor(s.primary_color)
            except:
                pass
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
    if branding['logo_path'] and os.path.exists(branding['logo_path']):
        try:
            logo = Image(branding['logo_path'], width=2*inch, height=0.8*inch)
            story.append(logo)
            story.append(Spacer(1, 0.2*inch))
        except:
            pass
    
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
    
    footer_text = branding['footer_text']
    canvas.drawCentredString(A4[0] / 2, 0.5*cm, footer_text)
    
    page_num = canvas.getPageNumber()
    canvas.drawRightString(A4[0] - 1*cm, 0.5*cm, f"Page {page_num}")
    
    canvas.restoreState()


def generate_investor_statement(investor, tenant):
    """Generate a branded PDF statement for an investor."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=1*cm, bottomMargin=1.5*cm)
    styles = getSampleStyleSheet()
    branding = get_tenant_branding(tenant)
    elements = []

    # Add branded header
    add_branded_header(elements, branding, styles, f"INVESTOR STATEMENT - {investor.name}")
    
    elements.append(Paragraph(f"Statement Date: {datetime.date.today().strftime('%d %B %Y')}", styles['Normal']))
    elements.append(Spacer(1, 0.2*inch))

    # Investor Details
    details_data = [
        ["Investor Number", investor.investor_number],
        ["Email", investor.email or "N/A"],
        ["Phone", investor.phone or "N/A"],
        ["Total Investments", str(investor.investments.count())],
    ]
    t = Table(details_data, colWidths=[2*inch, 3*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), branding['secondary_color']),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.white),
        ('GRID', (0, 0), (-1, -1), 1, branding['primary_color']),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 0.3*inch))

    # Investments Table
    elements.append(Paragraph("<b>Investment Portfolio Summary</b>", styles['Heading3']))
    inv_data = [["Inv. Number", "Date", "Principal", "Return Rate", "Paid Out", "Status"]]
    
    total_principal = Decimal('0')
    total_paid = Decimal('0')
    
    for inv in investor.investments.all():
        inv_data.append([
            inv.investment_number,
            inv.investment_date.strftime('%d/%m/%Y'),
            f"KES {inv.principal_amount:,.2f}",
            f"{inv.expected_return_rate}%",
            f"KES {inv.total_paid_out:,.2f}",
            inv.get_status_display()
        ])
        total_principal += inv.principal_amount
        total_paid += inv.total_paid_out
    
    # Add totals row
    inv_data.append([
        "", "<b>TOTALS</b>",
        f"<b>KES {total_principal:,.2f}</b>",
        "",
        f"<b>KES {total_paid:,.2f}</b>",
        ""
    ])
    
    t_inv = Table(inv_data, colWidths=[1.2*inch, 0.9*inch, 1.3*inch, 0.9*inch, 1.3*inch, 0.9*inch])
    t_inv.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), branding['primary_color']),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('GRID', (0, 0), (-1, -1), 0.5, branding['primary_color']),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('LINEABOVE', (0, -1), (-1, -1), 2, branding['primary_color']),
    ]))
    elements.append(t_inv)

    # Build with footer
    doc.build(elements, onFirstPage=lambda c, d: add_branded_footer(c, d, branding),
              onLaterPages=lambda c, d: add_branded_footer(c, d, branding))
    buffer.seek(0)
    return buffer


def generate_payslip(payroll, tenant):
    """Generate a branded PDF payslip for a staff member."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=1*cm, bottomMargin=1.5*cm)
    styles = getSampleStyleSheet()
    branding = get_tenant_branding(tenant)
    elements = []

    staff = payroll.staff

    # Add branded header
    add_branded_header(elements, branding, styles, f"PAYSLIP - {payroll.period}")
    
    elements.append(Paragraph(f"Print Date: {datetime.date.today().strftime('%d %B %Y')}", styles['Normal']))
    elements.append(Spacer(1, 0.2*inch))

    # Staff Info with branding
    staff_data = [
        ["Employee", f"{staff.first_name} {staff.last_name}", "Staff No", staff.employee_number],
        ["Department", staff.department, "Position", staff.position],
        ["KRA PIN", staff.kra_pin or "N/A", "ID Number", staff.id_number],
    ]
    t_staff = Table(staff_data, colWidths=[1.2*inch, 1.8*inch, 1.2*inch, 1.8*inch])
    t_staff.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), branding['secondary_color']),
        ('BACKGROUND', (2, 0), (2, -1), branding['secondary_color']),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.white),
        ('TEXTCOLOR', (2, 0), (2, -1), colors.white),
        ('GRID', (0, 0), (-1, -1), 1, branding['primary_color']),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(t_staff)
    elements.append(Spacer(1, 0.3*inch))

    # Earnings and Deductions
    elements.append(Paragraph("<b>EARNINGS</b>", styles['Heading3']))
    pay_data = [["Description", "Amount (KES)"]]
    pay_data.append(["Basic Salary", f"{payroll.basic_pay:,.2f}"])
    
    for item in payroll.items.filter(item_type='allowance'):
        pay_data.append([item.name, f"{item.amount:,.2f}"])
    
    pay_data.append(["<b>Gross Salary</b>", f"<b>{payroll.gross_pay:,.2f}</b>"])
    
    t_earnings = Table(pay_data, colWidths=[4*inch, 2*inch])
    t_earnings.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), branding['secondary_color']),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('LINEBELOW', (0, 0), (-1, 0), 1, branding['primary_color']),
        ('LINEABOVE', (0, -1), (-1, -1), 2, branding['primary_color']),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('PADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(t_earnings)
    elements.append(Spacer(1, 0.2*inch))
    
    # Deductions
    elements.append(Paragraph("<b>DEDUCTIONS</b>", styles['Heading3']))
    deduct_data = [["Description", "Amount (KES)"]]
    
    for item in payroll.items.filter(item_type='deduction'):
        deduct_data.append([item.name, f"{item.amount:,.2f}"])
    
    deduct_data.append(["<b>Total Deductions</b>", f"<b>{payroll.total_deductions:,.2f}</b>"])
    deduct_data.append(["", ""])
    deduct_data.append(["<b>NET SALARY</b>", f"<b>{payroll.net_pay:,.2f}</b>"])

    t_deduct = Table(deduct_data, colWidths=[4*inch, 2*inch])
    t_deduct.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), branding['secondary_color']),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('LINEBELOW', (0, 0), (-1, 0), 1, branding['primary_color']),
        ('LINEABOVE', (0, -2), (-1, -2), 2, branding['primary_color']),
        ('BACKGROUND', (0, -1), (-1, -1), branding['primary_color']),
        ('TEXTCOLOR', (0, -1), (-1, -1), colors.white),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('PADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(t_deduct)

    # Build with footer
    doc.build(elements, onFirstPage=lambda c, d: add_branded_footer(c, d, branding),
              onLaterPages=lambda c, d: add_branded_footer(c, d, branding))
    buffer.seek(0)
    return buffer
