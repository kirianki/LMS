from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SavingsProductViewSet, SavingsAccountViewSet, SavingsTransactionViewSet

router = DefaultRouter()
router.register(r'products', SavingsProductViewSet)
router.register(r'accounts', SavingsAccountViewSet)
router.register(r'transactions', SavingsTransactionViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
