from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BorrowerViewSet

router = DefaultRouter()
router.register(r'borrowers', BorrowerViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
