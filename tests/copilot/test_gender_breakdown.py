import pytest
from backend.app.ai.orchestrator import llm_orchestrator
from backend.app.ai.capability_registry import CapabilityEnum

def test_headcount_and_gender_split():
    res = llm_orchestrator.process("What is the total headcount and gender split?")
    assert res["intent"] == "DETERMINISTIC_SQL"
    assert res["execution_trace"]["capability"] == CapabilityEnum.GENDER_BREAKDOWN
    assert res["execution_trace"]["deterministic_route"] is True
    assert res["execution_trace"]["grounded"] is True
    assert res["execution_trace"]["invariants_validated"] is True
    assert res["llm_calls"] == 0
    assert "590" in res["answer"]
    assert "Male: 408 (69.2%)" in res["answer"]
    assert "Female: 182 (30.8%)" in res["answer"]
    assert len(res["data"]["rows"]) == 2
    assert res["chart_data"] == [{"name": "Male", "value": 408}, {"name": "Female", "value": 182}]

def test_gender_breakdown_active():
    res = llm_orchestrator.process("Gender breakdown of active employees")
    assert res["intent"] == "DETERMINISTIC_SQL"
    assert res["execution_trace"]["capability"] == CapabilityEnum.GENDER_BREAKDOWN
    assert "557 active employees" in res["answer"]
    assert "Male: 376 (67.5%)" in res["answer"]
    assert "Female: 181 (32.5%)" in res["answer"]

def test_which_gender_most():
    res = llm_orchestrator.process("Which gender has the most employees?")
    assert res["intent"] == "DETERMINISTIC_SQL"
    assert res["execution_trace"]["capability"] == CapabilityEnum.GENDER_BREAKDOWN
    assert "Male" in res["answer"]
    assert "408" in res["answer"]

def test_pure_headcount_remains_headcount():
    res = llm_orchestrator.process("What is the total headcount?")
    assert res["execution_trace"]["capability"] == CapabilityEnum.HEADCOUNT
    assert "590" in res["answer"]
