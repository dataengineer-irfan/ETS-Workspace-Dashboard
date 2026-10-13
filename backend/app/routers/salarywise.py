from fastapi import APIRouter, Request, Depends
from backend.app.analytics import analytics_engine, extract_request_filters
from backend.app.models import SalarywiseKPIs
from backend.app.security import require_roles

router = APIRouter(prefix="/api/salarywise", tags=["Salarywise"])

@router.get(
    "/kpis",
    response_model=SalarywiseKPIs,
    dependencies=[Depends(require_roles(["MANAGER", "HR_ANALYTICS", "EXECUTIVE", "ADMIN"]))]
)
def get_salarywise_kpis(request: Request):
    filters = extract_request_filters(request)
    return analytics_engine.get_salarywise_kpis(filters)
