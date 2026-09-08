from fastapi import APIRouter, Request
from backend.app.analytics import analytics_engine, extract_request_filters
from backend.app.models import CalendarData

router = APIRouter(prefix="/api/calendar", tags=["Calendar & Leaves"])

@router.get("/data", response_model=CalendarData)
def get_calendar_data(request: Request):
    filters = extract_request_filters(request)
    return analytics_engine.get_calendar_data(filters)
