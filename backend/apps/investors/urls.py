from rest_framework.routers import DefaultRouter
from .views import InvestorViewSet, InvestmentViewSet, InvestorPayoutViewSet

router = DefaultRouter()
router.register(r'investors', InvestorViewSet)
router.register(r'investments', InvestmentViewSet)
router.register(r'payouts', InvestorPayoutViewSet)

urlpatterns = router.urls
