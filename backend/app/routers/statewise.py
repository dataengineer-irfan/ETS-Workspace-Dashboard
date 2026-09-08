from fastapi import APIRouter, Request
from backend.app.analytics import analytics_engine, extract_request_filters
from backend.app.models import StatewiseKPIs

router = APIRouter(prefix="/api/statewise", tags=["Statewise"])

@router.get("/kpis", response_model=StatewiseKPIs)
def get_statewise_kpis(request: Request):
    filters = extract_request_filters(request)
    return analytics_engine.get_statewise_kpis(filters)

