from django.core.management.base import BaseCommand
from django.utils import timezone
from decimal import Decimal
from apps.treasury.models import CashAccount
from apps.accounting.models import ChartOfAccount
from apps.accounting.services import create_double_entry


# Mapping from CashAccount.AccountType to COA code
TYPE_TO_COA = {
    CashAccount.AccountType.BANK: '1110',
    CashAccount.AccountType.CASH: '1120',
    CashAccount.AccountType.MOBILE_MONEY: '1130',
}


class Command(BaseCommand):
    help = 'Link Treasury CashAccounts to their matching COA codes and post opening balance journal entries'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Show what would change without saving')

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)

        accounts = CashAccount.objects.select_related('organization', 'coa_account').all()
        self.stdout.write(self.style.HTTP_INFO(f'Processing {accounts.count()} cash account(s)...'))

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN — no changes will be saved.'))

        for ca in accounts:
            org = ca.organization
            coa_code = TYPE_TO_COA.get(ca.account_type)

            if not coa_code:
                self.stdout.write(self.style.WARNING(f'  SKIP {ca.name}: unknown account type "{ca.account_type}"'))
                continue

            if not org:
                self.stdout.write(self.style.WARNING(f'  SKIP {ca.name}: no organization linked'))
                continue

            # 1. Link COA account
            try:
                coa = ChartOfAccount.objects.get(code=coa_code, organization=org)
            except ChartOfAccount.DoesNotExist:
                self.stdout.write(self.style.ERROR(
                    f'  SKIP {ca.name}: COA {coa_code} not found for org {org.company_name}'
                ))
                continue

            if ca.coa_account != coa:
                old_link = ca.coa_account.code if ca.coa_account else 'NONE'
                self.stdout.write(self.style.SUCCESS(
                    f'  LINK {ca.name} → COA {coa_code} (was: {old_link})'
                ))
                if not dry_run:
                    ca.coa_account = coa
                    ca.save(update_fields=['coa_account'])
            else:
                self.stdout.write(f'  OK   {ca.name} already linked to COA {coa_code}')

            # 2. Post opening balance journal entry if opening_balance > 0
            if ca.opening_balance and ca.opening_balance > Decimal('0.00'):
                # Check if we already posted an opening balance JE for this account
                ref = f'OPENING-{ca.id}'
                from apps.accounting.models import JournalEntry
                if JournalEntry.objects.filter(reference=ref).exists():
                    self.stdout.write(f'  OK   Opening balance JE already exists for {ca.name}')
                    continue

                self.stdout.write(self.style.SUCCESS(
                    f'  POST Opening balance JE: DR {coa_code} / CR 3400 = {ca.opening_balance}'
                ))
                if not dry_run:
                    # Ensure 3400 exists
                    try:
                        ChartOfAccount.objects.get(code='3400', organization=org)
                    except ChartOfAccount.DoesNotExist:
                        self.stdout.write(self.style.ERROR(
                            f'  ERROR: COA 3400 not found for {org.company_name}. Run init_coa first.'
                        ))
                        continue

                    create_double_entry(
                        date=timezone.now().date(),
                        description=f'Opening balance for treasury account: {ca.name}',
                        reference=ref,
                        debits=[(coa_code, ca.opening_balance)],
                        credits=[('3400', ca.opening_balance)],
                        organization=org,
                    )

        self.stdout.write(self.style.SUCCESS('\n✓ Treasury → COA linking complete!'))
