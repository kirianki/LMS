from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BranchViewSet, BranchAssignmentViewSet

router = DefaultRouter()
router.register(r'branches', BranchViewSet)
router.register(r'assignments', BranchAssignmentViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
