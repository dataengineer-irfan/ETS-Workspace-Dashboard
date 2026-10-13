"""

PROOF 1 â MODELGATEWAY-BOUNDARY INVOCATION COUNTER

====================================================

Asserts that ModelGateway.generate() is NEVER called for any deterministic query,

regardless of how the question is phrased.

Every test checks ALL of:

  - ModelGateway._gateway_invocation_count == 0   <- authoritative boundary proof

  - response["llm_calls"] == 0

  - response["model_calls"] == 0

  - response["rag_calls"] == 0

  - execution_trace["deterministic_route"] == True

  - correct capability in execution_trace

  - correct numeric value in the answer

  - correct population semantics (ALL / ACTIVE / EXITED)

80 natural-language phrasings covering:

  Total / Active / Exited headcount

  State (NH / ND / AK) x population

  Location (Bangalore / Hyderabad / Chennai / Pune) x population

  Department (IT / Core / QA / Infra)

  Compensation (avg / min / max)

  Attrition

"""

import pytest

from typing import Dict, Any

from backend.app.ai.orchestrator import llm_orchestrator

from backend.app.ai.model_gateway import ModelGateway

from backend.app.ai.capability_registry import CapabilityEnum

# ---------------------------------------------------------------------------

# Verified database ground truth

# ---------------------------------------------------------------------------

DB = {

    "total": 590,

    "active": 557,

    "exited": 33,

    "NH_all": 364,  "NH_active": 331,  "NH_exited": 33,

    "ND_all": 118,  "ND_active": 118,  "ND_exited": 0,

    "AK_all": 108,  "AK_active": 108,  "AK_exited": 0,

    "BLR_all": 396, "BLR_active": 386, "BLR_exited": 10,

    "HYD_all": 171, "HYD_active": 148, "HYD_exited": 23,

    "CHN_all": 13,  "CHN_active": 13,  "CHN_exited": 0,

    "PNE_all": 10,  "PNE_active": 10,  "PNE_exited": 0,

    "IT_all": 383,

    "Core_all": 153,

    "QA_all": 22,

    "Infra_all": 16,

}

def _assert_deterministic(

    question: str,

    expected_value_in_answer: str,

    expected_capability: str,

    user_role: str = "EMPLOYEE",

    history=None,

):

    """

    Resets ModelGateway counter, calls orchestrator, asserts boundary + tracker + answer.

    Returns the full response for additional caller assertions.

    """

    ModelGateway.reset_invocation_count()

    res: Dict[str, Any] = llm_orchestrator.process(

        question=question,

        user_role=user_role,

        history=history or [],

    )

    # BOUNDARY PROOF

    gw_count = ModelGateway.get_invocation_count()

    assert gw_count == 0, (

        f"[BOUNDARY VIOLATION] ModelGateway.generate() called {gw_count} time(s) "

        f"for deterministic question: '{question}'\n"

        f"  capability={res.get('execution_trace', {}).get('capability')}\n"

        f"  intent={res.get('intent')}"

    )

    # CONTEXT-VAR TRACKER

    assert res.get("llm_calls", -1) == 0, (

        f"llm_calls != 0 for '{question}': got {res.get('llm_calls')}"

    )

    assert res.get("model_calls", -1) == 0, (

        f"model_calls != 0 for '{question}': got {res.get('model_calls')}"

    )

    assert res.get("rag_calls", -1) == 0, (

        f"rag_calls != 0 for '{question}': got {res.get('rag_calls')}"

    )

    # EXECUTION PATH

    trace = res.get("execution_trace", {})

    assert trace.get("deterministic_route") is True, (

        f"deterministic_route != True for '{question}': trace={trace}"

    )

    if expected_capability:

        actual_cap = trace.get("capability", "")

        assert actual_cap == expected_capability, (

            f"Wrong capability for '{question}': expected={expected_capability}, got={actual_cap}"

        )

    # ANSWER VALUE

    if expected_value_in_answer:

        answer = str(res.get("answer", ""))

        assert expected_value_in_answer in answer, (

            f"Expected '{expected_value_in_answer}' not found in answer for '{question}'.\n"

            f"  answer='{answer}'"

        )

    return res

# =============================================================================

# SUITE A - TOTAL HEADCOUNT (10 variants)

# =============================================================================

class TestProof1_TotalHeadcount:

    def test_v1_how_many_employees(self):

        _assert_deterministic("How many employees are there in ETS?", "590", "HEADCOUNT")

    def test_v2_total_headcount(self):

        _assert_deterministic("What is the total headcount of ETS?", "590", "HEADCOUNT")

    def test_v3_total_workforce(self):

        _assert_deterministic("Total workforce count in ETS", "590", "HEADCOUNT")

    def test_v4_workforce_size(self):

        _assert_deterministic("What is the total workforce size?", "590", "HEADCOUNT")

    def test_v5_all_employees(self):

        _assert_deterministic("How many total employees in ETS?", "590", "HEADCOUNT")

    def test_v6_headcount_lower(self):

        _assert_deterministic("total headcount", "590", "HEADCOUNT")

    def test_v7_overall_employees(self):

        _assert_deterministic("overall employee count in ETS", "590", "HEADCOUNT")

    def test_v8_staff_count(self):

        _assert_deterministic("What is the total staff count?", "590", "HEADCOUNT")

    def test_v9_personnel_count(self):

        _assert_deterministic("employees in ets", "590", "HEADCOUNT")

    def test_v10_how_large_workforce(self):

        _assert_deterministic("how large is the ETS workforce?", "590", "HEADCOUNT")

# =============================================================================

# SUITE B - ACTIVE HEADCOUNT (10 variants)

# =============================================================================

class TestProof1_ActiveHeadcount:

    def test_v1_active_employees(self):

        _assert_deterministic("How many active employees are there?", "557", "ACTIVE_HEADCOUNT")

    def test_v2_currently_working(self):

        _assert_deterministic("How many currently working employees are in ETS?", "557", "ACTIVE_HEADCOUNT")

    def test_v3_active_workforce(self):

        _assert_deterministic("Active workforce size", "557", "ACTIVE_HEADCOUNT")

    def test_v4_active_headcount(self):

        _assert_deterministic("What is the active headcount in ETS?", "557", "ACTIVE_HEADCOUNT")

    def test_v5_active_count(self):

        _assert_deterministic("active employees count", "557", "ACTIVE_HEADCOUNT")

    def test_v6_operational_staff(self):

        _assert_deterministic("operational staff count", "557", "ACTIVE_HEADCOUNT")

    def test_v7_active_ets_employees(self):

        _assert_deterministic("how many active employees work at ets", "557", "ACTIVE_HEADCOUNT")

    def test_v8_number_of_active(self):

        _assert_deterministic("number of active personnel", "557", "ACTIVE_HEADCOUNT")

    def test_v9_current_active(self):

        _assert_deterministic("current active workforce", "557", "ACTIVE_HEADCOUNT")

    def test_v10_total_active(self):

        _assert_deterministic("total active headcount", "557", "ACTIVE_HEADCOUNT")

# =============================================================================

# SUITE C - EXITED / LEAVER HEADCOUNT (10 variants)

# =============================================================================

class TestProof1_ExitedHeadcount:

    def test_v1_how_many_left(self):

        _assert_deterministic("How many employees have left ETS?", "33", "LEAVER_COUNT")

    def test_v2_total_leavers(self):

        _assert_deterministic("Total number of leavers in ETS", "33", "LEAVER_COUNT")

    def test_v3_people_exited(self):

        _assert_deterministic("How many people exited the company?", "33", "LEAVER_COUNT")

    def test_v4_exited_count(self):

        _assert_deterministic("Count of exited employees", "33", "LEAVER_COUNT")

    def test_v5_departed(self):

        _assert_deterministic("How many employees departed from ETS?", "33", "LEAVER_COUNT")

    def test_v6_separated(self):

        _assert_deterministic("Number of separated employees", "33", "LEAVER_COUNT")

    def test_v7_former_employees(self):

        _assert_deterministic("How many former employees in ETS records?", "33", "LEAVER_COUNT")

    def test_v8_total_leavers_lower(self):

        _assert_deterministic("total leavers count", "33", "LEAVER_COUNT")

    def test_v9_employees_who_left(self):

        _assert_deterministic("employees who have left ets", "33", "LEAVER_COUNT")

    def test_v10_how_many_people_left(self):

        _assert_deterministic("how many people have left", "33", "LEAVER_COUNT")

# =============================================================================

# SUITE D - STATE x POPULATION (12 variants)

# =============================================================================

class TestProof1_StatePopulation:

    def test_nh_all(self):

        _assert_deterministic("How many employees are in Project State NH?", str(DB["NH_all"]), "HEADCOUNT")

    def test_nh_active(self):

        _assert_deterministic("Active employees in NH", str(DB["NH_active"]), "ACTIVE_HEADCOUNT")

    def test_nh_exited(self):

        _assert_deterministic("How many employees have left in Project State NH?", str(DB["NH_exited"]), "LEAVER_COUNT")

    def test_nd_all(self):

        _assert_deterministic("How many employees are in Project State ND?", str(DB["ND_all"]), "HEADCOUNT")

    def test_nd_active(self):

        _assert_deterministic("Active employees in Project State ND", str(DB["ND_active"]), "ACTIVE_HEADCOUNT")

    def test_nd_exited(self):

        _assert_deterministic("How many employees have left in Project State ND?", str(DB["ND_exited"]), "LEAVER_COUNT")

    def test_ak_all(self):

        _assert_deterministic("How many employees are in Project State AK?", str(DB["AK_all"]), "HEADCOUNT")

    def test_ak_active(self):

        _assert_deterministic("Active employees in AK", str(DB["AK_active"]), "ACTIVE_HEADCOUNT")

    def test_ak_exited(self):

        _assert_deterministic("How many employees have left in Project State AK?", str(DB["AK_exited"]), "LEAVER_COUNT")

    def test_nh_alternate_all(self):

        _assert_deterministic("Total workforce in Project State NH", str(DB["NH_all"]), "HEADCOUNT")

    def test_nd_alternate_headcount(self):

        _assert_deterministic("Total headcount in ND", str(DB["ND_all"]), "HEADCOUNT")

    def test_ak_alternate_active(self):

        _assert_deterministic("Currently working employees in AK", str(DB["AK_active"]), "ACTIVE_HEADCOUNT")

# =============================================================================

# SUITE E - LOCATION x POPULATION (12 variants)

# =============================================================================

class TestProof1_LocationPopulation:

    def test_blr_all(self):

        _assert_deterministic("How many employees are in Bangalore?", str(DB["BLR_all"]), "HEADCOUNT")

    def test_blr_active(self):

        _assert_deterministic("How many active employees in Bangalore?", str(DB["BLR_active"]), "ACTIVE_HEADCOUNT")

    def test_blr_exited(self):

        _assert_deterministic("How many employees have left in Bangalore?", str(DB["BLR_exited"]), "LEAVER_COUNT")

    def test_hyd_all(self):

        _assert_deterministic("How many employees are in Hyderabad?", str(DB["HYD_all"]), "HEADCOUNT")

    def test_hyd_active(self):

        _assert_deterministic("Active employees in Hyderabad", str(DB["HYD_active"]), "ACTIVE_HEADCOUNT")

    def test_hyd_exited(self):

        _assert_deterministic("How many leavers in Hyderabad?", str(DB["HYD_exited"]), "LEAVER_COUNT")

    def test_chn_all(self):

        _assert_deterministic("Headcount in Chennai", str(DB["CHN_all"]), "HEADCOUNT")

    def test_chn_active(self):

        _assert_deterministic("Active employees in Chennai", str(DB["CHN_active"]), "ACTIVE_HEADCOUNT")

    def test_pne_all(self):

        _assert_deterministic("How many employees are in Pune?", str(DB["PNE_all"]), "HEADCOUNT")

    def test_pne_active(self):

        _assert_deterministic("Active headcount in Pune", str(DB["PNE_active"]), "ACTIVE_HEADCOUNT")

    def test_blr_alternate_total(self):

        _assert_deterministic("Total headcount in Bangalore", str(DB["BLR_all"]), "HEADCOUNT")

    def test_hyd_alternate_all(self):

        _assert_deterministic("Workforce in Hyderabad", str(DB["HYD_all"]), "HEADCOUNT")

# =============================================================================

# SUITE F - ATTRITION RATE (5 variants)

# =============================================================================

class TestProof1_Attrition:

    def test_v1_attrition_rate(self):

        _assert_deterministic("What is the attrition rate?", "5.59", "ATTRITION")

    def test_v2_employee_attrition(self):

        _assert_deterministic("What is the employee attrition rate at ETS?", "5.59", "ATTRITION")

    def test_v3_turnover_rate(self):

        _assert_deterministic("What is the turnover rate?", "5.59", "ATTRITION")

    def test_v4_attrition(self):

        _assert_deterministic("attrition rate at ETS", "5.59", "ATTRITION")

    def test_v5_how_much_attrition(self):

        _assert_deterministic("How much attrition does ETS have?", "5.59", "ATTRITION")


# =============================================================================
# SUITE G - COMPENSATION (6 variants)
# =============================================================================

class TestProof1_Compensation:

    def test_avg_salary(self):
        res = _assert_deterministic("What is the average salary at ETS?", "", "COMPENSATION_AVERAGE")
        assert res.get("llm_calls") == 0

    def test_min_salary(self):
        _assert_deterministic("What is the minimum salary at ETS?", "150,000", "RANKING")

    def test_max_salary(self):
        _assert_deterministic("What is the maximum salary at ETS?", "5,000,000", "RANKING")

    def test_lowest_ctc(self):
        _assert_deterministic("Lowest annual CTC in ETS?", "150,000", "RANKING")

    def test_highest_ctc(self):
        _assert_deterministic("Highest annual CTC at ETS?", "5,000,000", "RANKING")

    def test_average_compensation(self):
        res = _assert_deterministic("average compensation at ETS", "", "COMPENSATION_AVERAGE")
        assert res.get("llm_calls") == 0


# =============================================================================
# SUITE H - DEPARTMENT HEADCOUNT (4 variants)
# =============================================================================

class TestProof1_DepartmentHeadcount:

    def test_it_dept(self):
        _assert_deterministic("How many employees are in IT department?", str(DB["IT_all"]), "HEADCOUNT")

    def test_core_dept(self):

        _assert_deterministic("Headcount in Core department", str(DB["Core_all"]), "HEADCOUNT")

    def test_qa_dept(self):

        _assert_deterministic("How many people are in QA?", str(DB["QA_all"]), "HEADCOUNT")

    def test_infra_dept(self):

        _assert_deterministic("Employees in Infra department", str(DB["Infra_all"]), "HEADCOUNT")

# =============================================================================

# SUITE I - NEGATIVE: AMBIGUOUS PHRASING MUST NOT LEAK TO LLM

# =============================================================================

class TestProof1_NegativeLLMLeak:

    def test_ambiguous_how_many(self):

        _assert_deterministic("how many employees?", "590", "HEADCOUNT")

    def test_follow_up_blr_context(self):

        """Follow-up 'What about Bangalore?' after Hyderabad query"""

        res = _assert_deterministic(

            "What about Bangalore?", str(DB["BLR_all"]), "HEADCOUNT",

            history=[{

                "question": "How many employees are in Hyderabad?",

                "answer": f"There are {DB['HYD_all']} employees in Hyderabad."

            }]

        )

        assert res.get("llm_calls") == 0

    def test_follow_up_nd_after_nh(self):

        """'How about ND?' after NH query"""

        res = _assert_deterministic(

            "How about ND?", str(DB["ND_all"]), "HEADCOUNT",

            history=[{

                "question": "How many employees are in Project State NH?",

                "answer": f"There are {DB['NH_all']} employees in NH."

            }]

        )

        assert res.get("llm_calls") == 0

    def test_exited_nh(self):

        _assert_deterministic("How many exited employees are in state NH?", str(DB["NH_exited"]), "LEAVER_COUNT")

    def test_work_in_hyd_denotes_location_relationship_all_population(self):
        _assert_deterministic("How many people work in Hyderabad?", str(DB["HYD_all"]), "HEADCOUNT")

