import pytest
from typing import Dict, Any, List
from backend.app.ai.capability_registry import (
    CapabilityRegistry,
    CapabilityEnum,
    TypedParameters,
    PopulationEnum,
    FilterConstraint,
    FilterContext,
    ScopeModeEnum,
    detect_scope_mode,
    resolve_filter_precedence,
    merge_filter_context,
    PARTITION_FAMILIES,
)
from backend.app.ai.security_context import SecurityContext, UserRole
from backend.app.ai.compositional import (
    AnalyticalParser,
    DimensionEnum,
    RequirementTypeEnum,
    MultiRequirementQueryBuilder,
)
from backend.app.ai.orchestrator import llm_orchestrator
from backend.app.ai.query_builder import ParameterizedQueryBuilder


# ==============================================================================
# 1. RULE 3 REMOVAL & DATA INDEPENDENCE (5 TESTS)
# ==============================================================================
class TestRule3RemovalAndDataIndependence:
    """Verifies that database-dependent filter suppression is eliminated."""

    def test_r3_01_check_intersection_empty_does_not_exist(self):
        import backend.app.ai.capability_registry as cap_mod
        assert not hasattr(cap_mod, "_check_intersection_empty"), (
            "CRITICAL: _check_intersection_empty must be completely deleted."
        )

    def test_r3_02_resolve_filter_precedence_executes_without_db_calls(self):
        params = TypedParameters(raw_query="How many employees in AK?", project_state="AK")
        # Pass db_engine=None to ensure 100% data independence
        ctx = resolve_filter_precedence(params, active_filters={"location": ["Chennai"]}, db_engine=None)
        assert "location" in ctx.effective_filters
        assert ctx.effective_filters["location"] == "Chennai"
        assert len(ctx.dimension_conflicts) == 0

    def test_r3_03_no_empty_intersection_conflict_generated(self):
        params = TypedParameters(raw_query="How many employees in AK?", project_state="AK")
        ctx = resolve_filter_precedence(params, active_filters={"location": ["Chennai"]})
        conflict_types = [c.get("type") for c in ctx.dimension_conflicts]
        assert "empty_intersection_conflict" not in conflict_types
        assert len(ctx.overridden_filters) == 0

    def test_r3_04_zero_rows_returned_when_query_and_dashboard_empty_intersection(self):
        # When location=Chennai and state=AK, zero employees exist in ETS. Must return 0, not 108.
        res = llm_orchestrator.process("How many employees are in AK?", active_filters={"location": ["Chennai"]})
        assert "0 employees" in res.get("answer", "")
        sql = res.get("data", {}).get("sql", "")
        assert "state = 'AK'" in sql
        assert "location = 'Chennai'" in sql

    def test_r3_05_symmetry_of_empty_intersection_retention(self):
        # Query on Chennai with State=AK dashboard filter must also return 0 employees
        res = llm_orchestrator.process("How many employees are in Chennai?", active_filters={"state": ["AK"]})
        assert "0 employees" in res.get("answer", "")
        sql = res.get("data", {}).get("sql", "")
        assert "state = 'AK'" in sql
        assert "location = 'Chennai'" in sql


# ==============================================================================
# 2. RULE 1: SAME-DIMENSION OVERRIDES (6 TESTS)
# ==============================================================================
class TestSameDimensionOverrideGeneric:
    """Verifies that an explicit query on dimension D supersedes a dashboard filter on D generically."""

    def test_sdo_01_state_override_generic(self):
        params = TypedParameters(raw_query="How many in ND?", project_state="ND")
        ctx = resolve_filter_precedence(params, active_filters={"state": ["NH"]})
        assert "state" not in ctx.effective_filters
        assert any(c["type"] == "same_dimension_override" and c["dimension"] == "state" for c in ctx.overridden_filters)

    def test_sdo_02_project_override_generic(self):
        params = TypedParameters(raw_query="How many in project ND?", project="ND")
        ctx = resolve_filter_precedence(params, active_filters={"project": ["NH"]})
        assert "project" not in ctx.effective_filters
        assert any(c["type"] == "same_dimension_override" and c["dimension"] == "project" for c in ctx.overridden_filters)

    def test_sdo_03_location_override_generic(self):
        params = TypedParameters(raw_query="How many in Hyderabad?", physical_location="Hyderabad")
        ctx = resolve_filter_precedence(params, active_filters={"location": ["Bangalore"]})
        assert "location" not in ctx.effective_filters
        assert any(c["type"] == "same_dimension_override" and c["dimension"] == "location" for c in ctx.overridden_filters)

    def test_sdo_04_department_override_generic(self):
        params = TypedParameters(raw_query="How many in QA?", department="QA")
        ctx = resolve_filter_precedence(params, active_filters={"department": ["IT"]})
        assert "department" not in ctx.effective_filters
        assert any(c["type"] == "same_dimension_override" and c["dimension"] == "department" for c in ctx.overridden_filters)

    def test_sdo_05_job_level_override_generic(self):
        params = TypedParameters(raw_query="How many in grade E4?", job_level="E4")
        ctx = resolve_filter_precedence(params, active_filters={"job_level": ["E2"]})
        assert "job_level" not in ctx.effective_filters
        assert any(c["type"] == "same_dimension_override" and c["dimension"] == "job_level" for c in ctx.overridden_filters)

    def test_sdo_06_override_provenance_logged_in_overridden_filters(self):
        params = TypedParameters(raw_query="How many in Pune?", physical_location="Pune")
        ctx = resolve_filter_precedence(params, active_filters={"location": ["Chennai"]})
        assert len(ctx.overridden_filters) == 1
        conf = ctx.overridden_filters[0]
        assert conf["type"] == "same_dimension_override"
        assert conf["dimension"] == "location"
        assert conf["suppressed_dashboard_values"] == ["Chennai"]
        assert conf["query_values"] == ["Pune"]


# ==============================================================================
# 3. RULE 2: DOMAIN PARTITION FAMILY (4 TESTS)
# ==============================================================================
class TestDomainPartitionFamily:
    """Verifies partition family overrides (State vs Project client partition)."""

    def test_dpf_01_project_query_overrides_state_dashboard_filter(self):
        params = TypedParameters(raw_query="ND project", project="ND")
        ctx = resolve_filter_precedence(params, active_filters={"state": ["NH"]})
        assert "state" not in ctx.effective_filters
        assert any(c["type"] == "partition_family_conflict" for c in ctx.overridden_filters)

    def test_dpf_02_state_query_overrides_project_dashboard_filter(self):
        params = TypedParameters(raw_query="NH state", project_state="NH")
        ctx = resolve_filter_precedence(params, active_filters={"project": ["ND"]})
        assert "project" not in ctx.effective_filters
        assert any(c["type"] == "partition_family_conflict" for c in ctx.overridden_filters)

    def test_dpf_03_identical_partition_values_no_spurious_conflict(self):
        params = TypedParameters(raw_query="ND state", project_state="ND")
        ctx = resolve_filter_precedence(params, active_filters={"project": ["ND"]})
        # If project and state are both ND, there is no value contradiction
        assert len(ctx.dimension_conflicts) == 0

    def test_dpf_04_partition_family_metadata_trace(self):
        assert "client_partition" in PARTITION_FAMILIES
        assert PARTITION_FAMILIES["client_partition"] == {"state", "project"}


# ==============================================================================
# 4. RULE 4: CONJUNCTIVE FILTER RETENTION (6 TESTS)
# ==============================================================================
class TestConjunctiveFilterRetention:
    """Verifies that non-conflicting cross-dimension filters are preserved."""

    def test_cfr_01_location_and_state_compatible_retained(self):
        params = TypedParameters(raw_query="How many in AK?", project_state="AK")
        ctx = resolve_filter_precedence(params, active_filters={"location": ["Bangalore"]})
        assert ctx.effective_filters.get("location") == "Bangalore"
        assert len(ctx.dimension_conflicts) == 0

    def test_cfr_02_department_and_location_compatible_retained(self):
        params = TypedParameters(raw_query="How many in IT?", department="IT")
        ctx = resolve_filter_precedence(params, active_filters={"location": ["Hyderabad"]})
        assert ctx.effective_filters.get("location") == "Hyderabad"
        assert len(ctx.dimension_conflicts) == 0

    def test_cfr_03_project_and_job_level_compatible_retained(self):
        params = TypedParameters(raw_query="How many in project NH?", project="NH")
        ctx = resolve_filter_precedence(params, active_filters={"job_level": ["E3"]})
        assert ctx.effective_filters.get("job_level") == "E3"
        assert len(ctx.dimension_conflicts) == 0

    def test_cfr_04_multiple_dashboard_filters_conjunctively_retained(self):
        params = TypedParameters(raw_query="How many active employees?", population=PopulationEnum.ACTIVE)
        ctx = resolve_filter_precedence(params, active_filters={"location": ["Bangalore"], "department": ["IT"], "job_level": ["E4"]})
        assert ctx.effective_filters["location"] == "Bangalore"
        assert ctx.effective_filters["department"] == "IT"
        assert ctx.effective_filters["job_level"] == "E4"
        assert len(ctx.dimension_conflicts) == 0

    def test_cfr_05_selective_override_retains_unrelated_dashboard_filters(self):
        params = TypedParameters(raw_query="How many in QA?", department="QA")
        ctx = resolve_filter_precedence(params, active_filters={"department": ["IT"], "location": ["Pune"]})
        assert "department" not in ctx.effective_filters
        assert ctx.effective_filters.get("location") == "Pune"
        assert len(ctx.overridden_filters) == 1
        assert ctx.overridden_filters[0]["dimension"] == "department"

    def test_cfr_06_sql_where_clause_combines_all_compatible_dimensions(self):
        res = llm_orchestrator.process("How many in IT?", active_filters={"location": ["Bangalore"]})
        sql = res.get("data", {}).get("sql", "")
        assert "it" in sql.lower()
        assert "location = 'Bangalore'" in sql


# ==============================================================================
# 5. GLOBAL SCOPE ESCAPE (6 TESTS)
# ==============================================================================
class TestGlobalScopeEscape:
    """Verifies explicit linguistic escape from dashboard filters."""

    def test_gse_01_detect_company_wide(self):
        assert detect_scope_mode("What is the headcount company-wide?") == ScopeModeEnum.GLOBAL
        assert detect_scope_mode("What is the company wide headcount?") == ScopeModeEnum.GLOBAL

    def test_gse_02_detect_across_all_locations(self):
        assert detect_scope_mode("How many employees across all locations?") == ScopeModeEnum.GLOBAL

    def test_gse_03_detect_across_the_entire_organization(self):
        assert detect_scope_mode("Headcount across the entire organization") == ScopeModeEnum.GLOBAL
        assert detect_scope_mode("across entire company") == ScopeModeEnum.GLOBAL

    def test_gse_04_detect_overall_and_ignore_filters(self):
        assert detect_scope_mode("Overall headcount by grade") == ScopeModeEnum.GLOBAL
        assert detect_scope_mode("Ignore filters and tell me total employees") == ScopeModeEnum.GLOBAL

    def test_gse_05_clears_dashboard_filters_with_reason(self):
        params = TypedParameters(raw_query="What is the headcount company-wide?")
        ctx = resolve_filter_precedence(params, active_filters={"location": ["Chennai"], "project": ["NH"]}, raw_query="What is the headcount company-wide?")
        assert ctx.scope_mode == ScopeModeEnum.GLOBAL
        assert len(ctx.effective_filters) == 0
        assert len(ctx.cleared_filters) == 2
        assert all(c["type"] == "global_scope_cleared" for c in ctx.cleared_filters)

    def test_gse_06_global_scope_sql_excludes_dashboard_filters(self):
        res = llm_orchestrator.process("What is the headcount company-wide?", active_filters={"location": ["Chennai"]})
        sql = res.get("data", {}).get("sql", "")
        assert "Chennai" not in sql
        assert "590" in res.get("answer", "")


# ==============================================================================
# 6. ROW-LEVEL SECURITY AUTHORIZATION (6 TESTS)
# ==============================================================================
class TestRowLevelSecurityAuthorization:
    """Verifies that SecurityContext authorization constraints are immutable and enforced in SQL."""

    def test_rls_01_department_scope_injected_as_immutable_constraint(self):
        sec = SecurityContext.from_request(user_role="MANAGER", department="Core")
        params = TypedParameters(raw_query="How many employees?")
        ctx = resolve_filter_precedence(params, active_filters={}, security=sec)
        assert len(ctx.authorization_filters) == 1
        assert ctx.authorization_filters[0].dimension == "department"
        assert ctx.authorization_filters[0].immutable is True
        assert ctx.effective_filters.get("department") == "Core"

    def test_rls_02_global_scope_cannot_clear_authorization_constraint(self):
        sec = SecurityContext.from_request(user_role="MANAGER", department="Delivery")
        params = TypedParameters(raw_query="Total employees company-wide")
        ctx = resolve_filter_precedence(
            params,
            active_filters={"location": ["Chennai"]},
            security=sec,
            raw_query="Total employees company-wide"
        )
        assert ctx.scope_mode == ScopeModeEnum.GLOBAL
        # Ambient filter is cleared
        assert "location" not in ctx.effective_filters
        # Authorization filter is NOT cleared
        assert ctx.effective_filters.get("department") == "Delivery"

    def test_rls_03_explicit_query_department_cannot_override_authorization_constraint(self):
        sec = SecurityContext.from_request(user_role="MANAGER", department="Core")
        params = TypedParameters(raw_query="How many in IT?", department="IT")
        ctx = resolve_filter_precedence(params, active_filters={}, security=sec)
        assert ctx.effective_filters.get("department") == "Core"
        assert params.department == "Core"
        assert any(c["type"] == "authorization_override_denied" for c in ctx.dimension_conflicts)

    def test_rls_04_unauthorized_override_attempt_logged_in_resolution_trace(self):
        sec = SecurityContext.from_request(user_role="MANAGER", department="Core")
        params = TypedParameters(raw_query="How many in IT?", department="IT")
        ctx = resolve_filter_precedence(params, active_filters={}, security=sec)
        trace = ctx.resolution_trace
        assert "department" in trace.get("authorization_dimensions", [])
        assert any(c["type"] == "authorization_override_denied" for c in ctx.dimension_conflicts)

    def test_rls_05_generated_sql_where_clause_enforces_department_scope(self):
        res = llm_orchestrator.process(
            "How many employees are in Bangalore?",
            user_role="MANAGER",
            department="Core"
        )
        sql = res.get("data", {}).get("sql", "")
        assert "department" in sql.lower()
        assert "core" in sql.lower()
        assert "location = 'Bangalore'" in sql

    def test_rls_06_analytical_plan_enforces_department_scope_for_all_requirements(self):
        sec = SecurityContext.from_request(user_role="MANAGER", department="IT")
        contract = CapabilityRegistry().resolve("Workforce by state", security=sec)
        plan = AnalyticalParser.parse("Workforce by state", contract.parameters)
        for req in plan.requirements:
            assert req.filters.get("department") == "IT"
            sql = MultiRequirementQueryBuilder.build_sql_for_requirement(req)
            assert "it" in sql.lower()


# ==============================================================================
# 7. FILTER AUDITABILITY & PROVENANCE (4 TESTS)
# ==============================================================================
class TestFilterAuditabilityAndProvenance:
    """Verifies that filter resolution metadata and provenance are preserved."""

    def test_fap_01_resolution_trace_structure(self):
        params = TypedParameters(raw_query="How many in AK?", project_state="AK")
        ctx = resolve_filter_precedence(params, active_filters={"location": ["Bangalore"]})
        trace = ctx.resolution_trace
        assert "scope_mode" in trace
        assert "explicit_dimensions" in trace
        assert "dashboard_dimensions" in trace
        assert "retained_filters" in trace
        assert trace["scope_mode"].lower() == "dashboard_scoped"
        assert trace["explicit_dimensions"] == ["state"]
        assert trace["dashboard_dimensions"] == ["location"]

    def test_fap_02_filter_constraint_scope_and_immutability_flags(self):
        sec = SecurityContext.from_request(user_role="MANAGER", department="QA")
        params = TypedParameters(raw_query="How many in AK?", project_state="AK")
        ctx = resolve_filter_precedence(params, active_filters={"location": ["Pune"]}, security=sec)
        # Authorization constraint
        assert ctx.authorization_filters[0].immutable is True
        assert ctx.authorization_filters[0].source == "authorization"
        assert ctx.authorization_filters[0].scope == "immutable"
        # Dashboard constraint
        assert ctx.dashboard_filters[0].immutable is False
        assert ctx.dashboard_filters[0].source == "dashboard_filter"
        assert ctx.dashboard_filters[0].scope == "scoped"
        # Explicit query constraint
        assert ctx.explicit_query_filters[0].immutable is False
        assert ctx.explicit_query_filters[0].source == "explicit_query"

    def test_fap_03_filter_context_cleared_and_overridden_lists(self):
        params = TypedParameters(raw_query="Total headcount across all locations")
        ctx = resolve_filter_precedence(
            params,
            active_filters={"location": ["Bangalore"], "state": ["ND"]},
            raw_query="Total headcount across all locations"
        )
        assert len(ctx.cleared_filters) == 2
        assert len(ctx.overridden_filters) == 0

    def test_fap_04_end_to_end_orchestrator_preserves_filter_metadata(self):
        res = llm_orchestrator.process("How many in AK?", active_filters={"location": ["Bangalore"]})
        assert "filters" in res
        assert res["filters"].get("project_state") == "AK"
        assert res["filters"].get("physical_location") == "Bangalore"
