from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BorrowerViewSet

router = DefaultRouter()
router.register(r'borrowers', BorrowerViewSet)
from .views import CustomerDocumentViewSet, FinancialStatementViewSet
router.register(r'documents', CustomerDocumentViewSet)
router.register(r'statements', FinancialStatementViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
