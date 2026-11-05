import json
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Request

from backend.app.analytics import analytics_engine, extract_request_filters
from backend.app.data_loader import repo_root

router = APIRouter(prefix="/api/ai-utilization", tags=["AI utilization"])
_DEBUG_LOG = os.path.join(repo_root(), "debug-6a418b.log")


@router.get("/kpis")
def get_ai_utilization_kpis(request: Request):
    filters = extract_request_filters(request)
    return analytics_engine.get_ai_utilization_kpis(filters)


@router.post("/debug-log")
def post_ai_debug_log(payload: dict):
    # DEBUG-ONLY: dual-write because browser ingest to :7896 is often blocked
    line = dict(payload or {})
    line.setdefault("sessionId", "6a418b")
    line.setdefault("timestamp", int(datetime.now(timezone.utc).timestamp() * 1000))
    os.makedirs(os.path.dirname(_DEBUG_LOG) or ".", exist_ok=True)
    with open(_DEBUG_LOG, "a", encoding="utf-8") as handle:
        handle.write(json.dumps(line, ensure_ascii=True) + "\n")
    return {"ok": True}
