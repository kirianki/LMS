from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Notification
from .serializers import NotificationSerializer

class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response({'status': 'notification marked as read'})

    @action(detail=False, methods=['post'])
    def mark_all_as_read(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({'status': 'all notifications marked as read'})

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        count = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({'unread_count': count})


from .models import CommunicationLog
from .serializers import CommunicationLogSerializer
from apps.loans.services.sms import SMSService

class CommunicationLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    View set for Communication Log.
    ReadOnly by default, but has actions to trigger sending.
    """
    queryset = CommunicationLog.objects.all()
    serializer_class = CommunicationLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['status', 'message_type', 'recipient', 'related_borrower', 'related_loan']
    search_fields = ['recipient', 'content', 'related_borrower__first_name']

    @action(detail=False, methods=['post'])
    def send_manual_message(self, request):
        """Manually send an SMS to a recipient."""
        recipient = request.data.get('recipient')
        message = request.data.get('message')
        
        if not recipient or not message:
            return Response(
                {'error': 'Recipient and message are required.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Use SMSService which now handles logging
        sms_service = SMSService(request.tenant.settings)
        
        borrower_id = request.data.get('borrower_id')
        loan_id = request.data.get('loan_id')
        
        result = sms_service.send_sms(
            recipient, 
            message, 
            borrower_id=borrower_id, 
            loan_id=loan_id
        )
        
        if result.get('success'):
            return Response({'status': 'Message sent successfully', 'result': result})
        else:
            return Response(
                {'error': 'Failed to send message', 'details': result}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
