from apps.notifications.services import EmailService

def send_loan_reminder_email(org, borrower, loan, schedule_entry):
    """
    Send a loan payment reminder Email.
    """
    if not borrower.email:
        return {"success": False, "error": "Borrower has no email address"}

    email_service = EmailService(org)
    
    name = borrower.business_name if borrower.borrower_type in ['company', 'institution'] and borrower.business_name else borrower.first_name
    due_date_str = schedule_entry.due_date.strftime('%d/%m/%Y')
    amount_str = f"{schedule_entry.total_due:,.2f}"

    subject = f"Upcoming Loan Payment Reminder - {loan.loan_number}"
    body = (
        f"Dear {name},\n\n"
        f"This is a reminder that your loan payment of KES {amount_str} "
        f"for loan {loan.loan_number} is due on {due_date_str}.\n\n"
        f"PAYMENT DETAILS:\n"
        f"Bank: NCBA Bank\n"
        f"Paybill: 880100\n"
        f"Account: 699232\n\n"
        f"Please ensure timely payment to avoid penalties.\n\n"
        f"Thank you for choosing Salene Credit Ltd.\n\n"
        f"Best regards,\n"
        f"Salene Credit Ltd"
    )
    
    # Send staff notification as well
    staff_subject = f"STAFF NOTICE: Reminder sent to {borrower.first_name} - {loan.loan_number}"
    staff_body = (
        f"Hello Team,\n\n"
        f"This is to notify you that a payment reminder has been sent to {borrower.first_name} ({borrower.phone_number}).\n"
        f"Loan: {loan.loan_number}\n"
        f"Amount Due: KES {amount_str}\n"
        f"Due Date: {due_date_str}\n\n"
        f"Regards,\n"
        f"{org.company_name} Automation"
    )
    
    # Notify staff (company_email)
    if org.company_email:
        email_service.send_email(org.company_email, staff_subject, staff_body)

    return email_service.send_email(
        borrower.email, 
        subject,
        body, 
        related_loan=loan,
        related_borrower=borrower
    )

def send_overdue_reminder_email(org, borrower, loan, schedule_entry, days_overdue):
    """Send overdue payment reminder email."""
    if not borrower.email:
        return {"success": False, "error": "Borrower has no email address"}

    email_service = EmailService(org)
    
    name = borrower.business_name if borrower.borrower_type in ['company', 'institution'] and borrower.business_name else borrower.first_name
    amount_str = f"{schedule_entry.total_due:,.2f}"

    subject = f"URGENT: Overdue Loan Payment - {loan.loan_number}"
    body = (
        f"Dear {name},\n\n"
        f"Your loan payment of KES {amount_str} "
        f"for loan {loan.loan_number} is now {days_overdue} days OVERDUE.\n\n"
        f"PAYMENT DETAILS:\n"
        f"Bank: NCBA Bank\n"
        f"Paybill: 880100\n"
        f"Account: 699232\n\n"
        f"Please make payment immediately to avoid further penalties and negative reporting.\n\n"
        f"If you have already made this payment, please disregard this email.\n\n"
        f"Best regards,\n"
        f"Salene Credit Ltd"
    )
    
    # Send staff notification as well
    staff_subject = f"STAFF NOTICE: Overdue reminder sent to {borrower.first_name} - {loan.loan_number}"
    staff_body = (
        f"Hello Team,\n\n"
        f"This is to notify you that an OVERDUE payment reminder has been sent to {borrower.first_name} ({borrower.phone_number}).\n"
        f"Loan: {loan.loan_number}\n"
        f"Amount Due: KES {amount_str}\n"
        f"Days Overdue: {days_overdue}\n\n"
        f"Regards,\n"
        f"{org.company_name} Automation"
    )
    
    # Notify staff (company_email)
    if org.company_email:
        email_service.send_email(org.company_email, staff_subject, staff_body)

    return email_service.send_email(
        borrower.email, 
        subject,
        body,
        related_loan=loan,
        related_borrower=borrower
    )
