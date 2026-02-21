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
    """Get comprehensive tenant branding info from Organization."""
    # Default branding
    branding = {
        'company_name': getattr(tenant, 'company_name', 'Financial Institution'),
        'tagline': getattr(tenant, 'company_tagline', ''),
        'address': getattr(tenant, 'company_address', 'P.O. Box 12345, Nairobi, Kenya'),
        'postal_address': getattr(tenant, 'company_postal_address', ''),
        'city': getattr(tenant, 'company_city', 'Nairobi'),
        'country': getattr(tenant, 'company_country', 'Kenya'),
        'phone': getattr(tenant, 'company_phone', '+254 700 000 000'),
        'email': getattr(tenant, 'company_email', 'info@company.co.ke'),
        'website': getattr(tenant, 'website', ''),
        'registration_number': getattr(tenant, 'registration_number', ''),
        'tax_id': getattr(tenant, 'tax_identification', ''),
        'logo_path': None,
        'primary_color': colors.HexColor('#2EAD8F'),
        'secondary_color': colors.HexColor('#3B82F6'),
        'footer_text': getattr(tenant, 'report_footer_text', 'This is a computer-generated document. No signature is required.'),
    }
    
    # Handle logo
    if hasattr(tenant, 'logo') and tenant.logo and hasattr(tenant.logo, 'path'):
        branding['logo_path'] = tenant.logo.path
        
    # Handle colors
    if hasattr(tenant, 'primary_color') and tenant.primary_color:
        try:
            branding['primary_color'] = colors.HexColor(tenant.primary_color)
        except:
            pass
    if hasattr(tenant, 'secondary_color') and tenant.secondary_color:
        try:
            branding['secondary_color'] = colors.HexColor(tenant.secondary_color)
        except:
            pass
    
    return branding


def add_branded_header(story, branding, styles, title="DOCUMENT"):
    """Add a branded header to the PDF story."""
    # Logo Handling
    logo = None
    if branding['logo_path'] and os.path.exists(branding['logo_path']):
        try:
            img = Image(branding['logo_path'])
            # Calc aspect ratio
            img_w = img.imageWidth
            img_h = img.imageHeight
            aspect = img_h / float(img_w)
            
            # Constraints
            max_w = 2.0 * inch
            max_h = 1.0 * inch
            
            display_w = max_w
            display_h = display_w * aspect
            
            if display_h > max_h:
                display_h = max_h
                display_w = display_h / aspect
                
            logo = Image(branding['logo_path'], width=display_w, height=display_h)
            logo.hAlign = 'LEFT'
        except:
            pass
            
    # Styles
    company_style = ParagraphStyle(
        'HeaderCompany',
        parent=styles['Heading2'],
        alignment=TA_RIGHT,
        textColor=branding['primary_color'],
        fontSize=15,
        spaceAfter=6
    )
    details_style = ParagraphStyle(
        'HeaderDetails',
        parent=styles['Normal'],
        alignment=TA_RIGHT,
        fontSize=9,
        leading=11
    )
    
    # Text Content
    company_text = f"<b>{branding['company_name']}</b>"
    
    details_lines = []
    if branding['tagline']:
        details_lines.append(f"<i>{branding['tagline']}</i>")
        
    addr_parts = [branding['address'], branding['city']]
    if branding['country'] != 'Kenya':
        addr_parts.append(branding['country'])
    details_lines.append(" | ".join(filter(None, addr_parts)))
    
    contacts = [f"Tel: {branding['phone']}", f"Email: {branding['email']}"]
    if branding['website']:
        contacts.append(f"Web: {branding['website']}")
    details_lines.append(" | ".join(contacts))
    
    reg_parts = []
    if branding['registration_number']: reg_parts.append(f"Reg: {branding['registration_number']}")
    if branding['tax_id']: reg_parts.append(f"TIN: {branding['tax_id']}")
    if reg_parts:
        details_lines.append(" | ".join(reg_parts))
        
    # Layout (2-Column Table if Logo exists)
    if logo:
        # Right Column content
        right_col = [Paragraph(company_text, company_style)]
        for line in details_lines:
            right_col.append(Paragraph(line, details_style))
            
        data = [[logo, right_col]]
        # Col Widths: Logo 2.2 inch, Text 4.0 inch (Fits within margins)
        t = Table(data, colWidths=[2.2*inch, 4.0*inch])
        t.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('ALIGN', (0,0), (0,0), 'LEFT'),  # Logo Left
            ('ALIGN', (1,0), (1,0), 'RIGHT'), # Text Right
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ]))
        story.append(t)
    else:
        # Centered Fallback
        c_style = ParagraphStyle('CenterHead', parent=company_style, alignment=TA_CENTER)
        d_style = ParagraphStyle('CenterDet', parent=details_style, alignment=TA_CENTER)
        
        story.append(Paragraph(company_text, c_style))
        for line in details_lines:
            story.append(Paragraph(line, d_style))
            
    story.append(Spacer(1, 0.2*inch))
    
    # Document Title
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading2'],
        alignment=TA_CENTER,
        textColor=branding['primary_color'],
        spaceBefore=6,
        spaceAfter=12
    )
    story.append(Paragraph(f"<b>{title}</b>", title_style))
    story.append(Spacer(1, 0.1*inch))

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
