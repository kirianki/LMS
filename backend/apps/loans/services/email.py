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
        f"Please ensure timely payment to avoid penalties.\n\n"
        f"Thank you for choosing {org.company_name}.\n\n"
        f"Best regards,\n"
        f"The {org.company_name} team"
    )
    
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
        f"Please make payment immediately to avoid further penalties and negative reporting.\n\n"
        f"If you have already made this payment, please disregard this email.\n\n"
        f"Best regards,\n"
        f"The {org.company_name} team"
    )
    
    return email_service.send_email(
        borrower.email, 
        subject,
        body,
        related_loan=loan,
        related_borrower=borrower
    )
