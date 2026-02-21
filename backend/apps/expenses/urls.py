from rest_framework.routers import DefaultRouter
from .views import ExpenseViewSet, StaffViewSet, PayrollViewSet

router = DefaultRouter()
router.register(r'expenses', ExpenseViewSet)
router.register(r'staff', StaffViewSet)
router.register(r'payroll', PayrollViewSet)

urlpatterns = router.urls
