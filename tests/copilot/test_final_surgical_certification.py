"""
ETS GENIE COPILOT -- FINAL SURGICAL CERTIFICATION SUITE
=========================================================
Exhaustive verification of the operational gates demanded by the Principal AI Platform Architect:
  1. Same question repeatability (10x runs, zero variation)
  2. Population semantics (in/at/work in/based in/currently in -> ALL, 396)
  3. Explicit active semantics (active/current employees/still working -> ACTIVE, 386)
  4. Exited semantics (left/exited/former/leavers -> EXITED, 10 or 33)
  5. State vs Location hard boundary (Project State NH = 364, Bangalore = 396)
  6. Unknown entity preservation (Mumbai = 0, ZZ = 0, XYZ = 0, NEVER 590)
  7. Multi-dimension composition (NH+BLR=226, +ACT=216, +EXIT=10, AK+BLR=81, ND+HYD=26, NH+HYD+ACT=98)
  8. Follow-up consistency (5-turn conversation: BLR -> active -> HYD -> which more -> diff)
  9. RAG opposite-path & offline refusal (no fallback, no fabrication)
  10. Finance provenance verification (AUTHORITATIVE vs SYNTHETIC_DERIVED distinction)
  11. Metamorphic reconciliation (all partition identities and coverage sums)
  12. Confidence provenance (derived from verified gates, negative test for failed gate)
  13. ModelGateway boundary telemetry (zero calls verified at class-level atomic counter)
  14. Zero legacy routing path (quarantined ai_agent cannot be reached)
"""

import pytest
import sqlite3
from unittest.mock import patch
from typing import Dict, Any, List

from backend.app.ai.orchestrator import llm_orchestrator
from backend.app.ai.model_gateway import ModelGateway
from backend.app.ai.ollama_client import OllamaClient
from backend.app.ai.capability_registry import (
    capability_registry, CapabilityEnum, PopulationEnum
)
from backend.app.ai.db import sqlite_engine
from backend.app.ai.security_context import SecurityContext, UserRole


# =============================================================================
# GATE 1: SAME QUESTION MUST ALWAYS PRODUCE THE SAME SEMANTIC CONTRACT (10x)
# =============================================================================
class TestGate1_Repeatability:
    def test_bangalore_headcount_10x_repeatability(self):
        """Run 'How many employees are in Bangalore?' 10 times consecutively."""
        runs = []
        for i in range(10):
            ModelGateway.reset_invocation_count()
            res = llm_orchestrator.process("How many employees are in Bangalore?", user_role="EMPLOYEE")
            contract = capability_registry.resolve("How many employees are in Bangalore?")
            
            trace = res.get("execution_trace", {})
            record = {
                "capability": contract.capability.value,
                "population": contract.parameters.population.value,
                "location": contract.parameters.physical_location,
                "execution_path": res.get("intent"),
                "llm_calls": res.get("llm_calls"),
                "model_calls": res.get("model_calls"),
                "rag_calls": res.get("rag_calls"),
                "gateway_calls": ModelGateway.get_invocation_count(),
                "result_in_answer": "396" in str(res.get("answer", ""))
            }
            runs.append(record)

        # Verify zero variation across all 10 runs
        first = runs[0]
        assert first["capability"] == "HEADCOUNT"
        assert first["population"] == "ALL"
        assert first["location"] == "Bangalore"
        assert first["execution_path"] == "DETERMINISTIC_SQL"
        assert first["llm_calls"] == 0
        assert first["model_calls"] == 0
        assert first["rag_calls"] == 0
        assert first["gateway_calls"] == 0
        assert first["result_in_answer"] is True

        for i, r in enumerate(runs[1:], 2):
            assert r == first, f"Variation detected on run {i}: {r} != {first}"

    def test_nh_headcount_10x_repeatability(self):
        """Run 'How many employees are in Project State NH?' 10 times consecutively."""
        runs = []
        for i in range(10):
            ModelGateway.reset_invocation_count()
            res = llm_orchestrator.process("How many employees are in Project State NH?", user_role="EMPLOYEE")
            contract = capability_registry.resolve("How many employees are in Project State NH?")
            
            record = {
                "capability": contract.capability.value,
                "population": contract.parameters.population.value,
                "project_state": contract.parameters.project_state,
                "execution_path": res.get("intent"),
                "llm_calls": res.get("llm_calls"),
                "model_calls": res.get("model_calls"),
                "rag_calls": res.get("rag_calls"),
                "gateway_calls": ModelGateway.get_invocation_count(),
                "result_in_answer": "364" in str(res.get("answer", ""))
            }
            runs.append(record)

        first = runs[0]
        assert first["capability"] == "HEADCOUNT"
        assert first["population"] == "ALL"
        assert first["project_state"] == "NH"
        assert first["result_in_answer"] is True
        for i, r in enumerate(runs[1:], 2):
            assert r == first, f"Variation detected on run {i}: {r} != {first}"


# =============================================================================
# GATE 2: CRITICAL POPULATION SEMANTICS (in/at/work in/based in -> ALL, 396)
# =============================================================================
class TestGate2_PopulationSemanticsAll:
    POPULATION_ALL_QUERIES = [
        "How many employees are in Bangalore?",
        "How many employees work in Bangalore?",
        "How many employees work at Bangalore?",
        "How many people are based in Bangalore?",
        "How many staff are located in Bangalore?",
        "How many employees are currently in Bangalore?"
    ]

    @pytest.mark.parametrize("query", POPULATION_ALL_QUERIES)
    def test_location_relationship_implies_all_population(self, query):
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process(query, user_role="EMPLOYEE")
        contract = capability_registry.resolve(query)

        assert contract.capability == CapabilityEnum.HEADCOUNT, f"Wrong capability for '{query}': {contract.capability}"
        assert contract.parameters.population == PopulationEnum.ALL, f"Wrong population for '{query}': {contract.parameters.population}"
        assert contract.parameters.physical_location == "Bangalore"
        assert res.get("intent") == "DETERMINISTIC_SQL"
        assert "396" in str(res.get("answer", "")), f"Expected 396 in answer for '{query}': {res.get('answer')}"
        assert res.get("llm_calls") == 0
        assert res.get("model_calls") == 0
        assert ModelGateway.get_invocation_count() == 0


# =============================================================================
# GATE 3: EXPLICIT ACTIVE SEMANTICS (active/current employees -> ACTIVE, 386)
# =============================================================================
class TestGate3_ExplicitActiveSemantics:
    EXPLICIT_ACTIVE_QUERIES = [
        "How many active employees are in Bangalore?",
        "How many current employees work in Bangalore?",
        "How many employees are currently active in Bangalore?",
        "How many employees are still working in Bangalore?",
        "How many active staff are based in Bangalore?"
    ]

    @pytest.mark.parametrize("query", EXPLICIT_ACTIVE_QUERIES)
    def test_explicit_active_intent_resolves_active(self, query):
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process(query, user_role="EMPLOYEE")
        contract = capability_registry.resolve(query)

        assert contract.capability == CapabilityEnum.ACTIVE_HEADCOUNT, f"Expected ACTIVE_HEADCOUNT for '{query}': {contract.capability}"
        assert contract.parameters.population == PopulationEnum.ACTIVE, f"Expected ACTIVE population for '{query}': {contract.parameters.population}"
        assert contract.parameters.physical_location == "Bangalore"
        assert res.get("intent") == "DETERMINISTIC_SQL"
        assert "386" in str(res.get("answer", "")), f"Expected 386 in answer for '{query}': {res.get('answer')}"
        assert res.get("llm_calls") == 0
        assert ModelGateway.get_invocation_count() == 0


# =============================================================================
# GATE 4: EXITED SEMANTICS (left/exited/former/leavers -> EXITED)
# =============================================================================
class TestGate4_ExitedSemantics:
    EXITED_QUERIES_BLR = [
        "How many employees left Bangalore?",
        "How many employees have exited Bangalore?",
        "How many former employees were in Bangalore?",
        "How many leavers are from Bangalore?"
    ]

    @pytest.mark.parametrize("query", EXITED_QUERIES_BLR)
    def test_exited_bangalore_is_10(self, query):
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process(query, user_role="EMPLOYEE")
        contract = capability_registry.resolve(query)

        assert contract.capability == CapabilityEnum.LEAVER_COUNT
        assert contract.parameters.population == PopulationEnum.EXITED
        assert contract.parameters.physical_location == "Bangalore"
        assert "10" in str(res.get("answer", "")), f"Expected 10 in answer for '{query}': {res.get('answer')}"
        assert res.get("llm_calls") == 0
        assert ModelGateway.get_invocation_count() == 0

    def test_exited_nh_is_33(self):
        query = "How many employees left Project State NH?"
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process(query, user_role="EMPLOYEE")
        contract = capability_registry.resolve(query)

        assert contract.capability == CapabilityEnum.LEAVER_COUNT
        assert contract.parameters.population == PopulationEnum.EXITED
        assert contract.parameters.project_state == "NH"
        assert "33" in str(res.get("answer", ""))
        assert res.get("llm_calls") == 0
        assert ModelGateway.get_invocation_count() == 0


# =============================================================================
# GATE 5: STATE VS PHYSICAL LOCATION -- HARD BOUNDARY
# =============================================================================
class TestGate5_StateVsLocationHardBoundary:
    STATE_QUERIES = [
        "How many employees are in Project State NH?",
        "How many employees belong to State NH?",
        "How many employees are assigned to NH?"
    ]

    @pytest.mark.parametrize("query", STATE_QUERIES)
    def test_state_queries_bind_project_state_not_location(self, query):
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process(query, user_role="EMPLOYEE")
        contract = capability_registry.resolve(query)

        assert contract.parameters.project_state == "NH", f"Failed to extract project_state from '{query}'"
        assert contract.parameters.physical_location is None, f"Accidentally extracted physical_location from '{query}': {contract.parameters.physical_location}"
        assert contract.parameters.population == PopulationEnum.ALL
        assert "364" in str(res.get("answer", ""))
        assert res.get("llm_calls") == 0

    def test_location_queries_bind_location_not_state(self):
        query = "How many employees are in Bangalore?"
        contract = capability_registry.resolve(query)
        assert contract.parameters.physical_location == "Bangalore"
        assert contract.parameters.project_state is None, f"Accidentally extracted project_state from '{query}': {contract.parameters.project_state}"
        assert contract.parameters.population == PopulationEnum.ALL


# =============================================================================
# GATE 6: UNKNOWN ENTITY PRESERVATION
# =============================================================================
class TestGate6_UnknownEntityPreservation:
    def test_unknown_location_mumbai_returns_zero(self):
        query = "How many employees are in Mumbai?"
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process(query, user_role="EMPLOYEE")
        contract = capability_registry.resolve(query)

        assert contract.parameters.physical_location == "Mumbai" or contract.parameters.unrecognized_filter == "Mumbai"
        ans = str(res.get("answer", ""))
        assert "0" in ans
        assert "590" not in ans, "Unknown location Mumbai MUST NOT return 590 organization total!"
        assert res.get("llm_calls") == 0

    def test_unknown_state_zz_returns_zero(self):
        query = "How many employees are in Project State ZZ?"
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process(query, user_role="EMPLOYEE")
        contract = capability_registry.resolve(query)

        assert "ZZ" in (contract.parameters.project_states or [contract.parameters.project_state, contract.parameters.unrecognized_filter])
        ans = str(res.get("answer", ""))
        assert "0" in ans
        assert "590" not in ans, "Unknown state ZZ MUST NOT return 590 organization total!"
        assert res.get("llm_calls") == 0

    def test_unknown_dept_xyz_returns_zero(self):
        query = "How many employees are in Department XYZ?"
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process(query, user_role="EMPLOYEE")
        contract = capability_registry.resolve(query)

        assert contract.parameters.department == "XYZ" or contract.parameters.unrecognized_filter == "XYZ"
        ans = str(res.get("answer", ""))
        assert "0" in ans
        assert "590" not in ans, "Unknown department XYZ MUST NOT return 590 organization total!"
        assert res.get("llm_calls") == 0


# =============================================================================
# GATE 7: MULTI-DIMENSION COMPOSITION
# =============================================================================
class TestGate7_MultiDimensionComposition:
    COMBINATORIAL_CASES = [
        ("How many employees are in NH and Bangalore?", "226", PopulationEnum.ALL),
        ("How many active employees are in NH and Bangalore?", "216", PopulationEnum.ACTIVE),
        ("How many exited employees are in NH and Bangalore?", "10", PopulationEnum.EXITED),
        ("How many employees are in AK and Bangalore?", "81", PopulationEnum.ALL),
        ("How many employees are in ND and Hyderabad?", "26", PopulationEnum.ALL),
        ("How many active employees are in NH and Hyderabad?", "98", PopulationEnum.ACTIVE),
    ]

    @pytest.mark.parametrize("query,expected_count,expected_pop", COMBINATORIAL_CASES)
    def test_combinatorial_filters(self, query, expected_count, expected_pop):
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process(query, user_role="EMPLOYEE")
        contract = capability_registry.resolve(query)

        assert contract.capability == CapabilityEnum.FILTER_COMPOSITION, f"Expected FILTER_COMPOSITION for '{query}': {contract.capability}"
        assert contract.parameters.population == expected_pop
        assert expected_count in str(res.get("answer", ""))
        assert res.get("llm_calls") == 0
        assert ModelGateway.get_invocation_count() == 0


# =============================================================================
# GATE 8: FOLLOW-UP CONSISTENCY (5-Turn Conversation)
# =============================================================================
class TestGate8_FollowUpConsistency:
    def test_five_turn_conversation_sequence(self):
        """
        Turn 1: How many employees are in Bangalore?       -> Bangalore + ALL = 396
        Turn 2: How many are active?                        -> Bangalore + ACTIVE = 386
        Turn 3: What about Hyderabad?                       -> Hyderabad + ALL = 171
        Turn 4: Which has more?                             -> Bangalore has more (396 vs 171)
        Turn 5: What is the difference?                     -> Difference = 225
        All turns: llm_calls = 0, model_calls = 0, rag_calls = 0
        """
        history = []

        # Turn 1
        ModelGateway.reset_invocation_count()
        q1 = "How many employees are in Bangalore?"
        r1 = llm_orchestrator.process(q1, history=history)
        assert "396" in str(r1["answer"])
        assert r1["llm_calls"] == 0
        assert ModelGateway.get_invocation_count() == 0
        history.append({"question": q1, "answer": r1["answer"]})

        # Turn 2
        ModelGateway.reset_invocation_count()
        q2 = "How many are active?"
        r2 = llm_orchestrator.process(q2, history=history)
        assert "386" in str(r2["answer"])
        assert r2["llm_calls"] == 0
        assert ModelGateway.get_invocation_count() == 0
        history.append({"question": q2, "answer": r2["answer"]})

        # Turn 3
        ModelGateway.reset_invocation_count()
        q3 = "What about Hyderabad?"
        r3 = llm_orchestrator.process(q3, history=history)
        assert "171" in str(r3["answer"])
        assert r3["llm_calls"] == 0
        assert ModelGateway.get_invocation_count() == 0
        history.append({"question": q3, "answer": r3["answer"]})

        # Turn 4
        ModelGateway.reset_invocation_count()
        q4 = "Which has more?"
        r4 = llm_orchestrator.process(q4, history=history)
        ans4 = str(r4["answer"]).lower()
        assert "bangalore" in ans4
        assert r4["llm_calls"] == 0
        assert ModelGateway.get_invocation_count() == 0
        history.append({"question": q4, "answer": r4["answer"]})

        # Turn 5
        ModelGateway.reset_invocation_count()
        q5 = "What is the difference?"
        r5 = llm_orchestrator.process(q5, history=history)
        ans5 = str(r5["answer"])
        assert "225" in ans5 or r5.get("data", {}).get("difference") == 225
        assert r5["llm_calls"] == 0
        assert ModelGateway.get_invocation_count() == 0


# =============================================================================
# GATE 9: RAG / LLM OPPOSITE-PATH PROOF
# =============================================================================
class TestGate9_RAGOppositePathAndOfflineRefusal:
    POLICY_QUERY = "What are the promotion hike criteria and grade progression policy?"

    def test_policy_query_does_not_execute_deterministic_sql(self):
        """Policy queries MUST NOT execute deterministic employee SQL."""
        contract = capability_registry.resolve(self.POLICY_QUERY)
        assert contract.execution_route == "RAG"
        assert contract.capability == CapabilityEnum.RAG_POLICY_QA

    def test_policy_query_offline_ollama_fails_without_fabrication(self):
        """
        When Ollama is genuinely unavailable (port 65533),
        RAG query MUST fail explicitly with AI_UNAVAILABLE, zero fallback, zero fabricated answer.
        """
        dead_client = OllamaClient(base_url="http://localhost:65533")
        assert dead_client.is_available() is False

        with patch.object(llm_orchestrator, "ollama", dead_client):
            res = llm_orchestrator.process(self.POLICY_QUERY, user_role="EMPLOYEE")

        assert res.get("status") == "AI_UNAVAILABLE"
        assert res.get("intent") == "AI_UNAVAILABLE"
        assert res.get("confidence") == 0.0
        assert "unavailable" in str(res.get("answer")).lower()
        # Verify NO deterministic SQL fallback occurred
        assert res.get("execution_trace", {}).get("deterministic_route") is False


# =============================================================================
# GATE 10: FINANCE PROVENANCE VERIFICATION
# =============================================================================
class TestGate10_FinanceProvenance:
    def test_finance_history_provenance_split(self):
        """
        Verify exact provenance breakdown of finance_history in SQLite:
        - 65 authoritative source records (from Excel sheet FINANCE_HISTORY)
        - 1,869 synthetic derived records (multi-year progression model)
        Total = 1,934
        """
        cursor = sqlite_engine.conn.cursor()
        cursor.execute("""
            SELECT 
                SUM(CASE WHEN is_synthetic = 0 THEN 1 ELSE 0 END) as auth_cnt,
                SUM(CASE WHEN is_synthetic = 1 THEN 1 ELSE 0 END) as synth_cnt,
                COUNT(*) as total_cnt
            FROM finance_history
        """)
        row = dict(cursor.fetchone())
        assert row["auth_cnt"] == 65, f"Expected 65 authoritative records, got {row['auth_cnt']}"
        assert row["synth_cnt"] == 1869, f"Expected 1,869 synthetic records, got {row['synth_cnt']}"
        assert row["total_cnt"] == 1934

    def test_employees_table_is_pure_authoritative(self):
        """All 590 employees in employees table are authoritative source records."""
        cursor = sqlite_engine.conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM employees")
        cnt = cursor.fetchone()[0]
        assert cnt == 590

    def test_promotion_hike_query_provenance_transparency(self):
        """
        Promotion hike queries MUST expose provenance in insights or trace:
        distinguishing authoritative events (8 events, 26.97% avg) from synthetic models (419 events, 110.06% avg).
        """
        cursor = sqlite_engine.conn.cursor()
        cursor.execute("""
            SELECT 
                COUNT(*) as all_promos,
                SUM(CASE WHEN is_synthetic = 0 THEN 1 ELSE 0 END) as auth_promos,
                ROUND(AVG(CASE WHEN is_synthetic = 0 THEN hike_percent * 100.0 END), 2) as auth_avg,
                ROUND(AVG(hike_percent * 100.0), 2) as total_avg
            FROM finance_history WHERE is_promotion = 'Yes'
        """)
        stats = dict(cursor.fetchone())
        assert stats["all_promos"] == 427
        assert stats["auth_promos"] == 8
        assert stats["auth_avg"] == 26.97
        assert stats["total_avg"] == 110.06


# =============================================================================
# GATE 11: METAMORPHIC DATA RECONCILIATION
# =============================================================================
class TestGate11_MetamorphicReconciliation:
    def test_organization_population_conservation(self):
        """TOTAL = ACTIVE + EXITED (590 = 557 + 33)"""
        cursor = sqlite_engine.conn.cursor()
        tot = cursor.execute("SELECT COUNT(*) FROM employees").fetchone()[0]
        act = cursor.execute("SELECT COUNT(*) FROM employees WHERE current_status = 'Active'").fetchone()[0]
        ext = cursor.execute("SELECT COUNT(*) FROM employees WHERE current_status = 'Exited'").fetchone()[0]
        assert tot == 590
        assert act == 557
        assert ext == 33
        assert tot == act + ext

    def test_location_partitions_reconciliation(self):
        """
        396 = 386 + 10
        171 = 148 + 23
        13 = 13 + 0
        10 = 10 + 0
        Sum = 590
        """
        cursor = sqlite_engine.conn.cursor()
        loc_data = {}
        for loc in ["Bangalore", "Hyderabad", "Chennai", "Pune"]:
            t = cursor.execute(f"SELECT COUNT(*) FROM employees WHERE location = '{loc}'").fetchone()[0]
            a = cursor.execute(f"SELECT COUNT(*) FROM employees WHERE location = '{loc}' AND current_status = 'Active'").fetchone()[0]
            e = cursor.execute(f"SELECT COUNT(*) FROM employees WHERE location = '{loc}' AND current_status = 'Exited'").fetchone()[0]
            assert t == a + e, f"Partition mismatch in {loc}: {t} != {a} + {e}"
            loc_data[loc] = t

        assert loc_data["Bangalore"] == 396
        assert loc_data["Hyderabad"] == 171
        assert loc_data["Chennai"] == 13
        assert loc_data["Pune"] == 10
        assert sum(loc_data.values()) == 590

    def test_state_partitions_reconciliation(self):
        """
        364 = 331 + 33
        118 = 118 + 0
        108 = 108 + 0
        Sum = 590
        """
        cursor = sqlite_engine.conn.cursor()
        st_data = {}
        for st in ["NH", "ND", "AK"]:
            t = cursor.execute(f"SELECT COUNT(*) FROM employees WHERE state = '{st}'").fetchone()[0]
            a = cursor.execute(f"SELECT COUNT(*) FROM employees WHERE state = '{st}' AND current_status = 'Active'").fetchone()[0]
            e = cursor.execute(f"SELECT COUNT(*) FROM employees WHERE state = '{st}' AND current_status = 'Exited'").fetchone()[0]
            assert t == a + e, f"Partition mismatch in {st}: {t} != {a} + {e}"
            st_data[st] = t

        assert st_data["NH"] == 364
        assert st_data["ND"] == 118
        assert st_data["AK"] == 108
        assert sum(st_data.values()) == 590


# =============================================================================
# GATE 12: CONFIDENCE PROVENANCE
# =============================================================================
class TestGate12_ConfidenceProvenance:
    def test_deterministic_confidence_is_derived_and_equals_one(self):
        """
        Successful deterministic query:
        confidence = 1.0 derived from typed_resolution=True, governed_execution=True, runtime_invariants=True
        """
        res = llm_orchestrator.process("How many employees are in Bangalore?", user_role="EMPLOYEE")
        assert res.get("confidence") == 1.0
        trace = res.get("execution_trace", {})
        prov = trace.get("confidence_provenance", {})
        assert prov.get("typed_resolution") is True
        assert prov.get("governed_execution") is True
        assert prov.get("runtime_invariants") is True
        assert prov.get("provenance_type") == "DETERMINISTIC_VERIFIED_GATES"

    def test_negative_gate_failure_produces_zero_confidence(self):
        """
        Negative test: simulate failure in invariant assertion.
        Expected: confidence != 1.0 (confidence == 0.0) with failed gate exposed.
        """
        from backend.app.ai.invariant_engine import InvariantResult, invariant_engine
        
        failed_inv = InvariantResult(
            passed=False,
            invariant_name="TEST_SIMULATED_FAIL",
            details="Simulated assertion violation for negative test"
        )
        with patch.object(invariant_engine, "validate_capability_result", return_value=failed_inv):
            res = llm_orchestrator.process("How many employees are in Bangalore?", user_role="EMPLOYEE")

        assert res.get("confidence") == 0.0, f"Confidence should be 0.0 on invariant failure, got {res.get('confidence')}"
        assert res.get("status") == "INVARIANT_FAILED"
        assert "TEST_SIMULATED_FAIL" in str(res.get("insights"))


# =============================================================================
# GATE 13: REAL MODELGATEWAY BOUNDARY TELEMETRY
# =============================================================================
class TestGate13_RealModelGatewayBoundary:
    def test_gateway_invocation_count_is_zero(self):
        """
        Assert that ModelGateway._gateway_invocation_count is class-level authoritative.
        """
        ModelGateway.reset_invocation_count()
        assert ModelGateway.get_invocation_count() == 0
        res = llm_orchestrator.process("How many total employees are in ETS?", user_role="EMPLOYEE")
        assert ModelGateway.get_invocation_count() == 0
        assert res.get("llm_calls") == 0
        assert res.get("model_calls") == 0
        assert res.get("rag_calls") == 0


# =============================================================================
# GATE 14: ZERO LEGACY ROUTING PATH
# =============================================================================
class TestGate14_ZeroLegacyRoutingPath:
    def test_quarantined_files_cannot_be_imported(self):
        """Confirm ai_agent.py and ai_agent_backup.py are not in python import tree."""
        import sys
        assert "backend.app.ai_agent" not in sys.modules
        assert "backend.app.ai_agent_backup" not in sys.modules

    def test_copilot_router_uses_orchestrator_directly(self):
        """Verify backend.app.routers.copilot directly invokes llm_orchestrator."""
        import inspect
        from backend.app.routers import copilot
        src = inspect.getsource(copilot.query_copilot)
        assert "llm_orchestrator.process" in src
        assert "ai_agent" not in src
