from rest_framework.routers import DefaultRouter
from .views import ChartOfAccountViewSet, JournalEntryViewSet, AccountingReportViewSet

router = DefaultRouter()
router.register(r'accounts', ChartOfAccountViewSet)
router.register(r'journal', JournalEntryViewSet)
router.register(r'reports', AccountingReportViewSet, basename='accounting-reports')

urlpatterns = router.urls
