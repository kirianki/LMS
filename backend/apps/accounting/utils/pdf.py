from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from io import BytesIO
from decimal import Decimal
import datetime
import os
from apps.treasury.services.documents import get_tenant_branding, add_branded_header, add_branded_footer

def format_currency(amount):
    """Format decimal amount as KES currency string."""
    try:
        val = float(amount)
        return f"KES {val:,.2f}"
    except (ValueError, TypeError):
        return "KES 0.00"

def generate_balance_sheet_pdf(data, date, tenant):
    """Generate Balance Sheet PDF."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=1*cm, bottomMargin=1.5*cm)
    styles = getSampleStyleSheet()
    branding = get_tenant_branding(tenant)
    elements = []

    # Header
    add_branded_header(elements, branding, styles, f"BALANCE SHEET")
    elements.append(Paragraph(f"As of: {date}", styles['Normal']))
    elements.append(Spacer(1, 0.2*inch))

    # Balanced/Unbalanced Warning
    if not data.get('is_balanced', False):
        elements.append(Paragraph(
            "<font color='red'><b>WARNING: This Balance Sheet is Unbalanced! Assets do not equal Liabilities + Equity.</b></font>", 
            styles['Normal']
        ))
        elements.append(Spacer(1, 0.2*inch))

    def add_section(title, section_data):
        elements.append(Paragraph(f"<b>{title}</b>", styles['Heading3']))
        table_data = []
        for item in section_data['details']:
            table_data.append([
                Paragraph(item['name'], styles['Normal']), 
                format_currency(item['balance'])
            ])
        
        # Total Row
        table_data.append(["", ""]) # Spacer
        table_data.append([
            Paragraph(f"Total {title}", styles['Normal']), 
            format_currency(section_data['total'])
        ])

        t = Table(table_data, colWidths=[5*inch, 2*inch])
        t.setStyle(TableStyle([
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('LINEABOVE', (0, -1), (-1, -1), 1, colors.black),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 0.2*inch))

    add_section("ASSETS", data['assets'])
    add_section("LIABILITIES", data['liabilities'])
    add_section("EQUITY", data['equity'])

    # Grand Total Check
    elements.append(Spacer(1, 0.1*inch))
    total_le = Decimal(str(data['liabilities']['total'])) + Decimal(str(data['equity']['total']))
    
    table_data = [
        ["Total Assets", format_currency(data['assets']['total'])],
        ["Total Liabilities & Equity", format_currency(total_le)],
    ]
    t = Table(table_data, colWidths=[4*inch, 2*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.lightgrey),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('BOX', (0, 0), (-1, -1), 1, colors.black),
        ('PADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(t)

    doc.build(elements, onFirstPage=lambda c, d: add_branded_footer(c, d, branding),
              onLaterPages=lambda c, d: add_branded_footer(c, d, branding))
    buffer.seek(0)
    return buffer

def generate_profit_loss_pdf(data, start_date, end_date, tenant):
    """Generate Profit & Loss PDF."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=1*cm, bottomMargin=1.5*cm)
    styles = getSampleStyleSheet()
    branding = get_tenant_branding(tenant)
    elements = []

    add_branded_header(elements, branding, styles, f"PROFIT & LOSS STATEMENT")
    elements.append(Paragraph(f"Period: {start_date} to {end_date}", styles['Normal']))
    elements.append(Spacer(1, 0.2*inch))

    def add_section(title, section_data, color_base=colors.black):
        elements.append(Paragraph(f"<b>{title}</b>", styles['Heading3']))
        if not section_data['details']:
            elements.append(Paragraph("No records found.", styles['Normal']))
            return

        table_data = []
        for item in section_data['details']:
            table_data.append([
                Paragraph(item['name'], styles['Normal']), 
                format_currency(item['amount'])
            ])
        
        table_data.append(["", ""])
        table_data.append([
            Paragraph(f"Total {title}", styles['Normal']), 
            format_currency(section_data['total'])
        ])

        t = Table(table_data, colWidths=[5*inch, 2*inch])
        t.setStyle(TableStyle([
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('LINEABOVE', (0, -1), (-1, -1), 1, color_base),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 0.2*inch))

    add_section("INCOME", data['income'])
    add_section("EXPENSES", data['expenses'])

    # Net Profit
    net_profit = Decimal(str(data['net_profit']))
    profit_color = colors.green if net_profit >= 0 else colors.red
    
    t_net = Table([
        ["NET PROFIT / (LOSS)", format_currency(net_profit)]
    ], colWidths=[4*inch, 2*inch])
    t_net.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.whitesmoke),
        ('TEXTCOLOR', (1, 0), (1, 0), profit_color),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('BOX', (0, 0), (-1, -1), 1, colors.black),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('FONTSIZE', (0, 0), (-1, -1), 12),
    ]))
    elements.append(t_net)

    doc.build(elements, onFirstPage=lambda c, d: add_branded_footer(c, d, branding),
              onLaterPages=lambda c, d: add_branded_footer(c, d, branding))
    buffer.seek(0)
    return buffer

def generate_cash_flow_pdf(data, start_date, end_date, tenant):
    """Generate Cash Flow Statement PDF."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=1*cm, bottomMargin=1.5*cm)
    styles = getSampleStyleSheet()
    branding = get_tenant_branding(tenant)
    elements = []

    add_branded_header(elements, branding, styles, f"CASH FLOW STATEMENT")
    elements.append(Paragraph(f"Period: {start_date} to {end_date}", styles['Normal']))
    elements.append(Paragraph("(Direct Method)", styles['Normal']))
    elements.append(Spacer(1, 0.2*inch))

    elements.append(Paragraph("<b>OPERATING ACTIVITIES</b>", styles['Heading3']))
    
    # Inflows
    elements.append(Paragraph("<b>Cash Inflows</b>", styles['Normal']))
    if data['operating_activities']['inflow']:
        in_data = []
        for item in data['operating_activities']['inflow']:
            in_data.append([
                Paragraph(item.get('description', 'N/A'), styles['Normal']), 
                Paragraph(str(item.get('date', '')), styles['Normal']), 
                format_currency(item['amount'])
            ])
        # Adjusted colWidths: 4.5" for desc, 1" for date, 1.5" for amount
        t_in = Table(in_data, colWidths=[4.5*inch, 1*inch, 1.5*inch])
        t_in.setStyle(TableStyle([
            ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
            ('TEXTCOLOR', (2, 0), (2, -1), colors.green),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(t_in)
    else:
        elements.append(Paragraph("No inflows recorded.", styles['Normal']))
    elements.append(Spacer(1, 0.1*inch))

    # Outflows
    elements.append(Paragraph("<b>Cash Outflows</b>", styles['Normal']))
    if data['operating_activities']['outflow']:
        out_data = []
        for item in data['operating_activities']['outflow']:
            out_data.append([
                Paragraph(item.get('description', 'N/A'), styles['Normal']), 
                Paragraph(str(item.get('date', '')), styles['Normal']), 
                f"({format_currency(item['amount'])})"
            ])
        t_out = Table(out_data, colWidths=[4.5*inch, 1*inch, 1.5*inch])
        t_out.setStyle(TableStyle([
            ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
            ('TEXTCOLOR', (2, 0), (2, -1), colors.red),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(t_out)
    else:
        elements.append(Paragraph("No outflows recorded.", styles['Normal']))
    elements.append(Spacer(1, 0.2*inch))

    # Net Cash
    net_cash = Decimal(str(data['net_increase_in_cash']))
    t_net = Table([
        ["NET INCREASE / (DECREASE) IN CASH", format_currency(net_cash)]
    ], colWidths=[4.5*inch, 1.5*inch])
    t_net.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.whitesmoke),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('BOX', (0, 0), (-1, -1), 1, colors.black),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(t_net)

    doc.build(elements, onFirstPage=lambda c, d: add_branded_footer(c, d, branding),
              onLaterPages=lambda c, d: add_branded_footer(c, d, branding))
    buffer.seek(0)
    return buffer

def generate_trial_balance_pdf(data, date, tenant):
    """Generate Trial Balance PDF."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=1*cm, bottomMargin=1.5*cm)
    styles = getSampleStyleSheet()
    branding = get_tenant_branding(tenant)
    elements = []

    add_branded_header(elements, branding, styles, f"TRIAL BALANCE")
    elements.append(Paragraph(f"As of: {date}", styles['Normal']))
    elements.append(Spacer(1, 0.2*inch))

    table_data = [["Account Code", "Account Name", "Debit", "Credit"]]
    
    for item in data['report']:
        table_data.append([
            Paragraph(str(item['code']), styles['Normal']),
            Paragraph(item['name'], styles['Normal']),
            format_currency(item['debit']),
            format_currency(item['credit'])
        ])
        
    # Totals
    table_data.append([
        "", "TOTALS",
        format_currency(data['total_debit']),
        format_currency(data['total_credit'])
    ])

    t = Table(table_data, colWidths=[1*inch, 2.5*inch, 1.5*inch, 1.5*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), branding['primary_color']),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.whitesmoke, colors.white]),
        ('LINEABOVE', (0, -1), (-1, -1), 2, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(t)

    doc.build(elements, onFirstPage=lambda c, d: add_branded_footer(c, d, branding),
              onLaterPages=lambda c, d: add_branded_footer(c, d, branding))
    buffer.seek(0)
    return buffer

def generate_general_ledger_pdf(data, account_id, start_date, end_date, tenant):
    """Generate General Ledger PDF."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=1*cm, bottomMargin=1.5*cm)
    styles = getSampleStyleSheet()
    branding = get_tenant_branding(tenant)
    elements = []

    add_branded_header(elements, branding, styles, f"GENERAL LEDGER")
    elements.append(Paragraph(f"Period: {start_date} to {end_date}", styles['Normal']))
    elements.append(Spacer(1, 0.2*inch))

    def add_account_ledger(account_data):
        elements.append(Paragraph(f"<b>Account: {account_data['account_code']} - {account_data['account_name']}</b>", styles['Heading4']))
        # Opening Balance
        elements.append(Paragraph(f"Opening Balance: {format_currency(account_data['opening_balance'])}", styles['Normal']))
        elements.append(Spacer(1, 0.1*inch))

        table_data = [["Date", "Description", "Ref", "Debit", "Credit", "Balance"]]
        
        for item in account_data['history']:
            table_data.append([
                item['date'],
                Paragraph(item['description'], styles['Normal']), # Wrap text
                Paragraph(str(item['reference'] or "-"), styles['Normal']), # Wrap Ref too!
                format_currency(item['debit']) if item['debit'] > 0 else "-",
                format_currency(item['credit']) if item['credit'] > 0 else "-",
                format_currency(item['balance'])
            ])

        # Balanced widths: Date(0.8), Desc(2.2), Ref(1.1), Debit(1.1), Credit(1.1), Bal(1.2) = 7.5"
        t = Table(table_data, colWidths=[0.8*inch, 2.2*inch, 1.1*inch, 1*inch, 1*inch, 1.3*inch])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), branding['primary_color']),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            ('FONTSIZE', (0, 1), (-1, -1), 7), # Slightly smaller for body text to fit more
            ('ALIGN', (3, 0), (-1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 0.1*inch))
        elements.append(Paragraph(f"<b>Closing Balance: {format_currency(account_data['closing_balance'])}</b>", styles['Normal']))
        elements.append(Spacer(1, 0.3*inch))

    if data.get('is_bulk'):
        elements.append(Paragraph(f"<b>Summary:</b> Opening: {format_currency(data['total_opening'])} | Closing: {format_currency(data['total_closing'])}", styles['Normal']))
        elements.append(Spacer(1, 0.2*inch))
        for acc in data['accounts']:
            add_account_ledger(acc)
    else:
        add_account_ledger(data)

    doc.build(elements, onFirstPage=lambda c, d: add_branded_footer(c, d, branding),
              onLaterPages=lambda c, d: add_branded_footer(c, d, branding))
    buffer.seek(0)
    return buffer


def generate_generic_table_pdf(title, data_list, headers, filters, tenant, summary=None, col_widths=None):
    """Generate a generic tabular PDF report (for Disbursements, Collections, etc)."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=1*cm, bottomMargin=1.5*cm)
    styles = getSampleStyleSheet()
    branding = get_tenant_branding(tenant)
    elements = []

    add_branded_header(elements, branding, styles, title)
    
    # Filter info
    filter_text = []
    for k, v in filters.items():
        if v:
            filter_text.append(f"<b>{k}:</b> {v}")
    if filter_text:
        elements.append(Paragraph(" | ".join(filter_text), styles['Normal']))
    elements.append(Spacer(1, 0.2*inch))

    # Summary Section if provided
    if summary:
        elements.append(Paragraph("<b>Summary</b>", styles['Heading3']))
        sum_data = []
        for k, v in summary.items():
            # Format value if it looks like money
            val_str = str(v)
            if isinstance(v, (int, float, Decimal)) and 'count' not in k.lower():
               val_str = format_currency(v)
            sum_data.append([k.replace('_', ' ').title(), val_str])
        
        # Group summary into rows of 3
        rows = [sum_data[i:i+3] for i in range(0, len(sum_data), 3)]
        # This is a bit complex for a dynamic grid, simplifying to vertical list in 2 columns
        t_sum = Table(sum_data, colWidths=[2.5*inch, 2.5*inch])
        t_sum.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.whitesmoke),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('PADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(t_sum)
        elements.append(Spacer(1, 0.2*inch))

    # Main Data Table
    if data_list:
        # Extract keys from headers list of dicts or tuples if needed, assuming headers is list of (key, Label)
        # headers = [('date', 'Date'), ('amount', 'Amount'), ...]
        
        table_data = [[h[1] for h in headers]] # Header row
        
        for item in data_list:
            row = []
            for h in headers:
                key = h[0]
                val = item.get(key, '')
                # Basic formatting
                if 'amount' in key.lower() or 'balance' in key.lower() or 'principal' in key.lower() or 'interest' in key.lower() or 'fee' in key.lower():
                     try:
                         val = format_currency(val)
                     except:
                         pass
                # Wrap all values in Paragraph to ensure wrapping
                row.append(Paragraph(str(val), styles['Normal']))
            table_data.append(row)

        # Calculate column widths dynamically? 
        avail_width = 7.5*inch
        if col_widths:
            # If col_widths are provided as percentages or relative weights, convert to absolute
            total_weight = sum(col_widths)
            final_widths = [(w / total_weight) * avail_width for w in col_widths]
        else:
            col_count = len(headers)
            final_widths = [avail_width / col_count] * col_count
        
        t = Table(table_data, colWidths=final_widths)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), branding['primary_color']),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            # Wraps text
        ]))
        elements.append(t)
    else:
        elements.append(Paragraph("No data found for the selected criteria.", styles['Normal']))

    doc.build(elements, onFirstPage=lambda c, d: add_branded_footer(c, d, branding),
              onLaterPages=lambda c, d: add_branded_footer(c, d, branding))
    buffer.seek(0)
    return buffer

def generate_staff_payslip_pdf(payroll, tenant):
    """Generate a branded PDF payslip for a PayrollRecord (users app)."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=1*cm, bottomMargin=1.5*cm)
    styles = getSampleStyleSheet()
    branding = get_tenant_branding(tenant)
    elements = []

    # Custom styles
    header_style = ParagraphStyle(
        'HeaderStyle',
        parent=styles['Heading2'],
        alignment=TA_LEFT,
        textColor=branding['primary_color'],
        spaceAfter=12
    )
    
    label_style = ParagraphStyle('Label', parent=styles['Normal'], fontSize=9, fontName='Helvetica-Bold')
    value_style = ParagraphStyle('Value', parent=styles['Normal'], fontSize=9)
    total_style = ParagraphStyle('Total', parent=styles['Normal'], fontSize=10, fontName='Helvetica-Bold')

    # Add branded header
    add_branded_header(elements, branding, styles, f"PAYSLIP: {payroll.month}/{payroll.year}")
    
    # Staff Info
    elements.append(Paragraph("<b>Employee Information</b>", styles['Heading4']))
    elements.append(Spacer(1, 0.1*inch))
    
    staff_data = [
        [Paragraph("<b>Name:</b>", label_style), Paragraph(payroll.user.get_full_name(), value_style), 
         Paragraph("<b>ID/Email:</b>", label_style), Paragraph(payroll.user.email, value_style)],
        [Paragraph("<b>Employee ID:</b>", label_style), Paragraph(f"STF-{payroll.id.hex[:6].upper()}", value_style), 
         Paragraph("<b>Period:</b>", label_style), Paragraph(f"{payroll.month}/{payroll.year}", value_style)],
    ]
    t_staff = Table(staff_data, colWidths=[1.1*inch, 2.6*inch, 1.1*inch, 2.7*inch])
    t_staff.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('BACKGROUND', (0, 0), (0, -1), colors.whitesmoke),
        ('BACKGROUND', (2, 0), (2, -1), colors.whitesmoke),
    ]))
    elements.append(t_staff)
    elements.append(Spacer(1, 0.4*inch))

    # Earnings & Deductions Table
    elements.append(Paragraph("<b>Payment Breakdown</b>", styles['Heading4']))
    elements.append(Spacer(1, 0.1*inch))
    
    # Calculate Total Deductions
    total_deductions = payroll.nssf + payroll.shif + payroll.paye + payroll.housing_levy + payroll.other_deductions
    
    table_data = [
        [Paragraph("<b>EARNINGS</b>", label_style), "", Paragraph("<b>DEDUCTIONS</b>", label_style), ""],
        ["Basic Pay (+ Allowances)", format_currency(payroll.gross_pay), "PAYE (Income Tax)", f"({format_currency(payroll.paye)})"],
        ["", "", "SHIF (Health)", f"({format_currency(payroll.shif)})"],
        ["", "", "NSSF (Pension)", f"({format_currency(payroll.nssf)})"],
        ["", "", "Housing Levy", f"({format_currency(payroll.housing_levy)})"],
        ["", "", "Other Deductions", f"({format_currency(payroll.other_deductions)})"],
        ["", "", "", ""],
        [Paragraph("<b>TOTAL GROSS</b>", total_style), Paragraph(f"<b>{format_currency(payroll.gross_pay)}</b>", total_style), 
         Paragraph("<b>TOTAL DEDUCTIONS</b>", total_style), Paragraph(f"<b>({format_currency(total_deductions)})</b>", total_style)],
    ]

    t_breakdown = Table(table_data, colWidths=[2.5*inch, 1.2*inch, 2.3*inch, 1.5*inch])
    t_breakdown.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LINEBELOW', (0, 0), (3, 0), 1, branding['primary_color']),
        ('LINEABOVE', (0, -1), (3, -1), 1, colors.black),
        ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
        ('ALIGN', (3, 1), (3, -1), 'RIGHT'),
        ('PADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(t_breakdown)
    elements.append(Spacer(1, 0.5*inch))

    # Net Pay Final Card - Better sizing to avoid overlap
    net_data = [
        ["", "NET TAKE HOME PAY", format_currency(payroll.net_pay)]
    ]
    t_net = Table(net_data, colWidths=[3.5*inch, 2*inch, 2*inch])
    t_net.setStyle(TableStyle([
        ('BACKGROUND', (1, 0), (2, 0), branding['primary_color']),
        ('TEXTCOLOR', (1, 0), (2, 0), colors.white),
        ('FONTNAME', (1, 0), (2, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (1, 0), (2, 0), 12),
        ('ALIGN', (2, 0), (2, 0), 'RIGHT'),
        ('VALIGN', (1, 0), (2, 0), 'MIDDLE'),
        ('PADDING', (1, 0), (2, 0), 12),
    ]))
    elements.append(t_net)

    if payroll.status == 'paid':
        elements.append(Spacer(1, 0.4*inch))
        elements.append(Paragraph(f"<font color='grey'><i>Paid on {payroll.payment_date} via {payroll.reference}</i></font>", styles['Normal']))

    doc.build(elements, onFirstPage=lambda c, d: add_branded_footer(c, d, branding),
              onLaterPages=lambda c, d: add_branded_footer(c, d, branding))
    buffer.seek(0)
    return buffer
