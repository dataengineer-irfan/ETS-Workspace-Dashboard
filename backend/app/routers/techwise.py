from fastapi import APIRouter, Request
from backend.app.analytics import analytics_engine, extract_request_filters
from backend.app.models import TechwiseKPIs

router = APIRouter(prefix="/api/techwise", tags=["Techwise"])

@router.get("/kpis", response_model=TechwiseKPIs)
def get_techwise_kpis(request: Request):
    filters = extract_request_filters(request)
    return analytics_engine.get_techwise_kpis(filters)
