import pytest
import sqlite3
from typing import Dict, Any, List
from backend.app.ai.capability_registry import (
    capability_registry, CapabilityEnum, EntityNormalizer, TypedParameters
)
from backend.app.ai.security_context import SecurityContext, UserRole
from backend.app.ai.query_builder import query_builder, QueryPlan
from backend.app.ai.invariant_engine import invariant_engine, InvariantResult
from backend.app.ai.sql_governor import sql_governor
from backend.app.ai.db import sqlite_engine
from backend.app.ai.orchestrator import llm_orchestrator
from backend.app.ai.model_gateway import model_gateway

# =====================================================================
# TIER 1: CAPABILITY RESOLUTION UNIT TESTS
# =====================================================================
class TestCapabilityResolution:
    def test_total_headcount_capability(self):
        c = capability_registry.resolve("How many total employees are there in ETS?")
        assert c.capability == CapabilityEnum.HEADCOUNT
        assert c.execution_route == "DETERMINISTIC_SQL"

    def test_active_headcount_capability(self):
        c = capability_registry.resolve("How many active employees are there?")
        assert c.capability == CapabilityEnum.ACTIVE_HEADCOUNT
        assert c.execution_route == "DETERMINISTIC_SQL"
        assert c.parameters.current_status == "Active"

    def test_leaver_count_capability(self):
        c = capability_registry.resolve("How many employees have left ETS?")
        assert c.capability == CapabilityEnum.LEAVER_COUNT
        assert c.execution_route == "DETERMINISTIC_SQL"
        assert c.parameters.current_status == "Exited"

    def test_attrition_capability(self):
        c = capability_registry.resolve("What is the cumulative attrition rate?")
        assert c.capability == CapabilityEnum.ATTRITION
        assert c.execution_route == "DETERMINISTIC_SQL"

    def test_highest_salary_ranking_capability(self):
        c = capability_registry.resolve("Who has the highest salary at ETS?")
        assert c.capability == CapabilityEnum.RANKING
        assert c.execution_route == "DETERMINISTIC_SQL"
        assert c.parameters.direction == "DESC"

    def test_lowest_salary_ranking_capability(self):
        c = capability_registry.resolve("Who earns the lowest salary?")
        assert c.capability == CapabilityEnum.RANKING
        assert c.execution_route == "DETERMINISTIC_SQL"
        assert c.parameters.direction == "ASC"

    def test_promotion_hike_capability(self):
        c = capability_registry.resolve("What is the average promotion hike?")
        assert c.capability == CapabilityEnum.COMPENSATION_AVERAGE
        assert c.execution_route == "DETERMINISTIC_SQL"
        assert c.meta.get("metric") == "hike_percent"

    def test_unsupported_domain_guardrail(self):
        c = capability_registry.resolve("What is the weather in New York?")
        assert c.capability == CapabilityEnum.UNSUPPORTED_QUERY
        assert c.execution_route == "UNSUPPORTED"


# =====================================================================
# TIER 2: ENTITY NORMALIZATION & UNKNOWN ENTITY PRESERVATION
# =====================================================================
class TestEntityNormalization:
    def test_project_state_known(self):
        states, unk = EntityNormalizer.extract_project_states("How many employees in Project State ND?")
        assert states == ["ND"]
        assert unk is None

    def test_project_state_multi_known(self):
        states, unk = EntityNormalizer.extract_project_states("Compare employees in ND and NH")
        assert "ND" in states and "NH" in states

    def test_project_state_unknown_preserved(self):
        states, unk = EntityNormalizer.extract_project_states("How many employees in state ZZ?")
        assert "ZZ" in states
        assert unk == "ZZ"

    def test_preposition_in_does_not_trigger_indiana(self):
        states, unk = EntityNormalizer.extract_project_states("How many employees in ETS?")
        assert "IN" not in states
        assert unk is None

    def test_physical_location_known(self):
        locs, unk = EntityNormalizer.extract_locations("How many employees in Bangalore?")
        assert locs == ["Bangalore"]
        assert unk is None

    def test_physical_location_unknown_preserved(self):
        locs, unk = EntityNormalizer.extract_locations("How many employees in Delhi?")
        assert "Delhi" in locs
        assert unk == "Delhi"


# =====================================================================
# TIER 3: PARAMETERIZED QUERY BUILDER & AST VALIDATION
# =====================================================================
class TestParameterizedQueryBuilder:
    def test_headcount_query(self):
        sec = SecurityContext.from_request(user_role="EMPLOYEE")
        c = capability_registry.resolve("total headcount")
        plan = query_builder.build_plan(c, sec)
        assert "SELECT COUNT(*) AS count FROM employees" in plan.sql

    def test_unknown_state_predicate_never_dropped(self):
        sec = SecurityContext.from_request(user_role="EMPLOYEE")
        c = capability_registry.resolve("How many employees in state ZZ?")
        plan = query_builder.build_plan(c, sec)
        assert "state = 'ZZ'" in plan.sql

    def test_ranking_ties_represented_in_sql(self):
        sec = SecurityContext.from_request(user_role="EMPLOYEE")
        c = capability_registry.resolve("Who has the highest salary?")
        plan = query_builder.build_plan(c, sec)
        assert "annual_ctc = (SELECT MAX(annual_ctc)" in plan.sql


# =====================================================================
# TIER 4: RUNTIME INVARIANT ENGINE ASSERTIONS
# =====================================================================
class TestRuntimeInvariants:
    def test_headcount_conservation_invariant(self):
        c = capability_registry.resolve("total headcount")
        plan = query_builder.build_plan(c, SecurityContext.from_request())
        rows = sqlite_engine.conn.execute(plan.sql).fetchall()
        res = invariant_engine.validate_capability_result(c, [{"count": rows[0][0]}], sqlite_engine.conn)
        assert res.passed is True

    def test_state_partition_invariant(self):
        c = capability_registry.resolve("breakdown by state")
        plan = query_builder.build_plan(c, SecurityContext.from_request())
        rows = [{"state": r[0], "count": r[1]} for r in sqlite_engine.conn.execute(plan.sql).fetchall()]
        res = invariant_engine.validate_capability_result(c, rows, sqlite_engine.conn)
        assert res.passed is True

    def test_ranking_ties_invariant_passes_with_all_ties(self):
        c = capability_registry.resolve("highest salary")
        plan = query_builder.build_plan(c, SecurityContext.from_request())
        cursor = sqlite_engine.conn.cursor()
        raw_rows = cursor.execute(plan.sql).fetchall()
        col_names = [d[0] for d in cursor.description]
        rows = [dict(zip(col_names, r)) for r in raw_rows]
        assert len(rows) == 34
        res = invariant_engine.validate_capability_result(c, rows, sqlite_engine.conn)
        assert res.passed is True

    def test_unknown_filter_zero_invariant_rejects_leakage(self):
        c = capability_registry.resolve("employees in state ZZ")
        fake_leaked_rows = [{"count": 590}]
        res = invariant_engine.validate_capability_result(c, fake_leaked_rows, sqlite_engine.conn)
        assert res.passed is False
        assert "UNKNOWN_FILTER_ZERO_INVARIANT" in res.invariant_name


# =====================================================================
# TIER 5: GOVERNED SQL SECURITY & INJECTION FUZZING
# =====================================================================
class TestSQLGovernanceAndSecurity:
    def test_select_only_enforced(self):
        res = sql_governor.execute_governed("DELETE FROM employees WHERE employee_number = 1000177")
        assert res["success"] is False
        assert "Only SELECT queries are permitted" in res["error"]

    def test_drop_table_rejected(self):
        res = sql_governor.execute_governed("DROP TABLE employees")
        assert res["success"] is False

    def test_table_allowlist_enforced(self):
        res = sql_governor.execute_governed("SELECT * FROM sqlite_master")
        assert res["success"] is False
        assert "Unauthorized table" in res["error"]

    def test_unsupported_functions_blocked(self):
        res = sql_governor.execute_governed("SELECT YEAR(start_date) FROM employees")
        assert res["success"] is False


# =====================================================================
# TIER 6: SECURITY CONTEXT & ROLE-BASED ACCESS CONTROL
# =====================================================================
class TestSecurityContext:
    def test_employee_role_allowed_standard_capabilities(self):
        ctx = SecurityContext.from_request(user_role="EMPLOYEE")
        assert ctx.is_capability_authorized(CapabilityEnum.HEADCOUNT)
        assert ctx.is_capability_authorized(CapabilityEnum.ACTIVE_HEADCOUNT)
        assert ctx.is_capability_authorized(CapabilityEnum.RANKING)

    def test_document_authorization_employee(self):
        ctx = SecurityContext.from_request(user_role="EMPLOYEE")
        assert ctx.is_document_authorized({"ALL"}) is True
        assert ctx.is_document_authorized({"EMPLOYEE"}) is True
        assert ctx.is_document_authorized({"EXECUTIVE"}) is False

    def test_document_authorization_executive(self):
        ctx = SecurityContext.from_request(user_role="EXECUTIVE")
        assert ctx.is_document_authorized({"EXECUTIVE"}) is True
        assert ctx.is_document_authorized({"EMPLOYEE"}) is True


# =====================================================================
# TIER 7: DATA LINEAGE & PROVENANCE VERIFICATION
# =====================================================================
class TestDataProvenance:
    def test_finance_history_origin_labels(self):
        cursor = sqlite_engine.conn.cursor()
        excel_cnt = cursor.execute("SELECT COUNT(*) FROM finance_history WHERE record_origin = 'EXCEL_SOURCE' AND is_synthetic = 0").fetchone()[0]
        synth_cnt = cursor.execute("SELECT COUNT(*) FROM finance_history WHERE record_origin = 'SYNTHETIC_DERIVED' AND is_synthetic = 1").fetchone()[0]
        total_cnt = cursor.execute("SELECT COUNT(*) FROM finance_history").fetchone()[0]
        
        assert excel_cnt == 65
        assert synth_cnt == 1869
        assert total_cnt == 1934
        assert excel_cnt + synth_cnt == total_cnt


# =====================================================================
# TIER 8: ACCURACY ON MAJOR DETERMINISTIC BENCHMARKS
# =====================================================================
class TestDeterministicAccuracy:
    def test_total_workforce_is_590(self):
        res = llm_orchestrator.process("How many total employees are there in ETS?")
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "590" in res["answer"]
        assert res["execution_trace"]["llm_required"] is False
        assert res["execution_trace"]["invariants_validated"] is True

    def test_active_workforce_is_557(self):
        res = llm_orchestrator.process("How many active employees are there?")
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "557" in res["answer"]
        assert res["execution_trace"]["llm_required"] is False

    def test_exited_workforce_is_33(self):
        res = llm_orchestrator.process("How many employees have left ETS?")
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "33" in res["answer"]
        assert res["execution_trace"]["llm_required"] is False

    def test_project_state_nd_is_118(self):
        res = llm_orchestrator.process("How many employees in Project State ND?")
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "118" in res["answer"]

    def test_physical_location_bangalore_total_is_396(self):
        res = llm_orchestrator.process("How many employees in Bangalore?")
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "396" in res["answer"]

    def test_physical_location_bangalore_active_is_386(self):
        res = llm_orchestrator.process("How many active employees in Bangalore?")
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "386" in res["answer"]

    def test_unknown_state_zz_is_0(self):
        res = llm_orchestrator.process("How many employees in state ZZ?")
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "0 employees" in res["answer"]

    def test_highest_salary_represents_all_34_tied(self):
        res = llm_orchestrator.process("Who has the highest salary?")
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "34 employees" in res["answer"]
        assert "5,000,000" in res["answer"]

    def test_cumulative_attrition_rate_is_5_59(self):
        res = llm_orchestrator.process("What is the attrition rate?")
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "5.59%" in res["answer"]

    def test_average_promotion_hike_is_110_06(self):
        res = llm_orchestrator.process("What is the average promotion hike?")
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "110.06%" in res["answer"]


# =====================================================================
# TIER 9: MODEL GATEWAY & LOCAL / ENTERPRISE PROFILES
# =====================================================================
class TestModelGateway:
    def test_active_profile_and_models(self):
        rag_m = model_gateway.configured_rag_model
        sql_m = model_gateway.configured_sql_model
        embed_m = model_gateway.configured_embedding_model
        assert rag_m is not None
        assert sql_m is not None
        assert embed_m is not None


# =====================================================================
# TIER 10: RAG VECTOR GROUNDING & ANTI-HALLUCINATION
# =====================================================================
class TestRAGGrounding:
    def test_cryptocurrency_negative_policy_grounded(self):
        res = llm_orchestrator.process("Can I get reimbursed for cryptocurrency purchases?")
        assert res["intent"] == "LLM_UNSUPPORTED"
        ans_lower = res["answer"].lower()
        assert "no policy" in ans_lower or "no record" in ans_lower
        assert res["execution_trace"]["grounded"] is True


# =====================================================================
# TIER 11: OUT-OF-DOMAIN GUARDRAIL REFUSAL
# =====================================================================
class TestGuardrailRefusal:
    def test_weather_refused_immediately(self):
        res = llm_orchestrator.process("What is the weather in Paris?")
        assert res["intent"] == "UNSUPPORTED_DOMAIN"
        assert res["status"] == "REFUSAL"
        assert res["execution_trace"]["llm_required"] is False
        assert "outside the operational boundary" in res["answer"]


# =====================================================================
# TIER 12: COMBINATORIAL FILTER COMPOSITION
# =====================================================================
class TestCombinatorialFilters:
    def test_state_and_location_composition(self):
        res = llm_orchestrator.process("How many active employees in Project State ND in Bangalore?")
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert res["execution_trace"]["invariants_validated"] is True
