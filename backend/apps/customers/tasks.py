from celery import shared_task
from .models import FinancialStatement
import time
import random

@shared_task
def process_financial_statement(statement_id):
    """
    Simulate processing a financial statement.
    In production, this would use OCR/PDF parsing libs like Textract, PyPDF2, or a 3rd party API.
    """
    try:
        statement = FinancialStatement.objects.get(id=statement_id)
        
        # Guard: Don't process if already done
        if statement.extraction_status == FinancialStatement.ExtractionStatus.COMPLETED:
            return "Already completed"

        # Simulate Processing Delay
        time.sleep(5) 
        
        # Mock Extracted Data
        statement.extracted_data = {
            "transaction_count": random.randint(50, 500),
            "currency": "KES",
            "provider": statement.get_statement_type_display(),
            "sample_transactions": [
                {"date": "2026-01-01", "amount": 5000, "type": "credit", "description": "Deposit"},
                {"date": "2026-01-02", "amount": -200, "type": "debit", "description": "Airtime Purchase"},
                {"date": "2026-01-05", "amount": -1500, "type": "debit", "description": "Utility Payment"},
                {"date": "2026-01-15", "amount": 30000, "type": "credit", "description": "Salary"},
            ]
        }
        
        # Mock Analysis Results
        turnover = random.uniform(50000, 500000)
        statement.analysis_results = {
            "total_turnover": round(turnover, 2),
            "average_daily_balance": round(turnover / 30, 2),
            "highest_balance": round(turnover * 0.4, 2),
            "lowest_balance": round(random.uniform(0, 5000), 2),
            "salary_detected": True,
            "gambling_activity_detected": False,
            "risk_score": random.randint(1, 100)
        }
        
        statement.extraction_status = FinancialStatement.ExtractionStatus.COMPLETED
        statement.save()
        
        return f"Statement {statement_id} processed successfully."
        
    except FinancialStatement.DoesNotExist:
        return f"Statement {statement_id} not found."
    except Exception as e:
        if 'statement' in locals():
            statement.extraction_status = FinancialStatement.ExtractionStatus.FAILED
            statement.save()
        return f"Error processing statement {statement_id}: {str(e)}"
