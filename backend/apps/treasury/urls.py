from rest_framework.routers import DefaultRouter
from .views import CashAccountViewSet, TransactionViewSet, DailySnapshotViewSet

router = DefaultRouter()
router.register(r'accounts', CashAccountViewSet)
router.register(r'transactions', TransactionViewSet)
router.register(r'snapshots', DailySnapshotViewSet)

urlpatterns = router.urls
