"""
Email service for loan-related notifications.

Staff notification logic:
  The relationship manager (RM) for a borrower is determined by the following
  fallback chain:
    1. borrower.loan_officer  — the assigned staff member
    2. borrower.created_by   — the staff who onboarded the client
    3. First active is_staff user in the org  — org admin fallback
    4. org.company_email     — last resort (info inbox)

  This ensures that when a staff member is deleted, the notification
  automatically reaches the org admin until a new RM is assigned.
"""

from apps.notifications.services import EmailService
import logging

logger = logging.getLogger(__name__)


def get_relationship_manager_email(borrower, org):
    """
    Return the best staff email to notify when communicating with a borrower.

    Priority:
      1. borrower.loan_officer.email    (assigned relationship manager)
      2. borrower.created_by.email     (staff who onboarded the client)
      3. First active org admin (is_staff=True) in the org
      4. org.company_email             (shared inbox fallback)
    """
    # 1. Assigned loan officer / relationship manager
    if borrower.loan_officer_id and borrower.loan_officer and borrower.loan_officer.email:
        return borrower.loan_officer.email, borrower.loan_officer.get_full_name()

    # 2. Staff who created the borrower record
    if borrower.created_by_id and borrower.created_by and borrower.created_by.email:
        return borrower.created_by.email, borrower.created_by.get_full_name()

    # 3. Org admin fallback: first active staff user in the org
    try:
        from apps.users.models import User
        admin = (
            User.objects
            .filter(organization=org, is_staff=True, is_active=True)
            .order_by('date_joined')
            .first()
        )
        if admin and admin.email:
            return admin.email, admin.get_full_name()
    except Exception as e:
        logger.warning(f"Could not find org admin for fallback RM email: {e}")

    # 4. Shared company inbox
    if org.company_email:
        return org.company_email, org.company_name

    return None, None


def _notify_relationship_manager(email_service, borrower, org, event_type, event_details):
    """
    Send a staff notification to the relationship manager using the fallback chain.
    `event_type` is a short label like 'Payment Reminder' or 'Overdue Alert'.
    `event_details` is a dict with keys like 'loan_number', 'amount', etc.
    """
    rm_email, rm_name = get_relationship_manager_email(borrower, org)
    if not rm_email:
        logger.info(f"No RM email found for borrower {borrower.pk}; skipping staff notification.")
        return

    name = borrower.business_name if borrower.borrower_type in ['company', 'institution'] and borrower.business_name else borrower.first_name

    detail_lines = "\n".join(f"  {k}: {v}" for k, v in event_details.items())
    subject = f"[{event_type}] {name} — {event_details.get('loan_number', '')}"
    body = (
        f"Hi {rm_name},\n\n"
        f"This is an automated notice about your client {name} ({borrower.phone_number}).\n\n"
        f"Event: {event_type}\n"
        f"{detail_lines}\n\n"
        f"Please follow up as needed.\n\n"
        f"Regards,\n"
        f"{org.company_name} System"
    )

    try:
        email_service.send_email(rm_email, subject, body)
        # Also CC the shared info inbox if different from RM
        if org.company_email and org.company_email.lower() != rm_email.lower():
            email_service.send_email(org.company_email, subject, body)
    except Exception as e:
        logger.error(f"Failed to send RM notification to {rm_email}: {e}")


def send_loan_reminder_email(org, borrower, loan, schedule_entry):
    """Send a loan payment reminder email to the borrower and notify the RM."""
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
        f"Thank you for choosing {org.company_name}.\n\n"
        f"Best regards,\n"
        f"{org.company_name}"
    )

    # Notify the relationship manager
    _notify_relationship_manager(
        email_service, borrower, org,
        event_type="Payment Reminder Sent",
        event_details={
            "Loan Number": loan.loan_number,
            "Amount Due": f"KES {amount_str}",
            "Due Date": due_date_str,
        }
    )

    return email_service.send_email(
        borrower.email,
        subject,
        body,
        related_loan=loan,
        related_borrower=borrower
    )


def send_overdue_reminder_email(org, borrower, loan, schedule_entry, days_overdue):
    """Send overdue payment reminder email to the borrower and notify the RM."""
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
        f"{org.company_name}"
    )

    # Notify the relationship manager — escalate with urgency
    _notify_relationship_manager(
        email_service, borrower, org,
        event_type="⚠️ OVERDUE Alert",
        event_details={
            "Loan Number": loan.loan_number,
            "Amount Due": f"KES {amount_str}",
            "Days Overdue": days_overdue,
            "Action Required": "Please contact client immediately",
        }
    )

    return email_service.send_email(
        borrower.email,
        subject,
        body,
        related_loan=loan,
        related_borrower=borrower
    )
