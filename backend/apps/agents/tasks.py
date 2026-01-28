from celery import shared_task
from .services import ValuationParsingAgent
from .models import AgentLog
from apps.collateral.models import ValuationRequest, ValuationReport, EmailConfiguration
from django.core.files.base import ContentFile
import logging

logger = logging.getLogger(__name__)

@shared_task
def process_valuation_report_task(request_id, report_text):
    """
    Background task to parse report text and update models.
    """
    try:
        request = ValuationRequest.objects.get(id=request_id)
        agent = ValuationParsingAgent()
        result = agent.parse_report_text(report_text)
        
        status = "success" if result.get('success') else "failure"
        
        # Log the action
        AgentLog.objects.create(
            agent_name="ValuationParsingAgent",
            action="background_parse",
            input_data={"request_id": str(request_id), "text_length": len(report_text)},
            output_data=result,
            status=status
        )

        if result.get('success'):
            data = result['data']
            # Update/Create Report
            ValuationReport.objects.create(
                collateral=request.collateral,
                valuation_request=request,
                valuer_company=data['valuer_company'],
                market_value=data['market_value'],
                forced_sale_value=data['forced_sale_value'],
                valuation_date=data['valuation_date'],
                notes=f"Auto-parsed from email. Original text: {report_text[:100]}..."
            )
            
            # Update Request status
            request.status = ValuationRequest.RequestStatus.COMPLETED
            request.save()
            
            # Update Collateral values
            collateral = request.collateral
            collateral.market_value = data['market_value']
            collateral.forced_sale_value = data['forced_sale_value']
            collateral.valuation_date = data['valuation_date']
            collateral.valuer_name = data['valuer_company']
            collateral.save()
            
            logger.info(f"Successfully processed valuation for request {request_id}")
            return True
        else:
            request.status = ValuationRequest.RequestStatus.FAILED
            request.save()
            logger.error(f"AI Parsing failed for request {request_id}: {result.get('error')}")
            return False
            
    except Exception as e:
        logger.error(f"Task process_valuation_report_task failed: {str(e)}")
        return False

@shared_task
def poll_valuer_emails_task():
    """
    Periodic task to poll IMAP/Email for new reports (Skeleton).
    """
    # In a real implementation:
    # 1. Connect to IMAP using EmailConfiguration
    # 2. Fetch new emails
    # 3. Extract tracking ID from Reply-To or Subject
    # 4. Trigger process_valuation_report_task
    logger.info("Polling valuer emails (Simulated)...")
    return "Not implemented: Requires IMAP credentials and library"
