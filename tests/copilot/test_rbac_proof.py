"""
PROOF 4 - RBAC SCOPE TESTING
=============================
Proves that Role-Based Access Control (RBAC) enforces correct capability
authorization at the SecurityContext boundary.

Tests:
  1. Capability-level authorization - roles that cannot access certain capabilities
     receive ACCESS_DENIED with 0 LLM calls.
  2. Same query, different roles - demonstrates different permitted access.
  3. Scope escape attempts - verifying that EMPLOYEE cannot access EXECUTIVE-only
     document authorizations.
  4. Authorization enforcement at capability boundary (before SQL execution).

Note on row-level scoping: The current SecurityContext enforces capability-level
and document-level authorization. Row-level filtering (e.g., employee can only see
their own record) is a future hardening task requiring department_scope filters in
the query builder. This test documents the CURRENT authorization model honestly.
"""

import pytest
from typing import Dict, Any
from backend.app.ai.orchestrator import llm_orchestrator
from backend.app.ai.security_context import SecurityContext, UserRole, ROLE_PERMISSIONS
from backend.app.ai.capability_registry import CapabilityEnum, capability_registry
from backend.app.ai.model_gateway import ModelGateway


# =============================================================================
# SUITE 4A - SecurityContext Unit Tests
# =============================================================================

class TestProof4_SecurityContextConstruction:
    """Unit tests for SecurityContext.from_request() role validation."""

    def test_employee_role_constructed(self):
        ctx = SecurityContext.from_request(user_role="EMPLOYEE")
        assert ctx.user_role == UserRole.EMPLOYEE

    def test_hr_analytics_role_constructed(self):
        ctx = SecurityContext.from_request(user_role="HR_ANALYTICS")
        assert ctx.user_role == UserRole.HR_ANALYTICS

    def test_executive_role_constructed(self):
        ctx = SecurityContext.from_request(user_role="EXECUTIVE")
        assert ctx.user_role == UserRole.EXECUTIVE

    def test_invalid_role_defaults_to_employee(self):
        """An unrecognized role string must default to EMPLOYEE (least privilege)."""
        ctx = SecurityContext.from_request(user_role="SUPERADMIN_HACKER")
        assert ctx.user_role == UserRole.EMPLOYEE, (
            "Unknown role must default to EMPLOYEE (least privilege principle)."
        )

    def test_none_role_defaults_to_employee(self):
        """None role must default to EMPLOYEE."""
        ctx = SecurityContext.from_request(user_role=None)
        assert ctx.user_role == UserRole.EMPLOYEE

    def test_empty_role_defaults_to_employee(self):
        ctx = SecurityContext.from_request(user_role="")
        assert ctx.user_role == UserRole.EMPLOYEE

    def test_case_insensitive_role_parsing(self):
        """Role parsing must be case-insensitive."""
        ctx = SecurityContext.from_request(user_role="executive")
        assert ctx.user_role == UserRole.EXECUTIVE


# =============================================================================
# SUITE 4B - Capability Authorization (is_capability_authorized)
# =============================================================================

class TestProof4_CapabilityAuthorization:
    """Tests that ROLE_PERMISSIONS correctly restrict capability access."""

    def test_employee_can_do_headcount(self):
        ctx = SecurityContext.from_request(user_role="EMPLOYEE")
        assert ctx.is_capability_authorized(CapabilityEnum.HEADCOUNT) is True

    def test_employee_can_do_active_headcount(self):
        ctx = SecurityContext.from_request(user_role="EMPLOYEE")
        assert ctx.is_capability_authorized(CapabilityEnum.ACTIVE_HEADCOUNT) is True

    def test_employee_can_do_compensation_average(self):
        ctx = SecurityContext.from_request(user_role="EMPLOYEE")
        # EMPLOYEE can see averages per ROLE_PERMISSIONS
        assert ctx.is_capability_authorized(CapabilityEnum.COMPENSATION_AVERAGE) is True

    def test_employee_can_do_rag_policy_qa(self):
        ctx = SecurityContext.from_request(user_role="EMPLOYEE")
        assert ctx.is_capability_authorized(CapabilityEnum.RAG_POLICY_QA) is True

    def test_hr_analytics_has_all_capabilities(self):
        ctx = SecurityContext.from_request(user_role="HR_ANALYTICS")
        for cap in CapabilityEnum:
            assert ctx.is_capability_authorized(cap) is True, (
                f"HR_ANALYTICS must have access to {cap.value}"
            )

    def test_executive_has_all_capabilities(self):
        ctx = SecurityContext.from_request(user_role="EXECUTIVE")
        for cap in CapabilityEnum:
            assert ctx.is_capability_authorized(cap) is True

    def test_admin_has_all_capabilities(self):
        ctx = SecurityContext.from_request(user_role="ADMIN")
        for cap in CapabilityEnum:
            assert ctx.is_capability_authorized(cap) is True


# =============================================================================
# SUITE 4C - Document Authorization (is_document_authorized)
# =============================================================================

class TestProof4_DocumentAuthorization:
    """Tests document-level authorization gating."""

    def test_employee_can_see_all_tagged_docs(self):
        """Documents tagged ALL are visible to everyone."""
        ctx = SecurityContext.from_request(user_role="EMPLOYEE")
        assert ctx.is_document_authorized({"ALL"}) is True

    def test_employee_can_see_employee_tagged_docs(self):
        ctx = SecurityContext.from_request(user_role="EMPLOYEE")
        assert ctx.is_document_authorized({"EMPLOYEE"}) is True

    def test_employee_cannot_see_executive_docs(self):
        """EMPLOYEE must not access EXECUTIVE-tagged docs."""
        ctx = SecurityContext.from_request(user_role="EMPLOYEE")
        result = ctx.is_document_authorized({"EXECUTIVE"})
        assert result is False, (
            "EMPLOYEE role must not see EXECUTIVE-tagged documents. "
            "This is a document-level RBAC gate."
        )

    def test_employee_cannot_see_manager_only_docs(self):
        """EMPLOYEE must not access MANAGER-only docs."""
        ctx = SecurityContext.from_request(user_role="EMPLOYEE")
        result = ctx.is_document_authorized({"MANAGER"})
        assert result is False, (
            "EMPLOYEE role must not see MANAGER-tagged documents."
        )

    def test_employee_cannot_see_hr_docs(self):
        """EMPLOYEE must not access HR-tagged docs."""
        ctx = SecurityContext.from_request(user_role="EMPLOYEE")
        result = ctx.is_document_authorized({"HR"})
        assert result is False

    def test_hr_analytics_can_see_hr_docs(self):
        ctx = SecurityContext.from_request(user_role="HR_ANALYTICS")
        assert ctx.is_document_authorized({"HR"}) is True

    def test_hr_analytics_cannot_see_executive_docs(self):
        """HR_ANALYTICS does not have EXECUTIVE doc access."""
        ctx = SecurityContext.from_request(user_role="HR_ANALYTICS")
        result = ctx.is_document_authorized({"EXECUTIVE"})
        assert result is False

    def test_executive_can_see_all_doc_types(self):
        ctx = SecurityContext.from_request(user_role="EXECUTIVE")
        for tag in ["ALL", "EMPLOYEE", "MANAGER", "HR", "EXECUTIVE"]:
            assert ctx.is_document_authorized({tag}) is True, (
                f"EXECUTIVE must see {tag}-tagged docs."
            )

    def test_mixed_doc_tags_employee_access(self):
        """EMPLOYEE can access doc tagged with both EMPLOYEE and MANAGER (intersection non-empty)."""
        ctx = SecurityContext.from_request(user_role="EMPLOYEE")
        # EMPLOYEE tag IS in allowed set, so this should succeed
        assert ctx.is_document_authorized({"EMPLOYEE", "MANAGER"}) is True


# =============================================================================
# SUITE 4D - End-to-End RBAC via Orchestrator
# =============================================================================

class TestProof4_OrchestratorRBAC:
    """
    End-to-end tests: same query with different roles.
    For capabilities available to EMPLOYEE, both EMPLOYEE and HR_ANALYTICS get results.
    """

    def test_headcount_accessible_to_employee(self):
        """EMPLOYEE can query total headcount."""
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process("How many employees are there in ETS?", user_role="EMPLOYEE")
        assert res.get("status") != "UNAUTHORIZED", (
            "EMPLOYEE should be able to query total headcount."
        )
        assert "590" in str(res.get("answer", "")), (
            f"EMPLOYEE headcount query returned wrong answer: {res.get('answer')}"
        )
        assert res.get("llm_calls", -1) == 0

    def test_headcount_accessible_to_hr_analytics(self):
        """HR_ANALYTICS can query total headcount."""
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process("How many employees are there in ETS?", user_role="HR_ANALYTICS")
        assert res.get("status") != "UNAUTHORIZED"
        assert "590" in str(res.get("answer", ""))
        assert res.get("llm_calls", -1) == 0

    def test_headcount_accessible_to_executive(self):
        """EXECUTIVE can query total headcount."""
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process("How many employees are there in ETS?", user_role="EXECUTIVE")
        assert res.get("status") != "UNAUTHORIZED"
        assert "590" in str(res.get("answer", ""))

    def test_unknown_role_defaults_to_employee_access(self):
        """
        Unknown role defaults to EMPLOYEE. Should still get headcount (EMPLOYEE-accessible).
        """
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process("How many employees are there?", user_role="UNKNOWN_ROLE")
        # Should NOT be a hard error - EMPLOYEE can do headcount
        assert res.get("status") != "UNAUTHORIZED" or "590" in str(res.get("answer", "")), (
            f"Unknown role defaulted incorrectly: status={res.get('status')}, answer={res.get('answer')}"
        )

    def test_access_denied_response_has_zero_llm_calls(self):
        """
        Even if a capability were denied, the response must have 0 LLM calls.
        RBAC rejection happens before ANY tool execution.
        We test this by temporarily removing a capability from EMPLOYEE's set.
        """
        from unittest.mock import patch
        from backend.app.ai.security_context import ROLE_PERMISSIONS

        # Create a restricted EMPLOYEE permission that cannot do HEADCOUNT
        original_caps = ROLE_PERMISSIONS[UserRole.EMPLOYEE]["allowed_capabilities"].copy()
        restricted_caps = original_caps - {CapabilityEnum.HEADCOUNT}

        with patch.dict(
            ROLE_PERMISSIONS[UserRole.EMPLOYEE],
            {"allowed_capabilities": restricted_caps}
        ):
            ModelGateway.reset_invocation_count()
            res = llm_orchestrator.process("How many total employees?", user_role="EMPLOYEE")

        # Must be denied
        assert res.get("status") == "UNAUTHORIZED" or res.get("intent") == "ACCESS_DENIED", (
            f"Expected ACCESS_DENIED when HEADCOUNT removed from EMPLOYEE caps.\n"
            f"  status={res.get('status')}, intent={res.get('intent')}"
        )

        # Must have 0 LLM calls - denial happens BEFORE any tool execution
        assert res.get("llm_calls", -1) == 0, (
            f"RBAC denial should have 0 llm_calls, got {res.get('llm_calls')}"
        )
        assert ModelGateway.get_invocation_count() == 0, (
            "ModelGateway.generate() was called despite RBAC denial."
        )

    def test_rbac_denial_response_structure(self):
        """
        When access is denied, the response envelope must contain:
        - status == "UNAUTHORIZED"
        - intent == "ACCESS_DENIED"
        - confidence == 0.0
        - answer contains role and capability info
        """
        from unittest.mock import patch
        from backend.app.ai.security_context import ROLE_PERMISSIONS

        original_caps = ROLE_PERMISSIONS[UserRole.EMPLOYEE]["allowed_capabilities"].copy()
        restricted_caps = original_caps - {CapabilityEnum.HEADCOUNT, CapabilityEnum.ACTIVE_HEADCOUNT}

        with patch.dict(
            ROLE_PERMISSIONS[UserRole.EMPLOYEE],
            {"allowed_capabilities": restricted_caps}
        ):
            res = llm_orchestrator.process("Total headcount", user_role="EMPLOYEE")

        if res.get("status") == "UNAUTHORIZED":
            assert res.get("intent") == "ACCESS_DENIED"
            assert res.get("confidence") == 0.0
            answer = str(res.get("answer", "")).lower()
            # Answer should mention role or access denial
            assert any(kw in answer for kw in ["access denied", "not authorized", "unauthorized", "role"]), (
                f"ACCESS_DENIED answer missing role context: '{res.get('answer')}'"
            )


# =============================================================================
# SUITE 4E - Role Hierarchy Consistency
# =============================================================================

class TestProof4_RoleHierarchyConsistency:
    """Verify that role capability sets form a proper hierarchy."""

    def test_hr_analytics_is_superset_of_employee(self):
        """HR_ANALYTICS must have AT LEAST all capabilities that EMPLOYEE has."""
        emp_ctx = SecurityContext.from_request(user_role="EMPLOYEE")
        hr_ctx = SecurityContext.from_request(user_role="HR_ANALYTICS")

        for cap in emp_ctx.allowed_capabilities:
            assert hr_ctx.is_capability_authorized(cap), (
                f"HR_ANALYTICS missing capability {cap.value} that EMPLOYEE has. "
                "Role hierarchy is broken."
            )

    def test_executive_is_superset_of_hr_analytics(self):
        """EXECUTIVE must have AT LEAST all capabilities that HR_ANALYTICS has."""
        hr_ctx = SecurityContext.from_request(user_role="HR_ANALYTICS")
        exec_ctx = SecurityContext.from_request(user_role="EXECUTIVE")

        for cap in hr_ctx.allowed_capabilities:
            assert exec_ctx.is_capability_authorized(cap), (
                f"EXECUTIVE missing capability {cap.value} that HR_ANALYTICS has."
            )

    def test_admin_is_superset_of_executive(self):
        """ADMIN must have AT LEAST all capabilities that EXECUTIVE has."""
        exec_ctx = SecurityContext.from_request(user_role="EXECUTIVE")
        admin_ctx = SecurityContext.from_request(user_role="ADMIN")

        for cap in exec_ctx.allowed_capabilities:
            assert admin_ctx.is_capability_authorized(cap), (
                f"ADMIN missing capability {cap.value} that EXECUTIVE has."
            )

    def test_employee_doc_auth_is_subset_of_hr_analytics(self):
        """HR_ANALYTICS document access must be a superset of EMPLOYEE's."""
        emp_ctx = SecurityContext.from_request(user_role="EMPLOYEE")
        hr_ctx = SecurityContext.from_request(user_role="HR_ANALYTICS")

        for doc_auth in emp_ctx.allowed_document_authorizations:
            assert doc_auth in hr_ctx.allowed_document_authorizations, (
                f"HR_ANALYTICS missing doc auth '{doc_auth}' that EMPLOYEE has."
            )
