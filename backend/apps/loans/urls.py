from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LoanProductViewSet, LoanApplicationViewSet,
    LoanViewSet, LoanFeeViewSet,
    CollectionCaseViewSet, CollectionNoteViewSet,
    PromiseToPayViewSet, RecoveryActionViewSet,
    CollateralDischargeViewSet, LoanGuarantorViewSet,
    arrears_reports, dashboard_summary,
    mpesa_c2b_validation, mpesa_c2b_confirmation
)

router = DefaultRouter()
router.register(r'products', LoanProductViewSet, basename='loanproduct')
router.register(r'applications', LoanApplicationViewSet, basename='loanapplication')
router.register(r'loans', LoanViewSet, basename='loan')
router.register(r'fees', LoanFeeViewSet, basename='loanfee')
router.register(r'guarantors', LoanGuarantorViewSet, basename='loanguarantor')
router.register(r'collection-cases', CollectionCaseViewSet)
router.register(r'collection-notes', CollectionNoteViewSet)
router.register(r'promises-to-pay', PromiseToPayViewSet)
router.register(r'recovery-actions', RecoveryActionViewSet)
router.register(r'collateral-discharges', CollateralDischargeViewSet)


urlpatterns = [
    path('arrears_reports/', arrears_reports, name='arrears-reports'),
    path('dashboard_summary/', dashboard_summary, name='dashboard-summary'),
    
    # M-Pesa C2B Webhooks
    path('mpesa/c2b/validation/', mpesa_c2b_validation, name='mpesa-c2b-validation'),
    path('mpesa/c2b/confirmation/', mpesa_c2b_confirmation, name='mpesa-c2b-confirmation'),
    
    path('', include(router.urls)),
]
