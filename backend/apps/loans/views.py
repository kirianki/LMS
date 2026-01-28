from rest_framework import viewsets, permissions, status
from apps.users.permissions import HasRolePermission
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from django.http import FileResponse
from django.utils import timezone
from django.db import transaction
from datetime import date
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
from .services.treasury_sync import record_loan_disbursement
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
    filterset_fields = ['is_active', 'requires_collateral', 'requires_guarantor']


class LoanApplicationViewSet(viewsets.ModelViewSet):
    queryset = LoanApplication.objects.all()
    serializer_class = LoanApplicationSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    filterset_fields = ['customer', 'product', 'status']
    
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
        """Approve loan application and set deductions."""
        application = self.get_object()
        serializer = LoanApplicationApproveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        if application.status not in [LoanApplication.Status.SUBMITTED, LoanApplication.Status.UNDER_REVIEW]:
            return Response(
                {'error': 'Application cannot be approved in current status.'},
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
            
        return Response({'status': 'approved'})

    @action(detail=True, methods=['post'])
    def send_offer_letter(self, request, pk=None):
        """Generate and send offer letter."""
        application = self.get_object()
        if application.status != LoanApplication.Status.APPROVED:
            return Response({'error': 'Application must be approved first.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Generate PDF
        from django.core.files.base import ContentFile
        pdf_buffer = generate_offer_letter(application, request.tenant)
        
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
        """Download the generated disbursement letter."""
        application = self.get_object()
        if not application.disbursement_letter_file:
            return Response({'error': 'Disbursement letter has not been generated yet.'}, status=status.HTTP_404_NOT_FOUND)
        
        return FileResponse(application.disbursement_letter_file.open(), as_attachment=True)

    @action(detail=True, methods=['post'])
    def accept_offer(self, request, pk=None):
        """Upload signed offer and move to accepted status."""
        application = self.get_object()
        if 'signed_offer' not in request.FILES:
            return Response({'error': 'Signed offer letter file is required.'}, status=status.HTTP_400_BAD_REQUEST)
            
        application.signed_offer_letter = request.FILES['signed_offer']
        application.status = LoanApplication.Status.OFFER_ACCEPTED
        application.save()
        
        return Response({'status': 'offer_accepted'})
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
        """Disburse loan after offer is accepted."""
        application = self.get_object()
        serializer = DisburseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        if application.status != LoanApplication.Status.OFFER_ACCEPTED:
            return Response(
                {'error': 'Application must be in OFFER_ACCEPTED status before disbursement.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            # 1. Create the Loan object
            total_deductions = sum(d.calculated_amount for d in application.deductions.filter(is_withheld=True))
            disbursed_amount = application.approved_amount - total_deductions
            
            # Estimate total interest
            total_interest = calculate_interest(
                application.approved_amount,
                application.approved_interest_rate,
                application.approved_term,
                application.approved_interest_method
            )

            loan = Loan.objects.create(
                application=application,
                customer=application.customer,
                product=application.product,
                principal_amount=application.approved_amount,
                total_interest=total_interest,
                total_fees=total_deductions,
                disbursed_amount=disbursed_amount,
                disbursement_date=timezone.now().date(),
                disbursement_method=serializer.validated_data['disbursement_method'],
                term=application.approved_term,
                maturity_date=timezone.now().date() + relativedelta(months=application.approved_term),
                outstanding_balance=application.approved_amount + total_interest,
                outstanding_principal=application.approved_amount,
                outstanding_interest=total_interest,
                collateral=application.collateral
            )

            # 2. Generate Repayment Schedule
            generate_repayment_schedule(loan)

            # 3. Handle Documents
            from django.core.files.base import ContentFile
            advice_buffer = generate_disbursement_letter(loan, request.tenant)
            application.disbursement_letter_file.save(
                f"advice_{loan.loan_number}.pdf",
                ContentFile(advice_buffer.read())
            )

            # 4. Sync with Treasury
            record_loan_disbursement(loan, user=request.user)

            # 5. Update Status
            application.status = LoanApplication.Status.DISBURSED
            application.disbursed_at = timezone.now()
            application.save()

        return Response({'status': 'disbursed', 'loan_number': loan.loan_number})

    @action(detail=True, methods=['get'])
    def download_offer_letter(self, request, pk=None):
        """Download generated offer letter."""
        application = self.get_object()
        if not application.offer_letter_file:
            return Response({'error': 'Offer letter file not found.'}, status=status.HTTP_404_NOT_FOUND)
        return FileResponse(application.offer_letter_file, as_attachment=True, filename=f"Offer_{application.application_number}.pdf")

    @action(detail=True, methods=['get'])
    def download_disbursement_letter(self, request, pk=None):
        """Download generated disbursement advice."""
        application = self.get_object()
        if not application.disbursement_letter_file:
            return Response({'error': 'Disbursement advice not found.'}, status=status.HTTP_404_NOT_FOUND)
        return FileResponse(application.disbursement_letter_file, as_attachment=True, filename=f"Disbursement_{application.application_number}.pdf")


class LoanViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Loan.objects.all()
    serializer_class = LoanSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    filterset_fields = ['customer', 'product', 'status']
    
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
    filterset_fields = ['status', 'priority', 'assigned_to']
    
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
    filterset_fields = ['application', 'customer']
