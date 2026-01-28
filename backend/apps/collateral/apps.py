from django.apps import AppConfig

class CollateralConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.collateral'

    def ready(self):
        import apps.collateral.signals

