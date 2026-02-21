from rest_framework import serializers
from .models import Branch, BranchAssignment

class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = '__all__'

class BranchAssignmentSerializer(serializers.ModelSerializer):
    branch_name = serializers.ReadOnlyField(source='branch.name')
    
    class Meta:
        model = BranchAssignment
        fields = ['id', 'user', 'branch', 'branch_name', 'assigned_at']
