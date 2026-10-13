import pytest
from typing import Dict, Any, List
from backend.app.ai.capability_registry import (
    CapabilityRegistry,
    CapabilityEnum,
    TypedParameters,
    PopulationEnum,
    FilterConstraint,
    FilterContext,
    resolve_filter_precedence,
    merge_filter_context,
)
from backend.app.ai.security_context import SecurityContext, UserRole
from backend.app.ai.compositional import (
    AnalyticalParser,
    DimensionEnum,
    RequirementTypeEnum,
    OutputFormatEnum,
    extract_grouping_dimensions,
)
from backend.app.ai.orchestrator import llm_orchestrator
from backend.app.ai.db import sqlite_engine


# ==============================================================================
# 1. DEFECT-1 FILTER SEMANTICS (20 TESTS)
# ==============================================================================
class TestDefect1FilterSemantics:
    """Validates filter provenance, trace generation, and explicit vs ambient separation."""

    def setup_method(self):
        self.reg = CapabilityRegistry()

    def test_fs_01_filter_constraint_dataclass_fields(self):
        fc = FilterConstraint(dimension="state", attribute="state", values=["ND"], source="explicit_query")
        assert fc.dimension == "state"
        assert fc.attribute == "state"
        assert fc.values == ["ND"]
        assert fc.source == "explicit_query"

    def test_fs_02_filter_context_dataclass_initialization(self):
        ctx = FilterContext()
        assert ctx.dashboard_filters == []
        assert ctx.explicit_query_filters == []
        assert ctx.authorization_filters == []
        assert ctx.dimension_conflicts == []
        assert ctx.resolved_constraints == []
        assert ctx.effective_filters == {}
        assert ctx.resolution_trace == {}

    def test_fs_03_empty_active_filters_returns_clean_context(self):
        params = TypedParameters(raw_query="How many employees in ND?", project_state="ND")
        ctx = resolve_filter_precedence(params, active_filters={})
        assert ctx.dashboard_filters == []
        assert ctx.dimension_conflicts == []
        assert ctx.effective_filters == {}

    def test_fs_04_dashboard_filters_normalized_into_constraints(self):
        params = TypedParameters(raw_query="Workforce count")
        ctx = resolve_filter_precedence(params, active_filters={"project": ["NH"], "location": ["Bangalore"]})
        dims = {dfc.dimension for dfc in ctx.dashboard_filters}
        assert "project" in dims
        assert "location" in dims

    def test_fs_05_explicit_query_filters_normalized_into_constraints(self):
        params = TypedParameters(
            raw_query="Headcount in ND in Delivery",
            project_state="ND",
            department="Delivery"
        )
        ctx = resolve_filter_precedence(params, active_filters={"job_level": ["E3"]})
        dims = {qfc.dimension for qfc in ctx.explicit_query_filters}
        assert "state" in dims
        assert "department" in dims

    def test_fs_06_resolution_trace_structure(self):
        params = TypedParameters(raw_query="How many in ND?", project_state="ND")
        ctx = resolve_filter_precedence(params, active_filters={"project": ["NH"]})
        assert "explicit_dimensions" in ctx.resolution_trace
        assert "dashboard_dimensions" in ctx.resolution_trace
        assert "conflicts_detected" in ctx.resolution_trace
        assert "retained_filters" in ctx.resolution_trace

    def test_fs_07_slicer_clearing_behavior(self):
        params = TypedParameters(raw_query="Break down workforce by job level and project")
        eff = merge_filter_context(params, active_filters={})
        assert eff == {}

    def test_fs_08_case_insensitivity_in_dimension_normalization(self):
        params = TypedParameters(raw_query="Count")
        ctx = resolve_filter_precedence(params, active_filters={"Project": ["NH"], "LOCATION": ["Bangalore"]})
        dims = {dfc.dimension for dfc in ctx.dashboard_filters}
        assert "project" in dims
        assert "location" in dims

    def test_fs_09_null_and_empty_slicer_values_ignored(self):
        params = TypedParameters(raw_query="Count")
        ctx = resolve_filter_precedence(params, active_filters={"project": None, "location": "", "department": []})
        assert ctx.dashboard_filters == []
        assert ctx.effective_filters == {}

    def test_fs_10_multiple_dashboard_values_preserved_as_list(self):
        params = TypedParameters(raw_query="Count")
        ctx = resolve_filter_precedence(params, active_filters={"location": ["Bangalore", "Hyderabad"]})
        assert ctx.effective_filters.get("location") == ["Bangalore", "Hyderabad"]

    def test_fs_11_single_dashboard_value_extracted_cleanly(self):
        params = TypedParameters(raw_query="Count")
        ctx = resolve_filter_precedence(params, active_filters={"location": ["Bangalore"]})
        assert ctx.effective_filters.get("location") == "Bangalore"

    def test_fs_12_explicit_multi_values_in_query_map(self):
        params = TypedParameters(raw_query="Count", physical_locations=["Bangalore", "Hyderabad"])
        ctx = resolve_filter_precedence(params, active_filters={"department": ["Delivery"]})
        qfc = [f for f in ctx.explicit_query_filters if f.dimension == "location"][0]
        assert qfc.values == ["Bangalore", "Hyderabad"]

    def test_fs_13_partition_family_conflict_metadata(self):
        params = TypedParameters(raw_query="ND count", project_state="ND")
        ctx = resolve_filter_precedence(params, active_filters={"project": ["NH"]})
        assert len(ctx.dimension_conflicts) == 1
        conf = ctx.dimension_conflicts[0]
        assert conf["type"] == "partition_family_conflict"
        assert conf["dimension"] == "project"
        assert conf["conflicting_query_dimension"] == "state"
        assert conf["suppressed_dashboard_values"] == ["NH"]
        assert conf["query_values"] == ["ND"]

    def test_fs_14_non_conflicting_partition_values_match(self):
        params = TypedParameters(raw_query="NH count", project_state="NH")
        ctx = resolve_filter_precedence(params, active_filters={"project": ["NH"]})
        assert len(ctx.dimension_conflicts) == 0

    def test_fs_15_experience_metric_filters_coexist_with_dashboard_filters(self):
        res = self.reg.resolve(
            "What is the average total experience?",
            active_filters={"project": ["NH"]}
        )
        assert res.parameters.project == "NH"
        assert res.parameters.filter_context.effective_filters.get("project") == "NH"

    def test_fs_16_population_active_coexists_with_dashboard_filters(self):
        res = self.reg.resolve(
            "How many active employees are in Bangalore?",
            active_filters={"department": ["IT"]}
        )
        assert res.parameters.physical_location == "Bangalore"
        assert res.parameters.department == "IT"

    def test_fs_17_direction_and_limit_preserved_with_filters(self):
        res = self.reg.resolve(
            "Top 5 skills in IT",
            active_filters={"project": ["NH"]}
        )
        assert res.capability == CapabilityEnum.SKILLS_TOP_RANKING
        assert res.parameters.limit_n == 10
        assert res.parameters.direction == "DESC"

    def test_fs_18_sql_where_clause_reflects_merged_filters(self):
        res = llm_orchestrator.process(
            "How many employees are in Bangalore?",
            active_filters={"project": ["NH"]}
        )
        sql = res.get("data", {}).get("sql", "")
        assert "location = 'Bangalore'" in sql
        assert "project = 'NH'" in sql

    def test_fs_19_provenance_explicit_query_source(self):
        params = TypedParameters(raw_query="How many in AK?", project_state="AK")
        ctx = resolve_filter_precedence(params, active_filters={"department": ["Core"]})
        for f in ctx.explicit_query_filters:
            assert f.source == "explicit_query"

    def test_fs_20_provenance_dashboard_filter_source(self):
        params = TypedParameters(raw_query="How many in AK?", project_state="AK")
        ctx = resolve_filter_precedence(params, active_filters={"department": ["Core"]})
        for f in ctx.dashboard_filters:
            assert f.source == "dashboard_filter"


# ==============================================================================
# 2. EMPTY-INTERSECTION SEMANTICS (10 TESTS)
# ==============================================================================
class TestEmptyIntersectionSemantics:
    """
    Adversarial verification of empty intersection behavior:
    Distinguishes genuine multi-dimensional empty results (which must remain 0)
    from database-backed filter suppression rules.
    """

    def test_ei_01_explicit_two_dimension_zero_result_returns_zero(self):
        res = llm_orchestrator.process("How many employees are in Chennai and in AK?")
        sql = res.get("data", {}).get("sql", "")
        assert "state = 'AK'" in sql
        assert "location = 'Chennai'" in sql
        assert "0 employees" in res.get("answer", "")

    def test_ei_02_explicit_dept_and_state_zero_result_returns_zero(self):
        res = llm_orchestrator.process("How many employees are in Cognos in AK?")
        sql = res.get("data", {}).get("sql", "")
        assert "state = 'AK'" in sql
        assert "cognos" in sql.lower()
        assert "0 employees" in res.get("answer", "")

    def test_ei_03_explicit_dept_and_state_informatica_nd_returns_zero(self):
        res = llm_orchestrator.process("How many employees are in Informatica in ND?")
        sql = res.get("data", {}).get("sql", "")
        assert "state = 'ND'" in sql
        assert "informatica" in sql.lower()
        assert "0 employees" in res.get("answer", "")

    def test_ei_04_explicit_dept_and_grade_core_e10_returns_zero(self):
        res = llm_orchestrator.process("How many employees are in Core at grade E10?")
        sql = res.get("data", {}).get("sql", "")
        assert "core" in sql.lower()
        assert "job_level = 'E10'" in sql
        assert "0 employees" in res.get("answer", "")

    def test_ei_05_explicit_constraints_never_dropped_when_both_in_query(self):
        contract = CapabilityRegistry().resolve("How many employees are in Chennai on AK?")
        assert contract.parameters.physical_location == "Chennai"
        assert contract.parameters.project_state == "AK"

    def test_ei_06_data_independent_filter_retention(self):
        # Data-independent precedence: cross-dimension filters are preserved without DB queries
        params = TypedParameters(raw_query="How many employees are in AK?", project_state="AK")
        ctx = resolve_filter_precedence(params, active_filters={"location": ["Bangalore"]})
        assert "location" in ctx.effective_filters
        assert ctx.effective_filters["location"] == "Bangalore"
        assert len(ctx.dimension_conflicts) == 0

    def test_ei_07_cross_dimension_empty_intersection_preserved(self):
        # Empty intersection is preserved: AK + Chennai retains Chennai
        params = TypedParameters(raw_query="How many employees are in AK?", project_state="AK")
        ctx = resolve_filter_precedence(params, active_filters={"location": ["Chennai"]})
        assert "location" in ctx.effective_filters
        assert ctx.effective_filters["location"] == "Chennai"
        assert len(ctx.dimension_conflicts) == 0

    def test_ei_08_rule3_removed_no_empty_intersection_suppression(self):
        # Verified Rule 3 removal: no empty_intersection_conflict is generated
        params = TypedParameters(raw_query="How many employees are in AK?", project_state="AK")
        ctx = resolve_filter_precedence(params, active_filters={"location": ["Chennai"]})
        assert len(ctx.dimension_conflicts) == 0
        assert ctx.effective_filters.get("location") == "Chennai"

    def test_ei_09_empirical_characterization_ambient_filter_retained_yields_zero(self):
        # With Rule 3 removed, Chennai ambient filter is retained, yielding 0 employees
        res_chennai = llm_orchestrator.process("How many employees are in AK?", active_filters={"location": ["Chennai"]})
        assert "0 employees" in res_chennai.get("answer", "")
        # Bangalore has 81 employees in AK
        res_blr = llm_orchestrator.process("How many employees are in AK?", active_filters={"location": ["Bangalore"]})
        assert "81 employees" in res_blr.get("answer", "")

    def test_ei_10_explicit_multi_dimensional_query_immune_to_rule3(self):
        contract = CapabilityRegistry().resolve("How many employees are in Chennai in AK?")
        assert len(contract.parameters.filter_context.dimension_conflicts) == 0


# ==============================================================================
# 3. SAME-DIMENSION OVERRIDE (10 TESTS)
# ==============================================================================
class TestSameDimensionOverride:
    """Verifies that an explicit query on dimension D supersedes a dashboard filter on D generically."""

    def test_sdo_01_state_override_nh_with_nd(self):
        params = TypedParameters(raw_query="ND count", project_state="ND")
        ctx = resolve_filter_precedence(params, active_filters={"state": ["NH"]})
        assert "state" not in ctx.effective_filters
        assert ctx.dimension_conflicts[0]["type"] == "same_dimension_override"
        assert ctx.dimension_conflicts[0]["query_values"] == ["ND"]

    def test_sdo_02_state_override_symmetry_nd_with_nh(self):
        params = TypedParameters(raw_query="NH count", project_state="NH")
        ctx = resolve_filter_precedence(params, active_filters={"state": ["ND"]})
        assert "state" not in ctx.effective_filters
        assert ctx.dimension_conflicts[0]["type"] == "same_dimension_override"
        assert ctx.dimension_conflicts[0]["query_values"] == ["NH"]

    def test_sdo_03_state_override_ak_with_nd(self):
        params = TypedParameters(raw_query="ND count", project_state="ND")
        ctx = resolve_filter_precedence(params, active_filters={"state": ["AK"]})
        assert "state" not in ctx.effective_filters
        assert ctx.dimension_conflicts[0]["type"] == "same_dimension_override"

    def test_sdo_04_location_override_bangalore_with_hyderabad(self):
        params = TypedParameters(raw_query="Hyderabad count", physical_location="Hyderabad")
        ctx = resolve_filter_precedence(params, active_filters={"location": ["Bangalore"]})
        assert "location" not in ctx.effective_filters
        assert ctx.dimension_conflicts[0]["type"] == "same_dimension_override"
        assert ctx.dimension_conflicts[0]["query_values"] == ["Hyderabad"]

    def test_sdo_05_location_override_symmetry_hyderabad_with_bangalore(self):
        params = TypedParameters(raw_query="Bangalore count", physical_location="Bangalore")
        ctx = resolve_filter_precedence(params, active_filters={"location": ["Hyderabad"]})
        assert "location" not in ctx.effective_filters
        assert ctx.dimension_conflicts[0]["type"] == "same_dimension_override"
        assert ctx.dimension_conflicts[0]["query_values"] == ["Bangalore"]

    def test_sdo_06_department_override_delivery_with_cognos(self):
        params = TypedParameters(raw_query="Cognos count", department="Cognos")
        ctx = resolve_filter_precedence(params, active_filters={"department": ["Delivery"]})
        assert "department" not in ctx.effective_filters
        assert ctx.dimension_conflicts[0]["type"] == "same_dimension_override"

    def test_sdo_07_department_override_symmetry_cognos_with_delivery(self):
        params = TypedParameters(raw_query="Delivery count", department="Delivery")
        ctx = resolve_filter_precedence(params, active_filters={"department": ["Cognos"]})
        assert "department" not in ctx.effective_filters
        assert ctx.dimension_conflicts[0]["type"] == "same_dimension_override"

    def test_sdo_08_job_level_override_e3_with_e5(self):
        params = TypedParameters(raw_query="E5 count", job_level="E5")
        ctx = resolve_filter_precedence(params, active_filters={"job_level": ["E3"]})
        assert "job_level" not in ctx.effective_filters
        assert ctx.dimension_conflicts[0]["type"] == "same_dimension_override"

    def test_sdo_09_project_override_nh_with_nd(self):
        params = TypedParameters(raw_query="ND project count", project="ND")
        ctx = resolve_filter_precedence(params, active_filters={"project": ["NH"]})
        assert "project" not in ctx.effective_filters
        assert ctx.dimension_conflicts[0]["type"] == "same_dimension_override"

    def test_sdo_10_same_dimension_conflict_metadata_detail(self):
        params = TypedParameters(raw_query="E7 count", job_level="E7")
        ctx = resolve_filter_precedence(params, active_filters={"job_level": ["E1"]})
        conflict = ctx.dimension_conflicts[0]
        assert conflict["dimension"] == "job_level"
        assert conflict["suppressed_dashboard_values"] == ["E1"]
        assert conflict["query_values"] == ["E7"]
        assert "supersedes dashboard filter" in conflict["reason"]


# ==============================================================================
# 4. CROSS-DIMENSION COMPATIBLE FILTERS (10 TESTS)
# ==============================================================================
class TestCrossDimensionCompatibleFilters:
    """Verifies that non-conflicting, compatible cross-dimension filters are preserved."""

    def test_cd_01_project_nh_and_location_bangalore(self):
        params = TypedParameters(raw_query="Bangalore count", physical_location="Bangalore")
        ctx = resolve_filter_precedence(params, active_filters={"project": ["NH"]})
        assert ctx.effective_filters.get("project") == "NH"
        assert len(ctx.dimension_conflicts) == 0

    def test_cd_02_project_nh_and_location_hyderabad(self):
        params = TypedParameters(raw_query="Hyderabad count", physical_location="Hyderabad")
        ctx = resolve_filter_precedence(params, active_filters={"project": ["NH"]})
        assert ctx.effective_filters.get("project") == "NH"
        assert len(ctx.dimension_conflicts) == 0

    def test_cd_03_project_nd_and_location_bangalore(self):
        params = TypedParameters(raw_query="Bangalore count", physical_location="Bangalore")
        ctx = resolve_filter_precedence(params, active_filters={"project": ["ND"]})
        assert ctx.effective_filters.get("project") == "ND"
        assert len(ctx.dimension_conflicts) == 0

    def test_cd_04_department_it_and_location_bangalore(self):
        params = TypedParameters(raw_query="Bangalore count", physical_location="Bangalore")
        ctx = resolve_filter_precedence(params, active_filters={"department": ["IT"]})
        assert ctx.effective_filters.get("department") == "IT"
        assert len(ctx.dimension_conflicts) == 0

    def test_cd_05_department_core_and_job_level_e3(self):
        params = TypedParameters(raw_query="E3 count", job_level="E3")
        ctx = resolve_filter_precedence(params, active_filters={"department": ["Core"]})
        assert ctx.effective_filters.get("department") == "Core"
        assert len(ctx.dimension_conflicts) == 0

    def test_cd_06_location_bangalore_and_job_level_e1(self):
        params = TypedParameters(raw_query="E1 count", job_level="E1")
        ctx = resolve_filter_precedence(params, active_filters={"location": ["Bangalore"]})
        assert ctx.effective_filters.get("location") == "Bangalore"
        assert len(ctx.dimension_conflicts) == 0

    def test_cd_07_state_ak_and_job_level_e2(self):
        params = TypedParameters(raw_query="E2 count", job_level="E2")
        ctx = resolve_filter_precedence(params, active_filters={"state": ["AK"]})
        assert ctx.effective_filters.get("state") == "AK"
        assert len(ctx.dimension_conflicts) == 0

    def test_cd_08_project_nh_and_job_level_e3(self):
        params = TypedParameters(raw_query="E3 count", job_level="E3")
        ctx = resolve_filter_precedence(params, active_filters={"project": ["NH"]})
        assert ctx.effective_filters.get("project") == "NH"
        assert len(ctx.dimension_conflicts) == 0

    def test_cd_09_location_hyderabad_and_department_it(self):
        params = TypedParameters(raw_query="IT count", department="IT")
        ctx = resolve_filter_precedence(params, active_filters={"location": ["Hyderabad"]})
        assert ctx.effective_filters.get("location") == "Hyderabad"
        assert len(ctx.dimension_conflicts) == 0

    def test_cd_10_compatible_cross_dimension_sql_execution(self):
        res = llm_orchestrator.process(
            "How many employees are in Bangalore?",
            active_filters={"project": ["NH"]}
        )
        assert res.get("status") == "SUCCESS"
        assert ("226 employees" in res.get("answer", "")) or ("223 employees" in res.get("answer", ""))


# ==============================================================================
# 5. AUTHORIZATION CONSTRAINTS (5 TESTS)
# ==============================================================================
class TestAuthorizationConstraints:
    """Verifies that security context and RBAC constraints are non-bypassable."""

    def test_auth_01_employee_role_denied_salary_cost_by_grade(self):
        sec = SecurityContext.from_request(user_role="EMPLOYEE")
        assert not sec.is_capability_authorized(CapabilityEnum.SALARY_COST_BY_GRADE)

    def test_auth_02_orchestrator_blocks_unauthorized_capability(self):
        res = llm_orchestrator.process(
            "Show salary cost by grade",
            user_role="EMPLOYEE"
        )
        assert res.get("status") == "UNAUTHORIZED"
        assert "Access denied" in res.get("answer", "")

    def test_auth_03_dashboard_filter_cannot_bypass_authorization(self):
        res = llm_orchestrator.process(
            "Show salary cost by grade",
            user_role="EMPLOYEE",
            active_filters={"project": ["NH"]}
        )
        assert res.get("status") == "UNAUTHORIZED"

    def test_auth_04_explicit_filter_cannot_bypass_authorization(self):
        res = llm_orchestrator.process(
            "Show salary cost by grade for Bangalore",
            user_role="EMPLOYEE"
        )
        assert res.get("status") == "UNAUTHORIZED"

    def test_auth_05_executive_role_permitted_salary_capability(self):
        sec = SecurityContext.from_request(user_role="EXECUTIVE")
        assert sec.is_capability_authorized(CapabilityEnum.SALARY_COST_BY_GRADE)


# ==============================================================================
# 6. MULTIPLE DASHBOARD FILTERS (5 TESTS)
# ==============================================================================
class TestMultipleDashboardFilters:
    """Verifies selective override across multiple concurrent ambient slicers."""

    def test_mdf_01_three_filters_all_retained_when_unrelated(self):
        params = TypedParameters(raw_query="E3 count", job_level="E3")
        active = {"project": ["NH"], "location": ["Bangalore"], "department": ["IT"]}
        ctx = resolve_filter_precedence(params, active_filters=active)
        assert ctx.effective_filters.get("project") == "NH"
        assert ctx.effective_filters.get("location") == "Bangalore"
        assert ctx.effective_filters.get("department") == "IT"

    def test_mdf_02_selective_override_only_overrides_targeted_dimension(self):
        params = TypedParameters(raw_query="Hyderabad count", physical_location="Hyderabad")
        active = {"project": ["NH"], "location": ["Bangalore"], "department": ["IT"]}
        ctx = resolve_filter_precedence(params, active_filters=active)
        assert "location" not in ctx.effective_filters
        assert ctx.effective_filters.get("project") == "NH"
        assert ctx.effective_filters.get("department") == "IT"

    def test_mdf_03_selective_override_department_retains_others(self):
        params = TypedParameters(raw_query="Core count", department="Core")
        active = {"project": ["NH"], "location": ["Bangalore"], "department": ["IT"]}
        ctx = resolve_filter_precedence(params, active_filters=active)
        assert "department" not in ctx.effective_filters
        assert ctx.effective_filters.get("project") == "NH"
        assert ctx.effective_filters.get("location") == "Bangalore"

    def test_mdf_04_partial_conflict_retains_non_conflicting_dimensions(self):
        params = TypedParameters(raw_query="ND count", project_state="ND")
        active = {"project": ["NH"], "location": ["Bangalore"]}
        ctx = resolve_filter_precedence(params, active_filters=active)
        assert "project" not in ctx.effective_filters
        assert ctx.effective_filters.get("location") == "Bangalore"

    def test_mdf_05_resolution_trace_counts_match_decisions(self):
        params = TypedParameters(raw_query="Hyderabad count", physical_location="Hyderabad")
        active = {"project": ["NH"], "location": ["Bangalore"], "department": ["IT"]}
        ctx = resolve_filter_precedence(params, active_filters=active)
        trace = ctx.resolution_trace
        assert trace["conflicts_detected"] == 1
        assert set(trace["retained_filters"]) == {"project", "department"}


# ==============================================================================
# 7. DEFECT-2 REGRESSION (5 TESTS)
# ==============================================================================
class TestDefect2Regression:
    """Verifies generic semantic grouping dimension extraction without phrase hardcoding."""

    def test_d2r_01_across_grades_extracts_job_level(self):
        dims = extract_grouping_dimensions("Compare experience across grades")
        assert DimensionEnum.JOB_LEVEL in dims

    def test_d2r_02_by_location_extracts_location(self):
        dims = extract_grouping_dimensions("Break down workforce by location")
        assert DimensionEnum.LOCATION in dims

    def test_d2r_03_department_wise_suffix_extracts_department(self):
        dims = extract_grouping_dimensions("Show employee count department-wise")
        assert DimensionEnum.DEPARTMENT in dims

    def test_d2r_04_for_each_project_extracts_project(self):
        dims = extract_grouping_dimensions("Count employees for each project")
        assert DimensionEnum.PROJECT in dims

    def test_d2r_05_experience_comparison_plan_creates_table_mode(self):
        plan = AnalyticalParser.create_comparison_plan(
            dimension=DimensionEnum.JOB_LEVEL,
            entities=["E1", "E2", "E3"],
            raw_q="Experience across grades"
        )
        assert plan.requirements[0].output_format == OutputFormatEnum.COMPARISON


# ==============================================================================
# 8. DEFECT-3 REGRESSION (5 TESTS)
# ==============================================================================
class TestDefect3Regression:
    """Verifies conversational entity context isolation without blind history bleed."""

    def setup_method(self):
        self.reg = CapabilityRegistry()

    def test_d3r_01_state_to_location_switch_zero_state_bleed(self):
        history = [
            {"role": "user", "content": "Compare NH and ND headcount"},
            {"role": "assistant", "content": "NH has 364 vs ND 118."}
        ]
        res = self.reg.resolve("Compare Bangalore and Hyderabad headcount", history=history)
        assert res.parameters.project_states == []
        assert set(res.parameters.physical_locations) == {"Bangalore", "Hyderabad"}

    def test_d3r_02_location_to_department_switch_zero_location_bleed(self):
        history = [
            {"role": "user", "content": "Compare Bangalore and Hyderabad headcount"},
            {"role": "assistant", "content": "Bangalore has 396 vs Hyderabad 171."}
        ]
        res = self.reg.resolve("Compare Delivery and Core headcount", history=history)
        assert res.parameters.physical_locations == []

    def test_d3r_03_comparison_to_scalar_headcount_resets_entities(self):
        history = [
            {"role": "user", "content": "Compare NH and ND headcount"},
            {"role": "assistant", "content": "NH has 364 vs ND 118."}
        ]
        res = self.reg.resolve("How many total employees are there?", history=history)
        assert res.parameters.project_states == []

    def test_d3r_04_elliptical_followup_preserves_dimension(self):
        history = [
            {"role": "user", "content": "How many employees are in Bangalore?"},
            {"role": "assistant", "content": "There are 396 employees in Bangalore."}
        ]
        res = self.reg.resolve("What about Hyderabad?", history=history)
        assert res.parameters.physical_location == "Hyderabad"

    def test_d3r_05_current_turn_multi_entities_bypasses_history_scan(self):
        history = [
            {"role": "user", "content": "NH and ND state headcount"},
            {"role": "assistant", "content": "NH 364, ND 118"}
        ]
        res = self.reg.resolve("Compare Bangalore and Pune headcount", history=history)
        assert res.parameters.project_states == []
        assert "Bangalore" in res.parameters.physical_locations
        assert "Pune" in res.parameters.physical_locations
