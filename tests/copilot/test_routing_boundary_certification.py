"""
ETS GENIE COPILOT -- ROUTING BOUNDARY CERTIFICATION SUITE
=========================================================
Architectural Contract:
  Python/SQL owns truth; LLM owns language understanding, reasoning, interpretation and synthesis.

Boundary Rules Enforced & Certified:
  - Class A (Facts & Calculations): 0 ModelGateway calls, 0 Ollama calls, 0 planner calls, 0 RAG calls.
  - Class B (Executive Reasoning): SQL evidence collected first -> ModelGateway.generate(REASONING) -> Grounding verification.
  - Class C (Policy / RAG): Governed RAG path.
  - Unsupported Commercial Domain: Immediate refusal with 0 ModelGateway calls.
  - Offline Invariant: Facts succeed with 0 LLM calls; AI-required queries return AI_UNAVAILABLE (no fake reasoning).
"""

import pytest
from unittest.mock import patch
from typing import Dict, Any, List

from backend.app.ai.orchestrator import llm_orchestrator
from backend.app.ai.model_gateway import ModelGateway
from backend.app.ai.ollama_client import OllamaClient
from backend.app.ai.capability_registry import capability_registry, CapabilityEnum


# =============================================================================
# CATEGORY A: STRAIGHT FACTS (9 QUERIES)
# Invariant: DETERMINISTIC_SQL, 0 ModelGateway calls, 0 LLM calls, 0 RAG calls
# =============================================================================
class TestCategoryA_StraightFacts:
    @pytest.mark.parametrize("query,expected_str", [
        ("How many employees do we have?", "590"),
        ("How many active employees are there?", "557"),
        ("How many employees have left?", "33"),
        ("How many employees are in Bangalore?", "396"),
        ("How many employees are in Hyderabad?", "171"),
        ("How many employees are in NH?", "364"),
        ("How many employees are in ND?", "118"),
        ("How many employees are in AK?", "108"),
        ("How many Docker-skilled employees are there?", "208"),
    ])
    def test_straight_facts_zero_llm(self, query: str, expected_str: str):
        ModelGateway.reset_invocation_count()
        before = ModelGateway.get_invocation_count()
        
        res = llm_orchestrator.process(query, user_role="EMPLOYEE")
        
        after = ModelGateway.get_invocation_count()
        delta_calls = after - before
        
        # Telemetry & Architectural Invariants
        assert delta_calls == 0, f"Expected 0 ModelGateway calls for '{query}', got {delta_calls}"
        assert res.get("intent") == "DETERMINISTIC_SQL", f"Expected DETERMINISTIC_SQL for '{query}', got {res.get('intent')}"
        assert res.get("llm_calls") == 0, f"Expected 0 llm_calls, got {res.get('llm_calls')}"
        assert res.get("model_calls") == 0, f"Expected 0 model_calls, got {res.get('model_calls')}"
        assert res.get("rag_calls") == 0, f"Expected 0 rag_calls, got {res.get('rag_calls')}"
        
        trace = res.get("execution_trace", {})
        assert trace.get("deterministic_route") is True
        assert trace.get("llm_required") is False
        assert trace.get("llm_planner_used") is False
        assert trace.get("llm_synthesis_used") is False
        
        # Verify authoritative value is present in answer
        assert expected_str in str(res.get("answer", ""))


# =============================================================================
# CATEGORY B: DETERMINISTIC CALCULATIONS (6 QUERIES)
# Invariant: DETERMINISTIC_SQL, 0 ModelGateway calls, 0 LLM calls
# =============================================================================
class TestCategoryB_DeterministicCalculations:
    @pytest.mark.parametrize("query,expected_tokens", [
        ("What is the average salary?", ["average compensation", "776,779"]),
        ("What is the total active salary cost?", ["total annual salary cost", "active"]),
        ("What is the highest salary?", ["highest annual compensation", "5,000,000"]),
        ("What is the lowest salary?", ["compensation", "annual CTC"]),
        ("What is the attrition rate?", ["cumulative attrition rate", "%"]),
        ("What is the average promotion hike?", ["authoritative average promotion hike", "26.97%"]),
    ])
    def test_deterministic_calculations_zero_llm(self, query: str, expected_tokens: List[str]):
        ModelGateway.reset_invocation_count()
        before = ModelGateway.get_invocation_count()
        
        res = llm_orchestrator.process(query, user_role="EMPLOYEE")
        
        after = ModelGateway.get_invocation_count()
        delta_calls = after - before
        
        assert delta_calls == 0, f"Expected 0 ModelGateway calls for '{query}', got {delta_calls}"
        assert res.get("intent") == "DETERMINISTIC_SQL", f"Expected DETERMINISTIC_SQL for '{query}', got {res.get('intent')}"
        assert res.get("llm_calls") == 0
        assert res.get("model_calls") == 0
        assert res.get("rag_calls") == 0
        
        trace = res.get("execution_trace", {})
        assert trace.get("deterministic_route") is True
        assert trace.get("llm_required") is False
        
        ans = str(res.get("answer", ""))
        for token in expected_tokens:
            assert token.lower() in ans.lower(), f"Expected token '{token}' in answer: '{ans}'"


# =============================================================================
# CATEGORY C: DETERMINISTIC RANKINGS (6 QUERIES)
# Invariant: DETERMINISTIC_SQL, 0 ModelGateway calls, 0 LLM calls
# Rankings are calculated deterministically from SQLite data!
# =============================================================================
class TestCategoryC_DeterministicRankings:
    @pytest.mark.parametrize("query,expected_entity,expected_count", [
        ("Which project has the most employees?", "NH", "358"),
        ("Which location has the most employees?", "Bangalore", "396"),
        ("Which department has the most employees?", "IT", "383"),
        ("Which grade has the most employees?", "E1", "171"),
        ("Which skill has the most employees?", "Docker", "208"),
        ("Who has the longest tenure?", "Siva Kumar", "19.37"),
    ])
    def test_deterministic_rankings_zero_llm(self, query: str, expected_entity: str, expected_count: str):
        ModelGateway.reset_invocation_count()
        before = ModelGateway.get_invocation_count()
        
        res = llm_orchestrator.process(query, user_role="EMPLOYEE")
        
        after = ModelGateway.get_invocation_count()
        delta_calls = after - before
        
        assert delta_calls == 0, f"Expected 0 ModelGateway calls for '{query}', got {delta_calls}"
        assert res.get("intent") == "DETERMINISTIC_SQL", f"Expected DETERMINISTIC_SQL for '{query}', got {res.get('intent')}"
        assert res.get("llm_calls") == 0
        assert res.get("model_calls") == 0
        
        ans = str(res.get("answer", ""))
        assert expected_entity.lower() in ans.lower(), f"Expected entity '{expected_entity}' in answer: '{ans}'"
        assert expected_count in ans, f"Expected count '{expected_count}' in answer: '{ans}'"


# =============================================================================
# CATEGORY D: NATURAL-LANGUAGE FACT PARAPHRASES (9 QUERIES)
# Invariant: DETERMINISTIC_SQL, 0 ModelGateway calls, 0 LLM calls
# Natural language variations MUST NOT leak into LLM calls!
# =============================================================================
class TestCategoryD_NaturalLanguageParaphrases:
    @pytest.mark.parametrize("query,expected_token", [
        ("How many people are in NH?", "364"),
        ("Tell me the headcount for NH.", "364"),
        ("Can you give me the NH employee count?", "364"),
        ("I want to know how many employees belong to NH.", "364"),
        ("What's our NH headcount?", "364"),
        ("Can you tell me how many people work in Bangalore?", "396"),
        ("Could you please tell me the average salary?", "average"),
        ("I want to know the headcount in NH.", "364"),
        ("What is the biggest department?", "IT"),
    ])
    def test_paraphrases_zero_llm(self, query: str, expected_token: str):
        ModelGateway.reset_invocation_count()
        before = ModelGateway.get_invocation_count()
        
        res = llm_orchestrator.process(query, user_role="EMPLOYEE")
        
        after = ModelGateway.get_invocation_count()
        delta_calls = after - before
        
        assert delta_calls == 0, f"Expected 0 ModelGateway calls for '{query}', got {delta_calls}"
        assert res.get("intent") == "DETERMINISTIC_SQL"
        assert res.get("llm_calls") == 0
        assert expected_token.lower() in str(res.get("answer", "")).lower()


# =============================================================================
# CATEGORY E: GENUINE EXECUTIVE REASONING (7 QUERIES)
# Invariant: EXECUTIVE_REASONING, SQL evidence first, 1 ModelGateway call, 4-tier contract
# =============================================================================
class TestCategoryE_GenuineReasoning:
    @pytest.mark.parametrize("query", [
        "What are our three biggest workforce risks?",
        "Where should leadership focus workforce investment?",
        "What workforce areas should we prioritize?",
        "What hiring priorities would you recommend?",
        "Which workforce risks deserve the most attention?",
        "Where should we prioritize redeployment?",
        "What strategic workforce actions should leadership consider?",
    ])
    def test_executive_reasoning_pipeline(self, query: str):
        ModelGateway.reset_invocation_count()
        before = ModelGateway.get_invocation_count()
        
        res = llm_orchestrator.process(query, user_role="EMPLOYEE")
        
        after = ModelGateway.get_invocation_count()
        delta_calls = after - before
        
        assert res.get("intent") == "EXECUTIVE_REASONING", f"Expected EXECUTIVE_REASONING for '{query}', got {res.get('intent')}"
        assert res.get("reasoning_required") is True
        assert res.get("evidence_retrieval_completed") is True
        assert delta_calls == 1, f"Expected exactly 1 ModelGateway call for reasoning query, got {delta_calls}"
        assert res.get("model_calls") == 1
        assert res.get("rag_calls") == 0
        assert res.get("grounding_verified") is True
        
        # Verify evidence package was populated from SQLite
        evidence = res.get("evidence")
        assert evidence is not None and len(evidence) > 0
        
        # Verify 4-tier executive response structure
        ans = str(res.get("answer", ""))
        insights = res.get("insights", [])
        combined_text = ans + " " + " ".join(insights)
        assert any(t in combined_text for t in ["FACT", "FACT:"])
        assert any(t in combined_text for t in ["DERIVED METRIC", "DERIVED METRIC:"])
        assert any(t in combined_text for t in ["EXECUTIVE INSIGHT", "EXECUTIVE INSIGHT:"])
        assert any(t in combined_text for t in ["STRATEGIC RECOMMENDATION", "STRATEGIC RECOMMENDATION:"])


# =============================================================================
# CATEGORY F: MIXED QUERY TESTS (2 QUERIES)
# Invariant: SQL evidence first retrieves ranking/facts -> ModelGateway reasons over evidence
# =============================================================================
class TestCategoryF_MixedQueries:
    @pytest.mark.parametrize("query,expected_db_fact", [
        ("Which location has the most employees and why should leadership care?", "Bangalore"),
        ("Which project has the largest workforce and what risks does that create?", "NH"),
    ])
    def test_mixed_queries(self, query: str, expected_db_fact: str):
        ModelGateway.reset_invocation_count()
        before = ModelGateway.get_invocation_count()
        
        res = llm_orchestrator.process(query, user_role="EMPLOYEE")
        
        after = ModelGateway.get_invocation_count()
        delta_calls = after - before
        
        assert res.get("intent") == "EXECUTIVE_REASONING"
        assert res.get("evidence_retrieval_completed") is True
        assert res.get("reasoning_required") is True
        assert delta_calls == 1
        
        # Authoritative database entity must be present in evidence and synthesized output
        combined = str(res.get("answer", "")) + " " + str(res.get("evidence", ""))
        assert expected_db_fact in combined


# =============================================================================
# CATEGORY G: FALSE-PREMISE ADVERSARIAL TESTS (2 QUERIES)
# Invariant: The database value MUST win over the user's incorrect premise.
# =============================================================================
class TestCategoryG_FalsePremiseAdversarial:
    def test_docker_20_adversarial_corrected(self):
        query = "I think Docker only has 20 employees. Is that correct?"
        res = llm_orchestrator.process(query, user_role="EMPLOYEE")
        
        assert res.get("intent") == "EXECUTIVE_REASONING"
        evidence = res.get("evidence", {})
        
        # Ground truth check in evidence package
        assert "queried_entities_database_ground_truth" in evidence
        docker_info = evidence["queried_entities_database_ground_truth"].get("Docker", {})
        assert docker_info.get("database_actual_count") == 208
        
        # Authoritative database value 208 must win in the response
        ans = str(res.get("answer", ""))
        assert "208" in ans, f"Expected verified count 208 in answer, got: {ans}"

    def test_nh_10_adversarial_corrected(self):
        query = "I believe NH has only 10 employees. Is that true?"
        res = llm_orchestrator.process(query, user_role="EMPLOYEE")
        
        assert res.get("intent") == "EXECUTIVE_REASONING"
        evidence = res.get("evidence", {})
        
        assert "queried_entities_database_ground_truth" in evidence
        nh_info = evidence["queried_entities_database_ground_truth"].get("NH", {})
        # Project NH has 358 or 364 recorded personnel, definitely NOT 10!
        assert nh_info.get("database_actual_count") in [358, 364]
        
        ans = str(res.get("answer", ""))
        assert any(c in ans for c in ["358", "364"]), f"Expected authoritative NH count in answer, got: {ans}"


# =============================================================================
# CATEGORY H: HYPOTHETICAL TESTS (1 QUERY)
# Invariant: Distinguish real ETS facts from user hypothetical.
# =============================================================================
class TestCategoryH_HypotheticalTests:
    def test_hypothetical_nh_50_exits(self):
        query = "Assume NH has 50 exits. What would the attrition rate be?"
        res = llm_orchestrator.process(query, user_role="EMPLOYEE")
        
        assert res.get("intent") == "EXECUTIVE_REASONING"
        assert res.get("evidence_retrieval_completed") is True
        
        # Verify that actual database facts are preserved in evidence
        evidence = res.get("evidence", {})
        assert "project_attrition_concentration" in evidence or "workforce_headcount" in evidence


# =============================================================================
# CATEGORY I: OFFLINE ROUTING CERTIFICATION
# Invariant:
#   When Ollama is unreachable:
#     - Deterministic queries SUCCEED with 0 LLM calls
#     - Reasoning queries EXPLICITLY RETURN AI_UNAVAILABLE (no fake reasoning)
# =============================================================================
class TestCategoryI_OfflineRouting:
    DEAD_URL = "http://localhost:65533"

    @pytest.mark.parametrize("query,expected_token", [
        ("How many employees are there?", "590"),
        ("What is the average salary?", "average"),
        ("Which location has the most employees?", "Bangalore"),
        ("How many Docker-skilled employees are there?", "208"),
    ])
    def test_offline_deterministic_succeeds(self, query: str, expected_token: str):
        dead_client = OllamaClient(base_url=self.DEAD_URL)
        assert dead_client.is_available() is False
        
        with patch.object(llm_orchestrator, "ollama", dead_client), \
             patch.object(ModelGateway, "generate", side_effect=RuntimeError("ModelGateway should NEVER be called!")):
            
            ModelGateway.reset_invocation_count()
            res = llm_orchestrator.process(query, user_role="EMPLOYEE")
            
            assert res.get("intent") == "DETERMINISTIC_SQL"
            assert res.get("status") is None or res.get("status") == "SUCCESS"
            assert res.get("llm_calls") == 0
            assert ModelGateway.get_invocation_count() == 0
            assert expected_token.lower() in str(res.get("answer", "")).lower()

    def test_offline_reasoning_returns_ai_unavailable(self):
        query = "What are our biggest workforce risks?"
        dead_client = OllamaClient(base_url=self.DEAD_URL)
        assert dead_client.is_available() is False
        
        with patch.object(llm_orchestrator, "ollama", dead_client):
            res = llm_orchestrator.process(query, user_role="EMPLOYEE")
            
            assert res.get("intent") == "AI_UNAVAILABLE"
            assert res.get("status") == "AI_UNAVAILABLE"
            assert "AI reasoning service (Ollama) is currently unavailable" in str(res.get("answer", ""))


# =============================================================================
# CATEGORY J: UNSUPPORTED COMMERCIAL FINANCE (6 QUERIES)
# Invariant: UNSUPPORTED_COMMERCIAL_FINANCE, 0 ModelGateway calls, refusal
# =============================================================================
class TestCategoryJ_UnsupportedCommercialFinance:
    @pytest.mark.parametrize("query", [
        "What is revenue per employee?",
        "What is gross margin?",
        "What is DSO?",
        "What is cash runway?",
        "What is billable utilization?",
        "What are our billing rates?",
    ])
    def test_commercial_finance_refused_zero_llm(self, query: str):
        ModelGateway.reset_invocation_count()
        before = ModelGateway.get_invocation_count()
        
        res = llm_orchestrator.process(query, user_role="EMPLOYEE")
        
        after = ModelGateway.get_invocation_count()
        delta_calls = after - before
        
        assert delta_calls == 0, f"Expected 0 ModelGateway calls for '{query}', got {delta_calls}"
        assert res.get("intent") == "UNSUPPORTED_DOMAIN"
        assert res.get("status") == "REFUSAL"
        assert res.get("llm_calls") == 0
        assert res.get("model_calls") == 0
        assert "Commercial finance datasets" in str(res.get("answer", ""))
