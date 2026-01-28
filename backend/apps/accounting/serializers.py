from rest_framework import serializers
from .models import ChartOfAccount, JournalEntry, LedgerEntry


class ChartOfAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChartOfAccount
        fields = '__all__'


class LedgerEntrySerializer(serializers.ModelSerializer):
    account_name = serializers.ReadOnlyField(source='account.name')
    
    class Meta:
        model = LedgerEntry
        fields = '__all__'


class JournalEntrySerializer(serializers.ModelSerializer):
    ledger_entries = LedgerEntrySerializer(many=True)
    
    class Meta:
        model = JournalEntry
        fields = '__all__'
        read_only_fields = ('created_by', 'created_at')

    def create(self, validated_data):
        ledger_entries_data = validated_data.pop('ledger_entries')
        journal_entry = JournalEntry.objects.create(**validated_data)
        for entry_data in ledger_entries_data:
            LedgerEntry.objects.create(journal_entry=journal_entry, **entry_data)
        
        # Verify if balanced (optional, the model or view could also enforce this)
        if not journal_entry.is_balanced():
            # In a real app, you might want to raise an error or delete the JE
            pass
            
        return journal_entry
