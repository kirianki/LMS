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
from .services import EmailService

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
        """Manually send an SMS or Email to a recipient."""
        recipient = request.data.get('recipient')
        message = request.data.get('message')
        message_type = request.data.get('message_type', 'sms')  # 'sms' or 'email'
        subject = request.data.get('subject', '')
        
        if not recipient or not message:
            return Response(
                {'error': 'Recipient and message are required.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get organization from the authenticated user
        organization = getattr(request.user, 'organization', None)
        if not organization:
            return Response(
                {'error': 'No organization configured for your account.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Resolve optional related objects
        related_borrower = None
        related_loan = None
        borrower_id = request.data.get('borrower_id')
        loan_id = request.data.get('loan_id')
        
        if borrower_id:
            from apps.customers.models import Borrower
            related_borrower = Borrower.objects.filter(id=borrower_id).first()
        if loan_id:
            from apps.loans.models import Loan
            related_loan = Loan.objects.filter(id=loan_id).first()

        if message_type == 'email':
            if not subject:
                return Response(
                    {'error': 'Subject is required for email messages.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            email_service = EmailService(organization)
            result = email_service.send_email(
                recipient, subject, message,
                related_loan=related_loan,
                related_borrower=related_borrower
            )
        else:
            sms_service = SMSService(organization)
            result = sms_service.send_sms(
                recipient, message,
                related_loan=related_loan,
                related_borrower=related_borrower
            )
        
        if result.get('success'):
            return Response({'status': 'Message sent successfully', 'result': result})
        else:
            return Response(
                {'error': 'Failed to send message', 'details': result}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def send_with_document(self, request):
        """Send an email with a system-generated document attached."""
        recipient_email = request.data.get('recipient')
        document_type = request.data.get('document_type')  # 'offer_letter', 'loan_statement', 'disbursement_letter'
        application_id = request.data.get('application_id')
        loan_id = request.data.get('loan_id')
        custom_message = request.data.get('message', '')
        
        if not recipient_email:
            return Response({'error': 'Recipient email is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not document_type:
            return Response({'error': 'Document type is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not application_id and not loan_id:
            return Response({'error': 'Either application_id or loan_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
            
        organization = getattr(request.user, 'organization', None)
        if not organization:
            return Response({'error': 'No organization configured.'}, status=status.HTTP_400_BAD_REQUEST)

        # Generate the document
        try:
            from apps.loans.services import generate_offer_letter, generate_loan_statement, generate_disbursement_letter
            from apps.loans.models import LoanApplication, Loan
            
            pdf_buffer = None
            filename = ''
            subject = ''
            related_loan = None
            related_borrower = None
            
            if document_type == 'offer_letter' and application_id:
                application = LoanApplication.objects.get(id=application_id)
                related_borrower = application.borrower
                pdf_buffer = generate_offer_letter(application)
                filename = f"Offer_Letter_{application.application_number}.pdf"
                subject = f"Offer Letter - {application.application_number}"
                
            elif document_type == 'disbursement_letter' and application_id:
                application = LoanApplication.objects.get(id=application_id)
                related_borrower = application.borrower
                pdf_buffer = generate_disbursement_letter(application)
                filename = f"Disbursement_Checklist_{application.application_number}.pdf"
                subject = f"Disbursement Checklist - {application.application_number}"

            elif document_type == 'loan_statement' and loan_id:
                loan = Loan.objects.get(id=loan_id)
                related_loan = loan
                related_borrower = loan.borrower
                pdf_buffer = generate_loan_statement(loan)
                filename = f"Loan_Statement_{loan.loan_number}.pdf"
                subject = f"Loan Statement - {loan.loan_number}"
            else:
                return Response({'error': f'Unsupported document_type "{document_type}" or missing ID.'}, status=status.HTTP_400_BAD_REQUEST)

            if not pdf_buffer:
                return Response({'error': 'Failed to generate document.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            company_name = organization.company_name or 'Lender'
            borrower_name = ''
            if related_borrower:
                borrower_name = related_borrower.business_name if related_borrower.borrower_type in ['company', 'institution'] else f"{related_borrower.first_name} {related_borrower.last_name}"

            body = custom_message or (
                f"Dear {borrower_name},\n\n"
                f"Please find attached: {filename.replace('_', ' ').replace('.pdf', '')}.\n\n"
                f"Best regards,\n{company_name}"
            )

            email_service = EmailService(organization)
            attachments = [(filename, pdf_buffer.getvalue(), 'application/pdf')]
            
            result = email_service.send_email(
                recipient_email, subject, body,
                related_loan=related_loan,
                related_borrower=related_borrower,
                attachments=attachments
            )
            
            if result.get('success'):
                return Response({'status': 'Document sent successfully'})
            else:
                return Response({'error': 'Failed to send document', 'details': result}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Error sending document: {e}", exc_info=True)
            return Response({'error': f'Error: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
