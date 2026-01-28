from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from .models import Role, Profile

User = get_user_model()

class RoleSerializer(serializers.ModelSerializer):
    permissions_list = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = ('id', 'name', 'description', 'approval_limit', 'permissions_list')
    
    def get_permissions_list(self, obj):
        return [f"{p.content_type.app_label}.{p.codename}" for p in obj.permissions.all()]

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ('avatar', 'phone_number', 'bio', 'job_title', 'location')

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)
    role = RoleSerializer(read_only=True)
    role_id = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(), 
        source='role', 
        write_only=True, 
        required=False,
        allow_null=True
    )
    profile = ProfileSerializer(required=False)
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'email', 'first_name', 'last_name', 'role', 'role_id', 'profile', 'permissions', 'is_active', 'is_staff', 'password', 'date_joined')
        read_only_fields = ('date_joined',)
    
    def get_permissions(self, obj):
        if obj.is_superuser:
            from django.contrib.auth.models import Permission
            return [f"{p.content_type.app_label}.{p.codename}" for p in Permission.objects.all()]
        if obj.role:
            return [f"{p.content_type.app_label}.{p.codename}" for p in obj.role.permissions.all()]
        return []

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        # Extract profile data from validated_data (JSON) or request.data (Multipart)
        profile_data = validated_data.pop('profile', None)
        
        # If no nested profile data, look for flat keys (common in multipart/form-data)
        request = self.context.get('request')
        if not profile_data and request:
            profile_data = {}
            for key in ['phone_number', 'bio', 'job_title', 'location', 'avatar']:
                # Look for 'profile.bio' or 'bio'
                flat_key = f'profile.{key}'
                if flat_key in request.data:
                    profile_data[key] = request.data[flat_key]
                elif key in request.data and key != 'avatar': # Avoid conflict with user fields
                    profile_data[key] = request.data[key]

        if 'password' in validated_data:
            password = validated_data.pop('password')
            instance.set_password(password)
            
        # Update user instance
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update profile instance
        if profile_data:
            profile, _ = Profile.objects.get_or_create(user=instance)
            for attr, value in profile_data.items():
                setattr(profile, attr, value)
            profile.save()
            
        return instance

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        # Add extra user data
        serializer = UserSerializer(self.user)
        data['user'] = serializer.data
        return data
