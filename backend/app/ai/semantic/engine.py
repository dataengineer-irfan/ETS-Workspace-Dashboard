"""
ETS Genie — Semantic Query Engine Facade.

The master entry point for deterministic analytical query processing.
Implements the strict pipeline:
SemanticParser -> IRValidator -> QueryPlanner -> SemanticExecutor -> ResponseFormatter.
"""
from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

from backend.app.ai.semantic.executor import AnalysisResult, semantic_executor
from backend.app.ai.semantic.formatter import response_formatter
from backend.app.ai.semantic.ir import IRStatus, Intent
from backend.app.ai.semantic.parser import semantic_parser
from backend.app.ai.semantic.planner import query_planner
from backend.app.ai.semantic.validator import ir_validator


class SemanticQueryEngine:
    def __init__(self):
        self.parser = semantic_parser
        self.validator = ir_validator
        self.planner = query_planner
        self.executor = semantic_executor
        self.formatter = response_formatter

    def process(
        self,
        question: str,
        context_tab: Optional[str] = None,
        history: Optional[List[Dict[str, Any]]] = None,
        user_role: Optional[str] = "EMPLOYEE",
        active_filters: Optional[Dict[str, Any]] = None,
        department: Optional[str] = None,
    ) -> Dict[str, Any]:
        t0 = time.perf_counter()

        # Step 1: Semantic Parser (Question -> QueryIR)
        ir = self.parser.parse(question, context={"tab": context_tab, "history": history, "active_filters": active_filters})

        # Inject active dashboard filters if present
        if active_filters and isinstance(active_filters, dict):
            for k, v in active_filters.items():
                if v and not any(f.field == k for f in ir.filters.flat()):
                    from backend.app.ai.semantic.ir import FilterSpec
                    ir.filters.items.append(FilterSpec(field=k, op="=", value=v))

        # Step 2: IR Validation
        val_res = self.validator.validate(ir)
        if not val_res.is_valid:
            # Construct a controlled refusal result
            res = AnalysisResult(
                status="REFUSAL" if ir.status in (IRStatus.UNSUPPORTED, IRStatus.AMBIGUOUS) else "ERROR",
                ir=ir,
                error_message=val_res.refusal_reason or "Validation rejected query specification.",
                total_duration_ms=round((time.perf_counter() - t0) * 1000, 2),
            )
            return self.formatter.format(res)

        # Step 2.5: Security Context Resolution & Capability RBAC Enforcement
        from backend.app.ai.security_context import SecurityContext, UserRole
        from backend.app.ai.capability_registry import CapabilityEnum

        sec_ctx = SecurityContext.from_request(user_role=user_role, department=department)
        cap = self._resolve_capability(ir)

        # Deny if user role lacks capability
        if not sec_ctx.is_capability_authorized(cap):
            dur_ms = round((time.perf_counter() - t0) * 1000, 2)
            denial_msg = f"Access denied: User role '{sec_ctx.user_role.value}' is not authorized to execute capability '{cap.value}'."
            return {
                "answer": denial_msg,
                "intent": "ACCESS_DENIED",
                "status": "UNAUTHORIZED",
                "overall_status": "REFUSED",
                "confidence": 0.0,
                "source": "/api/copilot/security",
                "insights": ["Role-based access control policy rejected query."],
                "data": {},
                "filters": {},
                "suggested_questions": [],
                "evidence": [],
                "result_items": [
                    {
                        "requirement_id": "R1",
                        "title": "Access Restricted",
                        "status": "unauthorized",
                        "presentation_mode": "TEXT_NOTICE",
                        "error_details": denial_msg,
                    }
                ],
                "execution_trace": {
                    "llm_required": False,
                    "llm_planner_used": False,
                    "llm_synthesis_used": False,
                    "tool_invoked": None,
                    "deterministic_route": True,
                    "total_duration_ms": dur_ms,
                    "grounded": False,
                },
                "visual_target": "home",
            }

        # Confidential compensation protection: EMPLOYEE role cannot inspect individual salaries
        is_individual_salary_query = False
        if ir.intent == Intent.ENTITY_LOOKUP and ir.entity and "ctc" in (ir.entity.attributes or []):
            is_individual_salary_query = True
        elif ir.intent == Intent.AGGREGATE and any(m.measure in ("ctc", "monthly_salary", "bonus") for m in ir.metrics):
            # If filtered to a specific individual employee
            emp_filters = [f for f in ir.filters.flat() if f.field in ("employee_number", "employee_label")]
            if emp_filters:
                is_individual_salary_query = True

        if is_individual_salary_query and sec_ctx.user_role == UserRole.EMPLOYEE:
            dur_ms = round((time.perf_counter() - t0) * 1000, 2)
            denial_msg = "Access denied: User role 'EMPLOYEE' is not authorized to inspect individual compensation records."
            return {
                "answer": denial_msg,
                "intent": "ACCESS_DENIED",
                "status": "UNAUTHORIZED",
                "overall_status": "REFUSED",
                "confidence": 0.0,
                "source": "/api/copilot/security",
                "insights": ["Role-based access control policy rejected query for individual salary data."],
                "data": {},
                "filters": {},
                "suggested_questions": ["Show department average compensation", "List active employees"],
                "evidence": [],
                "result_items": [
                    {
                        "requirement_id": "R1",
                        "title": "Access Restricted: Individual Compensation",
                        "status": "unauthorized",
                        "presentation_mode": "TEXT_NOTICE",
                        "error_details": denial_msg,
                    }
                ],
                "execution_trace": {
                    "llm_required": False,
                    "llm_planner_used": False,
                    "llm_synthesis_used": False,
                    "tool_invoked": None,
                    "deterministic_route": True,
                    "total_duration_ms": dur_ms,
                    "grounded": False,
                },
                "visual_target": "home",
            }

        # Check for Delegated Intents (Policy RAG, Conversation Context, or Executive Reasoning)
        if ir.intent in (Intent.DELEGATE_POLICY, Intent.DELEGATE_CONTEXT) or ir.reasoning_required:
            # Return flag indicating delegable so orchestrator can handle via RAG, context, or reasoning
            return {
                "_delegate": True,
                "delegate_target": "EXECUTIVE_REASONING" if ir.reasoning_required else ir.intent.value,
                "ir": ir,
            }

        # Step 3: Query Planning & SQL Building
        plan = self.planner.plan(ir)

        # Step 4: Governed Execution
        analysis_result = self.executor.execute(plan)
        analysis_result.total_duration_ms = round((time.perf_counter() - t0) * 1000, 2)

        # Step 4.5: Runtime Invariant Validation
        from backend.app.ai.invariant_engine import invariant_engine
        from backend.app.ai.capability_registry import CapabilityContract, TypedParameters
        from backend.app.ai.db import sqlite_engine

        inv_params = TypedParameters(raw_query=question)
        for f in ir.filters.flat():
            if f.field == "location":
                inv_params.physical_location = f.value
            elif f.field == "state":
                inv_params.project_state = f.value
            elif f.field == "department":
                inv_params.department = f.value

        if ir.ordering:
            inv_params.direction = ir.ordering.direction

        if ir.entity and ir.entity.relation == "REPORTEES":
            inv_params.inquiry_type = "direct_reports_lookup"

        inv_contract = CapabilityContract(
            capability=cap,
            parameters=inv_params,
            execution_route="MULTI_REQUIREMENT"
        )
        inv_res = invariant_engine.validate_capability_result(
            contract=inv_contract,
            rows=analysis_result.rows,
            db_conn=sqlite_engine.conn
        )
        if not inv_res.passed:
            dur_ms = round((time.perf_counter() - t0) * 1000, 2)
            return {
                "answer": f"Data integrity assertion failure: {inv_res.details}. Execution halted per zero-trust architecture.",
                "intent": "DATA_INTEGRITY_VIOLATION",
                "status": "INVARIANT_FAILED",
                "overall_status": "FAILED",
                "confidence": 0.0,
                "source": "/api/copilot/error",
                "insights": [f"Invariant failed assertion check: {inv_res.invariant_name}: {inv_res.details}"],
                "data": {},
                "filters": {},
                "suggested_questions": [],
                "evidence": [],
                "result_items": [],
                "execution_trace": {
                    "llm_required": False,
                    "deterministic_route": True,
                    "total_duration_ms": dur_ms,
                    "confidence_provenance": {
                        "typed_resolution": True,
                        "governed_execution": True,
                        "runtime_invariants": False,
                        "provenance_type": "DETERMINISTIC_VERIFIED_GATES"
                    }
                }
            }

        # Step 5: Response Formatting
        response = self.formatter.format(analysis_result)

        # Add visual routing metadata
        visual_target = "home"
        if ir.intent == Intent.ENTITY_LOOKUP:
            visual_target = "employee_details"
        elif any(d in ("state", "location") for d in ir.dimensions):
            visual_target = "statewise"
        elif any(m.measure in ("ctc", "monthly_salary", "bonus", "hike") for m in ir.metrics):
            visual_target = "salarywise"
        elif any(m.measure in ("skill_coverage",) or "skill" in ir.dimensions for m in ir.metrics):
            visual_target = "techwise"

        response["visual_target"] = visual_target
        response["llm_calls"] = 0
        response["model_calls"] = 0
        response["rag_calls"] = 0
        response["confidence"] = 1.0
        if "execution_trace" not in response or not isinstance(response.get("execution_trace"), dict):
            response["execution_trace"] = {}
        response["execution_trace"]["capability"] = cap.value
        response["execution_trace"]["deterministic_route"] = True
        response["execution_trace"]["confidence_provenance"] = {
            "typed_resolution": True,
            "governed_execution": True,
            "runtime_invariants": True,
            "provenance_type": "DETERMINISTIC_VERIFIED_GATES"
        }
        return response

    def _resolve_capability(self, ir: QueryIR):
        from backend.app.ai.capability_registry import CapabilityEnum

        if ir.intent == Intent.ENTITY_LOOKUP:
            return CapabilityEnum.EMPLOYEE_LOOKUP
        if ir.intent == Intent.RANKING:
            if any(m.measure == "skill" for m in ir.metrics):
                return CapabilityEnum.SKILLS_TOP_RANKING
            return CapabilityEnum.RANKING
        if ir.intent == Intent.COMPARISON:
            return CapabilityEnum.COMPARISON
        if ir.intent == Intent.BREAKDOWN:
            for dim in ir.dimensions:
                if dim == "state":
                    return CapabilityEnum.STATE_BREAKDOWN
                if dim == "project":
                    return CapabilityEnum.PROJECT_BREAKDOWN
                if dim == "location":
                    return CapabilityEnum.LOCATION_BREAKDOWN
                if dim == "department":
                    return CapabilityEnum.DEPARTMENT_BREAKDOWN
                if dim in ("age", "age_group"):
                    return CapabilityEnum.AGE_BREAKDOWN
                if dim == "gender":
                    return CapabilityEnum.GENDER_BREAKDOWN
                if dim in ("skill", "skills"):
                    return CapabilityEnum.SKILL_DISTRIBUTION
            return CapabilityEnum.DEPARTMENT_BREAKDOWN
        if ir.intent == Intent.AGGREGATE:
            has_active = any(
                f.field == "status" and str(f.value).lower() in ("active", "current")
                for f in ir.filters.flat()
            )
            has_exited = any(
                f.field == "status" and str(f.value).lower() in ("exited", "left", "separated", "former", "inactive")
                for f in ir.filters.flat()
            )
            for m in ir.metrics:
                if m.measure == "headcount":
                    if has_exited:
                        return CapabilityEnum.LEAVER_COUNT
                    if has_active:
                        return CapabilityEnum.ACTIVE_HEADCOUNT
                    return CapabilityEnum.HEADCOUNT
                if m.measure in ("leaver_count",):
                    return CapabilityEnum.LEAVER_COUNT
                if m.measure in ("attrition",):
                    return CapabilityEnum.ATTRITION
                if m.measure in ("ctc", "monthly_salary", "bonus", "salary"):
                    if m.agg == "AVG":
                        return CapabilityEnum.COMPENSATION_AVERAGE
                    if m.agg in ("MIN", "MAX"):
                        return CapabilityEnum.RANKING
                    if m.agg == "SUM":
                        return CapabilityEnum.SALARY_TOTAL_COST
                if m.measure == "tenure":
                    return CapabilityEnum.TENURE
                if m.measure == "skill_coverage":
                    return CapabilityEnum.PROJECT_TECH_COVERAGE
            if has_exited:
                return CapabilityEnum.LEAVER_COUNT
            if has_active:
                return CapabilityEnum.ACTIVE_HEADCOUNT
            return CapabilityEnum.HEADCOUNT
        if ir.intent == Intent.DELEGATE_POLICY:
            return CapabilityEnum.RAG_POLICY_QA
        if ir.intent == Intent.UNSUPPORTED:
            return CapabilityEnum.UNSUPPORTED_QUERY
        return CapabilityEnum.HEADCOUNT


semantic_engine = SemanticQueryEngine()
