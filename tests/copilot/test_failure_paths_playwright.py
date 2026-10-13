import os
import sys
import time
import json
import datetime
import urllib.request
import subprocess
import threading
from playwright.sync_api import sync_playwright

sys.path.insert(0, r"c:\Users\affra\Documents\ETS\ETS-Dashboard")

ARTIFACT_DIR = r"c:\Users\affra\Documents\ETS\ETS-Dashboard\test-results\failure-paths"
os.makedirs(ARTIFACT_DIR, exist_ok=True)

FRONTEND_URL = "http://localhost:42005"
BACKEND_URL = "http://localhost:42006"
OLLAMA_URL = "http://localhost:11434"

# Global test control flag
TEST_MODE = "NORMAL"
CALL_COUNTER = 0

def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", "replace").decode("ascii"))

def setup_instrumented_backend():
    """
    Starts an in-process FastAPI uvicorn server on port 42006 with controlled LLM failure triggers.
    The underlying application logic, sql governor, grounding verifier, and fallback handlers
    are 100% UNTOUCHED.
    """
    from backend.app.main import app
    from backend.app.ai.orchestrator import llm_orchestrator
    import uvicorn

    orig_generate = llm_orchestrator.ollama.generate

    def controlled_generate(prompt="", system=None, model="qwen2.5-coder:3b", max_tokens=80, temperature=0.0):
        global TEST_MODE, CALL_COUNTER
        CALL_COUNTER += 1
        safe_print(f"  [CONTROLLED_LLM] Call #{CALL_COUNTER} in TEST_MODE={TEST_MODE}")
        safe_print(f"  [CONTROLLED_LLM] Prompt snippet: {prompt[:120].strip()}...")

        if TEST_MODE == "PLANNER_TIMEOUT":
            # Force planner call to fail / timeout (return None)
            safe_print("  [CONTROLLED_LLM] TRIGGERING PLANNER TIMEOUT / FAILURE -> Returning None")
            return None

        elif TEST_MODE == "PLANNER_MALFORMED":
            # Return syntactically malformed / unknown tool planner response
            safe_print("  [CONTROLLED_LLM] TRIGGERING MALFORMED PLAN -> Returning 'INVALID_TOOL | do_something_evil'")
            return "INVALID_TOOL | do_something_evil"

        elif TEST_MODE == "SYNTHESIS_TIMEOUT":
            if "Verified System Evidence:" in prompt or "verified_system_evidence" in prompt.lower():
                # This is the synthesis call
                safe_print("  [CONTROLLED_LLM] TRIGGERING SYNTHESIS TIMEOUT / FAILURE -> Returning None")
                return None
            else:
                # Normal planner call
                return orig_generate(prompt=prompt, system=system, model=model, max_tokens=max_tokens, temperature=temperature)

        elif TEST_MODE == "GROUNDING_HALLUCINATION":
            if "Verified System Evidence:" in prompt or "verified_system_evidence" in prompt.lower():
                # Inject unsupported number claim (e.g. IT has 999 employees)
                safe_print("  [CONTROLLED_LLM] TRIGGERING GROUNDING HALLUCINATION -> Claiming 'IT has 999 employees'")
                return "Executive Analysis: The three departments with highest headcounts are IT (999), Core (153), and QA (22)."
            else:
                return orig_generate(prompt=prompt, system=system, model=model, max_tokens=max_tokens, temperature=temperature)

        # Default: normal live Ollama generation
        return orig_generate(prompt=prompt, system=system, model=model, max_tokens=max_tokens, temperature=temperature)

    llm_orchestrator.ollama.generate = controlled_generate
    
    config = uvicorn.Config(app, host="0.0.0.0", port=42006, log_level="warning")
    server = uvicorn.Server(config)
    server_thread = threading.Thread(target=server.run, daemon=True)
    server_thread.start()
    return server

def stop_existing_backend():
    cmd = """
    $conns = Get-NetTCPConnection -LocalPort 42006 -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
        if ($c.OwningProcess -and $c.OwningProcess -gt 4) {
            Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }
    """
    subprocess.run(["powershell", "-Command", cmd], check=False)
    time.sleep(2)

def run_failure_tests():
    global TEST_MODE, CALL_COUNTER

    safe_print(f"\n================================================================================")
    safe_print("ETS Copilot Failure Paths Forensic Playwright Audit")
    safe_print(f"Timestamp: {datetime.datetime.now().isoformat()}")
    safe_print(f"================================================================================")

    # 1. Stop background backend on 42006
    safe_print("\n[Step 1] Stopping background backend on port 42006...")
    stop_existing_backend()

    # 2. Start instrumented in-process server
    safe_print("[Step 2] Starting test server on port 42006 with controlled failure injection...")
    server = setup_instrumented_backend()

    # Wait for server ready
    for _ in range(15):
        time.sleep(1)
        try:
            with urllib.request.urlopen("http://localhost:42006/api/health", timeout=1.5) as r:
                if r.status == 200:
                    safe_print("Test server is ready on http://localhost:42006/api/health")
                    break
        except:
            pass

    test_records = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        console_logs = []
        network_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] [{msg.type}] {msg.text}"))
        page.on("pageerror", lambda exc: console_logs.append(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] [PAGE_ERROR] {exc}"))
        page.on("requestfailed", lambda req: network_logs.append(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] [FAILED_REQ] {req.url} {req.failure}"))

        question = "Which 3 departments have the highest headcount?"

        # -------------------------------------------------------------
        # FAILURE TEST A: PLANNER TIMEOUT / FAILURE
        # -------------------------------------------------------------
        safe_print("\n================================================================================")
        safe_print("FAILURE TEST A: PLANNER TIMEOUT / FAILURE")
        safe_print("================================================================================")
        TEST_MODE = "PLANNER_TIMEOUT"
        CALL_COUNTER = 0

        page.goto(FRONTEND_URL, wait_until="networkidle", timeout=30000)
        time.sleep(1.5)
        genie_btn = page.locator("button[aria-label='Toggle ETS Genie assistant']").first
        genie_btn.click()
        time.sleep(1)

        input_box = page.locator("input[placeholder*='Ask AI']").first
        input_box.fill(question)

        # Screenshot A
        q_path = os.path.join(ARTIFACT_DIR, "failure_A_planner_timeout_question.png")
        page.screenshot(path=q_path)
        safe_print(f"Captured: failure_A_planner_timeout_question.png")

        # Submit
        t0 = time.perf_counter()
        page.locator("button[type='submit']").first.click()

        # Wait for response
        page.wait_for_function("() => document.querySelectorAll('div.flex.flex-col.gap-1.items-start').length >= 2", timeout=45000)
        page.wait_for_selector("div:has-text('Analyzing workforce records...')", state="detached", timeout=45000)
        time.sleep(2)
        dur_a = round((time.perf_counter() - t0) * 1000, 1)

        # Screenshot B
        a_path = os.path.join(ARTIFACT_DIR, "failure_A_planner_timeout_answer.png")
        page.screenshot(path=a_path)
        safe_print(f"Captured: failure_A_planner_timeout_answer.png")

        msgs_a = page.locator("div.flex.flex-col.gap-1.items-start").all()
        text_a = msgs_a[-1].inner_text() if len(msgs_a) >= 2 else ""
        safe_print(f"Test A Duration: {dur_a}ms")
        safe_print(f"Test A UI Answer:\n{text_a}")

        # Check for fallback query SELECT count(*) FROM employees
        fallback_a_detected = "590" in text_a or "total count" in text_a.lower() or "count(*)" in text_a.lower()
        explicit_a_fail = "planner_failed" in text_a.lower() or "planner failed" in text_a.lower() or "unavailable" in text_a.lower()
        safe_print(f"Test A - Fallback Heuristic Executed: {fallback_a_detected}")
        safe_print(f"Test A - Explicit AI Failure Rendered: {explicit_a_fail}")

        test_records.append({
            "test": "FAILURE_TEST_A_PLANNER_TIMEOUT",
            "duration_ms": dur_a,
            "ui_text": text_a,
            "fallback_heuristic_detected": fallback_a_detected,
            "explicit_failure_rendered": explicit_a_fail,
            "screenshot_q": q_path,
            "screenshot_a": a_path
        })

        # -------------------------------------------------------------
        # FAILURE TEST B: MALFORMED PLANNER OUTPUT
        # -------------------------------------------------------------
        safe_print("\n================================================================================")
        safe_print("FAILURE TEST B: MALFORMED PLANNER OUTPUT")
        safe_print("================================================================================")
        TEST_MODE = "PLANNER_MALFORMED"
        CALL_COUNTER = 0

        page.goto(FRONTEND_URL, wait_until="networkidle", timeout=30000)
        time.sleep(1.5)
        genie_btn = page.locator("button[aria-label='Toggle ETS Genie assistant']").first
        genie_btn.click()
        time.sleep(1)

        input_box = page.locator("input[placeholder*='Ask AI']").first
        input_box.fill(question)

        # Screenshot A
        q_path = os.path.join(ARTIFACT_DIR, "failure_B_malformed_plan_question.png")
        page.screenshot(path=q_path)
        safe_print(f"Captured: failure_B_malformed_plan_question.png")

        # Submit
        t0 = time.perf_counter()
        page.locator("button[type='submit']").first.click()

        # Wait for response
        page.wait_for_function("() => document.querySelectorAll('div.flex.flex-col.gap-1.items-start').length >= 2", timeout=45000)
        page.wait_for_selector("div:has-text('Analyzing workforce records...')", state="detached", timeout=45000)
        time.sleep(2)
        dur_b = round((time.perf_counter() - t0) * 1000, 1)

        # Screenshot B
        a_path = os.path.join(ARTIFACT_DIR, "failure_B_malformed_plan_answer.png")
        page.screenshot(path=a_path)
        safe_print(f"Captured: failure_B_malformed_plan_answer.png")

        msgs_b = page.locator("div.flex.flex-col.gap-1.items-start").all()
        text_b = msgs_b[-1].inner_text() if len(msgs_b) >= 2 else ""
        safe_print(f"Test B Duration: {dur_b}ms")
        safe_print(f"Test B UI Answer:\n{text_b}")

        fallback_b_detected = "590" in text_b or "count(*)" in text_b.lower() or "total count" in text_b.lower()
        explicit_b_fail = "planner_rejected" in text_b.lower() or "unsupported" in text_b.lower() or "malformed" in text_b.lower()
        safe_print(f"Test B - Fallback Heuristic Executed: {fallback_b_detected}")
        safe_print(f"Test B - Explicit AI Failure Rendered: {explicit_b_fail}")

        test_records.append({
            "test": "FAILURE_TEST_B_MALFORMED_PLAN",
            "duration_ms": dur_b,
            "ui_text": text_b,
            "fallback_heuristic_detected": fallback_b_detected,
            "explicit_failure_rendered": explicit_b_fail,
            "screenshot_q": q_path,
            "screenshot_a": a_path
        })

        # -------------------------------------------------------------
        # FAILURE TEST C: SYNTHESIS TIMEOUT / FAILURE
        # -------------------------------------------------------------
        safe_print("\n================================================================================")
        safe_print("FAILURE TEST C: SYNTHESIS TIMEOUT / FAILURE")
        safe_print("================================================================================")
        TEST_MODE = "SYNTHESIS_TIMEOUT"
        CALL_COUNTER = 0

        page.goto(FRONTEND_URL, wait_until="networkidle", timeout=30000)
        time.sleep(1.5)
        genie_btn = page.locator("button[aria-label='Toggle ETS Genie assistant']").first
        genie_btn.click()
        time.sleep(1)

        input_box = page.locator("input[placeholder*='Ask AI']").first
        input_box.fill(question)

        # Screenshot A
        q_path = os.path.join(ARTIFACT_DIR, "failure_C_synthesis_timeout_question.png")
        page.screenshot(path=q_path)
        safe_print(f"Captured: failure_C_synthesis_timeout_question.png")

        # Submit
        t0 = time.perf_counter()
        page.locator("button[type='submit']").first.click()

        # Wait for response
        page.wait_for_function("() => document.querySelectorAll('div.flex.flex-col.gap-1.items-start').length >= 2", timeout=45000)
        page.wait_for_selector("div:has-text('Analyzing workforce records...')", state="detached", timeout=45000)
        time.sleep(2)
        dur_c = round((time.perf_counter() - t0) * 1000, 1)

        # Screenshot B
        a_path = os.path.join(ARTIFACT_DIR, "failure_C_synthesis_timeout_answer.png")
        page.screenshot(path=a_path)
        safe_print(f"Captured: failure_C_synthesis_timeout_answer.png")

        msgs_c = page.locator("div.flex.flex-col.gap-1.items-start").all()
        text_c = msgs_c[-1].inner_text() if len(msgs_c) >= 2 else ""
        safe_print(f"Test C Duration: {dur_c}ms")
        safe_print(f"Test C UI Answer:\n{text_c}")

        canned_msg_c = "could not synthesize a grounded answer" in text_c
        explicit_c_fail = "synthesis_failed" in text_c.lower() or "synthesis failed" in text_c.lower() or "synthesis timeout" in text_c.lower() or "timed out" in text_c.lower()
        safe_print(f"Test C - Canned Static Message Substituted: {canned_msg_c}")
        safe_print(f"Test C - Explicit AI Failure Rendered: {explicit_c_fail}")

        test_records.append({
            "test": "FAILURE_TEST_C_SYNTHESIS_TIMEOUT",
            "duration_ms": dur_c,
            "ui_text": text_c,
            "canned_static_message_substituted": canned_msg_c,
            "explicit_failure_rendered": explicit_c_fail,
            "screenshot_q": q_path,
            "screenshot_a": a_path
        })

        # -------------------------------------------------------------
        # FAILURE TEST D: GROUNDING FAILURE (HALLUCINATED NUMBERS)
        # -------------------------------------------------------------
        safe_print("\n================================================================================")
        safe_print("FAILURE TEST D: GROUNDING FAILURE (HALLUCINATED NUMBERS)")
        safe_print("================================================================================")
        TEST_MODE = "GROUNDING_HALLUCINATION"
        CALL_COUNTER = 0

        page.goto(FRONTEND_URL, wait_until="networkidle", timeout=30000)
        time.sleep(1.5)
        genie_btn = page.locator("button[aria-label='Toggle ETS Genie assistant']").first
        genie_btn.click()
        time.sleep(1)

        input_box = page.locator("input[placeholder*='Ask AI']").first
        input_box.fill(question)

        # Screenshot A
        q_path = os.path.join(ARTIFACT_DIR, "failure_D_grounding_failure_question.png")
        page.screenshot(path=q_path)
        safe_print(f"Captured: failure_D_grounding_failure_question.png")

        # Submit
        t0 = time.perf_counter()
        page.locator("button[type='submit']").first.click()

        # Wait for response
        page.wait_for_function("() => document.querySelectorAll('div.flex.flex-col.gap-1.items-start').length >= 2", timeout=45000)
        page.wait_for_selector("div:has-text('Analyzing workforce records...')", state="detached", timeout=45000)
        time.sleep(2)
        dur_d = round((time.perf_counter() - t0) * 1000, 1)

        # Screenshot B
        a_path = os.path.join(ARTIFACT_DIR, "failure_D_grounding_failure_answer.png")
        page.screenshot(path=a_path)
        safe_print(f"Captured: failure_D_grounding_failure_answer.png")

        msgs_d = page.locator("div.flex.flex-col.gap-1.items-start").all()
        text_d = msgs_d[-1].inner_text() if len(msgs_d) >= 2 else ""
        safe_print(f"Test D Duration: {dur_d}ms")
        safe_print(f"Test D UI Answer:\n{text_d}")

        hallucination_accepted_in_ui = "999" in text_d
        confidence_lowered = "80%" in text_d
        grounding_hard_gate_blocked = "grounding_failed" in text_d.lower() or "blocked by the grounding verifier" in text_d.lower()
        safe_print(f"Test D - Hallucinated Number '999' Displayed in UI: {hallucination_accepted_in_ui}")
        safe_print(f"Test D - Confidence Lowered to 80%: {confidence_lowered}")
        safe_print(f"Test D - Grounding Hard Gate Blocked Hallucination: {grounding_hard_gate_blocked}")

        test_records.append({
            "test": "FAILURE_TEST_D_GROUNDING_FAILURE",
            "duration_ms": dur_d,
            "ui_text": text_d,
            "hallucination_displayed_in_ui": hallucination_accepted_in_ui,
            "confidence_lowered_to_80": confidence_lowered,
            "grounding_hard_gate_blocked": grounding_hard_gate_blocked,
            "screenshot_q": q_path,
            "screenshot_a": a_path
        })

        browser.close()

    # Save summary json
    summary_path = os.path.join(ARTIFACT_DIR, "failure_paths_summary.json")
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump({
            "generated_at": datetime.datetime.now().isoformat(),
            "tests": test_records,
            "console_logs_count": len(console_logs),
            "network_logs_count": len(network_logs)
        }, f, indent=2)

    safe_print(f"\nFailure Paths Audit Completed! Summary written to: {summary_path}")

    # Stop in-process server and restart original backend as daemon
    safe_print("\nStopping in-process test server...")
    stop_existing_backend()
    safe_print("Restarting original backend server daemon on 42006...")
    subprocess.Popen(["powershell", "-Command", "uvicorn backend.app.main:app --host 0.0.0.0 --port 42006"], creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)
    for _ in range(15):
        time.sleep(1)
        try:
            with urllib.request.urlopen("http://localhost:42006/api/health", timeout=1.5) as r:
                if r.status == 200:
                    safe_print("Original backend server restored on 42006!")
                    break
        except:
            pass

if __name__ == "__main__":
    run_failure_tests()
