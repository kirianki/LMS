from django.utils.deprecation import MiddlewareMixin

class TenantHeaderMiddleware(MiddlewareMixin):
    """
    Middleware that allows tenant identification via X-Tenant-Domain header.
    This is useful for:
    1. Development/Proxy situations where the Host header might be different (e.g. localhost vs actual domain)
    2. Mobile apps or external clients that need to target a specific tenant explicitly
    3. Manual "Locate Workspace" flow where we want to pretend to be on a tenant domain from localhost
    """
    def process_request(self, request):
        # Check for our custom header (converted to META key format)
        tenant_domain = request.META.get('HTTP_X_TENANT_DOMAIN')
        
        if tenant_domain:
            tenant_domain = tenant_domain.strip()
            # If the header contains a full URL, strip it to just the host
            if '://' in tenant_domain:
                tenant_domain = tenant_domain.split('://')[1]
            if '/' in tenant_domain:
                tenant_domain = tenant_domain.split('/')[0]
                
            # Log the override for debugging
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"[TenantMiddleware] Overriding Host '{request.META.get('HTTP_HOST')}' with '{tenant_domain}' from header")
            
            # Let's override the HTTP_HOST so django-tenants sees this as the request host
            # IMPORTANT: If we are in dev (localhost:9090), we must preserve the port!
            original_host = request.META.get('HTTP_HOST', '')
            if ':' in original_host and ':' not in tenant_domain:
                port = original_host.split(':')[-1]
                request.META['HTTP_HOST'] = f"{tenant_domain}:{port}"
            else:
                request.META['HTTP_HOST'] = tenant_domain
        # else:
        #    print(f"[TenantMiddleware] No X-Tenant-Domain header. Using Host: {request.META.get('HTTP_HOST')}")
