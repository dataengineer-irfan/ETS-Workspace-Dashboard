import time
import logging
from typing import Optional
from fastapi import APIRouter, Request
from backend.app.ai.orchestrator import llm_orchestrator
from backend.app.models import CopilotQueryRequest, CopilotQueryResponse
from backend.app.security import decode_access_token
from backend.app.auth_db import get_user_by_id

logger = logging.getLogger("copilot_telemetry")

router = APIRouter(prefix="/api/copilot", tags=["AI Copilot"])

@router.post("/query", response_model=CopilotQueryResponse)
def query_copilot(req: CopilotQueryRequest, request: Request):
    # Derive user role and department strictly from verified JWT token.
    # Unauthenticated requests are strictly enforced to EMPLOYEE role (least privilege).
    user_role = "EMPLOYEE"
    department = None

    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
        payload = decode_access_token(token)
        if payload and "user_id" in payload:
            user = get_user_by_id(int(payload["user_id"]))
            if user:
                user_role = user.get("role", "EMPLOYEE")
                department = user.get("department")
            else:
                logger.warning(f"[COPILOT] Authenticated user_id {payload.get('user_id')} not found in auth_db.")
        else:
            logger.warning("[COPILOT] Invalid or expired bearer token provided in request.")
    else:
        # If client provided an elevated role without authentication, reject escalation
        if req.user_role and req.user_role.upper() != "EMPLOYEE":
            logger.warning(
                f"[COPILOT] Unauthenticated query attempted to assert privileged role '{req.user_role}'. "
                f"Clamping to 'EMPLOYEE'."
            )

    t0 = time.time()
    res = llm_orchestrator.process(
        req.question,
        context_tab=req.context_tab,
        history=req.history,
        user_role=user_role,
        active_filters=req.filters,
        department=department
    )
    dur_ms = round((time.time() - t0) * 1000, 2)
    logger.info(f"[COPILOT] Query='{req.question}' | Intent={res.get('intent')} | Source={res.get('source')} | Latency={dur_ms}ms")
    return res
