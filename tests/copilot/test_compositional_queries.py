import pytest
from typing import Dict, Any
from backend.app.ai.orchestrator import llm_orchestrator
from backend.app.ai.capability_registry import CapabilityEnum
from backend.app.ai.model_gateway import ModelGateway

def assert_zero_llm_deterministic(res: Dict[str, Any]):
    assert res["intent"] == "DETERMINISTIC_SQL"
    assert res.get("llm_calls", -1) == 0
    assert res.get("model_calls", -1) == 0
    assert res.get("rag_calls", -1) == 0
    assert res["execution_trace"]["deterministic_route"] is True
    assert res["execution_trace"]["llm_required"] is False
    assert res["execution_trace"]["grounded"] is True
    assert res["execution_trace"]["invariants_validated"] is True
    assert res["confidence"] == 1.0

class TestCompositionalQueriesMatrix:
    """
    Compositional Query Architecture Tests (Section 15-17).
    Validates that combinations of metrics, dimensions, filters, rankings,
    and output formats are handled compositionally WITHOUT creating separate capability enums.
    """

    def test_total_headcount_metric(self):
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process("What is the total headcount?")
        assert_zero_llm_deterministic(res)
        assert "590" in res["answer"]
        assert ModelGateway.get_invocation_count() == 0

    def test_gender_split_dimension(self):
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process("What is the gender split?")
        assert_zero_llm_deterministic(res)
        assert "408" in res["answer"] and "182" in res["answer"]
        assert "69.2%" in res["answer"] and "30.8%" in res["answer"]
        assert res["chart_data"] is not None
        assert ModelGateway.get_invocation_count() == 0

    def test_total_headcount_and_gender_split(self):
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process("What is the total headcount and gender split?")
        assert_zero_llm_deterministic(res)
        assert "590" in res["answer"]
        assert "Male: 408 (69.2%)" in res["answer"]
        assert "Female: 182 (30.8%)" in res["answer"]
        assert ModelGateway.get_invocation_count() == 0

    def test_headcount_by_gender(self):
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process("What is the headcount by gender?")
        assert_zero_llm_deterministic(res)
        assert "590" in res["answer"]
        assert "408" in res["answer"] and "182" in res["answer"]
        assert ModelGateway.get_invocation_count() == 0

    def test_active_headcount_and_gender_split(self):
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process("What is the active headcount and gender split?")
        assert_zero_llm_deterministic(res)
        assert "557 active employees" in res["answer"]
        assert "Male: 376 (67.5%)" in res["answer"]
        assert "Female: 181 (32.5%)" in res["answer"]
        assert ModelGateway.get_invocation_count() == 0

    def test_headcount_by_department(self):
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process("What is the headcount by department?")
        assert_zero_llm_deterministic(res)
        assert "IT" in res["answer"] and "383" in res["answer"]
        assert "Core" in res["answer"] and "153" in res["answer"]
        assert "QA" in res["answer"] and "22" in res["answer"]
        assert ModelGateway.get_invocation_count() == 0

    def test_total_headcount_and_department_split(self):
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process("What is the total headcount and department split?")
        assert_zero_llm_deterministic(res)
        assert "590" in res["answer"]
        assert "IT: 383 (64.9%)" in res["answer"]
        assert "Core: 153 (25.9%)" in res["answer"]
        assert ModelGateway.get_invocation_count() == 0

    def test_headcount_by_location(self):
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process("What is the headcount by location?")
        assert_zero_llm_deterministic(res)
        assert "Bangalore" in res["answer"] and "396" in res["answer"]
        assert "Hyderabad" in res["answer"] and "171" in res["answer"]
        assert "Chennai" in res["answer"] and "13" in res["answer"]
        assert "Pune" in res["answer"] and "10" in res["answer"]
        assert ModelGateway.get_invocation_count() == 0

    def test_active_headcount_by_location(self):
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process("What is the active headcount by location?")
        assert_zero_llm_deterministic(res)
        assert "557" in res["answer"]
        assert "Bangalore: 386 (69.3%)" in res["answer"]
        assert "Hyderabad: 148 (26.6%)" in res["answer"]
        assert ModelGateway.get_invocation_count() == 0

    def test_headcount_in_nh_by_gender(self):
        """Metric + Filter (State=NH) + Dimension (Gender)"""
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process("What is the headcount in NH by gender?")
        assert_zero_llm_deterministic(res)
        assert "364" in res["answer"]
        # In NH: Male=259, Female=105 (Total=364)
        # Percentage must be relative to NH cohort (364):
        # Male: 259 / 364 = 71.2%
        # Female: 105 / 364 = 28.8%
        assert "Male: 259 (71.2%)" in res["answer"]
        assert "Female: 105 (28.8%)" in res["answer"]
        assert ModelGateway.get_invocation_count() == 0

    def test_headcount_by_department_in_nh(self):
        """Metric + Filter (State=NH) + Dimension (Department)"""
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process("What is the headcount by department in NH?")
        assert_zero_llm_deterministic(res)
        assert "364" in res["answer"]
        assert "IT: 272 (74.7%)" in res["answer"]
        assert "Core: 67 (18.4%)" in res["answer"]
        assert ModelGateway.get_invocation_count() == 0

    def test_which_gender_most_employees(self):
        """Dimension (Gender) + Ranking (Most)"""
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process("Which gender has the most employees?")
        assert_zero_llm_deterministic(res)
        assert "Male" in res["answer"]
        assert "408" in res["answer"]
        assert "69.2%" in res["answer"]
        assert ModelGateway.get_invocation_count() == 0

    def test_which_department_most_employees(self):
        """Dimension (Department) + Ranking (Most)"""
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process("Which department has the most employees?")
        assert_zero_llm_deterministic(res)
        assert "IT" in res["answer"]
        assert "383" in res["answer"]
        assert "64.9%" in res["answer"]
        assert ModelGateway.get_invocation_count() == 0

    def test_top_5_departments_by_headcount(self):
        """Dimension (Department) + Ranking (Top 5)"""
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process("What are the top 5 departments by headcount?")
        assert_zero_llm_deterministic(res)
        assert "Top 5" in res["answer"]
        assert "IT" in res["answer"]
        assert "Core" in res["answer"]
        assert len(res["data"]["rows"]) == 5
        assert ModelGateway.get_invocation_count() == 0

    def test_exact_cohort_percentage_active_nh_gender(self):
        """Validates Section 8: Percentages derived from the same filtered cohort"""
        ModelGateway.reset_invocation_count()
        res = llm_orchestrator.process("Active employees gender split in NH")
        assert_zero_llm_deterministic(res)
        # Active in NH: Total = 331
        # Male: 227 / 331 = 68.6%
        # Female: 104 / 331 = 31.4%
        assert "331 active employees" in res["answer"]
        assert "Male: 227 (68.6%)" in res["answer"]
        assert "Female: 104 (31.4%)" in res["answer"]
        assert ModelGateway.get_invocation_count() == 0
