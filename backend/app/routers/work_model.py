from fastapi import APIRouter, Request
from backend.app.analytics import analytics_engine, extract_request_filters

router = APIRouter(prefix="/api/work-model", tags=["Work model"])

@router.get("/kpis")
def get_work_model_kpis(request: Request):
    filters = extract_request_filters(request)
    return analytics_engine.get_work_model_kpis(filters)
