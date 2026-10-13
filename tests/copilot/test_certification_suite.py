import pytest
from unittest.mock import patch
from typing import Dict, Any, List
from backend.app.ai.capability_registry import (
    capability_registry, CapabilityEnum, PopulationEnum, EntityNormalizer, TypedParameters
)
from backend.app.ai.security_context import SecurityContext, UserRole
from backend.app.ai.query_builder import query_builder, QueryPlan
from backend.app.ai.invariant_engine import invariant_engine
from backend.app.ai.sql_governor import sql_governor
from backend.app.ai.db import sqlite_engine
from backend.app.ai.orchestrator import llm_orchestrator
from backend.app.ai.ollama_client import ollama_client

# =====================================================================
# SUITE 1: DETERMINISTIC PHRASINGS & POPULATION SEMANTICS (50 Tests)
# Gate A & Gate D
# =====================================================================

TOTAL_HEADCOUNT_QUERIES = [
    "How many total employees are there in ETS?",
    "What is the total headcount of ETS?",
    "Total workforce count in ETS",
    "How many employees are there in ETS?",
    "How many employees in ETS?",
    "Total headcount",
    "overall headcount",
    "total workforce size",
    "how many total employees",
    "employees in ets"
]

ACTIVE_HEADCOUNT_QUERIES = [
    "How many active employees are there?",
    "What is the active headcount in ETS?",
    "How many currently working employees are in ETS?",
    "Active workforce size",
    "how many active employees work at ets",
    "current active workforce",
    "operational staff count",
    "active employees count",
    "total active headcount",
    "number of active personnel"
]

LEAVER_HEADCOUNT_QUERIES = [
    "How many employees have left ETS?",
    "Total number of leavers in ETS",
    "How many people exited the company?",
    "Count of exited employees",
    "How many employees departed from ETS?",
    "Number of separated employees",
    "How many former employees in ETS records?",
    "total leavers count",
    "employees who have left ets",
    "how many people have left"
]

BANGALORE_POPULATION_QUERIES = [
    ("How many employees in Bangalore?", "396", PopulationEnum.ALL),
    ("Total headcount in Bangalore", "396", PopulationEnum.ALL),
    ("Workforce in Bangalore", "396", PopulationEnum.ALL),
    ("Bangalore employee count", "396", PopulationEnum.ALL),
    ("How many active employees in Bangalore?", "386", PopulationEnum.ACTIVE),
    ("Active headcount in Bangalore", "386", PopulationEnum.ACTIVE),
    ("Currently working employees in Bangalore", "386", PopulationEnum.ACTIVE),
    ("How many employees have left in Bangalore?", "10", PopulationEnum.EXITED),
    ("How many leavers in Bangalore?", "10", PopulationEnum.EXITED),
    ("Exited employees in Bangalore", "10", PopulationEnum.EXITED)
]

STATE_POPULATION_QUERIES = [
    ("How many employees in Project State NH?", "364", PopulationEnum.ALL),
    ("Total workforce in Project State NH", "364", PopulationEnum.ALL),
    ("How many active employees in Project State NH?", "331", PopulationEnum.ACTIVE),
    ("Active employees in NH", "331", PopulationEnum.ACTIVE),
    ("How many employees have left in Project State NH?", "33", PopulationEnum.EXITED),
    ("How many employees in Project State ND?", "118", PopulationEnum.ALL),
    ("Active employees in Project State ND", "118", PopulationEnum.ACTIVE),
    ("How many employees have left in Project State ND?", "0", PopulationEnum.EXITED),
    ("How many employees in Project State AK?", "108", PopulationEnum.ALL),
    ("Active employees in Project State AK", "108", PopulationEnum.ACTIVE)
]

class TestDeterministicHeadcountPhrasings:
    @pytest.mark.parametrize("query", TOTAL_HEADCOUNT_QUERIES)
    def test_total_workforce_phrasings_yield_590(self, query):
        res = llm_orchestrator.process(query)
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "590" in res["answer"]
        assert res["llm_calls"] == 0
        assert res["model_calls"] == 0
        assert res["rag_calls"] == 0

    @pytest.mark.parametrize("query", ACTIVE_HEADCOUNT_QUERIES)
    def test_active_workforce_phrasings_yield_557(self, query):
        res = llm_orchestrator.process(query)
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "557" in res["answer"]
        assert res["llm_calls"] == 0
        assert res["model_calls"] == 0

    @pytest.mark.parametrize("query", LEAVER_HEADCOUNT_QUERIES)
    def test_leaver_workforce_phrasings_yield_33(self, query):
        res = llm_orchestrator.process(query)
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "33" in res["answer"]
        assert res["llm_calls"] == 0
        assert res["model_calls"] == 0

    @pytest.mark.parametrize("query,expected_count,expected_pop", BANGALORE_POPULATION_QUERIES)
    def test_bangalore_population_semantics(self, query, expected_count, expected_pop):
        res = llm_orchestrator.process(query)
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert expected_count in res["answer"]
        assert res["llm_calls"] == 0

    @pytest.mark.parametrize("query,expected_count,expected_pop", STATE_POPULATION_QUERIES)
    def test_state_population_semantics(self, query, expected_count, expected_pop):
        res = llm_orchestrator.process(query)
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert expected_count in res["answer"]
        assert res["llm_calls"] == 0


# =====================================================================
# SUITE 2: ENTITY DISAMBIGUATION & STATE != LOCATION (30 Tests)
# Gate B
# =====================================================================
class TestEntityDisambiguationAndStateVsLocation:
    def test_nd_is_project_state_not_location(self):
        c = capability_registry.resolve("How many employees in Project State ND?")
        assert c.parameters.project_state == "ND"
        assert c.parameters.physical_location is None

    def test_nh_is_project_state_not_location(self):
        c = capability_registry.resolve("How many employees in Project State NH?")
        assert c.parameters.project_state == "NH"
        assert c.parameters.physical_location is None

    def test_ak_is_project_state_not_location(self):
        c = capability_registry.resolve("How many employees in Project State AK?")
        assert c.parameters.project_state == "AK"
        assert c.parameters.physical_location is None

    def test_bangalore_is_location_not_state(self):
        c = capability_registry.resolve("How many employees in Bangalore?")
        assert c.parameters.physical_location == "Bangalore"
        assert c.parameters.project_state is None

    def test_hyderabad_is_location_not_state(self):
        c = capability_registry.resolve("How many employees in Hyderabad?")
        assert c.parameters.physical_location == "Hyderabad"
        assert c.parameters.project_state is None

    def test_chennai_is_location_not_state(self):
        c = capability_registry.resolve("How many employees in Chennai?")
        assert c.parameters.physical_location == "Chennai"
        assert c.parameters.project_state is None

    def test_pune_is_location_not_state(self):
        c = capability_registry.resolve("How many employees in Pune?")
        assert c.parameters.physical_location == "Pune"
        assert c.parameters.project_state is None

    @pytest.mark.parametrize("city,expected_total", [
        ("Bangalore", "396"),
        ("Hyderabad", "171"),
        ("Chennai", "13"),
        ("Pune", "10")
    ])
    def test_physical_locations_total_headcounts(self, city, expected_total):
        res = llm_orchestrator.process(f"How many employees in {city}?")
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert expected_total in res["answer"]
        assert res["llm_calls"] == 0

    @pytest.mark.parametrize("city,expected_active", [
        ("Bangalore", "386"),
        ("Hyderabad", "148"),
        ("Chennai", "13"),
        ("Pune", "10")
    ])
    def test_physical_locations_active_headcounts(self, city, expected_active):
        res = llm_orchestrator.process(f"How many active employees in {city}?")
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert expected_active in res["answer"]
        assert res["llm_calls"] == 0

    @pytest.mark.parametrize("city,expected_exited", [
        ("Bangalore", "10"),
        ("Hyderabad", "23"),
        ("Chennai", "0"),
        ("Pune", "0")
    ])
    def test_physical_locations_exited_headcounts(self, city, expected_exited):
        res = llm_orchestrator.process(f"How many employees have left in {city}?")
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert expected_exited in res["answer"]
        assert res["llm_calls"] == 0

    def test_state_and_location_orthogonal_partition(self):
        res = llm_orchestrator.process("How many employees in Project State ND in London?")
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "0" in res["answer"]

    def test_state_nh_in_bangalore_is_226(self):
        res = llm_orchestrator.process("How many employees in Project State NH in Bangalore?")
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "226" in res["answer"]

    def test_state_ak_in_bangalore_is_81(self):
        res = llm_orchestrator.process("How many employees in Project State AK in Bangalore?")
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "81" in res["answer"]

    def test_state_ak_in_hyderabad_is_24(self):
        res = llm_orchestrator.process("How many employees in Project State AK in Hyderabad?")
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "24" in res["answer"]

    def test_preposition_in_never_maps_to_indiana(self):
        res = llm_orchestrator.process("How many people in ETS?")
        assert "590" in res["answer"]
        assert res["filters"].get("project_state") is None

    def test_stop_token_or_never_maps_to_oregon(self):
        res = llm_orchestrator.process("Are there 10 or 20 employees?")
        assert res["filters"].get("project_state") is None

    def test_stop_token_me_never_maps_to_maine(self):
        res = llm_orchestrator.process("Give me the employee count")
        assert "590" in res["answer"]
        assert res["filters"].get("project_state") is None


# =====================================================================
# SUITE 3: UNKNOWN ENTITIES & ZERO LEAKAGE INVARIANT (20 Tests)
# Gate A, D & Invariant Engine
# =====================================================================
UNKNOWN_ENTITIES = [
    "state ZZ", "Project State ZZ", "in ZZ",
    "state California", "state Texas", "state Florida", "state New York",
    "state Washington", "state Ohio", "state Illinois",
    "Delhi", "Mumbai", "Kolkata", "London", "New York",
    "Paris", "Berlin", "Tokyo", "Sydney", "Singapore"
]

class TestUnknownEntitiesAndZeroLeakage:
    @pytest.mark.parametrize("entity", UNKNOWN_ENTITIES)
    def test_unknown_entity_returns_zero_and_zero_leakage(self, entity):
        q = f"How many employees in {entity}?"
        res = llm_orchestrator.process(q)
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "0" in res["answer"]
        assert "590" not in res["answer"]
        assert res["llm_calls"] == 0


# =====================================================================
# SUITE 4: BREAKDOWNS, RANKINGS, AND ANALYTICAL INVARIANTS (25 Tests)
# Gate D & Gate H
# =====================================================================
class TestBreakdownsAndAggregations:
    @pytest.mark.parametrize("query", [
        "breakdown by state",
        "workforce by state",
        "distribution across states",
        "headcount per state",
        "state distribution"
    ])
    def test_state_breakdown_phrasings(self, query):
        res = llm_orchestrator.process(query)
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "NH" in res["answer"] and "ND" in res["answer"] and "AK" in res["answer"]
        assert res["llm_calls"] == 0

    @pytest.mark.parametrize("query", [
        "breakdown by location",
        "workforce by location",
        "distribution by location",
        "headcount per location",
        "location breakdown"
    ])
    def test_location_breakdown_phrasings(self, query):
        res = llm_orchestrator.process(query)
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "Bangalore" in res["answer"] and "Hyderabad" in res["answer"]
        assert res["llm_calls"] == 0

    @pytest.mark.parametrize("query", [
        "breakdown by department",
        "workforce by department",
        "department distribution",
        "headcount per department",
        "department breakdown"
    ])
    def test_department_breakdown_phrasings(self, query):
        res = llm_orchestrator.process(query)
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "Core" in res["answer"] or "Support" in res["answer"]
        assert res["llm_calls"] == 0

    @pytest.mark.parametrize("query", [
        "Who has the highest salary?",
        "Who earns the most?",
        "Highest CTC in ETS",
        "top salary in ETS"
    ])
    def test_highest_salary_all_34_tied(self, query):
        res = llm_orchestrator.process(query)
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "34 employees" in res["answer"]
        assert "5,000,000" in res["answer"]
        assert res["llm_calls"] == 0

    @pytest.mark.parametrize("query", [
        "Who has the lowest salary?",
        "Who earns the least?",
        "Lowest compensation in ETS"
    ])
    def test_lowest_salary_tied(self, query):
        res = llm_orchestrator.process(query)
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "150,000" in res["answer"]
        assert res["llm_calls"] == 0

    def test_cumulative_attrition_rate(self):
        res = llm_orchestrator.process("What is the cumulative attrition rate?")
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "5.59%" in res["answer"]
        assert res["llm_calls"] == 0

    def test_average_promotion_hike(self):
        res = llm_orchestrator.process("What is the average promotion hike?")
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "110.06%" in res["answer"]
        assert res["llm_calls"] == 0

    def test_longest_tenure(self):
        res = llm_orchestrator.process("Who has the longest tenure at ETS?")
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "19.37" in res["answer"]
        assert res["llm_calls"] == 0


# =====================================================================
# SUITE 5: COMBINATORIAL FILTER COMPOSITIONS (40 Tests)
# Gate H
# =====================================================================
COMBINATORIAL_CASES = [
    ("How many active employees in Project State NH in Bangalore?", "216"),
    ("How many exited employees in Project State NH in Bangalore?", "10"),
    ("How many employees in Project State NH in Bangalore?", "226"),
    ("How many active employees in Project State AK in Bangalore?", "81"),
    ("How many active employees in Project State AK in Hyderabad?", "24"),
    ("How many active employees in Project State ND in Hyderabad?", "26"),
    ("How many active employees in Project State ND in Chennai?", "2"),
    ("How many active employees in Project State ND in Pune?", "1"),
    ("How many active employees in Project State ND in Bangalore?", "89"),
    ("How many exited employees in Project State ND in Bangalore?", "0"),
    ("How many active employees in Project State NH in Hyderabad?", "98"),
    ("How many exited employees in Project State NH in Hyderabad?", "23"),
    ("How many active employees in Core department?", "150"),
    ("How many employees in Core department?", "153"),
    ("How many exited employees in Core department?", "3"),
    ("How many active employees in QA department?", "22"),
    ("How many employees in QA department?", "22"),
    ("How many exited employees in QA department?", "0"),
    ("How many active employees in IT department?", "356"),
    ("How many employees in IT department?", "383"),
    ("How many exited employees in IT department?", "27"),
    ("How many active employees in Infra department?", "14"),
    ("How many employees in Infra department?", "16"),
    ("How many exited employees in Infra department?", "2"),
    ("How many active employees in Cognos department?", "10"),
    ("How many employees in Cognos department?", "10"),
    ("How many active employees in Informatica department?", "5"),
    ("How many employees in Informatica department?", "6"),
    ("How many exited employees in Informatica department?", "1"),
    ("How many employees in Project State NH in Core department?", "67"),
    ("How many active employees in Project State NH in Core department?", "64"),
    ("How many employees in Project State NH in QA department?", "6"),
    ("How many active employees in Project State NH in QA department?", "6"),
    ("How many employees in Project State ND in Core department?", "50"),
    ("How many active employees in Project State ND in Core department?", "50"),
    ("How many employees in Project State AK in Core department?", "36"),
    ("How many active employees in Project State AK in Core department?", "36"),
    ("How many employees in Bangalore in Core department?", "125"),
    ("How many active employees in Bangalore in Core department?", "124"),
    ("How many employees in Project State NH in IT department?", "272")
]

class TestCombinatorialFilterCompositions:
    @pytest.mark.parametrize("query,expected_count", COMBINATORIAL_CASES)
    def test_combinatorial_filters(self, query, expected_count):
        res = llm_orchestrator.process(query)
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert expected_count in res["answer"]
        assert res["llm_calls"] == 0


# =====================================================================
# SUITE 6: CONVERSATIONAL FOLLOW-UPS & CONTEXT INHERITANCE (25 Tests)
# Gate E
# =====================================================================
class TestConversationalFollowUps:
    def test_bangalore_total_then_active(self):
        hist = [{"role": "user", "content": "How many employees in Bangalore?"}, {"role": "assistant", "content": "There are 396 employees in Bangalore."}]
        res = llm_orchestrator.process("How many of them are active?", history=hist)
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "386" in res["answer"]
        assert res["llm_calls"] == 0

    def test_bangalore_total_then_leavers(self):
        hist = [{"role": "user", "content": "How many employees in Bangalore?"}, {"role": "assistant", "content": "There are 396 employees in Bangalore."}]
        res = llm_orchestrator.process("How many have left?", history=hist)
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "10" in res["answer"]
        assert res["llm_calls"] == 0

    def test_nh_total_then_active(self):
        hist = [{"role": "user", "content": "How many employees in Project State NH?"}, {"role": "assistant", "content": "There are 364 employees in Project State NH."}]
        res = llm_orchestrator.process("How many of them are active?", history=hist)
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "331" in res["answer"]
        assert res["llm_calls"] == 0

    def test_nh_total_then_leavers(self):
        hist = [{"role": "user", "content": "How many employees in Project State NH?"}, {"role": "assistant", "content": "There are 364 employees in Project State NH."}]
        res = llm_orchestrator.process("How many left?", history=hist)
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "33" in res["answer"]
        assert res["llm_calls"] == 0

    def test_nd_total_then_active(self):
        hist = [{"role": "user", "content": "How many employees in Project State ND?"}, {"role": "assistant", "content": "There are 118 employees in Project State ND."}]
        res = llm_orchestrator.process("How many of them are active?", history=hist)
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "118" in res["answer"]
        assert res["llm_calls"] == 0

    def test_nd_total_then_leavers(self):
        hist = [{"role": "user", "content": "How many employees in Project State ND?"}, {"role": "assistant", "content": "There are 118 employees in Project State ND."}]
        res = llm_orchestrator.process("How many left?", history=hist)
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "0" in res["answer"]
        assert res["llm_calls"] == 0

    def test_hyderabad_total_then_active(self):
        hist = [{"role": "user", "content": "How many employees in Hyderabad?"}, {"role": "assistant", "content": "There are 171 employees in Hyderabad."}]
        res = llm_orchestrator.process("How many of them are active?", history=hist)
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "148" in res["answer"]
        assert res["llm_calls"] == 0

    def test_hyderabad_total_then_leavers(self):
        hist = [{"role": "user", "content": "How many employees in Hyderabad?"}, {"role": "assistant", "content": "There are 171 employees in Hyderabad."}]
        res = llm_orchestrator.process("How many have left?", history=hist)
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "23" in res["answer"]
        assert res["llm_calls"] == 0

    def test_comparison_followup_state(self):
        hist = [{"role": "user", "content": "Compare headcount in ND and NH"}, {"role": "assistant", "content": "NH has 364, ND has 118"}]
        res = llm_orchestrator.process("Which one has more?", history=hist)
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "NH" in res["answer"]
        assert res["llm_calls"] == 0

    def test_comparison_followup_location(self):
        hist = [{"role": "user", "content": "Compare employees in Bangalore and Hyderabad"}, {"role": "assistant", "content": "Bangalore has 396, Hyderabad has 171"}]
        res = llm_orchestrator.process("Which one has more?", history=hist)
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "Bangalore" in res["answer"]
        assert res["llm_calls"] == 0

    @pytest.mark.parametrize("emp_id", [1000177, 1000900, 1003859, 1004044, 1004641])
    def test_employee_lookup_by_id(self, emp_id):
        res = llm_orchestrator.process(f"Lookup employee {emp_id}")
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert str(emp_id) in res["answer"]
        assert res["llm_calls"] == 0

    @pytest.mark.parametrize("emp_id", [1000177, 1000900, 1003859, 1004044, 1004641])
    def test_employee_salary_followup(self, emp_id):
        hist = [{"role": "user", "content": f"Lookup employee {emp_id}"}, {"role": "assistant", "content": f"Details for {emp_id}", "data": {"rows": [{"employee_number": emp_id, "employee_label": f"Employee ({emp_id})"}]}}]
        res = llm_orchestrator.process("What is their salary?", history=hist)
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert res["llm_calls"] == 0

    @pytest.mark.parametrize("emp_id", [1000177, 1000900, 1003859, 1004044, 1004641])
    def test_employee_manager_followup(self, emp_id):
        hist = [{"role": "user", "content": f"Lookup employee {emp_id}"}, {"role": "assistant", "content": f"Details for {emp_id}", "data": {"rows": [{"employee_number": emp_id, "employee_label": f"Employee ({emp_id})"}]}}]
        res = llm_orchestrator.process("Who is their manager?", history=hist)
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert res["llm_calls"] == 0


# =====================================================================
# SUITE 7: SECURITY, RBAC & INJECTION DEFENSE (30 Tests)
# Gate F
# =====================================================================
SQL_INJECTION_ATTEMPTS = [
    "' OR '1'='1",
    "'; DROP TABLE employees; --",
    "1000177 OR 1=1",
    "' UNION SELECT * FROM sqlite_master --",
    "' UNION SELECT username, password FROM users --",
    "' OR current_status = 'Active' --",
    "' AND 1=(SELECT COUNT(*) FROM employees) --",
    "'; UPDATE employees SET annual_ctc = 9999999; --",
    "'; DELETE FROM employees; --",
    "' OR ''='"
]

class TestSecurityRBACAndInjection:
    @pytest.mark.parametrize("payload", SQL_INJECTION_ATTEMPTS)
    def test_sql_injection_sanitization_in_state(self, payload):
        q = f"How many employees in state {payload}?"
        res = llm_orchestrator.process(q)
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "0" in res["answer"]

    @pytest.mark.parametrize("payload", SQL_INJECTION_ATTEMPTS)
    def test_sql_injection_sanitization_in_location(self, payload):
        q = f"How many employees in location {payload}?"
        res = llm_orchestrator.process(q)
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "0" in res["answer"]

    @pytest.mark.parametrize("role,expected_auth", [
        ("EMPLOYEE", True),
        ("HR", True),
        ("FINANCE", True),
        ("EXECUTIVE", True)
    ])
    def test_standard_headcount_authorized_for_all_roles(self, role, expected_auth):
        ctx = SecurityContext.from_request(user_role=role)
        assert ctx.is_capability_authorized(CapabilityEnum.HEADCOUNT) == expected_auth

    @pytest.mark.parametrize("role,doc_tag,expected_access", [
        ("EMPLOYEE", "ALL", True),
        ("EMPLOYEE", "EMPLOYEE", True),
        ("EMPLOYEE", "EXECUTIVE", False),
        ("HR", "EMPLOYEE", True),
        ("HR", "EXECUTIVE", False),
        ("EXECUTIVE", "EXECUTIVE", True)
    ])
    def test_rbac_document_level_authorization(self, role, doc_tag, expected_access):
        ctx = SecurityContext.from_request(user_role=role)
        assert ctx.is_document_authorized({doc_tag}) == expected_access


# =====================================================================
# SUITE 8: RAG GROUNDING & ZERO-EVIDENCE REFUSAL (15 Tests)
# Gate C
# =====================================================================
UNSUPPORTED_DOMAINS_LIST = [
    "What is the weather in New York?",
    "What is the cricket score today?",
    "Tell me a recipe for chocolate cake",
    "What is the current stock price of Apple?",
    "Who is the president of France?",
    "What is the price of Bitcoin?",
    "Can I buy movie tickets with company expense?",
    "What is my daily horoscope?"
]

class TestRAGGroundingAndZeroEvidence:
    @pytest.mark.parametrize("q", UNSUPPORTED_DOMAINS_LIST)
    def test_unsupported_domains_immediate_refusal(self, q):
        res = llm_orchestrator.process(q)
        assert res["intent"] == "UNSUPPORTED_DOMAIN"
        assert res["status"] == "REFUSAL"
        assert res["llm_calls"] == 0
        assert res["model_calls"] == 0
        assert res["rag_calls"] == 0

    def test_cryptocurrency_negative_policy_refusal(self):
        res = llm_orchestrator.process("Can I get reimbursed for cryptocurrency purchases?")
        assert res["intent"] in ("LLM_UNSUPPORTED", "RAG_NO_EVIDENCE", "AI_UNAVAILABLE", "PLANNER_FAILED")
        ans_low = res["answer"].lower()
        assert any(phrase in ans_low for phrase in ["no policy or record found", "no policy or record", "no verified organizational policy", "no records were found", "no record", "offline", "unavailable", "unable to process", "planner", "failed", "zero-trust"])

    def test_grounding_blocks_ungrounded_fabricated_claim(self):
        res = llm_orchestrator.process("Does ETS offer gold bullion as retention bonus?")
        assert res["intent"] in ("LLM_UNSUPPORTED", "RAG_NO_EVIDENCE", "AI_UNAVAILABLE", "PLANNER_FAILED")


# =====================================================================
# SUITE 9: OFFLINE RESILIENCE GATE (10 Tests)
# Gate G
# =====================================================================
OFFLINE_DETERMINISTIC_QUERIES = [
    "How many employees in Bangalore?",
    "How many active employees in Bangalore?",
    "How many employees have left in Bangalore?",
    "How many employees in Project State NH?",
    "How many active employees in Project State NH?",
    "How many employees in Project State ND?",
    "How many employees in Project State ZZ?",
    "How many employees in Delhi?",
    "How many employees are there in ETS?",
    "What is the cumulative attrition rate?",
    "which age group we have more employees?",
    "what is our workforce age distribution?"
]

class TestOfflineResilience:
    @pytest.mark.parametrize("query", OFFLINE_DETERMINISTIC_QUERIES)
    def test_offline_execution_succeeds_with_zero_llm(self, query):
        with patch.object(ollama_client, "is_available", return_value=False):
            res = llm_orchestrator.process(query)
            assert res["intent"] == "DETERMINISTIC_SQL"
            assert res["llm_calls"] == 0
            assert res["model_calls"] == 0
            assert res["rag_calls"] == 0
            assert res["execution_trace"]["llm_required"] is False

class TestAgeDemographicIntelligence:
    def test_which_age_group_more_employees(self):
        res = llm_orchestrator.process("which age group we have more employees?")
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "25-29" in res["answer"]
        assert any(cnt in res["answer"] for cnt in ("219", "220", "221"))
        assert res["confidence"] == 1.0

    def test_workforce_age_distribution(self):
        res = llm_orchestrator.process("what is our workforce age distribution?")
        assert res["intent"] == "DETERMINISTIC_SQL"
        assert "25-29" in res["answer"]
        assert any(cnt in res["answer"] for cnt in ("219", "220", "221"))
        assert res["chart_type"] == "bar"
        assert len(res["chart_data"]) >= 6

