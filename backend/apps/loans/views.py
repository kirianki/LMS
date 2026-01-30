from rest_framework import viewsets, permissions, status, filters
from django_filters.rest_framework import DjangoFilterBackend
from apps.users.permissions import HasRolePermission
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from django.http import FileResponse
from django.utils import timezone
from django.db import transaction
from django.core.files.base import ContentFile
from datetime import date
from decimal import Decimal
from dateutil.relativedelta import relativedelta

from .models import (
    LoanProduct, LoanApplication, Loan,
    RepaymentSchedule, LoanRepayment, LoanFee,
    CollectionCase, CollectionNote, PromiseToPay, RecoveryAction,
    CollateralDischarge, LoanDeduction, LoanGuarantor
)
from .serializers import (
    LoanProductSerializer, LoanApplicationSerializer, LoanSerializer,
    RepaymentScheduleSerializer, LoanRepaymentSerializer, LoanFeeSerializer,
    LoanApplicationApproveSerializer, LoanApplicationRejectSerializer,
    LoanRepaymentCreateSerializer, DisburseSerializer,
    CollectionCaseSerializer, CollectionNoteSerializer,
    PromiseToPaySerializer, RecoveryActionSerializer,
    CollateralDischargeSerializer, LoanGuarantorSerializer
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


class LoanProductViewSet(viewsets.ModelViewSet):
    queryset = LoanProduct.objects.all()
    serializer_class = LoanProductSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active', 'requires_collateral', 'term_unit']
    search_fields = ['name', 'code', 'description']
    ordering_fields = ['name', 'created_at', 'min_amount', 'max_amount']
    ordering = ['name']


class LoanApplicationViewSet(viewsets.ModelViewSet):
    queryset = LoanApplication.objects.all()
    serializer_class = LoanApplicationSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['borrower', 'product', 'status', 'risk_category']
    search_fields = [
        'application_number', 
        'borrower__first_name', 'borrower__last_name', 'borrower__business_name',
        'borrower__borrower_number', 'borrower__id_number'
    ]
    ordering_fields = ['created_at', 'requested_amount', 'approved_amount', 'submitted_at']
    ordering = ['-created_at']
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
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
    def approve(self, request, pk=None):
        """Approve loan application and set terms."""
        application = self.get_object()
        serializer = LoanApplicationApproveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Allow revision if already approved or offer sent
        valid_statuses = [
            LoanApplication.Status.SUBMITTED, 
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
        if product.requires_collateral and not application.collateral:
            return Response(
                {'error': 'This loan product requires collateral. Please attach collateral before approval.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if product.requires_guarantor and not application.guarantors.exists():
            return Response(
                {'error': 'This loan product requires at least one guarantor. Please add guarantors before approval.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            # Set approved terms
            application.approved_amount = serializer.validated_data['approved_amount']
            application.approved_term = serializer.validated_data['approved_term']
            application.approved_interest_rate = serializer.validated_data['approved_interest_rate']
            application.approved_interest_method = serializer.validated_data['approved_interest_method']
            application.approved_interest_period = serializer.validated_data.get('approved_interest_period', 'per_year')
            application.status = LoanApplication.Status.APPROVED
            application.approved_at = timezone.now()
            application.approved_by = request.user
            application.review_notes = serializer.validated_data.get('notes', '')
            
            # Save deductions
            application.deductions.all().delete()
            for ded_data in serializer.validated_data.get('deductions', []):
                LoanDeduction.objects.create(
                    application=application,
                    name=ded_data['name'],
                    charge_method=ded_data['charge_method'],
                    value=ded_data['value'],
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
            schedules = application.provisional_schedules.all().order_by('due_date')
            if not schedules.exists():
                # If no schedule exists (e.g. legacy), generate one on the fly (but don't save yet to avoid side effects in GET)
                # Actually, better to generate and save if missing, for consistency
                provisional_schedule = generate_repayment_schedule(application)
                RepaymentSchedule.objects.bulk_create(provisional_schedule)
                schedules = application.provisional_schedules.all().order_by('due_date')
                
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
                    sched = RepaymentSchedule(
                        application=application,
                        installment_number=item.get('installment_number'),
                        due_date=item.get('due_date'),
                        principal_due=item.get('principal_due'),
                        interest_due=item.get('interest_due'),
                        fees_due=item.get('fees_due', 0),
                        total_due=Decimal(str(item.get('principal_due'))) + Decimal(str(item.get('interest_due'))) + Decimal(str(item.get('fees_due', 0)))
                    )
                    new_schedules.append(sched)
                
                RepaymentSchedule.objects.bulk_create(new_schedules)
            
            return Response({'status': 'schedule_updated'})

    @action(detail=True, methods=['post'])
    def send_offer_letter(self, request, pk=None):
        """Generate and send offer letter."""
        application = self.get_object()
        
        # Allow regeneration if status is APPROVED or OFFER_SENT
        if application.status not in [LoanApplication.Status.APPROVED, LoanApplication.Status.OFFER_SENT]:
            return Response({'error': 'Application must be approved first.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Generate PDF
        from django.core.files.base import ContentFile
        pdf_buffer = generate_offer_letter(application, request.tenant)
        
        # Delete old file if it exists to prevent suffixing
        if application.offer_letter_file:
            application.offer_letter_file.delete(save=False)
            
        application.offer_letter_file.save(
            f"offer_{application.application_number}.pdf",
            ContentFile(pdf_buffer.read())
        )
        
        application.status = LoanApplication.Status.OFFER_SENT
        application.submitted_at = timezone.now() # Record last activity
        application.save()
        
        return Response({'status': 'offer_sent'})

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
            # Fallback: Generate it on the fly if we are in ACCEPTED status (Authorization Phase)
            if application.status == LoanApplication.Status.OFFER_ACCEPTED:
                pdf_buffer = generate_disbursement_letter(application, request.tenant)
                filename = f"disbursement_checklist_{application.application_number}.pdf"
                application.disbursement_letter_file.save(filename, ContentFile(pdf_buffer.getvalue()), save=True)
                # Rewind buffer for FileResponse
                pdf_buffer.seek(0)
                return FileResponse(pdf_buffer, as_attachment=True, filename=filename)
            
            return Response({'error': 'Disbursement checklist has not been generated yet.'}, status=status.HTTP_404_NOT_FOUND)
        
        return FileResponse(application.disbursement_letter_file.open(), as_attachment=True)

    @action(detail=True, methods=['post'])
    def accept_offer(self, request, pk=None):
        """Upload signed offer and move to accepted status."""
        application = self.get_object()
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
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"Starting auto-generation of disbursement checklist for {application.application_number}")
            
            pdf_buffer = generate_disbursement_letter(application, request.tenant)
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
                    self._email_disbursement_letter(application, request.tenant, content, filename)
                    logger.info("Outbound email triggered.")
                except Exception as email_err:
                    logger.error(f"Emailing failed: {email_err}")
            
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"CRITICAL: Automation failed during offer acceptance for {application.application_number}: {e}", exc_info=True)

        return Response({'status': 'offer_accepted'})

    def _email_disbursement_letter(self, application, tenant, pdf_content, filename):
        """Helper to email the disbursement letter to the relevant contact."""
        from apps.agents.utils import send_tenant_email
        
        tenant_settings = getattr(tenant, 'settings', None)
        if not tenant_settings or not tenant_settings.smtp_host:
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
        company_name = (tenant_settings.company_name if tenant_settings and tenant_settings.company_name else tenant.name)
        message = f"Dear {recipient_name},\n\nPlease find attached the disbursement checklist for your loan application {application.application_number}.\n\nBest regards,\n{company_name}"
        
        attachments = [(filename, pdf_content, 'application/pdf')]
        
        send_tenant_email(
            settings_obj=tenant_settings,
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

        # Import payment services
        from .services.mpesa import MpesaService
        from .services.bank_api import BankAPIService

        disbursement_method = serializer.validated_data['disbursement_method']
        disbursement_details = serializer.validated_data.get('disbursement_details', {})
        
        # Get tenant settings
        tenant_settings = getattr(request.tenant, 'settings', None)
        
        # Determine mode: AUTOMATED or MANUAL
        api_transaction_id = None
        disbursement_status = Loan.DisbursementStatus.PENDING
        is_automated = False
        
        try:
            if disbursement_method == 'mpesa':
                # Check if M-Pesa is configured
                if tenant_settings and tenant_settings.mpesa_consumer_key and tenant_settings.mpesa_consumer_secret:
                    is_automated = True
                    logger.info(f"Attempting automated M-Pesa disbursement for {application.application_number}")
                    
                    mpesa = MpesaService(tenant_settings)
                    phone = disbursement_details.get('phone_number')
                    if not phone:
                        return Response({'error': 'Phone number required for M-Pesa disbursement'}, status=status.HTTP_400_BAD_REQUEST)
                    
                    total_deductions = sum(d.calculated_amount for d in application.deductions.filter(is_withheld=True))
                    disbursed_amount = application.approved_amount - total_deductions
                    
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
                if tenant_settings and tenant_settings.bank_api_enabled:
                    is_automated = True
                    logger.info(f"Attempting automated bank transfer for {application.application_number}")
                    
                    bank_api = BankAPIService(tenant_settings)
                    account = disbursement_details.get('account_number')
                    bank = disbursement_details.get('bank_name')
                    
                    if not account or not bank:
                        return Response({'error': 'Account number and bank name required for bank transfer'}, status=status.HTTP_400_BAD_REQUEST)
                    
                    total_deductions = sum(d.calculated_amount for d in application.deductions.filter(is_withheld=True))
                    disbursed_amount = application.approved_amount - total_deductions
                    
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
            disbursed_amount = application.approved_amount - total_deductions
            
            # Estimate total interest
            total_interest = calculate_interest(
                application.approved_amount,
                application.approved_interest_rate,
                application.approved_term,
                application.product.term_unit,
                application.approved_interest_method
            )

            loan = Loan.objects.create(
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
                outstanding_balance=application.approved_amount + total_interest,
                outstanding_principal=application.approved_amount,
                outstanding_interest=total_interest,
                collateral=application.collateral
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
            advice_buffer = generate_disbursement_letter(loan, request.tenant)
            application.disbursement_letter_file.save(
                f"advice_{loan.loan_number}.pdf",
                ContentFile(advice_buffer.read())
            )

            # 4. Sync with Financials (Treasury & Accounting)
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

class LoanViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Loan.objects.all()
    serializer_class = LoanSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
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
        schedules = loan.schedule.all()
        serializer = RepaymentScheduleSerializer(schedules, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get', 'post'])
    def repayments(self, request, pk=None):
        """Get or record repayments."""
        loan = self.get_object()
        
        if request.method == 'GET':
            repayments = loan.repayments.all()
            serializer = LoanRepaymentSerializer(repayments, many=True)
            return Response(serializer.data)
        
        # POST - Record payment
        serializer = LoanRepaymentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        amount = serializer.validated_data['amount']
        allocation = allocate_payment(loan, amount)
        
        with transaction.atomic():
            repayment = LoanRepayment.objects.create(
                loan=loan,
                amount=amount,
                payment_date=serializer.validated_data['payment_date'],
                payment_method=serializer.validated_data['payment_method'],
                reference_number=serializer.validated_data.get('reference_number', ''),
                notes=serializer.validated_data.get('notes', ''),
                received_by=request.user,
                **allocation
            )
            
            # Update loan balances
            loan.outstanding_principal -= allocation['principal_paid']
            loan.outstanding_interest -= allocation['interest_paid']
            loan.outstanding_penalties -= allocation['penalty_paid']
            loan.outstanding_balance = (
                loan.outstanding_principal + 
                loan.outstanding_interest + 
                loan.outstanding_penalties
            )
            loan.last_payment_date = serializer.validated_data['payment_date']
            
            # Check if paid off
            if loan.outstanding_balance <= 0:
                loan.status = Loan.Status.PAID_OFF
                loan.closed_at = timezone.now()
            
            loan.save()
        
        return Response(LoanRepaymentSerializer(repayment).data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['get'])
    def statement(self, request, pk=None):
        """Download loan statement PDF."""
        loan = self.get_object()
        
        from django.db import connection
        tenant = connection.tenant
        
        pdf_buffer = generate_loan_statement(loan, tenant)
        return FileResponse(
            pdf_buffer,
            as_attachment=True,
            filename=f"statement_{loan.loan_number}.pdf",
            content_type='application/pdf'
        )
    
    @action(detail=True, methods=['post'])
    def update_arrears(self, request, pk=None):
        """Manually trigger arrears calculation for a loan."""
        loan = self.get_object()
        info = calculate_loan_arrears_status(loan)
        return Response(info)


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


# ========== REPORTS ==========

@api_view(['GET'])
def arrears_reports(request):
    """ Arrears Aging and PAR Dashboard """
    aging = get_arrears_aging_report()
    par = calculate_par_metrics()
    
    return Response({
        'aging': aging,
        'par': par
    })


@api_view(['GET'])
def dashboard_summary(request):
    """ Top-level metrics for dashboard cards """
    from django.db.models import Sum, Count
    
    today = timezone.now().date()
    
    # 1. Total Portfolio (Principal Outstanding)
    portfolio_value = Loan.objects.filter(status=Loan.Status.ACTIVE).aggregate(total=Sum('outstanding_balance'))['total'] or 0
    
    # 2. Active Loans Count
    active_loans_count = Loan.objects.filter(status=Loan.Status.ACTIVE).count()
    
    # 3. PAR Percentage
    par_metrics = calculate_par_metrics()
    par_percentage = par_metrics.get('par_30_plus_percent', 0)
    
    # 4. Today's Disbursements
    disbursements_today = Loan.objects.filter(disbursement_date=today).aggregate(total=Sum('disbursed_amount'))['total'] or 0
    disbursements_count = Loan.objects.filter(disbursement_date=today).count()
    
    # 5. Month-over-Month Change (Mocked for now)
    # In a real app, we'd compare against last month's snapshots
    
    return Response({
        'portfolio_value': portfolio_value,
        'active_loans_count': active_loans_count,
        'par_percentage': par_percentage,
        'disbursements_today': disbursements_today,
        'disbursements_count': disbursements_count,
        'currency': 'KES' # Should come from tenant settings
    })
class LoanGuarantorViewSet(viewsets.ModelViewSet):
    queryset = LoanGuarantor.objects.all()
    serializer_class = LoanGuarantorSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    filterset_fields = ['application', 'borrower']
