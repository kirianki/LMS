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
            table_data.append([item['name'], format_currency(item['balance'])])
        
        # Total Row
        table_data.append(["", ""]) # Spacer
        table_data.append([f"<b>Total {title}</b>", f"<b>{format_currency(section_data['total'])}</b>"])

        t = Table(table_data, colWidths=[4*inch, 2*inch])
        t.setStyle(TableStyle([
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('LINEABOVE', (0, -1), (-1, -1), 1, colors.black),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
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
            table_data.append([item['name'], format_currency(item['balance'])])
        
        table_data.append(["", ""])
        table_data.append([f"<b>Total {title}</b>", f"<b>{format_currency(section_data['total'])}</b>"])

        t = Table(table_data, colWidths=[4*inch, 2*inch])
        t.setStyle(TableStyle([
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('LINEABOVE', (0, -1), (-1, -1), 1, color_base),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
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
            in_data.append([item.get('description', 'N/A'), item.get('date', ''), format_currency(item['amount'])])
        t_in = Table(in_data, colWidths=[3.5*inch, 1*inch, 1.5*inch])
        t_in.setStyle(TableStyle([
            ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
            ('TEXTCOLOR', (2, 0), (2, -1), colors.green),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
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
            out_data.append([item.get('description', 'N/A'), item.get('date', ''), f"({format_currency(item['amount'])})"])
        t_out = Table(out_data, colWidths=[3.5*inch, 1*inch, 1.5*inch])
        t_out.setStyle(TableStyle([
            ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
            ('TEXTCOLOR', (2, 0), (2, -1), colors.red),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
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
            item['code'],
            item['name'],
            format_currency(item['debit']),
            format_currency(item['credit'])
        ])
        
    # Totals
    table_data.append([
        "", "<b>TOTALS</b>",
        f"<b>{format_currency(data['total_debit'])}</b>",
        f"<b>{format_currency(data['total_credit'])}</b>"
    ])

    t = Table(table_data, colWidths=[1*inch, 3*inch, 1.5*inch, 1.5*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), branding['primary_color']),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.whitesmoke, colors.white]),
        ('LINEABOVE', (0, -1), (-1, -1), 2, colors.black),
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
    elements.append(Paragraph(f"Account: {data['account_code']} - {data['account_name']}", styles['Heading4']))
    elements.append(Paragraph(f"Period: {start_date} to {end_date}", styles['Normal']))
    elements.append(Spacer(1, 0.2*inch))

    # Opening Balance
    elements.append(Paragraph(f"<b>Opening Balance: {format_currency(data['opening_balance'])}</b>", styles['Normal']))
    elements.append(Spacer(1, 0.1*inch))

    table_data = [["Date", "Description", "Ref", "Debit", "Credit", "Balance"]]
    
    for item in data['history']:
        table_data.append([
            item['date'],
            Paragraph(item['description'], styles['Normal']), # Wrap text
            item['reference'],
            format_currency(item['debit']) if item['debit'] > 0 else "-",
            format_currency(item['credit']) if item['credit'] > 0 else "-",
            format_currency(item['balance'])
        ])

    t = Table(table_data, colWidths=[0.8*inch, 2.5*inch, 0.7*inch, 1*inch, 1*inch, 1.2*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), branding['primary_color']),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('ALIGN', (3, 0), (-1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 0.1*inch))
    
    elements.append(Paragraph(f"<b>Closing Balance: {format_currency(data['closing_balance'])}</b>", styles['Heading4']))

    doc.build(elements, onFirstPage=lambda c, d: add_branded_footer(c, d, branding),
              onLaterPages=lambda c, d: add_branded_footer(c, d, branding))
    buffer.seek(0)
    return buffer


def generate_generic_table_pdf(title, data_list, headers, filters, tenant, summary=None):
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
                row.append(str(val))
            table_data.append(row)

        # Calculate column widths dynamically? 
        # For simplicity, distribute evenly or use fixed
        col_count = len(headers)
        avail_width = 7.5*inch
        col_w = avail_width / col_count
        
        t = Table(table_data, colWidths=[col_w]*col_count)
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
