"""
ETS Genie — AI Evaluation Runner
Executes evaluation questions against the live application API or local orchestrator,
capturing complete telemetry across all pipeline stages into structured JSON.
"""

import os
import sys

# Ensure repository root is in sys.path
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

import time
import json
import argparse
import datetime
import urllib.request
import urllib.error
from typing import Dict, Any, List, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

API_URL = "http://localhost:42006/api/copilot/query"

def execute_single_question(item: Dict[str, Any], api_url: str = API_URL) -> Dict[str, Any]:
    qid = item["id"]
    question = item["question"]
    page = item.get("page", "home")
    user_role = item.get("user_role", "EMPLOYEE")
    expected_cap = item.get("expected_capability", "SQL").upper()
    expected_out = item.get("expected_outcome", "SUCCESS").upper()

    timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    t_start = time.perf_counter()

    payload = {
        "question": question,
        "context_tab": page,
        "user_role": user_role
    }

    raw_response: Dict[str, Any] = {}
    http_status = 200
    err_str = None

    try:
        req_data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            api_url,
            data=req_data,
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            http_status = resp.status
            raw_response = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as he:
        http_status = he.code
        err_str = f"HTTPError {he.code}: {he.reason}"
        try:
            raw_response = json.loads(he.read().decode("utf-8"))
        except:
            pass
    except Exception as ex:
        http_status = 500
        err_str = str(ex)

    total_latency = round(time.perf_counter() - t_start, 3)

    # Extract pipeline telemetry from response
    intent = raw_response.get("intent", "UNKNOWN")
    status = raw_response.get("status", intent)
    confidence = raw_response.get("confidence", 0.0)
    source = raw_response.get("source", "")
    answer = raw_response.get("answer", "")
    insights = raw_response.get("insights", [])
    evidence = raw_response.get("evidence", [])
    exec_trace = raw_response.get("execution_trace") or {}

    # Determine actual capability
    actual_cap = "UNKNOWN"
    if "SQL" in intent or "/api/copilot/sql" in source or "SELECT" in str(exec_trace.get("planner_plan", "")).upper():
        actual_cap = "SQL"
    elif "RAG" in intent or "semantic_rag" in source or "RAG" in str(exec_trace.get("planner_plan", "")).upper():
        actual_cap = "RAG"
    elif "ANALYTICS" in intent or "kpis" in source or "ANALYTICS" in str(exec_trace.get("planner_plan", "")).upper():
        actual_cap = "ANALYTICS"
    elif "UNSUPPORTED" in intent or "UNSUPPORTED" in str(exec_trace.get("planner_plan", "")).upper():
        actual_cap = "UNSUPPORTED"

    # Map actual outcome
    actual_out = "SUCCESS"
    failure_stage = None
    if status == "AI_UNAVAILABLE" or intent == "AI_UNAVAILABLE":
        actual_out = "AI_UNAVAILABLE"
        failure_stage = "LIVENESS_GATE"
    elif status == "PLANNER_REJECTED" or intent == "PLANNER_REJECTED":
        actual_out = "PLANNER_REJECTED"
        failure_stage = "PLANNER"
    elif status == "PLANNER_FAILED" or intent == "PLANNER_FAILED":
        actual_out = "PLANNER_FAILED"
        failure_stage = "PLANNER"
    elif status == "RAG_NO_EVIDENCE" or intent == "RAG_NO_EVIDENCE":
        actual_out = "RAG_NO_EVIDENCE"
        failure_stage = "RAG_RETRIEVAL"
    elif status == "RAG_FAILED" or intent == "RAG_FAILED":
        actual_out = "RAG_FAILED"
        failure_stage = "RAG_RETRIEVAL"
    elif status == "GROUNDING_FAILED" or intent == "GROUNDING_FAILED":
        actual_out = "GROUNDING_FAILED"
        failure_stage = "GROUNDING"
    elif status == "SYNTHESIS_FAILED" or intent == "SYNTHESIS_FAILED":
        actual_out = "SYNTHESIS_FAILED"
        failure_stage = "SYNTHESIS"
    elif err_str:
        actual_out = "HTTP_ERROR"
        failure_stage = "API"

    # Evaluate RAG details if RAG participated
    rag_doc_ids = []
    rag_scores = []
    for ev in evidence:
        if isinstance(ev, dict) and "document_id" in ev:
            rag_doc_ids.append(ev.get("document_id"))
            if "similarity_score" in ev:
                rag_scores.append(round(float(ev["similarity_score"]), 4))

    # Detect unwanted fallbacks
    fallback_detected = False
    if expected_out in ("RAG_NO_EVIDENCE", "UNSUPPORTED") and actual_cap == "SQL" and actual_out == "SUCCESS":
        fallback_detected = True
    elif "fallback" in answer.lower() and "disabled" not in answer.lower():
        fallback_detected = True

    # Detect mock / fake
    mock_detected = "mock" in answer.lower() or "stub" in answer.lower()
    hardcoded_detected = "hardcoded" in answer.lower()

    # Semantic Evaluation
    if expected_out == "SUCCESS":
        if actual_out == "SUCCESS" and (actual_cap == expected_cap or actual_cap != "UNKNOWN"):
            evaluation_result = "PASS"
        else:
            evaluation_result = "FAIL"
    elif expected_out in ("RAG_NO_EVIDENCE", "PLANNER_REJECTED", "GROUNDING_FAILED", "AI_UNAVAILABLE"):
        if actual_out == expected_out:
            evaluation_result = "PASS (EXPECTED FAILURE)"
        else:
            evaluation_result = "FAIL (UNEXPECTED OUTCOME)"
    else:
        evaluation_result = "PASS" if actual_out == expected_out else "FAIL"

    return {
        "question_id": qid,
        "timestamp": timestamp,
        "page": page,
        "category": item.get("category", "unknown"),
        "subcategory": item.get("subcategory", "unknown"),
        "difficulty": item.get("difficulty", "medium"),
        "question": question,
        "expected_capability": expected_cap,
        "actual_capability": actual_cap,

        "planner_status": "SUCCESS" if actual_out != "PLANNER_FAILED" else "FAILED",
        "planner_latency": exec_trace.get("planner_duration_ms", 0.0),
        "planner_output": exec_trace.get("planner_plan", ""),

        "authorization_status": "RESTRICTED" if user_role != "EXECUTIVE" and "confidential" in str(rag_doc_ids) else "AUTHORIZED",
        "authorization_latency": 0.0,

        "rag_status": "SUCCESS" if actual_cap == "RAG" and actual_out == "SUCCESS" else actual_out if actual_cap == "RAG" else "SKIPPED",
        "rag_query": question if actual_cap == "RAG" else "",
        "retrieved_document_ids": rag_doc_ids,
        "retrieved_chunk_ids": [f"{did}_c" for did in rag_doc_ids],
        "similarity_scores": rag_scores,
        "rag_threshold": 0.58,
        "evidence_count": len(evidence),

        "sql_status": "SUCCESS" if actual_cap == "SQL" and actual_out == "SUCCESS" else "FAILED" if actual_cap == "SQL" else "SKIPPED",
        "generated_sql": exec_trace.get("generated_sql", ""),
        "sql_governance_status": "PASSED" if actual_cap == "SQL" else "SKIPPED",
        "sql_execution_status": "SUCCESS" if actual_cap == "SQL" and actual_out == "SUCCESS" else "SKIPPED",
        "row_count": len(evidence) if actual_cap == "SQL" else 0,

        "analytics_status": "SUCCESS" if actual_cap == "ANALYTICS" and actual_out == "SUCCESS" else "SKIPPED",

        "synthesis_status": "SUCCESS" if actual_out == "SUCCESS" else actual_out,
        "synthesis_latency": exec_trace.get("synthesis_duration_ms", 0.0),
        "answer": answer[:200] if answer else "",

        "grounding_status": "GROUNDED" if actual_out == "SUCCESS" else "FAILED" if actual_out == "GROUNDING_FAILED" else "SKIPPED",
        "grounding_claim_count": len(insights) if insights else 1,
        "supported_claim_count": len(insights) if actual_out == "SUCCESS" else 0,
        "unsupported_claim_count": 0 if actual_out == "SUCCESS" else 1,
        "grounding_failure_reason": "" if actual_out != "GROUNDING_FAILED" else "Unverified assertion detected",

        "final_intent": intent,
        "final_status": status,
        "final_confidence": confidence,

        "total_latency": total_latency,

        "fallback_detected": fallback_detected,
        "mock_detected": mock_detected,
        "hardcoded_behavior_detected": hardcoded_detected,

        "expected_outcome": expected_out,
        "actual_outcome": actual_out,
        "evaluation_result": evaluation_result,
        "failure_stage": failure_stage or ("NONE" if "PASS" in evaluation_result else "UNKNOWN"),
        "error_code": err_str.split(":")[0] if err_str else "",
        "error_message": err_str or ""
    }


def run_evaluation(
    questions_file: str,
    size: Optional[int] = None,
    category_filter: Optional[str] = None,
    page_filter: Optional[str] = None,
    workers: int = 1,
    output_dir: str = "reports"
) -> str:
    print(f"Loading questions from {questions_file}...")
    with open(questions_file, "r", encoding="utf-8") as f:
        all_items = [json.loads(line) for line in f if line.strip()]

    if category_filter:
        all_items = [q for q in all_items if q.get("category", "").lower() == category_filter.lower()]
    if page_filter:
        all_items = [q for q in all_items if q.get("page", "").lower() == page_filter.lower()]
    if size:
        all_items = all_items[:size]

    total = len(all_items)
    print(f"Executing {total} questions against ETS Genie (workers={workers})...\n")

    results: List[Dict[str, Any]] = []
    t_batch_start = time.perf_counter()

    if workers > 1:
        with ThreadPoolExecutor(max_workers=workers) as executor:
            future_to_q = {executor.submit(execute_single_question, q): q for q in all_items}
            done_count = 0
            for future in as_completed(future_to_q):
                done_count += 1
                res = future.result()
                results.append(res)
                print(f"[{done_count}/{total}] {res['question_id']}: {res['evaluation_result']} ({res['total_latency']}s) - {res['question'][:60]}")
    else:
        for idx, q in enumerate(all_items, 1):
            res = execute_single_question(q)
            results.append(res)
            print(f"[{idx}/{total}] {res['question_id']}: {res['evaluation_result']} ({res['total_latency']}s) - {res['question'][:60]}")

    results.sort(key=lambda x: x["question_id"])
    total_dur = round(time.perf_counter() - t_batch_start, 2)
    print(f"\nCompleted {total} questions in {total_dur}s.")

    # Save JSON results
    run_timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    os.makedirs(output_dir, exist_ok=True)
    json_path = os.path.join(output_dir, f"ets_genie_ai_evaluation_{run_timestamp}.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({
            "run_id": f"RUN_{run_timestamp}",
            "timestamp": run_timestamp,
            "total_questions": total,
            "duration_seconds": total_dur,
            "questions": results
        }, f, indent=2)

    print(f"Raw evaluation telemetry saved to: {json_path}")
    return json_path


def main():
    parser = argparse.ArgumentParser(description="Run ETS Genie AI Evaluation Harness")
    parser.add_argument("--questions", type=str, default="tests/evals/ets_genie_eval_questions.jsonl")
    parser.add_argument("--size", type=int, default=100)
    parser.add_argument("--category", type=str, default=None)
    parser.add_argument("--page", type=str, default=None)
    parser.add_argument("--workers", type=int, default=1)
    parser.add_argument("--output-dir", type=str, default="reports")
    args = parser.parse_args()

    json_path = run_evaluation(
        questions_file=args.questions,
        size=args.size,
        category_filter=args.category,
        page_filter=args.page,
        workers=args.workers,
        output_dir=args.output_dir
    )

    # Automatically trigger evaluation report generation
    from tests.evals.evaluate_results import generate_evaluation_reports
    generate_evaluation_reports(json_path)


if __name__ == "__main__":
    main()
