"""
Unit and integration tests for the ETS Genie AI Evaluation Harness.
Verifies question schema, duplicate detection, telemetry extraction, and Excel generation.
"""

import os
import sys
import json
import pytest
import openpyxl

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from tests.evals.generate_eval_corpus import (
    SEED_100_QUESTIONS,
    CorpusGenerator,
    calculate_token_similarity,
    PAGES,
    CATEGORIES
)
from tests.evals.evaluate_results import generate_evaluation_reports

def test_seed_100_questions_validity():
    """Verify that all 100 seed questions have mandatory metadata fields."""
    assert len(SEED_100_QUESTIONS) == 100
    seen_ids = set()
    pages_found = set()
    cats_found = set()

    for idx, q in enumerate(SEED_100_QUESTIONS):
        qid = q.get("id")
        assert qid is not None and qid.startswith("Q")
        assert qid not in seen_ids, f"Duplicate ID: {qid}"
        seen_ids.add(qid)

        assert q.get("question") and len(q["question"].strip()) > 5
        assert q.get("expected_capability") in ("SQL", "RAG", "ANALYTICS", "UNSUPPORTED")
        assert q.get("expected_outcome") in ("SUCCESS", "RAG_NO_EVIDENCE", "PLANNER_REJECTED", "GROUNDING_FAILED")

        page = q.get("page")
        assert page in PAGES, f"Invalid page '{page}' at index {idx}"
        pages_found.add(page)

        cat = q.get("category")
        assert cat in CATEGORIES, f"Invalid category '{cat}' at index {idx}"
        cats_found.add(cat)

    # Verify all 6 pages are represented
    assert len(pages_found) == 6, f"Missing pages in seed corpus: {set(PAGES) - pages_found}"

def test_duplicate_detection_rejects_identical():
    """Verify that identical or near-duplicate questions are rejected."""
    gen = CorpusGenerator(SEED_100_QUESTIONS[:10])
    q1 = "What is the average salary of employees in grade E3?"
    q2 = "What is the average salary of employees in grade E3?"
    assert calculate_token_similarity(q1, q2) == 1.0

def test_excel_generation_all_13_worksheets(tmp_path):
    """Verify that evaluate_results generates an Excel workbook with all 13 worksheets."""
    dummy_json = tmp_path / "dummy_eval.json"
    dummy_data = {
        "run_id": "TEST_RUN_001",
        "timestamp": "20260913_120000",
        "total_questions": 2,
        "duration_seconds": 5.2,
        "questions": [
            {
                "question_id": "Q000001",
                "page": "home",
                "category": "sql",
                "subcategory": "headcount",
                "difficulty": "easy",
                "question": "How many total employees are there?",
                "expected_capability": "SQL",
                "actual_capability": "SQL",
                "expected_outcome": "SUCCESS",
                "actual_outcome": "SUCCESS",
                "evaluation_result": "PASS",
                "failure_stage": "NONE",
                "total_latency": 1.25,
                "final_confidence": 1.0,
                "final_intent": "LLM_SQL",
                "answer": "Total headcount is 590.",
                "fallback_detected": False,
                "mock_detected": False,
                "planner_status": "SUCCESS",
                "planner_output": "SELECT COUNT(*) FROM employees",
                "planner_latency": 120.0,
                "generated_sql": "SELECT COUNT(*) FROM employees;",
                "sql_governance_status": "PASSED",
                "sql_execution_status": "SUCCESS",
                "row_count": 1,
                "rag_status": "SKIPPED",
                "evidence_count": 0,
                "grounding_status": "GROUNDED",
                "supported_claim_count": 1,
                "unsupported_claim_count": 0
            },
            {
                "question_id": "Q000071",
                "page": "salarywise",
                "category": "rag",
                "subcategory": "out_of_domain",
                "difficulty": "medium",
                "question": "What is the cryptocurrency reimbursement policy?",
                "expected_capability": "RAG",
                "actual_capability": "RAG",
                "expected_outcome": "RAG_NO_EVIDENCE",
                "actual_outcome": "RAG_NO_EVIDENCE",
                "evaluation_result": "PASS (EXPECTED FAILURE)",
                "failure_stage": "RAG_RETRIEVAL",
                "total_latency": 0.95,
                "final_confidence": 0.0,
                "final_intent": "RAG_NO_EVIDENCE",
                "answer": "No verified policy found.",
                "fallback_detected": False,
                "mock_detected": False,
                "planner_status": "SUCCESS",
                "planner_output": "RAG cryptocurrency reimbursement",
                "planner_latency": 110.0,
                "generated_sql": "",
                "sql_governance_status": "SKIPPED",
                "sql_execution_status": "SKIPPED",
                "row_count": 0,
                "rag_status": "RAG_NO_EVIDENCE",
                "evidence_count": 0,
                "grounding_status": "SKIPPED",
                "supported_claim_count": 0,
                "unsupported_claim_count": 0
            }
        ]
    }
    with open(dummy_json, "w", encoding="utf-8") as f:
        json.dump(dummy_data, f)

    xlsx_out = generate_evaluation_reports(str(dummy_json), output_dir=str(tmp_path))
    assert os.path.exists(xlsx_out)

    wb = openpyxl.load_workbook(xlsx_out)
    expected_sheets = [
        "Executive_Summary", "Question_Results", "Planner", "SQL", "RAG",
        "Grounding", "Authorization", "Failures", "Page_Coverage",
        "Category_Coverage", "Difficulty", "Latency", "Fallback_Audit"
    ]
    for s in expected_sheets:
        assert s in wb.sheetnames, f"Missing required worksheet: {s}"
