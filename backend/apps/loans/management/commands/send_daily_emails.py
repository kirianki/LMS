"""
Management command to send all today's loan emails.

Sends two categories of emails:
  1. Payment Due Reminders  — installments with due_date = today (status: pending/partial)
  2. Overdue Alerts         — installments with due_date < today (status: overdue/partial/pending)

Usage:
  python manage.py send_daily_emails
  python manage.py send_daily_emails --dry-run
  python manage.py send_daily_emails --only reminders        # only due-today
  python manage.py send_daily_emails --only overdue          # only overdue
  python manage.py send_daily_emails --days-ahead 3          # remind 3 days before due
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Send all loan payment reminder and overdue alert emails for today.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            default=False,
            help='Print what would be sent without actually sending emails.',
        )
        parser.add_argument(
            '--only',
            choices=['reminders', 'overdue'],
            default=None,
            help='Restrict to only one type. Default: both.',
        )
        parser.add_argument(
            '--days-ahead',
            type=int,
            default=0,
            help='Send reminders N days before the due date (default: 0 = today only).',
        )
        parser.add_argument(
            '--loan',
            type=str,
            default=None,
            help='Process only a specific loan number.',
        )

    def handle(self, *args, **options):
        from apps.loans.models import RepaymentSchedule
        from apps.loans.services.email import send_loan_reminder_email, send_overdue_reminder_email

        dry_run = options['dry_run']
        only = options['only']
        days_ahead = options['days_ahead']
        loan_filter = options.get('loan')

        today = timezone.localdate()
        reminder_date = today + timezone.timedelta(days=days_ahead)

        self.stdout.write(self.style.NOTICE(
            f"\n{'[DRY RUN] ' if dry_run else ''}Processing daily emails for {today}"
            f"{f' (reminding {days_ahead} days ahead → {reminder_date})' if days_ahead else ''}\n"
        ))

        sent_reminders = 0
        sent_overdue = 0
        errors = 0

        # ─────────────────────────────────────────────
        # 1. Payment Due Today (or within days_ahead)
        # ─────────────────────────────────────────────
        if only != 'overdue':
            due_qs = RepaymentSchedule.objects.filter(
                due_date=reminder_date,
                status__in=['pending', 'partial'],
                loan__isnull=False,
                loan__status='active',
            ).select_related('loan', 'loan__borrower', 'loan__organization')

            if loan_filter:
                due_qs = due_qs.filter(loan__loan_number=loan_filter)

            self.stdout.write(self.style.HTTP_INFO(
                f"📅 Due {'today' if days_ahead == 0 else f'on {reminder_date}'}: {due_qs.count()} installment(s)"
            ))

            for schedule in due_qs:
                loan = schedule.loan
                borrower = loan.borrower
                org = loan.organization

                if not borrower.email:
                    self.stdout.write(
                        self.style.WARNING(f"  ⚠  {loan.loan_number} — {borrower.name}: no email, skipping")
                    )
                    continue

                label = f"  📩 REMINDER  {loan.loan_number} → {borrower.name} ({borrower.email})"
                label += f"  | KES {schedule.total_due:,.2f} due {schedule.due_date}"

                if dry_run:
                    self.stdout.write(self.style.SUCCESS(f"[DRY RUN] {label}"))
                    sent_reminders += 1
                    continue

                try:
                    result = send_loan_reminder_email(org, borrower, loan, schedule)
                    if result and result.get('success', True):
                        self.stdout.write(self.style.SUCCESS(f"  ✓ {label}"))
                        sent_reminders += 1
                    else:
                        err = result.get('error', 'Unknown error') if result else 'No result'
                        self.stdout.write(self.style.ERROR(f"  ✗ {label}  → {err}"))
                        errors += 1
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"  ✗ {label}  → Exception: {e}"))
                    logger.exception(f"Error sending reminder for {loan.loan_number}: {e}")
                    errors += 1

        # ─────────────────────────────────────────────
        # 2. Overdue Installments (past due date)
        # ─────────────────────────────────────────────
        if only != 'reminders':
            overdue_qs = RepaymentSchedule.objects.filter(
                due_date__lt=today,
                status__in=['overdue', 'pending', 'partial'],
                loan__isnull=False,
                loan__status__in=['active', 'defaulted'],
            ).select_related('loan', 'loan__borrower', 'loan__organization')

            if loan_filter:
                overdue_qs = overdue_qs.filter(loan__loan_number=loan_filter)

            self.stdout.write(self.style.HTTP_INFO(
                f"⚠️  Overdue installments: {overdue_qs.count()} installment(s)"
            ))

            for schedule in overdue_qs:
                loan = schedule.loan
                borrower = loan.borrower
                org = loan.organization

                if not borrower.email:
                    self.stdout.write(
                        self.style.WARNING(f"  ⚠  {loan.loan_number} — {borrower.name}: no email, skipping")
                    )
                    continue

                days_overdue = (today - schedule.due_date).days
                label = (
                    f"  🔴 OVERDUE   {loan.loan_number} → {borrower.name} ({borrower.email})"
                    f"  | KES {schedule.total_due:,.2f}  |  {days_overdue} days overdue"
                )

                if dry_run:
                    self.stdout.write(self.style.WARNING(f"[DRY RUN] {label}"))
                    sent_overdue += 1
                    continue

                try:
                    result = send_overdue_reminder_email(org, borrower, loan, schedule, days_overdue)
                    if result and result.get('success', True):
                        self.stdout.write(self.style.SUCCESS(f"  ✓ {label}"))
                        sent_overdue += 1
                    else:
                        err = result.get('error', 'Unknown error') if result else 'No result'
                        self.stdout.write(self.style.ERROR(f"  ✗ {label}  → {err}"))
                        errors += 1
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"  ✗ {label}  → Exception: {e}"))
                    logger.exception(f"Error sending overdue alert for {loan.loan_number}: {e}")
                    errors += 1

        # ─────────────────────────────────────────────
        # Summary
        # ─────────────────────────────────────────────
        self.stdout.write("\n" + "─" * 60)
        if dry_run:
            self.stdout.write(self.style.NOTICE(
                f"[DRY RUN] Would send {sent_reminders} due reminders + {sent_overdue} overdue alerts. No emails sent."
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"Done.  ✓ {sent_reminders} reminders  +  ✓ {sent_overdue} overdue alerts  |  ✗ {errors} errors"
            ))
