from fastapi import APIRouter, Request
from backend.app.analytics import analytics_engine, extract_request_filters
from backend.app.models import HomeKPIs

router = APIRouter(prefix="/api/home", tags=["Home"])

@router.get("/kpis", response_model=HomeKPIs)
def get_home_kpis(request: Request):
    filters = extract_request_filters(request)
    return analytics_engine.get_home_kpis(filters)

@router.get("/filters")
def get_filter_options():
    return analytics_engine.get_filter_options()
