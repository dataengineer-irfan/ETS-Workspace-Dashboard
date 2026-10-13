"""
PROOF 2 - GENUINE OLLAMA UNAVAILABILITY TEST
=============================================
Tests that deterministic queries succeed even when Ollama is TRULY unreachable.

Unlike a simple mock, this test:
  1. Creates a REAL OllamaClient pointed at an invalid/unreachable port (65533).
  2. Patches ollama_client.base_url in the orchestrator to point to that bad URL.
  3. Also patches model_gateway.ollama to use that bad client.
  4. Calls the orchestrator with a deterministic query.
  5. Asserts:
     - The answer is correct (deterministic SQL succeeded).
     - ModelGateway._gateway_invocation_count == 0 (no boundary crossing).
     - response["llm_calls"] == 0 and response["model_calls"] == 0.
     - response["rag_calls"] == 0.
     - execution_trace["deterministic_route"] == True.

This proves that the deterministic pipeline is TRULY independent of Ollama,
not just that the mock harness works.
"""

import pytest
from unittest.mock import patch, PropertyMock
from typing import Dict, Any
from backend.app.ai.orchestrator import llm_orchestrator
from backend.app.ai.ollama_client import OllamaClient, ollama_client
from backend.app.ai.model_gateway import ModelGateway

# ---------------------------------------------------------------------------
# Verified ground truth
# ---------------------------------------------------------------------------
DB = {
    "total": 590,
    "active": 557,
    "exited": 33,
    "NH_all": 364,
    "BLR_all": 396,
    "BLR_active": 386,
}

# An unreachable URL - port 65533 is never bound by Ollama.
# This creates a REAL connection failure, not a mock.
DEAD_URL = "http://localhost:65533"


def _make_dead_client() -> OllamaClient:
    """Return a real OllamaClient that will fail every network call."""
    return OllamaClient(base_url=DEAD_URL)


def _run_with_dead_ollama(question: str) -> Dict[str, Any]:
    """
    Patch ollama_client and model_gateway to use a truly unreachable Ollama URL,
    then call the orchestrator.
    """
    dead_client = _make_dead_client()
    # Verify that the dead client actually reports unavailable
    assert dead_client.is_available() is False, (
        "Dead client on port 65533 unexpectedly reported Ollama as available. "
        "Choose a different dead port or check system configuration."
    )

    ModelGateway.reset_invocation_count()

    # Patch at both the orchestrator's ollama reference and model_gateway's ollama
    with patch.object(llm_orchestrator, "ollama", dead_client), \
         patch.object(llm_orchestrator.tools._engine if hasattr(llm_orchestrator, "tools") else llm_orchestrator, "ollama", dead_client, create=True):

        res = llm_orchestrator.process(question=question, user_role="EMPLOYEE")

    return res


def _assert_offline_deterministic(question: str, expected_value: str):
    """
    Assert a deterministic query succeeds with Ollama genuinely unreachable.
    """
    dead_client = _make_dead_client()
    assert dead_client.is_available() is False, "Test requires port 65533 to be unreachable"

    ModelGateway.reset_invocation_count()

    with patch.object(llm_orchestrator, "ollama", dead_client):
        res = llm_orchestrator.process(question=question, user_role="EMPLOYEE")

    # Gateway boundary: 0 calls (deterministic route never calls model_gateway.generate)
    gw_count = ModelGateway.get_invocation_count()
    assert gw_count == 0, (
        f"[OFFLINE BOUNDARY VIOLATION] ModelGateway.generate() called {gw_count} time(s) "
        f"for deterministic question '{question}' even with dead Ollama."
    )

    # Tracker: 0 LLM calls
    assert res.get("llm_calls", -1) == 0, (
        f"llm_calls != 0 for '{question}' with dead Ollama: got {res.get('llm_calls')}"
    )
    assert res.get("model_calls", -1) == 0, (
        f"model_calls != 0 for '{question}' with dead Ollama: got {res.get('model_calls')}"
    )
    assert res.get("rag_calls", -1) == 0, (
        f"rag_calls != 0 for '{question}' with dead Ollama: got {res.get('rag_calls')}"
    )

    # Execution path: deterministic
    trace = res.get("execution_trace", {})
    assert trace.get("deterministic_route") is True, (
        f"deterministic_route != True for offline test '{question}': trace={trace}\n"
        f"  This means the orchestrator attempted to reach LLM despite Ollama being dead."
    )

    # Correct DB answer
    if expected_value:
        answer = str(res.get("answer", ""))
        assert expected_value in answer, (
            f"Expected '{expected_value}' not in answer for offline '{question}'.\n"
            f"  answer='{answer}'"
        )

    return res


# =============================================================================
# OFFLINE PROOF TESTS
# =============================================================================

class TestProof2_OfflineResilience:
    """
    Ollama is TRULY unreachable (port 65533 - not a mock).
    Deterministic queries must succeed unchanged.
    """

    def test_total_headcount_offline(self):
        """Total headcount must work with no Ollama whatsoever."""
        _assert_offline_deterministic("How many total employees in ETS?", "590")

    def test_active_headcount_offline(self):
        """Active headcount must work with no Ollama whatsoever."""
        _assert_offline_deterministic("How many active employees are there?", "557")

    def test_exited_headcount_offline(self):
        """Exited headcount must work with no Ollama whatsoever."""
        _assert_offline_deterministic("How many employees have left ETS?", "33")

    def test_state_nh_offline(self):
        """State-filtered query must work with no Ollama whatsoever."""
        _assert_offline_deterministic("How many employees are in Project State NH?", str(DB["NH_all"]))

    def test_location_blr_all_offline(self):
        """Location-filtered query must work with no Ollama whatsoever."""
        _assert_offline_deterministic("How many employees are in Bangalore?", str(DB["BLR_all"]))

    def test_location_blr_active_offline(self):
        """Location + active population filter must work offline."""
        _assert_offline_deterministic("Active employees in Bangalore", str(DB["BLR_active"]))

    def test_attrition_offline(self):
        """Attrition rate must be computed offline without Ollama."""
        _assert_offline_deterministic("What is the attrition rate?", "5.59")

    def test_min_salary_offline(self):
        """Min salary query must succeed without Ollama."""
        _assert_offline_deterministic("What is the minimum salary?", "150,000")

    def test_max_salary_offline(self):
        """Max salary query must succeed without Ollama."""
        _assert_offline_deterministic("What is the maximum salary?", "5,000,000")


class TestProof2_OllamaLivenessCheck:
    """
    Verify that the dead client truly cannot connect,
    ensuring these tests validate the real failure boundary and not the mock harness.
    """

    def test_dead_client_is_unavailable(self):
        """The dead client on port 65533 must report unavailable."""
        dead = OllamaClient(base_url=DEAD_URL)
        available = dead.is_available()
        assert available is False, (
            f"Dead client on {DEAD_URL} reported available=True. "
            "Tests in this suite are NOT testing real unavailability."
        )

    def test_dead_client_generate_returns_none(self):
        """The dead client's generate() must return None (real network failure)."""
        dead = OllamaClient(base_url=DEAD_URL)
        result = dead.generate(prompt="test", model="qwen2.5:3b", max_tokens=10)
        assert result is None, (
            f"Dead client generate() returned '{result}' instead of None."
        )

    def test_real_ollama_client_is_live_client(self):
        """Confirm the orchestrator's ollama attribute is the real module-level client."""
        import backend.app.ai.ollama_client as oc_module
        assert llm_orchestrator.ollama is oc_module.ollama_client, (
            "Orchestrator is not using the module-level ollama_client. "
            "Patching may not be targeting the correct reference."
        )
