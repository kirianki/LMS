from rest_framework import serializers
from django.db import transaction
from django_tenants.utils import schema_context
from django.contrib.auth import get_user_model
from apps.users.models import Role
from .models import Tenant, Domain, Module, Subscription, TenantSettings, DocumentTemplate

User = get_user_model()

class DomainSerializer(serializers.ModelSerializer):
    class Meta:
        model = Domain
        fields = ('domain', 'is_primary')

class TenantSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = TenantSettings
        fields = '__all__'
        read_only_fields = ('tenant',)

class TenantSerializer(serializers.ModelSerializer):
    domains = DomainSerializer(many=True, read_only=True)
    settings = TenantSettingsSerializer(required=False)
    # Proxy fields for easier updates via Multipart
    logo = serializers.ImageField(write_only=True, required=False)
    
    domain_url = serializers.CharField(write_only=True)
    owner_email = serializers.EmailField(write_only=True)
    owner_password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    owner_name = serializers.CharField(write_only=True)

    class Meta:
        model = Tenant
        fields = ('id', 'name', 'schema_name', 'kra_pin', 'status', 'created_on', 'domains', 'settings',
                  'domain_url', 'owner_email', 'owner_password', 'owner_name', 'logo')
        read_only_fields = ('id', 'created_on', 'domains')
    
    def update(self, instance, validated_data):
        settings_data = validated_data.pop('settings', None)
        logo = validated_data.pop('logo', None)
        
        # Update Tenant fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update Settings fields
        if settings_data or logo:
            settings_instance = instance.settings
            if settings_data:
                for attr, value in settings_data.items():
                    setattr(settings_instance, attr, value)
            if logo:
                settings_instance.logo = logo
            settings_instance.save()
            
        return instance

    def create(self, validated_data):
        domain_url = validated_data.pop('domain_url')
        owner_email = validated_data.pop('owner_email')
        owner_password = validated_data.pop('owner_password')
        owner_name = validated_data.pop('owner_name')

        schema_name = validated_data.get('schema_name')

        # 0. Pre-creation validation
        if Tenant.objects.filter(schema_name=schema_name).exists():
            raise serializers.ValidationError({"schema_name": "This schema name is already taken."})
        
        if Domain.objects.filter(domain=domain_url).exists():
            raise serializers.ValidationError({"domain_url": "This domain is already taken."})

        with transaction.atomic():
            # 1. Create Tenant & Domain in PUBLIC schema context
            # This is critical to avoid "Can't create tenant outside the public schema" error
            # when the request originates from a tenant sub-domain.
            with schema_context('public'):
                tenant = Tenant.objects.create(**validated_data)
                Domain.objects.create(domain=domain_url, tenant=tenant, is_primary=True)
                
                # 2.5 Auto-create port 9090 alias for local dev environment
                if 'localhost' in domain_url and not ':' in domain_url:
                    Domain.objects.get_or_create(domain=f"{domain_url}:9090", tenant=tenant, defaults={'is_primary': False})

            # 2. Bootstrap Owner in the new Tenant Schema
            try:
                with schema_context(tenant.schema_name):
                    # The 'Administrator' role and other defaults are created via 
                    # signal (apps.tenants.signals.bootstrap_tenant_data) 
                    # triggered by post_schema_sync during tenant creation.
                    
                    try:
                        admin_role = Role.objects.get(name='Administrator')
                    except Role.DoesNotExist:
                        # Fallback if signal hasn't finished or failed
                        admin_role = Role.objects.create(name='Administrator', description="Tenant Owner")

                    # Create Owner User
                    parts = owner_name.split(' ')
                    first_name = parts[0]
                    last_name = ' '.join(parts[1:]) if len(parts) > 1 else ''
                    
                    user = User(
                        email=owner_email,
                        first_name=first_name,
                        last_name=last_name,
                        role=admin_role,
                        is_staff=True,
                        is_active=True,
                        is_superuser=True 
                    )
                    user.set_password(owner_password)
                    user._history_user = None
                    user.save()
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Tenant bootstrapping failed for {tenant.schema_name}: {str(e)}")
                # We might want to re-raise if we want to roll back the whole thing
                raise serializers.ValidationError({"detail": f"Tenant created but owner bootstrapping failed: {str(e)}"})
            
            return tenant

class SubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscription
        fields = ('id', 'tenant', 'plan', 'start_date', 'expiry_date', 'is_active')
        read_only_fields = ('id', 'start_date')

class ModuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Module
        fields = ('id', 'name', 'description')
class DocumentTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentTemplate
        fields = '__all__'
        read_only_fields = ('tenant',)

    def create(self, validated_data):
        from django.db import connection
        validated_data['tenant'] = connection.tenant
        return super().create(validated_data)
