"""Run the 500-question Genie harness and store prompts plus full telemetry.

This calls the local orchestrator. It does not call Cursor.
Do not start it unless Ollama is available and you intend to spend local model time.
"""
import io
import json
import os
import sys
import time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.app.ai.ollama_client import ollama_client
from backend.app.ai.orchestrator import llm_orchestrator

HERE = os.path.dirname(__file__)
QUESTIONS_PATH = os.path.join(HERE, "harness_questions.json")
RESULTS_PATH = os.path.join(HERE, "harness_results.jsonl")


def main():
    with open(QUESTIONS_PATH, encoding="utf-8") as handle:
        questions = json.load(handle)

    captured = []
    original_generate = ollama_client.generate

    def traced_generate(
        prompt,
        system=None,
        model="qwen2.5-coder:3b",
        temperature=0.0,
        max_tokens=150,
        timeout=120.0,
        task_type="GENERAL",
    ):
        raw = original_generate(
            prompt=prompt,
            system=system,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=timeout,
            task_type=task_type,
        )
        captured.append({
            "task_type": task_type,
            "model": model,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "system_prompt": system,
            "user_prompt": prompt,
            "raw_response": raw,
        })
        return raw

    ollama_client.generate = traced_generate

    print(f"Questions: {len(questions)}")
    print(f"Writing: {RESULTS_PATH}")

    with open(RESULTS_PATH, "w", encoding="utf-8") as out:
        for index, item in enumerate(questions, start=1):
            captured.clear()
            started = time.perf_counter()
            error = None
            payload = None
            try:
                payload = llm_orchestrator.process(item["question"])
            except Exception as exc:
                error = f"{type(exc).__name__}: {exc}"
            duration_ms = round((time.perf_counter() - started) * 1000, 2)
            record = {
                "topic": item.get("topic"),
                "question": item.get("question"),
                "duration_ms": duration_ms,
                "model_calls_captured": len(captured),
                "prompts": list(captured),
                "genie": payload,
                "error": error,
            }
            out.write(json.dumps(record, ensure_ascii=False, default=str) + "\n")
            out.flush()
            intent = ""
            if isinstance(payload, dict):
                intent = payload.get("intent") or ""
            print(f"{index}/{len(questions)} {item.get('topic')} {intent} {duration_ms}ms calls={len(captured)}")

    print("Finished.")


if __name__ == "__main__":
    main()
