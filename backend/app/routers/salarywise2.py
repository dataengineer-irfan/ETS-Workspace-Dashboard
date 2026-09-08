from fastapi import APIRouter, Request
from backend.app.analytics import analytics_engine, extract_request_filters
from backend.app.models import Salarywise2KPIs

router = APIRouter(prefix="/api/salarywise2", tags=["Salarywise2"])

@router.get("/kpis", response_model=Salarywise2KPIs)
def get_salarywise2_kpis(request: Request):
    filters = extract_request_filters(request)
    return analytics_engine.get_salarywise2_kpis(filters)

