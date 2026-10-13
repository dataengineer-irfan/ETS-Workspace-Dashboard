"""
ETS Genie — Local Model Benchmark Harness
Benchmarks installed local Ollama models across:
1. SQL Generation Accuracy
2. RAG Synthesis Grounding
3. Claim Verification Accuracy
4. End-to-end Latency Profile
"""

import os
import sys
import time
import json
import urllib.request
from typing import Dict, Any, List

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from backend.app.ai.ollama_client import ollama_client
from backend.app.ai.model_gateway import model_gateway

INSTALLED_MODELS_TO_BENCHMARK = [
    "qwen2.5:3b",
    "qwen2.5-coder:3b",
    "qwen2.5:1.5b"
]

BENCHMARK_TASKS = [
    {
        "task": "SQL_GENERATION",
        "prompt": "User Question: How many active employees work in Bangalore?\nGenerate SQLite SELECT query ONLY:",
        "system": "You are a SQLite database expert for employees(employee_number, current_status, location, state, annual_ctc). Output SELECT query ONLY.",
        "expected_token": "SELECT"
    },
    {
        "task": "GROUNDING_VERIFICATION",
        "prompt": """Verify if this claim is supported by evidence:
<evidence>
Employees in Grade E3 to E4 receive a 12% standardized promotion hike.
</evidence>
Claim: Moving from E3 to E4 grants a 12% promotion hike.
JSON output format: {"supported": true}""",
        "system": "You are an enterprise factual audit system. Return valid JSON only.",
        "expected_token": "true"
    },
    {
        "task": "RAG_SYNTHESIS",
        "prompt": """Summarize policy strictly from evidence:
<evidence>
Carry forward of leave is allowed up to a maximum of 15 days into the next calendar year.
</evidence>
What is the leave carry forward limit?""",
        "system": "Synthesize concise factual answer grounded strictly in evidence.",
        "expected_token": "15"
    }
]

def run_benchmark() -> Dict[str, Any]:
    print("=== ETS GENIE LOCAL MODEL BENCHMARK ===")
    results = {}
    
    for model_name in INSTALLED_MODELS_TO_BENCHMARK:
        print(f"\nEvaluating Model: {model_name}")
        model_results = []
        
        for b_task in BENCHMARK_TASKS:
            task_name = b_task["task"]
            t0 = time.perf_counter()
            try:
                out = ollama_client.generate(
                    prompt=b_task["prompt"],
                    system=b_task["system"],
                    model=model_name,
                    temperature=0.0,
                    max_tokens=150
                )
                dur_ms = round((time.perf_counter() - t0) * 1000, 2)
                success = bool(out and b_task["expected_token"].lower() in out.lower())
                print(f"  [{task_name}] Duration: {dur_ms}ms, Success: {success}")
                model_results.append({
                    "task": task_name,
                    "duration_ms": dur_ms,
                    "success": success,
                    "sample_output": out[:100] if out else ""
                })
            except Exception as e:
                dur_ms = round((time.perf_counter() - t0) * 1000, 2)
                print(f"  [{task_name}] FAILED with exception: {e}")
                model_results.append({
                    "task": task_name,
                    "duration_ms": dur_ms,
                    "success": False,
                    "error": str(e)
                })
        
        results[model_name] = model_results
        
    return results

if __name__ == "__main__":
    benchmark_report = run_benchmark()
    out_path = os.path.join(REPO_ROOT, "scratch", "local_benchmark_results.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(benchmark_report, f, indent=2)
    print(f"\nBenchmark completed. Report written to {out_path}")
