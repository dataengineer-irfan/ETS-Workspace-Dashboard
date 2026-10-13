import pytest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../backend")))

from backend.app.ai.orchestrator import LLMOrchestrator
from backend.app.ai.capability_registry import capability_registry, CapabilityEnum, merge_filter_context
from backend.app.ai.compositional import (
    AnalyticalParser,
    MultiRequirementQueryBuilder,
    MultiRequirementInvariantEngine,
    MetricEnum,
    DimensionEnum,
    RequirementTypeEnum,
)
from backend.app.ai.db import sqlite_engine


@pytest.fixture(scope="module")
def orchestrator():
    return LLMOrchestrator()


class TestGenericFilterContext:
    """Tests generic filter precedence and context propagation from dashboard to AI query execution."""

    def test_active_filter_propagation_e3_nh(self, orchestrator):
        """Active filter state=NH with explicit question E3 returns exactly 91 employees."""
        res = orchestrator.process("How many employees are in E3?", active_filters={"state": "NH"})
        assert res.get("status") in ("SUCCESS", "success", "deterministic_answered")
        assert "91" in res.get("answer", "")

        items = res.get("result_items", [])
        assert len(items) >= 1
        card = items[0].get("metric_card_spec", {})
        assert card.get("value") == "91"

    def test_active_filter_propagation_e2_ak(self, orchestrator):
        """Active filter state=AK with explicit question E2 returns exactly 69 employees."""
        res = orchestrator.process("How many employees are in E2?", active_filters={"state": "AK"})
        assert res.get("status") in ("SUCCESS", "success", "deterministic_answered")
        assert "69" in res.get("answer", "")

        items = res.get("result_items", [])
        assert len(items) >= 1
        card = items[0].get("metric_card_spec", {})
        assert card.get("value") == "69"

    def test_explicit_query_overrides_active_dashboard_filter(self, orchestrator):
        """Explicit query entity (ND) overrides active dashboard filter (NH)."""
        res = orchestrator.process("How many employees in ND?", active_filters={"state": "NH"})
        assert res.get("status") in ("SUCCESS", "success", "deterministic_answered")
        assert "118" in res.get("answer", "")
        assert "364" not in res.get("answer", "")

    def test_generic_filter_precedence_model_merge(self):
        """Test merge_filter_context function directly."""
        from backend.app.ai.capability_registry import TypedParameters

        # Case 1: active filter state=NH, no query entities -> effective has state=NH
        p1 = TypedParameters(raw_query="How many employees?")
        eff1 = merge_filter_context(params=p1, active_filters={"state": "NH", "job_level": "E3"})
        assert eff1["state"] == "NH"
        assert eff1["job_level"] == "E3"

        # Case 2: active filter state=NH, query explicitly mentions ND -> effective does not override to NH
        p2 = TypedParameters(raw_query="How many employees in ND?", project_state="ND")
        eff2 = merge_filter_context(params=p2, active_filters={"state": "NH"})
        # The active filter state 'NH' is suppressed because query explicitly set project_state='ND'
        assert "state" not in eff2


class TestExperienceComparison:
    """Tests experience comparison (Infinite vs Prior experience) and experience metrics."""

    def test_experience_comparison_by_grade_table_structure(self, orchestrator):
        """'Compare Infinite vs Prior experience by grade' produces TABLE mode with 10 grades."""
        res = orchestrator.process("Compare Infinite vs Prior experience by grade")
        assert res.get("status") in ("SUCCESS", "success", "deterministic_answered")

        items = res.get("result_items", [])
        assert len(items) == 1
        table_item = items[0]
        assert table_item.get("presentation_mode") == "TABLE"

        table_spec = table_item.get("table_spec", {})
        cols = table_spec.get("columns", [])
        assert "job_level" in cols
        assert "avg_prior_exp" in cols
        assert "avg_infinite_exp" in cols
        assert "avg_total_exp" in cols

        rows = table_spec.get("rows", [])
        assert len(rows) == 10
        assert rows[0]["job_level"] == "E1"
        assert rows[-1]["job_level"] == "E10"

    def test_experience_comparison_generic_department(self, orchestrator):
        """'Compare Infinite vs Prior experience by department' works generically across departments."""
        res = orchestrator.process("Compare Infinite vs Prior experience by department")
        assert res.get("status") in ("SUCCESS", "success", "deterministic_answered")

        items = res.get("result_items", [])
        assert len(items) == 1
        table_spec = items[0].get("table_spec", {})
        assert "department" in table_spec.get("columns", [])
        assert len(table_spec.get("rows", [])) >= 5

    def test_single_infinite_experience_metric(self, orchestrator):
        """'Average infinite experience by grade' returns INFINITE_EXP metric."""
        contract = capability_registry.resolve("Average infinite experience by grade")
        plan = AnalyticalParser.parse("Average infinite experience by grade", base_params=contract.parameters)
        assert len(plan.requirements) == 1
        assert plan.requirements[0].metric == MetricEnum.INFINITE_EXP
        assert plan.requirements[0].dimensions == [DimensionEnum.JOB_LEVEL]

    def test_single_prior_experience_metric(self, orchestrator):
        """'Average prior experience by department' returns PRIOR_EXP metric."""
        contract = capability_registry.resolve("Average prior experience by department")
        plan = AnalyticalParser.parse("Average prior experience by department", base_params=contract.parameters)
        assert len(plan.requirements) == 1
        assert plan.requirements[0].metric == MetricEnum.PRIOR_EXP
        assert plan.requirements[0].dimensions == [DimensionEnum.DEPARTMENT]


class TestCompositeBreakdownIntegrity:
    """Tests multi-dimensional composite breakdowns (e.g. Job Level x Project)."""

    def test_composite_breakdown_table_mode_and_no_limit_12(self, orchestrator):
        """Composite breakdown across Job Level and Project returns TABLE with all 20 combinations."""
        res = orchestrator.process("Show workforce distribution by job level and project")
        assert res.get("status") in ("SUCCESS", "success", "deterministic_answered")

        items = res.get("result_items", [])
        assert len(items) >= 1
        comp_item = items[0]
        assert comp_item.get("presentation_mode") == "TABLE"

        table_spec = comp_item.get("table_spec", {})
        rows = table_spec.get("rows", [])
        assert len(rows) == 20

    def test_composite_breakdown_with_active_filter(self, orchestrator):
        """Composite breakdown with active filter state=NH returns 13 combinations (364 total employees)."""
        res = orchestrator.process("Show workforce distribution by job level and project", active_filters={"state": "NH"})
        assert res.get("status") in ("SUCCESS", "success", "deterministic_answered")

        items = res.get("result_items", [])
        comp_item = items[0]
        table_spec = comp_item.get("table_spec", {})
        rows = table_spec.get("rows", [])
        assert len(rows) == 13
        total_count = sum(r["count"] for r in rows)
        assert total_count == 364


class TestNonSalaryGradeAuthorization:
    """Verifies that non-salary job level queries are not falsely mapped to SALARY_COST_BY_GRADE."""

    def test_headcount_by_job_level_accessible_to_employee(self, orchestrator):
        """EMPLOYEE role can view headcount by grade (FILTER_COMPOSITION, not SALARY_COST_BY_GRADE)."""
        res = orchestrator.process("Show headcount by grade", user_role="EMPLOYEE")
        assert res.get("status") in ("SUCCESS", "success", "deterministic_answered")
        assert res.get("intent") != "ACCESS_DENIED"
        assert "E1" in res.get("answer", "")

    def test_experience_by_grade_accessible_to_employee(self, orchestrator):
        """EMPLOYEE role can view experience by grade."""
        res = orchestrator.process("Compare Infinite vs Prior experience by grade", user_role="EMPLOYEE")
        assert res.get("status") in ("SUCCESS", "success", "deterministic_answered")
        assert res.get("intent") != "ACCESS_DENIED"


class TestResultScopeInvariant:
    """Verifies MultiRequirementInvariantEngine enforces filter boundaries on returned evidence."""

    def test_result_scope_validation_passes_valid_evidence(self):
        """Evidence matching active filter passes invariant validation."""
        plan = AnalyticalParser.parse("How many employees?", base_params=capability_registry.resolve("How many employees?").parameters)
        req = plan.requirements[0]
        req.filters["state"] = "NH"
        req.evidence = [{"state": "NH", "count": 364}]
        passed, msg, _ = MultiRequirementInvariantEngine.validate(plan, sqlite_engine.conn)
        assert passed, f"Expected pass, got: {msg}"

    def test_result_scope_validation_rejects_out_of_scope_row(self):
        """Evidence containing AK row when state=NH fails result-scope invariant."""
        plan = AnalyticalParser.parse("How many employees?", base_params=capability_registry.resolve("How many employees?").parameters)
        req = plan.requirements[0]
        req.filters["state"] = "NH"
        req.evidence = [{"state": "AK", "count": 108}]
        passed, msg, _ = MultiRequirementInvariantEngine.validate(plan, sqlite_engine.conn)
        assert not passed
        assert "Scope invariant violation" in msg


class TestResponseLanguagePolish:
    """Verifies professional executive language without clumsy phrases like 'Most location cohort'."""

    def test_ranking_location_language(self, orchestrator):
        res = orchestrator.process("Which location has the most employees?")
        ans = res.get("answer", "")
        insights = " ".join(res.get("insights", []))
        assert "cohort" not in ans.lower()
        assert "most location cohort" not in insights.lower()
        assert "highest headcount" in ans.lower() or "highest" in ans.lower()
        assert "Bangalore" in ans
