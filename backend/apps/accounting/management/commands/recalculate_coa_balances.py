from django.core.management.base import BaseCommand
from django.db.models import Sum, Q
from decimal import Decimal
from apps.accounting.models import ChartOfAccount, LedgerEntry


class Command(BaseCommand):
    help = 'Recalculate all COA balances from posted ledger entries (source of truth)'

    def add_arguments(self, parser):
        parser.add_argument('--org', type=int, help='Only recalculate for a specific organization ID')
        parser.add_argument('--dry-run', action='store_true', help='Show what would change without saving')

    def handle(self, *args, **options):
        org_id = options.get('org')
        dry_run = options.get('dry_run', False)

        accounts = ChartOfAccount.objects.all()
        if org_id:
            accounts = accounts.filter(organization_id=org_id)

        self.stdout.write(self.style.HTTP_INFO(f'Recalculating balances for {accounts.count()} accounts...'))
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN — no changes will be saved.'))

        updated = 0
        skipped = 0

        for acc in accounts:
            entries = LedgerEntry.objects.filter(account=acc, is_posted=True)

            debits = entries.filter(entry_type='debit').aggregate(
                total=Sum('amount')
            )['total'] or Decimal('0.00')

            credits = entries.filter(entry_type='credit').aggregate(
                total=Sum('amount')
            )['total'] or Decimal('0.00')

            # Normal balance rules
            if acc.account_type in ['asset', 'expense']:
                correct_balance = debits - credits
            else:  # liability, equity, income
                correct_balance = credits - debits

            if acc.balance != correct_balance:
                old = acc.balance
                if not dry_run:
                    acc.balance = correct_balance
                    acc.save(update_fields=['balance'])
                updated += 1
                self.stdout.write(
                    f'  {acc.code} {acc.name:40s} | {old:>12.2f} → {correct_balance:>12.2f}'
                )
            else:
                skipped += 1

        self.stdout.write(self.style.SUCCESS(
            f'\n✓ Done. Updated: {updated} | Already correct: {skipped}'
        ))
