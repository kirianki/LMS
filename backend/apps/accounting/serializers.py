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
        read_only_fields = ('journal_entry', 'is_posted')


class JournalEntrySerializer(serializers.ModelSerializer):
    ledger_entries = LedgerEntrySerializer(many=True)
    
    class Meta:
        model = JournalEntry
        fields = '__all__'
        read_only_fields = ('created_by', 'created_at')

    def validate(self, data):
        """Pre-validation to ensure entries are balanced."""
        ledger_entries = data.get('ledger_entries', [])
        if not ledger_entries:
            raise serializers.ValidationError("At least two ledger entries are required.")
            
        debits = sum(e['amount'] for e in ledger_entries if e['entry_type'] == 'debit')
        credits = sum(e['amount'] for e in ledger_entries if e['entry_type'] == 'credit')
        
        if debits != credits:
            raise serializers.ValidationError(
                f"The journal entry is not balanced. Total Debits: {debits}, Total Credits: {credits}"
            )
        return data

    def create(self, validated_data):
        ledger_entries_data = validated_data.pop('ledger_entries')
        journal_entry = JournalEntry.objects.create(**validated_data)
        for entry_data in ledger_entries_data:
            LedgerEntry.objects.create(journal_entry=journal_entry, **entry_data)
            
        return journal_entry
