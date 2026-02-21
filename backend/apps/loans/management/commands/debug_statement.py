from django.core.management.base import BaseCommand
from apps.loans.models import Loan
from apps.loans.services.documents import generate_loan_statement
import traceback

class Command(BaseCommand):
    help = 'Debug loan statement generation'

    def handle(self, *args, **options):
        try:
            loan_id = '4d8dffdd-e920-45a0-a3d4-533c2fc3cdb0'
            loan = Loan.objects.get(id=loan_id)
            print(f"Generating statement for loan: {loan.loan_number}")
            pdf = generate_loan_statement(loan)
            print("Success!")
        except Exception as e:
            print("Error generating statement:")
            traceback.print_exc()
