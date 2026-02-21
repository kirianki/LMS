#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Function to wait for database
wait_for_db() {
    echo "Waiting for database..."
    while ! nc -z $DB_HOST $DB_PORT; do
      sleep 0.1
    done
    echo "Database is up!"
}

# Wait for DB if DB_HOST and DB_PORT are set
if [ -n "$DB_HOST" ] && [ -n "$DB_PORT" ]; then
    wait_for_db
fi

if [ "$RUN_MIGRATIONS" = "1" ]; then
    # Create database migrations
    echo "Creating database migrations..."
    python manage.py makemigrations --noinput

    # Apply database migrations
    echo "Applying database migrations..."
    python manage.py migrate --noinput

    # Create default Organization if not exists
    echo "Ensuring Organization exists..."
    python -c "
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from apps.accounts.models import Organization
if not Organization.objects.exists():
    Organization.objects.create(company_name='Aurum Finance')
    print('Default Organization created.')
else:
    print('Organization already exists.')
"

    # Collect static files
    echo "Collecting static files..."
    python manage.py collectstatic --noinput
fi

# Start server
# Execute the passed command if provided
if [ $# -gt 0 ]; then
    exec "$@"
else
    # Start server default behavior
    echo "Starting server..."
    # Check if DEBUG is on (for development)
    if [ "$DEBUG" = "True" ] || [ "$DEBUG" = "1" ]; then
        python manage.py runserver 0.0.0.0:8000
    else
        exec gunicorn core.wsgi:application --bind 0.0.0.0:8000 --workers 3
    fi
fi
