from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LoanProductViewSet, LoanApplicationViewSet,
    LoanViewSet, LoanFeeViewSet,
    CollectionCaseViewSet, CollectionNoteViewSet,
    PromiseToPayViewSet, RecoveryActionViewSet,
    CollateralDischargeViewSet, LoanGuarantorViewSet,
    LoanDocumentViewSet,
    arrears_reports, dashboard_summary, collections_forecast_detail,
    mpesa_c2b_validation, mpesa_c2b_confirmation,
    BulkLoanImportView
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
router.register(r'documents', LoanDocumentViewSet, basename='loandocument')


urlpatterns = [
    path('arrears_reports/', arrears_reports, name='arrears-reports'),
    path('collections_forecast_detail/', collections_forecast_detail, name='collections-forecast-detail'),
    path('dashboard_summary/', dashboard_summary, name='dashboard-summary'),
    path('bulk-import/', BulkLoanImportView.as_view(), name='bulk-import'),
    
    # M-Pesa C2B Webhooks
    path('mpesa/c2b/validation/', mpesa_c2b_validation, name='mpesa-c2b-validation'),
    path('mpesa/c2b/confirmation/', mpesa_c2b_confirmation, name='mpesa-c2b-confirmation'),
    
    path('', include(router.urls)),
]
