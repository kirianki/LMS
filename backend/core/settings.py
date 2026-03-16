import os
import environ
from pathlib import Path
from celery.schedules import crontab

# --- Environment Configuration ---
env = environ.Env(
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, []),
)

# Build paths inside the project like this: BASE_DIR / 'parent'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Read .env file
environ.Env.read_env(os.path.join(BASE_DIR, '.env'))

# --- Security Settings ---
SECRET_KEY = env('SECRET_KEY')
DEBUG = env('DEBUG')
ALLOWED_HOSTS = env('ALLOWED_HOSTS')
CSRF_TRUSTED_ORIGINS = [f"http://{host}" for host in ALLOWED_HOSTS if host != '*']
# Add port 9090 variations for development through proxy
CSRF_TRUSTED_ORIGINS += ["http://62.84.184.62:90", "http://62.84.184.62", "http://*.localhost:9090", "http://localhost:90", "http://127.0.0.1:90", "http://*.localhost:90"]

# --- Proxy Configuration ---
USE_X_FORWARDED_HOST = True
USE_X_FORWARDED_PORT = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

AUTH_USER_MODEL = 'users.User'

# --- Application Definition ---
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'simple_history',
    'django_filters',
    'apps.core',
    'apps.users',
    'apps.accounts',  # Renamed from tenants for clarity
    'apps.customers',
    'apps.collateral',
    'apps.agents',
    'apps.loans',
    'apps.treasury',
    'apps.investors',
    'apps.expenses',
    'apps.accounting',
    'apps.savings',
    'apps.branches',
    'apps.auditlog',
    'apps.notifications',
]

# --- REST Framework Configuration ---
REST_FRAMEWORK = {
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'core.pagination.StandardResultsSetPagination',
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle'
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '10/minute',
        'user': '100/minute'
    }
}

# --- Spectacular Configuration ---
SPECTACULAR_SETTINGS = {
    'TITLE': 'MFI & SACCO Platform API',
    'DESCRIPTION': 'Core Financial Engine API Documentation',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}

# --- Middleware ---
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'simple_history.middleware.HistoryRequestMiddleware',
    'apps.users.middleware.CurrentUserMiddleware',
]

# --- CORS Configuration ---
CORS_ALLOW_ALL_ORIGINS = True

# --- URLs & WSGI ---
ROOT_URLCONF = 'core.urls'
# ROOT_URLCONF = 'dummy_urls'
WSGI_APPLICATION = 'core.wsgi.application'

# --- Database Configuration ---
DATABASES = {
    'default': env.db(),
}
DATABASES['default']['ENGINE'] = 'django.db.backends.postgresql'

# --- Templates ---
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# --- Password Validation ---
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# --- Internationalization ---
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Africa/Nairobi'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.1/howto/static-files/

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Celery Settings
CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://redis:6379/0")
CELERY_RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", "redis://redis:6379/1")
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE

# Celery Beat Schedule (Periodic Tasks)
CELERY_BEAT_SCHEDULE = {
    'update-arrears-status': {
        'task': 'apps.loans.tasks.update_arrears_status',
        'schedule': crontab(hour=8, minute=0),
    },
    'calculate-loan-penalties': {
        'task': 'apps.loans.tasks.calculate_loan_penalties',
        'schedule': crontab(hour=8, minute=5),
    },
    'send-overdue-payment-reminders': {
        'task': 'apps.loans.tasks.send_overdue_payment_reminders',
        'schedule': crontab(hour=8, minute=10),
    },
    'send-upcoming-payment-reminders': {
        'task': 'apps.loans.tasks.send_upcoming_payment_reminders',
        'schedule': crontab(hour=8, minute=15),
    },
    'check-payment-promises': {
        'task': 'apps.loans.tasks.check_payment_promises',
        'schedule': crontab(hour=8, minute=20),
    },
    'create-daily-financial-snapshots': {
        'task': 'apps.treasury.tasks.create_daily_financial_snapshots',
        'schedule': crontab(hour=8, minute=25),
    },
    'reconcile-treasury-coa': {
        'task': 'apps.treasury.tasks.reconcile_treasury_coa',
        'schedule': 60 * 60,  # Hourly
    },
}

# --- Email Configuration ---
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = env('EMAIL_HOST', default='localhost')
EMAIL_PORT = env.int('EMAIL_PORT', default=587)
EMAIL_USE_TLS = env.bool('EMAIL_USE_TLS', default=True)
EMAIL_HOST_USER = env('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL = env('DEFAULT_FROM_EMAIL', default=EMAIL_HOST_USER)

# --- Default Primary Key Field ---
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
