import threading

_thread_locals = threading.local()

def get_current_user():
    return getattr(_thread_locals, 'user', None)

def get_current_request():
    return getattr(_thread_locals, 'request', None)

class CurrentUserMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Default user from request
        user = getattr(request, 'user', None)

        # If user is anonymous or not set, try DRF JWT authentication
        if user is None or user.is_anonymous:
            try:
                from rest_framework_simplejwt.authentication import JWTAuthentication
                authenticator = JWTAuthentication()
                auth_res = authenticator.authenticate(request)
                if auth_res:
                    user = auth_res[0]
            except Exception:
                # Silently fail if JWT authentication fails or DRF not installed
                pass

        _thread_locals.user = user
        _thread_locals.request = request
        response = self.get_response(request)
        
        # Clean up to avoid memory leaks
        if hasattr(_thread_locals, 'user'):
            del _thread_locals.user
        if hasattr(_thread_locals, 'request'):
            del _thread_locals.request
        return response
