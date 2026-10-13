import pytest
from unittest.mock import MagicMock
from backend.app.ai.orchestrator import LLMOrchestrator
from backend.app.ai.sql_governor import SQLGovernor
from backend.app.ai.grounding import GroundingVerifier

def test_kill_switch_offline_ollama():
    """Verify that if Ollama is unavailable, the system strictly returns AI_UNAVAILABLE with no static fallback."""
    orch = LLMOrchestrator()
    orig_is_available = orch.ollama.is_available
    try:
        orch.ollama.is_available = MagicMock(return_value=False)
        res = orch.process("How many employees are in Bangalore?")
        assert res.get("status") == "AI_UNAVAILABLE"
        assert res.get("intent") == "AI_UNAVAILABLE"
        assert res.get("confidence") == 0.0
        assert "AI reasoning service (Ollama) is currently unavailable" in res.get("answer")
        assert "Per zero-trust architecture guidelines, deterministic fallback is disabled" in res.get("insights")[1]
    finally:
        orch.ollama.is_available = orig_is_available

def test_governed_sql_ast_protection():
    """Verify that AST governor rejects mutating or disallowed statements."""
    gov = SQLGovernor()
    # Mutation injection attempt
    drop_res = gov.execute_governed("DROP TABLE employees")
    assert drop_res["success"] is False
    assert "Only SELECT queries are permitted" in drop_res["error"]

    update_res = gov.execute_governed("UPDATE employees SET annual_ctc = 0")
    assert update_res["success"] is False
    assert "Only SELECT queries are permitted" in update_res["error"]

    # Disallowed table
    disallowed_res = gov.execute_governed("SELECT * FROM passwords")
    assert disallowed_res["success"] is False
    assert "Unauthorized table 'passwords'" in disallowed_res["error"]

def test_grounding_verifier():
    """Verify grounding verifier catches ungrounded numbers."""
    verifier = GroundingVerifier()
    evidence = [{"department": "IT", "headcount": 383}, {"department": "Core", "headcount": 153}]
    
    # Grounded answer
    grounded_ans = "The IT department has 383 employees while Core has 153."
    res = verifier.verify_evidence(grounded_ans, evidence)
    assert res["is_grounded"] is True
    assert len(res["ungrounded_numbers"]) == 0

    # Hallucinated / ungrounded answer
    hallucinated_ans = "The IT department has 999 employees with 450 contractors."
    res2 = verifier.verify_evidence(hallucinated_ans, evidence)
    assert res2["is_grounded"] is False
    assert "999" in res2["ungrounded_numbers"]
    assert "450" in res2["ungrounded_numbers"]

def test_live_llm_orchestrator_query():
    """Verify live query execution through real Ollama model."""
    orch = LLMOrchestrator()
    if not orch.ollama.is_available():
        pytest.skip("Ollama is offline, skipping live LLM test")

    res = orch.process("How many employees are in Bangalore?")
    assert "396" in res["answer"]
    assert res["intent"] == "LLM_SQL"
    assert res["source"] == "/api/copilot/governed_sql"
    assert res["confidence"] >= 0.8
    assert res["execution_trace"]["grounded"] is True

def test_utilization_guardrail():
    """Verify that the system explicitly avoids fabricating Billable Utilization."""
    orch = LLMOrchestrator()
    if not orch.ollama.is_available():
        pytest.skip("Ollama is offline, skipping live LLM test")

    res = orch.process("What is our billable utilization percentage?")
    # Answer must not claim a fabricated 100% or invented metric
    assert "billable utilization" in res["answer"].lower() or "not contain" in res["answer"].lower() or "client delivery" in res["answer"].lower() or "limitations" in res["answer"].lower()
