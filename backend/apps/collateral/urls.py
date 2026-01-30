from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CollateralViewSet, ValuerViewSet, 
    ValuationRequestViewSet, ValuationReportViewSet
)

router = DefaultRouter()
router.register(r'collateral', CollateralViewSet)
router.register(r'valuers', ValuerViewSet)
router.register(r'valuation-requests', ValuationRequestViewSet)
router.register(r'valuation-reports', ValuationReportViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
