from fastapi import APIRouter, Request
from backend.app.analytics import analytics_engine, extract_request_filters
from backend.app.models import SalarywiseKPIs

router = APIRouter(prefix="/api/salarywise", tags=["Salarywise"])

@router.get("/kpis", response_model=SalarywiseKPIs)
def get_salarywise_kpis(request: Request):
    filters = extract_request_filters(request)
    return analytics_engine.get_salarywise_kpis(filters)
