from rest_framework import viewsets, permissions, parsers
from .permissions import HasRolePermission
from rest_framework.decorators import action
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, extend_schema_view
from django.contrib.auth import get_user_model
from .models import Role
from .serializers import UserSerializer, RoleSerializer

User = get_user_model()

@extend_schema_view(
    list=extend_schema(description="List all users in the tenant."),
    create=extend_schema(description="Register a new user in the tenant."),
    retrieve=extend_schema(description="Get user details."),
    update=extend_schema(description="Update user profile."),
    destroy=extend_schema(description="Deactivate or remove a user."),
)
class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    parser_classes = [parsers.JSONParser, parsers.MultiPartParser, parsers.FormParser]

    @action(detail=False, methods=['get'])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

@extend_schema_view(
    list=extend_schema(description="List available roles."),
    create=extend_schema(description="Define a new role with approval limits."),
)
class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
