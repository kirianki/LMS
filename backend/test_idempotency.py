import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.loans.tasks import send_upcoming_payment_reminders, send_overdue_payment_reminders
from apps.notifications.models import CommunicationLog
from django.utils import timezone

today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)

start_count = CommunicationLog.objects.count()
print(f"Starting CommunicationLog count: {start_count}")

print("\n--- Testing Upcoming Reminders ---")
print("Run 1...")
p1 = send_upcoming_payment_reminders()
c1 = CommunicationLog.objects.count()
print(f"Processed: {p1}, Log count: {c1} (+{c1 - start_count})")

print("Run 2...")
p2 = send_upcoming_payment_reminders()
c2 = CommunicationLog.objects.count()
print(f"Processed: {p2}, Log count: {c2} (+{c2 - c1})")

if c2 == c1:
    print("SUCCESS: No duplicates created for upcoming reminders.")
else:
    print("FAILURE: Duplicates created for upcoming reminders.")


print("\n--- Testing Overdue Reminders ---")
print("Run 1...")
p3 = send_overdue_payment_reminders()
c3 = CommunicationLog.objects.count()
print(f"Processed: {p3}, Log count: {c3} (+{c3 - c2})")

print("Run 2...")
p4 = send_overdue_payment_reminders()
c4 = CommunicationLog.objects.count()
print(f"Processed: {p4}, Log count: {c4} (+{c4 - c3})")

if c4 == c3:
    print("SUCCESS: No duplicates created for overdue reminders.")
else:
    print("FAILURE: Duplicates created for overdue reminders.")
