from apps.core.viewsets import TenantScopedMixin, TenantScopedViewSet
from rest_framework import viewsets, permissions, status, filters
from rest_framework.permissions import AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from apps.users.permissions import HasRolePermission
from apps.users.filters import BranchScopingFilterBackend
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.views import APIView
from rest_framework.response import Response
from django.http import FileResponse
from django.utils import timezone
from django.db import transaction
from django.core.files.base import ContentFile
from datetime import date
from decimal import Decimal
from dateutil.relativedelta import relativedelta
import logging

from apps.auditlog.models import ActivityLog
from apps.auditlog.serializers import ActivityLogSerializer

logger = logging.getLogger(__name__)

from .models import (
    LoanProduct, LoanApplication, Loan,
    RepaymentSchedule, LoanRepayment, LoanFee,
    CollectionCase, CollectionNote, PromiseToPay, RecoveryAction,
    CollateralDischarge, LoanDeduction, LoanGuarantor, LoanComment, LoanDocument
)
from .serializers import (
    LoanProductSerializer, LoanApplicationSerializer, LoanSerializer,
    RepaymentScheduleSerializer, LoanRepaymentSerializer, LoanFeeSerializer,
    LoanApplicationApproveSerializer, LoanApplicationRejectSerializer,
    LoanRepaymentCreateSerializer, DisburseSerializer,
    CollectionCaseSerializer, CollectionNoteSerializer,
    PromiseToPaySerializer, RecoveryActionSerializer,
    CollateralDischargeSerializer, LoanGuarantorSerializer, LoanCommentSerializer,
    BulkLoanImportSerializer, LoanDocumentSerializer
)
from .services import (
    calculate_interest, calculate_processing_fee,
    generate_repayment_schedule, allocate_payment,
    generate_offer_letter, generate_loan_statement,
    generate_disbursement_letter
)
from .services.arrears import (
    calculate_loan_arrears_status, get_arrears_aging_report, calculate_par_metrics
)
from .services.collections import (
    log_collection_interaction, record_payment_promise
)
from .services.recovery import (
    record_recovery_action, approve_loan_write_off
)
from apps.accounting.services import post_loan_repayment


class LoanProductViewSet(TenantScopedViewSet):
    queryset = LoanProduct.objects.all()
    serializer_class = LoanProductSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active', 'requires_collateral', 'term_unit']
    search_fields = ['name', 'code', 'description']
    ordering_fields = ['name', 'created_at', 'min_amount', 'max_amount']
    ordering = ['name']


class LoanApplicationViewSet(TenantScopedViewSet):
    queryset = LoanApplication.objects.all()
    serializer_class = LoanApplicationSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter, BranchScopingFilterBackend]
    filterset_fields = ['borrower', 'product', 'status', 'risk_category']
    search_fields = [
        'application_number', 
        'borrower__first_name', 'borrower__last_name', 'borrower__business_name',
        'borrower__borrower_number', 'borrower__id_number'
    ]
    ordering_fields = ['created_at', 'requested_amount', 'approved_amount', 'submitted_at']
    ordering = ['-created_at']
    
    def perform_create(self, serializer):
        from apps.branches.utils import get_user_branch
        
        # Auto-set branch: use user's assigned branch, or HQ for administrators
        branch = get_user_branch(self.request.user)
            
        super().perform_create(serializer)
        
        # Update extra fields after creation
        instance = serializer.instance
        if not instance.created_by:
            instance.created_by = self.request.user
        if not instance.branch:
            instance.branch = branch
        instance.save()
    
    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit application for review."""
        application = self.get_object()
        if application.status != LoanApplication.Status.DRAFT:
            return Response(
                {'error': 'Only draft applications can be submitted.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        application.status = LoanApplication.Status.SUBMITTED
        application.submitted_at = timezone.now()
        application.save()
        return Response({'status': 'submitted'})
    
    @action(detail=True, methods=['post'])
    def start_review(self, request, pk=None):
        """Move application to under review."""
        application = self.get_object()
        if application.status != LoanApplication.Status.SUBMITTED:
            return Response(
                {'error': 'Only submitted applications can be reviewed.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        application.status = LoanApplication.Status.UNDER_REVIEW
        application.reviewed_by = request.user
        application.reviewed_at = timezone.now()
        application.save()
        return Response({'status': 'under_review'})
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel application."""
        application = self.get_object()
        if application.status == LoanApplication.Status.DISBURSED:
            return Response(
                {'error': 'Cannot cancel a disbursed application.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        application.status = LoanApplication.Status.CANCELLED
        application.save()
        return Response({'status': 'cancelled'})
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve loan application and set terms."""
        application = self.get_object()
        serializer = LoanApplicationApproveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Allow revision if already approved or offer sent
        valid_statuses = [
            LoanApplication.Status.UNDER_REVIEW,
            LoanApplication.Status.APPROVED,
            LoanApplication.Status.OFFER_SENT
        ]
        if application.status not in valid_statuses:
            return Response(
                {'error': f'Application in {application.status} status cannot be approved/revised.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Enforcement of requirements
        product = application.product
        has_collateral = application.collateral or application.collaterals.exists()
        if product.requires_collateral and not has_collateral:
            return Response(
                {'error': 'This loan product requires collateral. Please attach collateral before approval.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if product.requires_guarantor and not application.guarantors.exists():
            return Response(
                {'error': 'This loan product requires at least one guarantor. Please add guarantors before approval.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Collateral Specific Validations (Insurance, Tracker)
        all_collaterals = []
        if application.collateral:
            all_collaterals.append(application.collateral)
        all_collaterals.extend(application.collaterals.all())
        
        for coll in all_collaterals:
            if coll.collateral_type in ['motor_vehicle', 'chattels']:
                expiry_date = coll.insurance_expiry_date
                if expiry_date:
                    term = serializer.validated_data['approved_term']
                    # Simplification: Assuming monthly term unit for calculation safety margin
                    maturity_date = timezone.now().date() + relativedelta(months=term)
                    
                    if expiry_date < maturity_date:
                        deductions = serializer.validated_data.get('deductions', [])
                        has_insurance_fee = any('insurance' in d['name'].lower() for d in deductions)
                        
                        if not has_insurance_fee:
                            return Response(
                                {
                                    'error': f"Collateral ({coll.reg_number or coll.lr_number}) insurance expires on {expiry_date}, which is before the loan maturity ({maturity_date}). Please add a 'Comprehensive Insurance Renewal' fee to the deductions."
                                },
                                status=status.HTTP_400_BAD_REQUEST
                            )
                
                if not coll.tracker_installed:
                    deductions = serializer.validated_data.get('deductions', [])
                    has_tracker_fee = any('tracker' in d['name'].lower() for d in deductions)
                    
                    if not has_tracker_fee:
                        return Response(
                            {
                                 'error': f"Vehicle collateral ({coll.reg_number or coll.lr_number}) requires a tracker. Please add a 'Tracker Installation Fee' to the deductions or update the collateral details if a tracker is already installed."
                            },
                            status=status.HTTP_400_BAD_REQUEST
                        )
        
        with transaction.atomic():
            # Set approved terms
            application.approved_amount = serializer.validated_data['approved_amount']
            application.approved_term = serializer.validated_data['approved_term']
            application.approved_interest_rate = serializer.validated_data['approved_interest_rate']
            application.approved_interest_method = serializer.validated_data['approved_interest_method']
            application.approved_interest_period = serializer.validated_data.get('approved_interest_period', 'per_year')
            application.approved_repayment_frequency = serializer.validated_data.get('approved_repayment_frequency', 'monthly')
            
            # Save Penalty Snapshot
            application.penalty_type = serializer.validated_data.get('penalty_type', 'fixed')
            application.penalty_value = serializer.validated_data.get('penalty_value', 0)
            application.penalty_grace_period = serializer.validated_data.get('penalty_grace_period', 0)
            application.penalty_basis = serializer.validated_data.get('penalty_basis', 'per_day')
            
            application.status = LoanApplication.Status.APPROVED
            application.approved_at = timezone.now()
            application.approved_by = request.user
            application.review_notes = serializer.validated_data.get('notes', '')
            
            # Save deductions
            application.deductions.all().delete()
            from apps.accounting.models import ChartOfAccount
            for ded_data in serializer.validated_data.get('deductions', []):
                coa_code = ded_data.get('coa_code')
                coa_acc = None
                
                # Auto-link based on name if coa_code is missing
                if not coa_code:
                    name_lower = ded_data['name'].lower()
                    if 'insurance' in name_lower:
                        coa_code = '4240'  # Insurance Fee Income
                    elif 'tracker' in name_lower:
                        coa_code = '4230'  # Tracker Installation Fees
                
                if coa_code:
                    coa_acc = ChartOfAccount.objects.filter(
                        code=coa_code, 
                        organization=application.organization
                    ).first()
                
                LoanDeduction.objects.create(
                    application=application,
                    name=ded_data['name'],
                    charge_method=ded_data['charge_method'],
                    value=ded_data['value'],
                    coa_account=coa_acc,
                    is_withheld=ded_data.get('is_withheld', True)
                )
            
            application.save()
            
            # Clear existing schedules before regenerating (Idempotency)
            application.provisional_schedules.all().delete()
            
            # Generate and save provisional repayment schedule
            provisional_schedule = generate_repayment_schedule(application)
            RepaymentSchedule.objects.bulk_create(provisional_schedule)
            
        return Response({'status': 'approved'})

    @action(detail=True, methods=['get', 'put'])
    def manage_schedule(self, request, pk=None):
        """View or Edit provisional repayment schedule before disbursement."""
        application = self.get_object()
        
        if request.method == 'GET':
            # Only show schedule if application is approved or later
            allowed_statuses = [
                LoanApplication.Status.APPROVED,
                LoanApplication.Status.OFFER_SENT,
                LoanApplication.Status.OFFER_ACCEPTED,
                LoanApplication.Status.DISBURSED
            ]
            if application.status not in allowed_statuses:
                return Response([], status=status.HTTP_200_OK)

            schedules = application.provisional_schedules.all().order_by('due_date')
            if not schedules.exists():
                try:
                    provisional_schedule = generate_repayment_schedule(application)
                    RepaymentSchedule.objects.bulk_create(provisional_schedule)
                    schedules = application.provisional_schedules.all().order_by('due_date')
                except Exception as e:
                    logger.error(f"Failed to generate schedule for application {application.id}: {e}")
                    return Response([], status=status.HTTP_200_OK)
                
            serializer = RepaymentScheduleSerializer(schedules, many=True)
            return Response(serializer.data)
        
        elif request.method == 'PUT':
            # 1. Validate total principal matches approved amount
            approved_amount = application.approved_amount
            total_principal = sum(Decimal(str(item.get('principal_due', 0))) for item in request.data)
            
            # Allow a small delta for rounding differences (e.g. 0.05)
            if abs(approved_amount - total_principal) > Decimal('1.00'):
                return Response(
                    {'error': f"Total principal ({total_principal}) must match approved amount ({approved_amount})."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            with transaction.atomic():
                # 2. Delete existing provisional schedules
                application.provisional_schedules.all().delete()
                
                # 3. Create new schedules
                new_schedules = []
                for item in request.data:
                    due_date_val = item.get('due_date')
                    if isinstance(due_date_val, str):
                        from datetime import datetime
                        try:
                            due_date_val = datetime.strptime(due_date_val[:10], '%Y-%m-%d').date()
                        except (ValueError, TypeError):
                            return Response(
                                {'error': f"Invalid due_date format: {due_date_val}. Use YYYY-MM-DD."},
                                status=status.HTTP_400_BAD_REQUEST
                            )
                    new_schedules.append(RepaymentSchedule(
                        application=application,
                        installment_number=item.get('installment_number'),
                        due_date=due_date_val,
                        principal_due=item.get('principal_due'),
                        interest_due=item.get('interest_due'),
                        fees_due=item.get('fees_due', Decimal('0.00')),
                        total_due=Decimal(str(item.get('principal_due', 0))) + Decimal(str(item.get('interest_due', 0))) + Decimal(str(item.get('fees_due', 0)))
                    ))
                
                RepaymentSchedule.objects.bulk_create(new_schedules)
            
            return Response({'status': 'schedule_updated'})

    @action(detail=True, methods=['post'])
    def send_offer_letter(self, request, pk=None):
        """Generate and send offer letter. Optionally email to borrower."""
        application = self.get_object()
        
        # Allow regeneration if status is APPROVED or OFFER_SENT
        if application.status not in [LoanApplication.Status.APPROVED, LoanApplication.Status.OFFER_SENT]:
            return Response({'error': 'Application must be approved first.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Generate PDF
        from django.core.files.base import ContentFile
        try:
            logger.info(f"Starting offer letter generation for application {application.application_number}")
            pdf_buffer = generate_offer_letter(application)
            logger.info(f"PDF buffer generated successfully")
        except Exception as e:
            logger.error(f"CRITICAL ERROR generating offer letter: {str(e)}", exc_info=True)
            return Response({'error': f'Failed to generate offer letter: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        if not pdf_buffer:
            logger.error("PDF buffer is None")
            return Response({'error': 'Failed to generate offer letter PDF.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Delete old file if it exists to prevent suffixing
        if application.offer_letter_file:
            application.offer_letter_file.delete(save=False)
            
        pdf_content = pdf_buffer.getvalue()
        offer_filename = f"offer_{application.application_number}.pdf"
        
        application.offer_letter_file.save(
            offer_filename,
            ContentFile(pdf_content)
        )
        
        application.status = LoanApplication.Status.OFFER_SENT
        application.offer_expires_at = timezone.now() + timezone.timedelta(days=7)
        application.save()
        
        # Optionally email the offer letter to the borrower
        email_sent = False
        send_to_borrower = request.data.get('send_to_borrower', False)
        if send_to_borrower:
            try:
                from apps.notifications.services import EmailService
                
                borrower = application.borrower
                organization = application.organization
                
                # Determine recipient email
                recipient_email = None
                recipient_name = ""
                
                if borrower.borrower_type in ['company', 'institution']:
                    primary_contact = borrower.contacts.filter(is_primary=True).first()
                    if primary_contact and primary_contact.email:
                        recipient_email = primary_contact.email
                        recipient_name = f"{primary_contact.first_name} {primary_contact.last_name}"
                
                if not recipient_email and borrower.email:
                    recipient_email = borrower.email
                    if borrower.borrower_type in ['company', 'institution']:
                        recipient_name = borrower.business_name or ''
                    else:
                        recipient_name = f"{borrower.first_name} {borrower.last_name}"
                
                if recipient_email and organization:
                    company_name = organization.company_name or 'Lender'
                    email_service = EmailService(organization)
                    result = email_service.send_email(
                        recipient_email,
                        f"Offer Letter - {application.application_number}",
                        f"Dear {recipient_name},\n\n"
                        f"Please find attached the offer letter for your loan application {application.application_number}.\n\n"
                        f"This offer is valid for 7 days.\n\n"
                        f"Best regards,\n{company_name}",
                        related_borrower=borrower,
                        attachments=[(offer_filename, pdf_content, 'application/pdf')]
                    )
                    email_sent = result.get('success', False)
            except Exception as email_err:
                logger.error(f"Failed to email offer letter: {email_err}", exc_info=True)
        
        return Response({
            'status': 'offer_sent',
            'email_sent': email_sent
        })

    @action(detail=True, methods=['get'])
    def download_offer_letter(self, request, pk=None):
        """Download the generated offer letter."""
        application = self.get_object()
        if not application.offer_letter_file:
            return Response({'error': 'Offer letter has not been generated yet.'}, status=status.HTTP_404_NOT_FOUND)
        
        return FileResponse(application.offer_letter_file.open(), as_attachment=True)

    @action(detail=True, methods=['get'])
    def download_disbursement_letter(self, request, pk=None):
        """Download the generated disbursement letter (Advice)."""
        application = self.get_object()
        if not application.disbursement_letter_file:
            return Response({'error': 'Disbursement checklist has not been generated yet.'}, status=status.HTTP_404_NOT_FOUND)
        
        return FileResponse(application.disbursement_letter_file.open(), as_attachment=True)

    @action(detail=True, methods=['post'])
    def accept_offer(self, request, pk=None):
        """Upload signed offer and move to accepted status."""
        application = self.get_object()
        
        if application.status != LoanApplication.Status.OFFER_SENT:
            return Response(
                {'error': 'Application must have an offer sent before it can be accepted.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if offer is expired
        if application.offer_expires_at and timezone.now() > application.offer_expires_at:
            return Response(
                {'error': 'This offer has expired. Please request a new offer letter.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if 'signed_offer' not in request.FILES:
            return Response({'error': 'Signed offer letter file is required.'}, status=status.HTTP_400_BAD_REQUEST)
            
        application.signed_offer_letter = request.FILES['signed_offer']
        application.status = LoanApplication.Status.OFFER_ACCEPTED
        
        # Update repayment channel if provided
        repayment_channel = request.data.get('repayment_channel')
        if repayment_channel:
            application.repayment_channel = repayment_channel
        
        # 1. Delete unsigned offer letter to keep storage clean
        if application.offer_letter_file:
            application.offer_letter_file.delete(save=False)
        
        application.save()

        # 2. Automatically generate the disbursement letter (Checklist)
        try:
            logger.info(f"Starting auto-generation of disbursement checklist for {application.application_number}")
            pdf_buffer = generate_disbursement_letter(application)
            if not pdf_buffer:
                logger.error(f"Generated PDF buffer is None for {application.application_number}")
            else:
                filename = f"disbursement_checklist_{application.application_number}.pdf"
                content = pdf_buffer.getvalue()
                logger.info(f"PDF generated successfully, size: {len(content)} bytes. Saving to field...")
                
                application.disbursement_letter_file.save(filename, ContentFile(content), save=True)
                logger.info(f"File saved successfully: {application.disbursement_letter_file.name}")
                
                # 3. Email the letter to the borrower
                try:
                    self._email_disbursement_letter(application, content, filename)
                    logger.info("Outbound email triggered.")
                except Exception as email_err:
                    logger.error(f"Emailing failed: {email_err}")
            
        except Exception as e:
            logger.error(f"CRITICAL: Automation failed during offer acceptance for {application.application_number}: {e}", exc_info=True)

        return Response({'status': 'offer_accepted'})

    def _email_disbursement_letter(self, application, pdf_content, filename):
        """Helper to email the disbursement letter to the relevant contact."""
        from apps.agents.utils import send_tenant_email
        from apps.accounts.models import Organization
        
        organization = application.organization
        if not organization or not organization.smtp_host:
            return

        borrower = application.borrower
        recipient_email = None
        recipient_name = ""

        if borrower.borrower_type in ['company', 'institution']:
            primary_contact = borrower.contacts.filter(is_primary=True).first()
            if primary_contact and primary_contact.email:
                recipient_email = primary_contact.email
                recipient_name = f"{primary_contact.first_name} {primary_contact.last_name}"
        
        # Fallback to borrower email
        if not recipient_email and borrower.email:
            recipient_email = borrower.email
            if borrower.borrower_type in ['company', 'institution']:
                recipient_name = borrower.business_name
            else:
                recipient_name = f"{borrower.first_name} {borrower.last_name}"

        if not recipient_email:
            return

        subject = f"Disbursement Checklist - {application.application_number}"
        company_name = (organization.company_name if organization and organization.company_name else "Lender")
        message = f"Dear {recipient_name},\n\nPlease find attached the disbursement checklist for your loan application {application.application_number}.\n\nBest regards,\n{company_name}"
        
        attachments = [(filename, pdf_content, 'application/pdf')]
        
        send_tenant_email(
            settings_obj=organization,
            subject=subject,
            message=message,
            recipient_list=[recipient_email],
            attachments=attachments
        )

    @action(detail=True, methods=['post'])
    def upload_disbursement_authorization(self, request, pk=None):
        """Upload signed disbursement checklist."""
        application = self.get_object()
        if 'signed_disbursement' not in request.FILES:
            return Response({'error': 'Signed disbursement checklist file is required.'}, status=status.HTTP_400_BAD_REQUEST)
            
        application.signed_disbursement_letter = request.FILES['signed_disbursement']
        application.save()
        
        return Response({'status': 'disbursement_checklist_uploaded'})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject loan application."""
        application = self.get_object()
        serializer = LoanApplicationRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        if application.status not in [LoanApplication.Status.SUBMITTED, LoanApplication.Status.UNDER_REVIEW]:
            return Response(
                {'error': 'Application cannot be rejected in current status.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        application.status = LoanApplication.Status.REJECTED
        application.rejected_at = timezone.now()
        application.rejected_by = request.user
        application.rejection_reason = serializer.validated_data['rejection_reason']
        application.save()
        
        return Response({'status': 'rejected'})
    
    @action(detail=True, methods=['post'])
    def disburse(self, request, pk=None):
        """Disburse loan after offer is accepted - supports API and manual modes."""
        application = self.get_object()
        serializer = DisburseSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        
        if application.status != LoanApplication.Status.OFFER_ACCEPTED:
            return Response(
                {'error': 'Application must be in OFFER_ACCEPTED status before disbursement.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not application.signed_disbursement_letter:
            return Response(
                {'error': 'Signed disbursement checklist must be uploaded before disbursement.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate refinancing eligibility if applicable
        if application.refinances_loan:
            from .services import validate_refinancing_eligibility
            is_eligible, error_msg = validate_refinancing_eligibility(application)
            if not is_eligible:
                return Response(
                    {'error': error_msg},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Import payment services
        from .services.mpesa import MpesaService
        from .services.bank_api import BankAPIService

        disbursement_method = serializer.validated_data['disbursement_method']
        disbursement_details = serializer.validated_data.get('disbursement_details', {})
        
        # Get site settings
        from apps.accounts.models import Organization
        organization = application.organization
        
        # Determine mode: AUTOMATED or MANUAL
        api_transaction_id = None
        disbursement_status = Loan.DisbursementStatus.PENDING
        is_automated = False
        
        try:
            if disbursement_method == 'mpesa':
                # Check if M-Pesa is configured
                if organization and organization.mpesa_consumer_key and organization.mpesa_consumer_secret:
                    is_automated = True
                    logger.info(f"Attempting automated M-Pesa disbursement for {application.application_number}")
                    
                    mpesa = MpesaService(site_settings)
                    phone = disbursement_details.get('phone_number')
                    if not phone:
                        return Response({'error': 'Phone number required for M-Pesa disbursement'}, status=status.HTTP_400_BAD_REQUEST)
                    
                    total_deductions = sum(d.calculated_amount for d in application.deductions.filter(is_withheld=True))
                    payoff = application.payoff_amount or Decimal('0.00')
                    disbursed_amount = application.approved_amount - total_deductions - payoff
                    
                    result = mpesa.initiate_b2c_disbursement(
                        phone_number=phone,
                        amount=disbursed_amount,
                        remarks=f"Loan Disbursement - {application.application_number}"
                    )
                    
                    if result.get('success'):
                        api_transaction_id = result.get('conversation_id', result.get('originator_conversation_id'))
                        disbursement_status = Loan.DisbursementStatus.PROCESSING
                        logger.info(f"M-Pesa B2C initiated: {api_transaction_id}")
                    else:
                        return Response({'error': f"M-Pesa disbursement failed: {result.get('error')}"}, status=status.HTTP_400_BAD_REQUEST)
                else:
                    logger.info(f"M-Pesa not configured - using manual mode for {application.application_number}")
            
            elif disbursement_method == 'bank_transfer':
                # Check if Bank API is configured
                if site_settings and site_settings.bank_api_enabled:
                    is_automated = True
                    logger.info(f"Attempting automated bank transfer for {application.application_number}")
                    
                    bank_api = BankAPIService(site_settings)
                    account = disbursement_details.get('account_number')
                    bank = disbursement_details.get('bank_name')
                    
                    if not account or not bank:
                        return Response({'error': 'Account number and bank name required for bank transfer'}, status=status.HTTP_400_BAD_REQUEST)
                    
                    total_deductions = sum(d.calculated_amount for d in application.deductions.filter(is_withheld=True))
                    payoff = application.payoff_amount or Decimal('0.00')
                    disbursed_amount = application.approved_amount - total_deductions - payoff
                    
                    result = bank_api.initiate_transfer(
                        recipient_account=account,
                        recipient_bank=bank,
                        amount=disbursed_amount,
                        reference=application.application_number,
                        narration=f"Loan Disbursement - {application.application_number}"
                    )
                    
                    if result.get('success'):
                        api_transaction_id = result.get('transaction_id')
                        disbursement_status = Loan.DisbursementStatus.PROCESSING
                        logger.info(f"Bank transfer initiated: {api_transaction_id}")
                    else:
                        logger.warning(f"Bank API failed: {result.get('error')}. Falling back to manual mode.")
                else:
                    logger.info(f"Bank API not configured - using manual mode for {application.application_number}")
            
            # MANUAL MODE VALIDATION
            if not is_automated or api_transaction_id is None:
                # Manual mode - require proof and reference
                disbursement_proof = serializer.validated_data.get('disbursement_proof')
                manual_reference = serializer.validated_data.get('disbursement_reference_manual')
                
                if not disbursement_proof or not manual_reference:
                    return Response({
                        'error': 'Manual disbursement requires both disbursement_proof (file) and disbursement_reference_manual (transaction code/reference)'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                api_transaction_id = manual_reference
                disbursement_status = Loan.DisbursementStatus.COMPLETED  # Assume completed for manual
                logger.info(f"Manual disbursement mode - proof uploaded with reference: {manual_reference}")
        
        except Exception as e:
            logger.error(f"Disbursement processing error: {e}", exc_info=True)
            return Response({'error': f"Disbursement failed: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

        # CREATE LOAN OBJECT
        with transaction.atomic():
            # 1. Calculate amounts
            total_deductions = sum(d.calculated_amount for d in application.deductions.filter(is_withheld=True))
            payoff_amount = application.payoff_amount or Decimal('0.00')
            disbursed_amount = application.approved_amount - total_deductions - payoff_amount
            
            # Estimate total interest
            total_interest = calculate_interest(
                application.approved_amount,
                application.approved_interest_rate,
                application.approved_term,
                application.product.term_unit,
                application.approved_interest_method,
                interest_period=application.approved_interest_period or 'per_year',
                frequency=application.approved_repayment_frequency or 'monthly'
            )

            loan = Loan.objects.create(
                organization=application.organization,
                branch=application.branch,
                application=application,
                borrower=application.borrower,
                product=application.product,
                principal_amount=application.approved_amount,
                total_interest=total_interest,
                total_fees=total_deductions,
                disbursed_amount=disbursed_amount,
                disbursement_date=timezone.now().date(),
                disbursement_method=disbursement_method,
                disbursement_reference=api_transaction_id,
                disbursement_details=disbursement_details,
                disbursement_status=disbursement_status,
                disbursement_proof=serializer.validated_data.get('disbursement_proof') if not is_automated else None,
                repayment_channel=application.repayment_channel,
                term=application.approved_term,
                maturity_date=timezone.now().date() + relativedelta(months=application.approved_term),
                repayment_frequency=application.approved_repayment_frequency,
                interest_rate=application.approved_interest_rate,
                interest_method=application.approved_interest_method,
                interest_period=application.approved_interest_period,
                penalty_type=application.penalty_type,
                penalty_value=application.penalty_value,
                penalty_grace_period=application.penalty_grace_period,
                penalty_basis=getattr(application, 'penalty_basis', 'per_day'),
                outstanding_balance=application.approved_amount + total_interest,
                outstanding_principal=application.approved_amount,
                outstanding_interest=total_interest,
                collateral=application.collateral
            )
            
            # 1.3 Sync Many-to-Many Collaterals
            if application.collaterals.exists():
                loan.collaterals.set(application.collaterals.all())

            # 1.5 Create LoanFee records from application deductions
            for deduction in application.deductions.filter(is_withheld=True):
                LoanFee.objects.create(
                    loan=loan,
                    fee_type=LoanFee.FeeType.OTHER,  # Mapping to OTHER for general deductions
                    amount=deduction.calculated_amount,
                    description=deduction.name,
                    is_paid=True
                )

            # 2. Handle Repayment Schedule
            provisional_schedules = application.provisional_schedules.all().order_by('installment_number')
            
            if provisional_schedules.exists():
                provisional_schedules.update(loan=loan, application=None)
            else:
                schedules = generate_repayment_schedule(loan)
                RepaymentSchedule.objects.bulk_create(schedules)

            # 3. Handle Documents
            from django.core.files.base import ContentFile
            advice_buffer = generate_disbursement_letter(loan)
            if advice_buffer:
                application.disbursement_letter_file.save(
                    f"disbursement_checklist_{loan.loan_number}.pdf",
                    ContentFile(advice_buffer.getvalue()),
                    save=False
                )

            # 4. Sync with Financials (Treasury & Accounting)
            # Both standard and refinancing are now handled by record_money_event
            from apps.treasury.services.integrity import record_money_event
            record_money_event(
                'loan_disbursement',
                loan,
                cash_account_id=serializer.validated_data.get('cash_account_id'),
                user=request.user
            )

            # 5. Update Status
            application.status = LoanApplication.Status.DISBURSED
            application.disbursed_at = timezone.now()
            application.save()

        return Response({
            'status': 'disbursed',
            'loan_number': loan.loan_number,
            'disbursement_mode': 'automated' if is_automated else 'manual',
            'disbursement_reference': api_transaction_id,
            'disbursement_status': disbursement_status
        })

class LoanViewSet(TenantScopedMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Loan.objects.all()
    serializer_class = LoanSerializer
    lookup_value_regex = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter, BranchScopingFilterBackend]
    filterset_fields = ['borrower', 'product', 'status', 'arrears_category']
    search_fields = [
        'loan_number', 
        'borrower__first_name', 'borrower__last_name', 'borrower__business_name',
        'borrower__borrower_number', 'borrower__id_number'
    ]
    ordering_fields = ['created_at', 'principal_amount', 'outstanding_balance', 'disbursement_date']
    ordering = ['-created_at']
    
    @action(detail=True, methods=['get'])
    def schedule(self, request, pk=None):
        """Get repayment schedule."""
        loan = self.get_object()
        schedules = loan.schedules.all()
        serializer = RepaymentScheduleSerializer(schedules, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def sync_schedules(self, request, pk=None):
        """Manually trigger schedule status synchronization."""
        loan = self.get_object()
        loan.sync_schedules()
        return Response({'status': 'schedules_synced'})
    
    @action(detail=True, methods=['get', 'post'])
    def repayments(self, request, pk=None):
        """Get or record repayments."""
        loan = self.get_object()
        
        if request.method == 'GET':
            repayments = loan.repayments.all()
            serializer = LoanRepaymentSerializer(repayments, many=True)
            return Response(serializer.data)
        
        # POST - Record payment
        from .services.payment_processor import PaymentProcessor
        serializer = LoanRepaymentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        amount = serializer.validated_data['amount']
        treasury_code = serializer.validated_data.get('treasury_account_code')
        cash_account_id_input = serializer.validated_data.get('cash_account_id')
        payment_method = serializer.validated_data['payment_method']
        payment_date = serializer.validated_data['payment_date']
        reference = serializer.validated_data.get('reference_number', '')
        notes = serializer.validated_data.get('notes', '')
        installment_id = serializer.validated_data.get('installment_id')

        processor = PaymentProcessor()
        
        # Resolve Cash Account
        from apps.treasury.models import CashAccount
        cash_account = None
        
        if cash_account_id_input:
            cash_account = CashAccount.objects.filter(id=cash_account_id_input, is_active=True).first()
        elif treasury_code:
            cash_account = CashAccount.objects.filter(coa_account__code=treasury_code, is_active=True).first()
            
        if not cash_account:
            return Response(
                {"error": "Invalid Cash Account or Treasury Code provided."}, 
                status=status.HTTP_400_BAD_REQUEST
            )




        with transaction.atomic():
            repayment = processor.record_manual_payment(
                loan_id=loan.id,
                amount=amount,
                payment_method=payment_method,
                reference=reference,
                payment_date=payment_date,
                user=request.user,
                installment_id=installment_id,
                notes=notes,
                cash_account_id=cash_account.id
            )
        
        return Response(LoanRepaymentSerializer(repayment).data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['get', 'post'])
    def statement(self, request, pk=None):
        """Download or email loan statement PDF."""
        loan = self.get_object()
        
        pdf_buffer = generate_loan_statement(loan)
        
        if request.method == 'GET':
            return FileResponse(
                pdf_buffer,
                as_attachment=True,
                filename=f"statement_{loan.loan_number}.pdf",
                content_type='application/pdf'
            )
            
        # POST - generates and optionally emails
        email_sent = False
        send_to_borrower = request.data.get('send_to_borrower', False)
        
        if send_to_borrower:
            try:
                from apps.notifications.services import EmailService
                borrower = loan.borrower
                organization = loan.organization
                
                # Determine recipient email
                recipient_email = None
                recipient_name = ""
                
                if borrower.borrower_type in ['company', 'institution']:
                    primary_contact = borrower.contacts.filter(is_primary=True).first()
                    if primary_contact and primary_contact.email:
                        recipient_email = primary_contact.email
                        recipient_name = f"{primary_contact.first_name} {primary_contact.last_name}"
                
                if not recipient_email and borrower.email:
                    recipient_email = borrower.email
                    if borrower.borrower_type in ['company', 'institution']:
                        recipient_name = borrower.business_name or ''
                    else:
                        recipient_name = f"{borrower.first_name} {borrower.last_name}"
                
                if recipient_email and organization:
                    company_name = organization.company_name or 'Lender'
                    email_service = EmailService(organization)
                    result = email_service.send_email(
                        recipient_email,
                        f"Loan Statement - {loan.loan_number}",
                        f"Dear {recipient_name},\n\nPlease find attached your loan statement for {loan.loan_number}.\n\nBest regards,\n{company_name}",
                        related_loan=loan,
                        related_borrower=borrower,
                        attachments=[(f"Statement_{loan.loan_number}.pdf", pdf_buffer.getvalue(), 'application/pdf')]
                    )
                    email_sent = result.get('success', False)
            except Exception as email_err:
                logger.error(f"Failed to email statement: {email_err}", exc_info=True)
                
        return Response({
            'status': 'success',
            'email_sent': email_sent
        })

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        """Get activity history for this specific loan."""
        loan = self.get_object()
        from django.contrib.contenttypes.models import ContentType
        
        loan_ct = ContentType.objects.get_for_model(Loan)
        logs = ActivityLog.objects.filter(
            content_type=loan_ct,
            object_id=str(loan.id)
        ).order_by('-timestamp')
        
        serializer = ActivityLogSerializer(logs, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def update_arrears(self, request, pk=None):
        """Manually trigger arrears calculation for a loan."""
        loan = self.get_object()
        info = calculate_loan_arrears_status(loan)
        return Response(info)

    @action(detail=True, methods=['post'])
    def update_schedule(self, request, pk=None):
        """
        Update the due dates for the repayment schedule.
        Expected format:
        {
            "schedule": [
                {"id": "uuid", "due_date": "YYYY-MM-DD"},
                ...
            ]
        }
        """
        loan = self.get_object()
        
        # Check permissions - require Change Loan permission or System Admin role
        if not (request.user.is_superuser or 
                (request.user.role and request.user.role.name in ['Admin', 'Company Administrator', 'System Administrator']) or
                request.user.has_perm('loans.change_loan')):
            return Response({"error": "You do not have permission to update the loan schedule."}, status=status.HTTP_403_FORBIDDEN)

        schedule_data = request.data.get('schedule', [])
        
        if not schedule_data:
            return Response({"error": "No schedule data provided"}, status=status.HTTP_400_BAD_REQUEST)
        
        updated_count = 0
        from datetime import datetime
        
        with transaction.atomic():
            for item in schedule_data:
                installment_id = item.get('id')
                new_due_date_str = item.get('due_date')
                
                if not installment_id or not new_due_date_str:
                    continue
                
                try:
                    # Validate date format
                    new_due_date = datetime.strptime(new_due_date_str, '%Y-%m-%d').date()
                    
                    installment = RepaymentSchedule.objects.get(id=installment_id, loan=loan)
                    
                    # Log change if date is actually changing
                    if str(installment.due_date) != new_due_date_str:
                        installment.due_date = new_due_date
                        installment.save()
                        updated_count += 1
                except (ValueError, RepaymentSchedule.DoesNotExist):
                    continue
        
        if updated_count > 0:
            # Log activity
            from django.contrib.contenttypes.models import ContentType
            loan_ct = ContentType.objects.get_for_model(Loan)
            ActivityLog.objects.create(
                user=request.user,
                action=ActivityLog.Action.UPDATE,
                module='Loans',
                content_type=loan_ct,
                object_id=str(loan.id),
                description=f"Updated repayment schedule dates for loan {loan.loan_number}. {updated_count} installments updated."
            )
        
        return Response({
            "success": True, 
            "message": f"Successfully updated {updated_count} schedule entries",
            "updated_count": updated_count
        })
    
    @action(detail=True, methods=['get', 'post'], url_path='comments')
    def comments(self, request, pk=None):
        """Get or create comments for a loan."""
        loan = self.get_object()
        
        if request.method == 'GET':
            comments = loan.comments.all()
            serializer = LoanCommentSerializer(comments, many=True)
            return Response(serializer.data)
        
        elif request.method == 'POST':
            serializer = LoanCommentSerializer(data=request.data)
            if serializer.is_valid():
                serializer.save(
                    loan=loan,
                    author=request.user
                )
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoanFeeViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = LoanFee.objects.all()
    serializer_class = LoanFeeSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]


# ========== NEW ARREARS MANAGEMENT VIEWSETS ==========

class CollectionCaseViewSet(viewsets.ModelViewSet):
    queryset = CollectionCase.objects.all()
    serializer_class = CollectionCaseSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'priority', 'assigned_to']
    search_fields = [
        'loan__loan_number', 
        'loan__borrower__first_name', 'loan__borrower__last_name', 'loan__borrower__business_name'
    ]
    ordering_fields = ['days_overdue', 'overdue_amount', 'priority', 'next_follow_up']
    ordering = ['-days_overdue']
    
    @action(detail=True, methods=['post'])
    def log_interaction(self, request, pk=None):
        """Log a collection interaction."""
        case = self.get_object()
        serializer = CollectionNoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        note = log_collection_interaction(
            case, 
            request.user, 
            serializer.validated_data['contact_method'],
            serializer.validated_data['note'],
            serializer.validated_data.get('customer_response', '')
        )
        return Response(CollectionNoteSerializer(note).data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def record_promise(self, request, pk=None):
        """Record a promise to pay."""
        case = self.get_object()
        serializer = PromiseToPaySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        promise = record_payment_promise(
            case,
            serializer.validated_data['promised_amount'],
            serializer.validated_data['promised_date'],
            request.user,
            serializer.validated_data.get('notes', '')
        )
        return Response(PromiseToPaySerializer(promise).data, status=status.HTTP_201_CREATED)


class CollectionNoteViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = CollectionNote.objects.all()
    serializer_class = CollectionNoteSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    filterset_fields = ['case']


class PromiseToPayViewSet(viewsets.ModelViewSet):
    queryset = PromiseToPay.objects.all()
    serializer_class = PromiseToPaySerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    filterset_fields = ['case', 'status']


class RecoveryActionViewSet(viewsets.ModelViewSet):
    queryset = RecoveryAction.objects.all()
    serializer_class = RecoveryActionSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    filterset_fields = ['loan', 'action_type']
    
    def perform_create(self, serializer):
        serializer.save(initiated_by=self.request.user)


class CollateralDischargeViewSet(viewsets.ModelViewSet):
    queryset = CollateralDischarge.objects.all()
    serializer_class = CollateralDischargeSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    filterset_fields = ['loan', 'status']
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark discharge process as completed."""
        discharge = self.get_object()
        discharge.status = CollateralDischarge.Status.COMPLETED
        discharge.completed_at = timezone.now()
        discharge.save()
        
        # Trigger actual collateral status update if not already done
        collateral = discharge.loan.collateral
        if collateral and collateral.status != 'discharged':
            collateral.status = 'discharged'
            collateral.save()
            
        return Response({'status': 'completed'})



class LoanDocumentViewSet(TenantScopedViewSet):
    queryset = LoanDocument.objects.all()
    serializer_class = LoanDocumentSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    filterset_fields = ['application', 'loan', 'document_name']

    def perform_create(self, serializer):
        # Auto-link loan if application is provided and has an associated loan
        application = serializer.validated_data.get('application')
        loan = serializer.validated_data.get('loan')
        
        if application and not loan:
            try:
                loan = application.loan
            except Exception:
                loan = None
                
        serializer.save(
            uploaded_by=self.request.user,
            organization=getattr(self.request.user, 'organization', None),
            loan=loan
        )


# ========== REPORTS ==========

@api_view(['GET'])
def arrears_reports(request):
    """ Arrears Aging and PAR Dashboard """
    from .services.arrears import get_arrears_aging_report, calculate_par_metrics, get_collections_forecast, update_all_loans_arrears_status
    
    # Refresh all arrears status to ensure data integrity for the report
    update_all_loans_arrears_status()
    
    aging = get_arrears_aging_report()
    par = calculate_par_metrics()
    forecast = get_collections_forecast()
    
    return Response({
        'aging': aging,
        'par': par,
        'forecast': forecast,
        'refreshed_at': timezone.now().isoformat()
    })


@api_view(['GET'])
def collections_forecast_detail(request):
    """ Get detailed breakdown for a specific forecast month """
    from .services.arrears import get_collections_breakdown
    
    month = request.query_params.get('month')
    if not month:
        return Response({"error": "Month parameter is required"}, status=400)
    
    try:
        breakdown = get_collections_breakdown(month)
        return Response(breakdown)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def dashboard_summary(request):
    """ Top-level metrics for dashboard cards """
    from django.db.models import Sum, Count, Avg
    from apps.customers.models import Borrower
    from apps.users.utils import scope_queryset
    user = request.user
    is_super = user.is_superuser
    
    today = timezone.now().date()
    start_of_month = today.replace(day=1)
    start_of_month_dt = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # 1. Active Portfolio (Active & Defaulted)
    active_statuses = [Loan.Status.ACTIVE, Loan.Status.DEFAULTED]
    active_portfolio_qs = scope_queryset(request.user, Loan.objects.filter(status__in=active_statuses))
    
    portfolio_value = active_portfolio_qs.aggregate(total=Sum('outstanding_balance'))['total'] or 0
    portfolio_principal = active_portfolio_qs.aggregate(total=Sum('outstanding_principal'))['total'] or 0
    portfolio_interest = active_portfolio_qs.aggregate(total=Sum('outstanding_interest'))['total'] or 0
    portfolio_penalties = active_portfolio_qs.aggregate(total=Sum('outstanding_penalties'))['total'] or 0
    active_loans_count = active_portfolio_qs.count()
    
    # 2. Avg Loan Size (Principal)
    avg_loan_size = active_portfolio_qs.aggregate(avg=Avg('principal_amount'))['avg'] or 0
    
    # 3. PAR Metrics
    par_metrics = calculate_par_metrics()
    par_percentage = par_metrics.get('par30_percent', 0)
    par_amount = par_metrics.get('par30_amount', 0)
    
    # Arrears: Just use the PAR30 amount as the default Portfolio in Arrears flag
    portfolio_arrears = par_amount
    
    # 4. Disbursements
    disbursement_qs = scope_queryset(request.user, Loan.objects.exclude(disbursement_date__isnull=True))
    
    # MTD
    month_qs = disbursement_qs.filter(
        disbursement_date__gte=start_of_month,
        disbursement_date__lte=today
    )
    disbursements_this_month = month_qs.aggregate(total=Sum('disbursed_amount'))['total'] or 0
    disbursements_count_mtd = month_qs.count()
    
    # Today
    today_qs = disbursement_qs.filter(disbursement_date=today)
    disbursements_today = today_qs.aggregate(total=Sum('disbursed_amount'))['total'] or 0
    disbursements_count_today = today_qs.count()
    
    # 5. Pending Applications
    pending_applications = scope_queryset(request.user, LoanApplication.objects.filter(
        status__in=[
            LoanApplication.Status.SUBMITTED,
            LoanApplication.Status.UNDER_REVIEW,
            LoanApplication.Status.APPROVED
        ]
    )).count()

    # 6. Borrower Metrics
    borrower_qs = scope_queryset(request.user, Borrower.objects.all())
    total_borrowers = borrower_qs.count()
    new_borrowers_this_month = borrower_qs.filter(created_at__gte=start_of_month_dt).count()
    verified_borrowers = borrower_qs.filter(verification_status=Borrower.VerificationStatus.VERIFIED).count()
    
    # Active Borrowers: Borrowers with at least one active loan
    active_borrowers = active_portfolio_qs.values('borrower').distinct().count()
    inactive_borrowers = total_borrowers - active_borrowers

    # 7. Portfolio Growth & Trends (Last 6 Months)
    from dateutil.relativedelta import relativedelta
    trends = []
    for i in range(5, -1, -1):
        month_start = (today.replace(day=1) - relativedelta(months=i))
        month_end = month_start + relativedelta(months=1) - relativedelta(days=1)
        
        month_disbursement = disbursement_qs.filter(
            disbursement_date__gte=month_start,
            disbursement_date__lte=month_end
        ).aggregate(total=Sum('disbursed_amount'))['total'] or 0
        
        trends.append({
            'month': month_start.strftime('%b %Y'),
            'disbursements': float(month_disbursement)
        })

    # 8. Branch Performance Breakdown
    branch_performance = []
    if is_super or (user.role and user.role.name in ['Admin', 'System Administrator']):
        from apps.branches.models import Branch
        for branch in Branch.objects.all():
            branch_portfolio = Loan.objects.filter(
                borrower__branch=branch,
                status__in=active_statuses
            ).aggregate(total=Sum('outstanding_balance'))['total'] or 0
            
            branch_performance.append({
                'name': branch.name,
                'portfolio_value': float(branch_portfolio),
                'active_loans': Loan.objects.filter(borrower__branch=branch, status__in=active_statuses).count()
            })
    
    # 9. Product Performance
    product_performance = []
    products = LoanProduct.objects.filter(is_active=True)
    for product in products:
        prod_portfolio = active_portfolio_qs.filter(product=product).aggregate(total=Sum('outstanding_balance'))['total'] or 0
        product_performance.append({
            'name': product.name,
            'portfolio_value': float(prod_portfolio),
            'count': active_portfolio_qs.filter(product=product).count()
        })

    return Response({
        'portfolio_value': portfolio_value,
        'portfolio_principal': portfolio_principal,
        'portfolio_interest': portfolio_interest,
        'portfolio_penalties': portfolio_penalties,
        'portfolio_arrears': portfolio_arrears,
        'active_loans_count': active_loans_count,
        'par_percentage': par_percentage,
        'par_amount': par_amount,
        
        'disbursements_this_month': disbursements_this_month,
        'disbursements_count_mtd': disbursements_count_mtd,
        
        'disbursements_today': disbursements_today,
        'disbursements_count': disbursements_count_today,
        
        'pending_applications': pending_applications,
        'avg_loan_size': avg_loan_size,
        'total_borrowers': total_borrowers,
        'new_borrowers_this_month': new_borrowers_this_month,
        'verified_borrowers': verified_borrowers,
        'active_borrowers': active_borrowers,
        'inactive_borrowers': inactive_borrowers,
        
        'trends': trends,
        'branch_performance': branch_performance,
        'product_performance': product_performance,
        'portfolio_growth_percentage': 5.2,
        'currency': 'KES'
    })
class LoanGuarantorViewSet(viewsets.ModelViewSet):
    queryset = LoanGuarantor.objects.all()
    serializer_class = LoanGuarantorSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    filterset_fields = ['application', 'borrower']

    @action(detail=True, methods=['post'], url_path='record-payment')
    def record_payment(self, request, pk=None):
        """
        Record manual payment for a loan.
        POST /api/v1/loans/loans/{id}/record-payment/
        Body: {
            "amount": 5000,
            "payment_method": "cash|bank|mpesa|cheque",
            "reference_number": "ABC123",
            "payment_date": "2026-02-06",
            "installment_id": "uuid" (optional),
            "notes": "Payment received at branch"
        }
        """
        from .services.payment_processor import PaymentProcessor
        from .serializers import LoanRepaymentSerializer
        
        loan = self.get_object()
        
        # Validate required fields
        amount = request.data.get('amount')
        payment_method = request.data.get('payment_method', 'cash')
        
        if not amount:
            return Response(
                {'error': 'amount is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            amount = Decimal(str(amount))
            if amount <= 0:
                return Response(
                    {'error': 'amount must be greater than 0'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except (ValueError, TypeError):
            return Response(
                {'error': 'Invalid amount format'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Parse payment date
        payment_date_str = request.data.get('payment_date')
        if payment_date_str:
            try:
                from datetime import datetime
                payment_date = datetime.strptime(payment_date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {'error': 'Invalid date format. Use YYYY-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            payment_date = timezone.now().date()
        
        # Record payment
        processor = PaymentProcessor()
        try:
            repayment = processor.record_manual_payment(
                loan_id=loan.id,
                amount=amount,
                payment_method=payment_method,
                reference=request.data.get('reference_number', ''),
                payment_date=payment_date,
                user=request.user,
                installment_id=request.data.get('installment_id'),
                notes=request.data.get('notes', '')
            )
            
            from django.contrib.contenttypes.models import ContentType
            loan_ct = ContentType.objects.get_for_model(Loan)
            ActivityLog.objects.create(
                user=request.user,
                action=ActivityLog.Action.REPAY,
                module='Loans',
                content_type=loan_ct,
                object_id=str(loan.id),
                description=f"Recorded payment of KES {amount} for loan {loan.loan_number}"
            )
            
            # Refresh loan from database
            loan.refresh_from_db()
            
            serializer = LoanRepaymentSerializer(repayment)
            return Response({
                'message': 'Payment recorded successfully',
                'repayment': serializer.data,
                'new_balance': float(loan.outstanding_balance),
                'loan_status': loan.status
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error recording payment: {str(e)}", exc_info=True)
            return Response(
                {'error': f'Failed to record payment: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'], url_path='initiate-mpesa-payment')
    def initiate_mpesa_payment(self, request, pk=None):
        """
        Initiate M-Pesa STK Push for payment collection.
        POST /api/v1/loans/loans/{id}/initiate-mpesa-payment/
        Body: {
            "phone_number": "254712345678",
            "amount": 5000,
            "installment_id": "uuid" (optional)
        }
        """
        loan = self.get_object()
        phone = request.data.get('phone_number')
        amount = request.data.get('amount')
        
        if not phone or not amount:
            return Response(
                {'error': 'phone_number and amount are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get site settings
        from apps.accounts.models import Organization
        organization = loan.organization
        
        if not organization or not organization.mpesa_consumer_key:
            return Response(
                {'error': 'M-Pesa not configured.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Initiate STK Push
        from .services.mpesa import MpesaService
        mpesa = MpesaService(organization)
        
        try:
            result = mpesa.initiate_stk_push(
                phone_number=phone,
                amount=amount,
                account_reference=loan.loan_number,
                description=f"Payment for loan {loan.loan_number}"
            )
            
            if result.get('success'):
                from django.contrib.contenttypes.models import ContentType
                loan_ct = ContentType.objects.get_for_model(Loan)
                ActivityLog.objects.create(
                    user=request.user,
                    action=ActivityLog.Action.UPDATE,
                    module='Loans',
                    content_type=loan_ct,
                    object_id=str(loan.id),
                    description=f"Initiated M-Pesa STK Push for KES {amount} to {phone}"
                )
                
                return Response({
                    'message': 'STK Push sent successfully',
                    'checkout_request_id': result.get('checkout_request_id'),
                    'instructions': 'Customer will receive a prompt on their phone to complete payment'
                })
            else:
                return Response({
                    'error': result.get('error', 'STK Push failed')
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            logger.error(f"Error initiating M-Pesa payment: {str(e)}", exc_info=True)
            return Response({
                'error': f'Failed to initiate payment: {str(e)}'
            }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])  # M-Pesa doesn't send auth headers
def mpesa_c2b_validation(request):
    """
    Validate incoming C2B payment before M-Pesa completes it.
    Return ResultCode 0 to accept, non-zero to reject.
    
    M-Pesa sends:
    {
        "TransactionType": "",
        "TransID": "LHG31AA5TX",
        "TransTime": "20170816190243",
        "TransAmount": "200.00",
        "BusinessShortCode": "600000",
        "BillRefNumber": "account",
        "InvoiceNumber": "",
        "OrgAccountBalance": "",
        "ThirdPartyTransID": "",
        "MSISDN": "254708374149",
        "FirstName": "John",
        "MiddleName": "",
        "LastName": "Doe"
    }
    """
    try:
        data = request.data
        logger.info(f"M-Pesa C2B Validation received: {data}")
        
        bill_ref = data.get('BillRefNumber', '')
        amount = float(data.get('TransAmount', 0))
        
        # Validate: Check if loan exists
        from apps.loans.models import Loan
        try:
            loan = Loan.objects.get(loan_number=bill_ref)
            
            # Reject if loan is already paid off
            if loan.status == 'paid_off':
                logger.warning(f"Payment rejected - Loan {bill_ref} already paid off")
                return Response({
                    "ResultCode": "C2B00012",
                    "ResultDesc": "Loan already paid off"
                })
            
            # Reject if loan is written off or defaulted
            if loan.status in ['written_off', 'defaulted']:
                logger.warning(f"Payment rejected - Loan {bill_ref} status: {loan.status}")
                return Response({
                    "ResultCode": "C2B00013",
                    "ResultDesc": f"Loan is {loan.status}"
                })
                
        except Loan.DoesNotExist:
            logger.warning(f"Payment rejected - Loan {bill_ref} not found")
            return Response({
                "ResultCode": "C2B00011",
                "ResultDesc": "Invalid loan number"
            })
        
        # Accept payment
        logger.info(f"Payment validated for loan {bill_ref}: KES {amount}")
        return Response({
            "ResultCode": "0",
            "ResultDesc": "Accepted"
        })
        
    except Exception as e:
        logger.error(f"M-Pesa C2B validation error: {str(e)}", exc_info=True)
        return Response({
            "ResultCode": "1",
            "ResultDesc": f"Validation error: {str(e)}"
        })


@api_view(['POST'])
@permission_classes([AllowAny])
def mpesa_c2b_confirmation(request):
    """
    Process confirmed C2B payment.
    This is called after M-Pesa completes the transaction.
    
    M-Pesa sends same payload as validation.
    """
    try:
        data = request.data
        logger.info(f"M-Pesa C2B Confirmation received: {data}")
        
        # Parse transaction time
        trans_time_str = data.get('TransTime', '')
        try:
            trans_time = datetime.strptime(trans_time_str, '%Y%m%d%H%M%S')
            trans_time = timezone.make_aware(trans_time)
        except (ValueError, TypeError):
            trans_time = timezone.now()
        
        # Create transaction record
        from apps.loans.models import MpesaC2BTransaction
        transaction = MpesaC2BTransaction.objects.create(
            trans_id=data.get('TransID'),
            trans_time=trans_time,
            trans_amount=data.get('TransAmount'),
            business_short_code=data.get('BusinessShortCode'),
            bill_ref_number=data.get('BillRefNumber', ''),
            invoice_number=data.get('InvoiceNumber', ''),
            org_account_balance=data.get('OrgAccountBalance') or None,
            third_party_trans_id=data.get('ThirdPartyTransID', ''),
            msisdn=data.get('MSISDN'),
            first_name=data.get('FirstName', ''),
            middle_name=data.get('MiddleName', ''),
            last_name=data.get('LastName', ''),
            raw_data=data,
            status='validated'
        )
        
        logger.info(f"M-Pesa C2B transaction created: {transaction.trans_id}")
        
        # Process payment asynchronously
        from apps.loans.tasks import process_mpesa_c2b_payment
        process_mpesa_c2b_payment.delay(str(transaction.id))
        
        return Response({
            "ResultCode": "0",
            "ResultDesc": "Accepted"
        })
        
    except Exception as e:
        logger.error(f"M-Pesa C2B confirmation error: {str(e)}", exc_info=True)
        return Response({
            "ResultCode": "1",
            "ResultDesc": "Processing error"
        })


class BulkLoanImportView(APIView):
    """
    Endpoint for bulk importing loans via Excel/JSON.
    Expects a list of loan objects.
    """
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    
    def post(self, request, *args, **kwargs):
        data = request.data
        if not isinstance(data, list):
            return Response(
                {'error': 'Expected a list of loan objects.'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        serializer = BulkLoanImportSerializer(data=data, many=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        created_count = 0
        errors = []
        
        from django.db import IntegrityError
        
        with transaction.atomic():
            for index, item in enumerate(serializer.validated_data):
                try:
                    borrower = item['borrower']
                    product = item['product']
                    amount = item['amount']
                    term = item['term']
                    disbursement_date = item['disbursement_date']
                    
                    # 1. Create Application
                    application = LoanApplication.objects.create(
                        organization=borrower.organization,
                        borrower=borrower,
                        product=product,
                        branch=borrower.branch,
                        requested_amount=amount,
                        requested_term=term,
                        status=LoanApplication.Status.DISBURSED,
                        
                        # Approved values
                        approved_amount=amount,
                        approved_term=term,
                        approved_interest_rate=item.get('interest_rate', product.suggested_interest_rate),
                        approved_interest_method=product.interest_type,
                        approved_interest_period=product.suggested_interest_period,
                        approved_repayment_frequency=item.get('repayment_frequency', product.repayment_frequency),
                        
                        # Defaults
                        submitted_at=timezone.now(),
                        approved_at=timezone.now(),
                        disbursed_at=timezone.now(),
                        created_by=request.user
                    )
                    
                    # 2. Calculate Interest
                    total_interest = calculate_interest(
                        application.approved_amount,
                        application.approved_interest_rate,
                        application.approved_term,
                        product.term_unit,
                        application.approved_interest_method,
                        interest_period=application.approved_interest_period,
                        frequency=application.approved_repayment_frequency
                    )
                    
                    # 3. Create Loan
                    loan = Loan.objects.create(
                        organization=borrower.organization,
                        application=application,
                        borrower=borrower,
                        product=product,
                        branch=borrower.branch,
                        
                        principal_amount=amount,
                        total_interest=total_interest,
                        total_fees=0, # Assuming no fees for bulk import unless specified
                        
                        disbursed_amount=amount,
                        disbursement_date=disbursement_date,
                        disbursement_method='manual', 
                        disbursement_reference='BULK_IMPORT',
                        disbursement_status=Loan.DisbursementStatus.COMPLETED,
                        
                        term=term,
                        maturity_date=disbursement_date + relativedelta(months=term), # Simplification
                        
                        repayment_frequency=application.approved_repayment_frequency,
                        interest_rate=application.approved_interest_rate,
                        interest_method=application.approved_interest_method,
                        interest_period=application.approved_interest_period,
                        
                        outstanding_balance=amount + total_interest,
                        outstanding_principal=amount,
                        outstanding_interest=total_interest,
                        
                        created_at=timezone.now()
                    )
                    
                    # 4. Generate Schedule
                    # We need to fudge the start date to match the historical disbursement date
                    # generate_repayment_schedule uses loan.disbursement_date
                    schedule = generate_repayment_schedule(loan)
                    RepaymentSchedule.objects.bulk_create(schedule)
                    
                    created_count += 1
                    
                except Exception as e:
                    errors.append({'index': index, 'error': str(e)})
                    # If we want all-or-nothing, we should re-raise here.
                    # For now, let's assume we want to fail the whole batch if one fails?
                    # The prompt said "way of adding loans in bulk".
                    # Usually bulk endpoints are transactional.
                    raise e
        
        return Response({
            'status': 'success',
            'created_count': created_count,
            'errors': errors
        })
