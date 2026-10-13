import pytest
from typing import Dict, Any
from backend.app.ai.orchestrator import llm_orchestrator
from backend.app.ai.model_gateway import ModelGateway

def assert_zero_llm(res: Dict[str, Any]):
    assert res.get("llm_calls", -1) == 0, f"Expected llm_calls == 0, got {res.get('llm_calls')}"
    assert res.get("model_calls", -1) == 0, f"Expected model_calls == 0, got {res.get('model_calls')}"
    assert res["execution_trace"]["deterministic_route"] is True
    assert res["execution_trace"]["llm_required"] is False
    assert res["execution_trace"]["grounded"] is True
    assert res["execution_trace"]["invariants_validated"] is True
    assert res["confidence"] == 1.0

class TestMultiRequirementArchitecture:
    """
    General Multi-Requirement Deterministic Architecture Verification Suite.
    Tests that compound queries with multiple atomic requirements are decomposed,
    executed deterministically with ZERO LLM calls for structured data, validated
    against partition and completeness invariants, and synthesized completely without dropping requirements.
    """

    def test_multi_metric_headcount_and_avg_salary(self):
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process("What is the headcount and average salary?")
        assert_zero_llm(res)
        assert "590" in res["answer"]
        assert "776,779.66" in res["answer"] or "776779.66" in res["answer"]
        assert len(res["insights"]) >= 2
        assert ModelGateway.get_invocation_count() == 0

    def test_multi_metric_headcount_and_total_salary(self):
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process("What is the total headcount and total salary?")
        assert_zero_llm(res)
        assert "590" in res["answer"]
        assert "458,300,000" in res["answer"] or "458300000" in res["answer"]
        assert ModelGateway.get_invocation_count() == 0

    def test_multi_metric_avg_salary_and_max_salary(self):
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process("What is the average salary and highest salary?")
        assert_zero_llm(res)
        assert "776,779.66" in res["answer"] or "776779.66" in res["answer"]
        assert "5,000,000" in res["answer"] or "5000000" in res["answer"]
        assert ModelGateway.get_invocation_count() == 0

    def test_multi_metric_active_and_exited(self):
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process("How many employees are active and how many have exited?")
        assert_zero_llm(res)
        assert "557" in res["answer"]
        assert "33" in res["answer"]
        assert ModelGateway.get_invocation_count() == 0

    def test_composite_breakdown_gender_and_department(self):
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process("Show the headcount by gender and department.")
        assert_zero_llm(res)
        assert "Male" in res["answer"] and "IT" in res["answer"]
        assert "Female" in res["answer"] and "Core" in res["answer"]
        assert res["chart_data"] is not None
        assert ModelGateway.get_invocation_count() == 0

    def test_breakdown_headcount_and_avg_salary_by_dept(self):
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process("What is the headcount and average salary by department?")
        assert_zero_llm(res)
        assert "IT" in res["answer"] and "383" in res["answer"]
        assert "Core" in res["answer"] and "153" in res["answer"]
        assert "882,810.46" in res["answer"] or "882810.46" in res["answer"]
        assert ModelGateway.get_invocation_count() == 0

    def test_avg_salary_by_department(self):
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process("What is the average salary by department?")
        assert_zero_llm(res)
        assert "Core" in res["answer"]
        assert "882,810.46" in res["answer"] or "882810.46" in res["answer"]
        assert "IT" in res["answer"]
        assert ModelGateway.get_invocation_count() == 0

    def test_mixed_three_requirements(self):
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process("How many active employees are there, which department is largest, and what is the average salary?")
        assert_zero_llm(res)
        assert "557" in res["answer"]
        assert "IT" in res["answer"]
        assert "629,192.10" in res["answer"] or "629192.10" in res["answer"]
        assert ModelGateway.get_invocation_count() == 0

    def test_total_headcount_gender_split_and_avg_salary(self):
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process("What is the total headcount, gender split, and average salary?")
        assert_zero_llm(res)
        assert "590" in res["answer"]
        assert "Male: 408" in res["answer"]
        assert "Female: 182" in res["answer"]
        assert "776,779.66" in res["answer"] or "776779.66" in res["answer"]
        assert ModelGateway.get_invocation_count() == 0

    def test_multi_location_workforce_percentages(self):
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process("What is the headcount in Bangalore, Hyderabad, and Chennai and what percentage of the workforce does each represent?")
        assert_zero_llm(res)
        assert "Bangalore: 396" in res["answer"]
        assert "67.1%" in res["answer"]
        assert "Hyderabad: 171" in res["answer"]
        assert "29.0%" in res["answer"]
        assert "Chennai: 13" in res["answer"]
        assert "2.2%" in res["answer"]
        assert ModelGateway.get_invocation_count() == 0

    def test_ranked_subset_bottom_locations(self):
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process("Bottom 3 locations by active headcount.")
        assert_zero_llm(res)
        assert "Pune" in res["answer"] and "10" in res["answer"]
        assert "Chennai" in res["answer"] and "13" in res["answer"]
        assert "Hyderabad" in res["answer"] and "148" in res["answer"]
        assert ModelGateway.get_invocation_count() == 0

    def test_ranked_subset_top_departments_avg_salary(self):
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process("Top 3 departments by average salary.")
        assert_zero_llm(res)
        assert "Core" in res["answer"] and "882,810.46" in res["answer"]
        assert "Cognos" in res["answer"] and "827,000.00" in res["answer"]
        assert "Infra" in res["answer"] and "793,125.00" in res["answer"]
        assert ModelGateway.get_invocation_count() == 0

    def test_compound_sql_and_unsupported_cryptocurrency(self):
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process("What is the headcount and tell me something about cryptocurrency?")
        # Structured data part answered deterministically with 0 LLM calls
        assert res.get("llm_calls", -1) == 0
        assert "590" in res["answer"]
        assert "cryptocurrency" in res["answer"].lower()
        assert "outside ets records" in res["answer"].lower() or "cannot be answered" in res["answer"].lower()
        assert ModelGateway.get_invocation_count() == 0

    def test_compound_sql_and_unsupported_finance(self):
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process("What is the gender split and explain billable utilization?")
        assert res.get("llm_calls", -1) == 0
        assert "Male: 408" in res["answer"]
        assert "Female: 182" in res["answer"]
        assert "billable utilization" in res["answer"].lower()
        assert "outside ets records" in res["answer"].lower() or "cannot be answered" in res["answer"].lower()
        assert ModelGateway.get_invocation_count() == 0

    def test_compound_sql_and_rag_policy(self):
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process("What is the current headcount and what are the promotion hike criteria?")
        assert res.get("llm_calls", -1) == 0
        assert "557" in res["answer"]
        assert "promotion" in res["answer"].lower()
        assert ModelGateway.get_invocation_count() == 0
