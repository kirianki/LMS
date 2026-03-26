from django.core.management.base import BaseCommand
from apps.loans.models import LoanApplication
from apps.loans.services.documents import generate_disbursement_letter
from django.core.files.base import ContentFile
from django.utils import timezone
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Regenerate disbursement checklists for accepted or disbursed loans.'

    def add_arguments(self, parser):
        parser.add_argument('--date', type=str, help='Filter by application update date (YYYY-MM-DD)')
        parser.add_argument('--app', type=str, help='Specific application number')
        parser.add_argument('--force', action='store_true', help='Force regeneration even if file exists')

    def handle(self, *args, **options):
        apps = LoanApplication.objects.filter(status__in=['offer_accepted', 'disbursed'])
        
        if options['app']:
            apps = apps.filter(application_number=options['app'])
        
        if options['date']:
            try:
                filter_date = datetime.strptime(options['date'], '%Y-%m-%d').date()
                apps = apps.filter(updated_at__date=filter_date)
            except ValueError:
                self.stderr.write("Invalid date format. Use YYYY-MM-DD.")
                return

        if not apps.exists():
            self.stdout.write("No matching applications found.")
            return

        self.stdout.write(f"Found {apps.count()} applications to process.")

        success_count = 0
        fail_count = 0

        for app in apps:
            if not options['force'] and app.disbursement_letter_file:
                self.stdout.write(f"Skipping {app.application_number} (file already exists). Use --force to regenerate.")
                continue

            self.stdout.write(f"Processing {app.application_number}...")
            try:
                # Use the loan object if disbursed, otherwise Use the application
                loan_obj = getattr(app, 'loan', None) if app.status == 'disbursed' else app
                if not loan_obj:
                    loan_obj = app

                pdf_buffer = generate_disbursement_letter(loan_obj)
                if pdf_buffer:
                    filename = f"disbursement_checklist_{app.application_number}.pdf"
                    if app.status == 'disbursed' and hasattr(loan_obj, 'loan_number'):
                        filename = f"disbursement_checklist_{loan_obj.loan_number}.pdf"
                    
                    # Delete old file if it exists to avoid suffixing
                    if app.disbursement_letter_file:
                        app.disbursement_letter_file.delete(save=False)
                        
                    app.disbursement_letter_file.save(filename, ContentFile(pdf_buffer.getvalue()), save=True)
                    self.stdout.write(self.style.SUCCESS(f"Successfully regenerated checklist for {app.application_number}"))
                    success_count += 1
                else:
                    self.stderr.write(f"Failed to generate PDF for {app.application_number}")
                    fail_count += 1
            except Exception as e:
                self.stderr.write(f"Error processing {app.application_number}: {str(e)}")
                fail_count += 1

        self.stdout.write(self.style.SUCCESS(f"Completed: {success_count} success, {fail_count} failed."))
