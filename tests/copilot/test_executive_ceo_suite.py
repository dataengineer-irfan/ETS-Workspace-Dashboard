import pytest
from typing import Dict, Any, List
from backend.app.ai.orchestrator import llm_orchestrator
from backend.app.ai.capability_registry import CapabilityEnum, capability_registry
from backend.app.models import CopilotQueryResponse

# =====================================================================
# SUITE: EXECUTIVE DECISION INTELLIGENCE (CEO / CFO / CTO QUESTION SET)
# 20 Benchmark Questions + Paraphrases + Hard Commercial Boundaries
# =====================================================================

EXECUTIVE_BENCHMARK_CASES = [
    # 1. Total annual salary cost
    ("What is our total annual salary cost?", CapabilityEnum.SALARY_TOTAL_COST, "DETERMINISTIC_SQL", ["350,460,000", "35.05 Cr", "557"]),
    ("what is our total payroll cost", CapabilityEnum.SALARY_TOTAL_COST, "DETERMINISTIC_SQL", ["350,460,000", "35.05 Cr"]),
    
    # 2. Grade consuming most salary cost
    ("Which grade consumes the most salary cost?", CapabilityEnum.SALARY_COST_BY_GRADE, "DETERMINISTIC_SQL", ["E1", "161,500,000", "35.2%"]),
    ("which grades consume the most salary cost", CapabilityEnum.SALARY_COST_BY_GRADE, "DETERMINISTIC_SQL", ["E1"]),
    
    # 3. Project highest salary cost
    ("Which project has the highest salary cost?", CapabilityEnum.SALARY_COST_BY_PROJECT, "DETERMINISTIC_SQL", ["NH", "322,280,000", "70.3%"]),
    ("project has the highest salary cost", CapabilityEnum.SALARY_COST_BY_PROJECT, "DETERMINISTIC_SQL", ["NH"]),
    
    # 4. Top 10 highest-paid employees share
    ("What percentage of salary cost sits with our top 10 highest-paid employees?", CapabilityEnum.SALARY_CONCENTRATION, "DETERMINISTIC_SQL", ["10.91%", "50,000,000"]),
    ("where is compensation concentrated", CapabilityEnum.SALARY_CONCENTRATION, "DETERMINISTIC_SQL", ["Project NH", "Bangalore"]),
    
    # 5. Maximum CTC employees
    ("How many employees are at the maximum CTC?", CapabilityEnum.MAX_CTC_DISTRIBUTION, "DETERMINISTIC_SQL", ["34", "5,000,000"]),
    ("how many employees are at max ctc", CapabilityEnum.MAX_CTC_DISTRIBUTION, "DETERMINISTIC_SQL", ["34", "50 Lakhs"]),
    
    # 6. Authoritative vs derived finance history
    ("How much of our finance history is authoritative versus derived?", CapabilityEnum.FINANCE_PROVENANCE_AUDIT, "DETERMINISTIC_SQL", ["65", "1869", "26.97%", "110.06%"]),
    
    # 7. Top 10 technology skills
    ("What are our top 10 technology skills by headcount?", CapabilityEnum.SKILLS_TOP_RANKING, "DETERMINISTIC_SQL", ["Docker", "208", "SQL", "177"]),
    ("what are our top technology skills", CapabilityEnum.SKILLS_TOP_RANKING, "DETERMINISTIC_SQL", ["Docker", "SQL"]),
    
    # 8. Rarest technology skills
    ("Which skills are rarest across the organization?", CapabilityEnum.SKILLS_RAREST, "DETERMINISTIC_SQL", ["API Documentation", "Markdown"]),
    
    # 9. Single-person dependency risk (SPOF)
    ("Which technology skills are our biggest single-person dependency risk?", CapabilityEnum.SKILLS_CONCENTRATION_RISK, "DETERMINISTIC_SQL", ["API Documentation", "Markdown", "Technical Documentation", "User Manuals"]),
    
    # 10. Project tech coverage
    ("Which projects have the strongest technology coverage?", CapabilityEnum.PROJECT_TECH_COVERAGE, "DETERMINISTIC_SQL", ["NH", "47", "AK", "30", "ND", "29"]),
    
    # 11. Skill hiring priorities
    ("Which skills should we prioritize for hiring?", CapabilityEnum.SKILL_HIRING_PRIORITIES, "DETERMINISTIC_SQL", ["Technical Documentation", "Docker", "SQL"]),
    
    # 12. Internal redeployment vs hiring
    ("Which skills could we satisfy through internal redeployment?", CapabilityEnum.SKILL_REDEPLOYMENT, "DETERMINISTIC_SQL", ["QA Automation", "Selenium", "Postman", "105"]),
    
    # 13. Project exit exposure
    ("Which projects are most exposed to employee exits?", CapabilityEnum.PROJECT_ATTRITION_EXPOSURE, "DETERMINISTIC_SQL", ["Project NH", "33", "9.22%", "Project AK"]),
    
    # 14. Management spans & concentration
    ("Which managers have unusually large management spans?", CapabilityEnum.MANAGEMENT_SPAN_RISK, "DETERMINISTIC_SQL", ["219", "37.1%", "Kishore Kumar N", "64"]),
    
    # 15. Top 3 workforce risks
    ("What are the three biggest workforce risks visible in our data?", CapabilityEnum.TOP_WORKFORCE_RISKS, "DETERMINISTIC_SQL", ["Project NH Attrition", "Single-Person Skill Dependencies", "Management Span"]),
    
    # 16. Top 3 workforce investments
    ("If we could make only three workforce investments, where should they go?", CapabilityEnum.STRATEGIC_INVESTMENTS, "DETERMINISTIC_SQL", ["Project NH Retention", "Technical Writing", "Organizational Restructuring"]),
]

COMMERCIAL_FINANCE_REFUSAL_CASES = [
    "What is our revenue per employee?",
    "What is our cash runway and DSO?",
    "What is our gross margin and client profitability?",
    "What is our billable utilization rate?",
    "What is our EBITDA and net margin?",
    "Show client invoicing and payment cycles"
]

@pytest.mark.parametrize("query,expected_cap,expected_intent,expected_tokens", EXECUTIVE_BENCHMARK_CASES)
def test_executive_benchmark_deterministic_intelligence(query, expected_cap, expected_intent, expected_tokens):
    contract = capability_registry.resolve(query)
    assert contract.capability == expected_cap, f"Query '{query}' expected capability {expected_cap}, got {contract.capability}"
    assert contract.execution_route == "DETERMINISTIC_SQL"
    
    res = llm_orchestrator.process(query)
    assert res.get("intent") == expected_intent
    assert res.get("status") != "REFUSAL"
    assert res.get("confidence") == 1.0
    assert res.get("llm_calls", 0) == 0
    assert res.get("model_calls", 0) == 0
    assert res.get("rag_calls", 0) == 0
    
    ans = res.get("answer", "")
    for token in expected_tokens:
        assert token.lower() in ans.lower(), f"Expected token '{token}' not found in answer: {ans}"
        
    assert len(res.get("insights", [])) >= 1
    # Verify response model serialization
    pydantic_res = CopilotQueryResponse(**res)
    assert pydantic_res.answer == ans

@pytest.mark.parametrize("query", COMMERCIAL_FINANCE_REFUSAL_CASES)
def test_commercial_finance_strict_refusal_boundary(query):
    contract = capability_registry.resolve(query)
    assert contract.capability == CapabilityEnum.UNSUPPORTED_COMMERCIAL_FINANCE
    assert contract.execution_route == "UNSUPPORTED_COMMERCIAL_FINANCE"
    
    res = llm_orchestrator.process(query)
    assert res.get("status") == "REFUSAL"
    assert res.get("intent") == "UNSUPPORTED_DOMAIN"
    assert res.get("confidence") == 0.0
    assert res.get("llm_calls", 0) == 0
    assert res.get("model_calls", 0) == 0
    assert res.get("rag_calls", 0) == 0
    assert "commercial finance datasets" in res.get("answer", "").lower()
    assert "revenue, project profitability, client billing" in res.get("answer", "").lower()
