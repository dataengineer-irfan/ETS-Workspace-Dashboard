import pytest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../backend")))

from backend.app.ai.orchestrator import LLMOrchestrator
from backend.app.ai.capability_registry import (
    capability_registry,
    CapabilityEnum,
    TypedParameters,
    resolve_filter_precedence,
    merge_filter_context,
)
from backend.app.ai.compositional import (
    AnalyticalParser,
    extract_grouping_dimensions,
    MetricEnum,
    DimensionEnum,
    RequirementTypeEnum,
)
from backend.app.ai.db import sqlite_engine


@pytest.fixture(scope="module")
def orchestrator():
    return LLMOrchestrator()


# =====================================================================
# DEFECT 1: CROSS-DIMENSION FILTER PRECEDENCE TESTS (10 TESTS)
# =====================================================================

class TestDefect1CrossDimensionFilterPrecedence:
    """10 Tests verifying generic precedence, conflict resolution, and compatibility."""

    def test_d1_01_explicit_query_override_project_nh_nd_query(self, orchestrator):
        """Active filter Project=NH with explicit question 'How many employees are in ND?' returns 118 (not 0)."""
        res = orchestrator.process("How many employees are in ND?", active_filters={"project": "NH"})
        assert res.get("status") in ("SUCCESS", "success", "deterministic_answered")
        assert "118" in res.get("answer", "")
        assert "0 employees" not in res.get("answer", "")
        items = res.get("result_items", [])
        assert len(items) >= 1
        assert items[0].get("metric_card_spec", {}).get("value") == "118"

    def test_d1_02_compatible_cross_dimension_filter_retained(self, orchestrator):
        """Active filter Project=NH with compatible explicit location query preserves filter (Bangalore + NH = 226)."""
        res = orchestrator.process("How many employees in Bangalore?", active_filters={"project": "NH"})
        assert res.get("status") in ("SUCCESS", "success", "deterministic_answered")
        ans = res.get("answer", "")
        assert any(val in ans for val in ["223", "226"])

    def test_d1_03_active_filter_persistence_on_dimension_breakdown(self, orchestrator):
        """Active filter Project=NH persists for open-ended grouping queries like 'Show workforce by job level'."""
        res = orchestrator.process("Show workforce by job level", active_filters={"project": "NH"})
        assert res.get("status") in ("SUCCESS", "success", "deterministic_answered")
        items = res.get("result_items", [])
        assert len(items) >= 1
        rows = items[0].get("chart_spec", {}).get("data") or items[0].get("table_spec", {}).get("rows", [])
        assert len(rows) > 0
        total_in_nh = sum(r.get("value") or r.get("count") or 0 for r in rows)
        assert total_in_nh in (358, 364)

    def test_d1_04_same_dimension_override_location(self, orchestrator):
        """Active filter Location=Bangalore overridden by explicit query Location=Hyderabad."""
        res = orchestrator.process("How many employees in Hyderabad?", active_filters={"location": "Bangalore"})
        assert res.get("status") in ("SUCCESS", "success", "deterministic_answered")
        assert "171" in res.get("answer", "")

    def test_d1_05_different_value_partition_conflict_state_vs_project(self):
        """Partition conflict: query state=ND vs dashboard project=NH correctly suppresses project=NH."""
        p = TypedParameters(raw_query="How many employees in ND?", project_state="ND")
        ctx = resolve_filter_precedence(params=p, active_filters={"project": "NH"})
        assert "project" not in ctx.effective_filters
        assert len(ctx.dimension_conflicts) >= 1
        assert ctx.dimension_conflicts[0]["type"] in ("partition_family_conflict", "empty_intersection_conflict")

    def test_d1_06_multiple_active_filters_with_partial_conflict(self, orchestrator):
        """Cross-dimension retention: department=Cognos and project=AK. Cognos has 0 employees in AK. Remediated Rule 3 retains AK, yielding 0."""
        res = orchestrator.process("How many employees in Cognos?", active_filters={"project": "AK"})
        assert res.get("status") in ("SUCCESS", "success", "deterministic_answered")
        assert "0 employees" in res.get("answer", "")

    def test_d1_07_multiple_active_filters_with_compatible_department(self, orchestrator):
        """Multiple active filters: department=IT and project=NH. IT in NH exists (267 employees). Filter retained."""
        res = orchestrator.process("How many employees in IT?", active_filters={"project": "NH"})
        assert res.get("status") in ("SUCCESS", "success", "deterministic_answered")
        ans = res.get("answer", "")
        assert any(val in ans for val in ["267", "272"])

    def test_d1_08_comparison_query_overrides_conflicting_dashboard_filter(self, orchestrator):
        """Comparison query 'Compare NH and ND headcount' with active filter project=NH preserves ND."""
        res = orchestrator.process("Compare NH and ND headcount", active_filters={"project": "NH"})
        assert res.get("status") in ("SUCCESS", "success", "deterministic_answered")
        ans = res.get("answer", "")
        assert "364" in ans
        assert "118" in ans

    def test_d1_09_active_filter_job_level_propagation(self, orchestrator):
        """Active filter job_level=E3 with query 'How many employees in NH?' retains both."""
        res = orchestrator.process("How many employees in NH?", active_filters={"job_level": "E3"})
        assert res.get("status") in ("SUCCESS", "success", "deterministic_answered")
        assert "91" in res.get("answer", "")

    def test_d1_10_resolve_filter_precedence_trace_contract(self):
        """FilterContext contract populates resolution_trace and conflict metadata."""
        p = TypedParameters(raw_query="How many employees in ND?", project_state="ND")
        ctx = resolve_filter_precedence(params=p, active_filters={"project": "NH", "location": "Bangalore"})
        assert "resolution_trace" in ctx.__dict__
        assert ctx.resolution_trace["conflicts_detected"] >= 1
        assert "location" in ctx.effective_filters


# =====================================================================
# DEFECT 2: GENERIC GROUPING DIMENSION EXTRACTION TESTS (10 TESTS)
# =====================================================================

class TestDefect2GenericGroupingDimensionExtraction:
    """10 Tests verifying relational pattern extraction without keyword hacks."""

    def test_d2_01_across_grades_phrase(self, orchestrator):
        """'How does Infinite experience compare with Prior experience across grades?' binds JOB_LEVEL -> 10-row TABLE."""
        res = orchestrator.process("How does Infinite experience compare with Prior experience across grades?")
        assert res.get("status") in ("SUCCESS", "success", "deterministic_answered")
        items = res.get("result_items", [])
        assert len(items) == 1
        table = items[0]
        assert table.get("presentation_mode") == "TABLE"
        spec = table.get("table_spec", {})
        assert "job_level" in spec.get("columns", [])
        assert len(spec.get("rows", [])) == 10
        assert spec.get("rows", [])[0]["job_level"] == "E1"
        assert spec.get("rows", [])[-1]["job_level"] == "E10"

    def test_d2_02_by_grade_phrase(self):
        """'by grade' extracts DimensionEnum.JOB_LEVEL."""
        dims = extract_grouping_dimensions("compare infinite vs prior experience by grade")
        assert DimensionEnum.JOB_LEVEL in dims

    def test_d2_03_over_grades_phrase(self):
        """'over grades' extracts DimensionEnum.JOB_LEVEL."""
        dims = extract_grouping_dimensions("compare infinite and prior experience over grades")
        assert DimensionEnum.JOB_LEVEL in dims

    def test_d2_04_for_each_grade_phrase(self):
        """'for each grade' extracts DimensionEnum.JOB_LEVEL."""
        dims = extract_grouping_dimensions("show infinite vs prior experience for each grade")
        assert DimensionEnum.JOB_LEVEL in dims

    def test_d2_05_grade_wise_suffix(self):
        """'grade-wise' extracts DimensionEnum.JOB_LEVEL."""
        dims = extract_grouping_dimensions("compare experience grade-wise")
        assert DimensionEnum.JOB_LEVEL in dims

    def test_d2_06_grouped_by_grade_phrase(self):
        """'grouped by grade' extracts DimensionEnum.JOB_LEVEL."""
        dims = extract_grouping_dimensions("experience comparison grouped by grade")
        assert DimensionEnum.JOB_LEVEL in dims

    def test_d2_07_broken_down_by_grade_phrase(self):
        """'broken down by grade' extracts DimensionEnum.JOB_LEVEL."""
        dims = extract_grouping_dimensions("infinite vs prior experience broken down by grade")
        assert DimensionEnum.JOB_LEVEL in dims

    def test_d2_08_over_grade_levels_phrase(self):
        """'over grade levels' extracts DimensionEnum.JOB_LEVEL."""
        dims = extract_grouping_dimensions("experience distribution over grade levels")
        assert DimensionEnum.JOB_LEVEL in dims

    def test_d2_09_for_every_grade_phrase(self):
        """'for every grade' extracts DimensionEnum.JOB_LEVEL."""
        dims = extract_grouping_dimensions("compare infinite and prior experience for every grade")
        assert DimensionEnum.JOB_LEVEL in dims

    def test_d2_10_adversarial_negative_test_no_dimension(self, orchestrator):
        """Adversarial Negative: 'How does Infinite experience compare with Prior experience?' has NO dimension -> 1-row METRIC_CARD."""
        res = orchestrator.process("How does Infinite experience compare with Prior experience?")
        assert res.get("status") in ("SUCCESS", "success", "deterministic_answered")
        items = res.get("result_items", [])
        assert len(items) == 1
        card = items[0]
        assert card.get("presentation_mode") == "METRIC_CARD"
        assert card.get("table_spec") is None


# =====================================================================
# DEFECT 3: MULTI-TURN CONTEXT ISOLATION & FOLLOW-UP TESTS (10 TESTS)
# =====================================================================

class TestDefect3MultiTurnContextIsolation:
    """10 Tests verifying zero entity leak, proper elliptical resolution, and clean reset."""

    def test_d3_01_independent_query_zero_entity_leak(self, orchestrator):
        """Turn 1: Compare NH and ND -> Turn 2: Compare Bangalore and Hyderabad -> Location comparison (Bangalore 396 vs Hyderabad 171)."""
        hist = [{"question": "Compare NH and ND headcount", "answer": "NH has more employees (364) compared to ND (118)."}]
        res = orchestrator.process("Compare Bangalore and Hyderabad headcount", history=hist)
        assert res.get("status") in ("SUCCESS", "success", "deterministic_answered")
        ans = res.get("answer", "")
        assert "Bangalore" in ans
        assert "Hyderabad" in ans
        assert "396" in ans
        assert "171" in ans
        assert "364" not in ans
        assert "118" not in ans

    def test_d3_02_anaphoric_followup_which_one_has_more(self, orchestrator):
        """Turn 1: Compare Bangalore and Hyderabad -> Turn 2: 'Which one has more?' -> Resolves to Bangalore vs Hyderabad."""
        hist = [{"question": "Compare Bangalore and Hyderabad headcount", "answer": "Bangalore has more employees (396) compared to Hyderabad (171), a difference of 225."}]
        res = orchestrator.process("Which one has more?", history=hist)
        assert res.get("status") in ("SUCCESS", "success", "deterministic_answered")
        ans = res.get("answer", "")
        assert "Bangalore" in ans
        assert "Hyderabad" in ans

    def test_d3_03_difference_followup_by_how_much(self, orchestrator):
        """Turn 1: Compare Bangalore and Hyderabad -> Turn 2: 'What is the difference?' -> Sub-mode difference."""
        hist = [{"question": "Compare Bangalore and Hyderabad headcount", "answer": "Bangalore has more employees (396) compared to Hyderabad (171), a difference of 225."}]
        res = orchestrator.process("What is the difference?", history=hist)
        assert res.get("status") in ("SUCCESS", "success", "deterministic_answered")
        ans = res.get("answer", "")
        assert "225" in ans or "difference" in ans.lower()

    def test_d3_04_elliptical_replacement_location(self, orchestrator):
        """Turn 1: Compare Bangalore and Hyderabad -> Turn 2: 'What about Chennai?' -> Pairs Bangalore with Chennai."""
        hist = [{"question": "Compare Bangalore and Hyderabad headcount", "answer": "Bangalore has more employees (396) compared to Hyderabad (171), a difference of 225."}]
        res = orchestrator.process("What about Chennai?", history=hist)
        assert res.get("status") in ("SUCCESS", "success", "deterministic_answered")
        ans = res.get("answer", "")
        assert "Chennai" in ans

    def test_d3_05_continuation_single_to_comparison(self, orchestrator):
        """Turn 1: 'Show NH headcount' -> Turn 2: 'Now compare it with ND' -> State comparison between NH and ND."""
        hist = [{"question": "Show NH headcount", "answer": "There are 364 employees in NH."}]
        res = orchestrator.process("Now compare it with ND", history=hist)
        assert res.get("status") in ("SUCCESS", "success", "deterministic_answered")
        ans = res.get("answer", "")
        assert "NH" in ans
        assert "ND" in ans

    def test_d3_06_unrelated_query_resets_context(self, orchestrator):
        """Turn 1: Compare NH and ND headcount -> Turn 2: 'What is the average salary in IT?' -> IT salary without state filter."""
        hist = [{"question": "Compare NH and ND headcount", "answer": "NH has 364 and ND has 118."}]
        res = orchestrator.process("What is the average salary in IT?", history=hist)
        assert res.get("status") in ("SUCCESS", "success", "deterministic_answered")
        assert "IT" in res.get("answer", "")

    def test_d3_07_three_turn_sequence_isolation(self, orchestrator):
        """Three-turn sequence: Turn 1 (State comp) -> Turn 2 (Anaphoric state) -> Turn 3 (Location comp)."""
        hist = [
            {"question": "Compare NH and ND headcount", "answer": "NH (364) vs ND (118)."},
            {"question": "Which one has more?", "answer": "NH has more employees."}
        ]
        res = orchestrator.process("Compare Bangalore and Hyderabad headcount", history=hist)
        assert res.get("status") in ("SUCCESS", "success", "deterministic_answered")
        ans = res.get("answer", "")
        assert "Bangalore" in ans
        assert "Hyderabad" in ans
        assert "364" not in ans

    def test_d3_08_cross_dimension_independence(self, orchestrator):
        """Turn 1: Compare NH and ND -> Turn 2: Compare E2 and E3 -> Grade comparison without state leak."""
        hist = [{"question": "Compare NH and ND headcount", "answer": "NH (364) vs ND (118)."}]
        res = orchestrator.process("Compare E2 and E3 headcount", history=hist)
        assert res.get("status") in ("SUCCESS", "success", "deterministic_answered")
        ans = res.get("answer", "")
        assert "E2" in ans or "E3" in ans

    def test_d3_09_dashboard_filter_plus_multi_turn_isolation(self, orchestrator):
        """Active filter Project=NH, Turn 1: 'Show workforce by job level', Turn 2: 'Compare Bangalore and Hyderabad headcount'."""
        hist = [{"question": "Show workforce by job level", "answer": "Workforce by job level in NH..."}]
        res = orchestrator.process("Compare Bangalore and Hyderabad headcount", history=hist, active_filters={"project": "NH"})
        assert res.get("status") in ("SUCCESS", "success", "deterministic_answered")
        ans = res.get("answer", "")
        assert "Bangalore" in ans
        assert "Hyderabad" in ans

    def test_d3_10_empty_history_handles_comparison(self, orchestrator):
        """Single standalone query without history compares cleanly."""
        res = orchestrator.process("Compare Bangalore and Hyderabad headcount")
        assert res.get("status") in ("SUCCESS", "success", "deterministic_answered")
        ans = res.get("answer", "")
        assert "Bangalore" in ans
        assert "Hyderabad" in ans
        assert "225" in ans
