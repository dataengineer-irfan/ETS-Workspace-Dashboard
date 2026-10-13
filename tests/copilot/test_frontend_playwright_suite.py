import os
import sys
import time
import json
import shutil
import datetime
import urllib.request
import subprocess
import openpyxl
from playwright.sync_api import sync_playwright

ARTIFACT_DIR = r"c:\Users\affra\Documents\ETS\ETS-Dashboard\test-results\copilot-ui"
os.makedirs(ARTIFACT_DIR, exist_ok=True)

FRONTEND_URL = "http://localhost:42005"
BACKEND_URL = "http://localhost:42006"
OLLAMA_URL = "http://localhost:11434"

TEST_CASES = [
    {
        "id": "01",
        "name": "headcount",
        "question": "Which 3 departments have the highest headcount?",
        "expected_tool": "governed_sql",
        "expected_intent": "LLM_SQL"
    },
    {
        "id": "02",
        "name": "experience",
        "question": "What is the average total experience of employees?",
        "expected_tool": "governed_sql",
        "expected_intent": "LLM_SQL"
    },
    {
        "id": "03",
        "name": "python_skill",
        "question": "Which employees have Python as their primary skill?",
        "expected_tool": "governed_sql",
        "expected_intent": "LLM_SQL"
    },
    {
        "id": "04",
        "name": "manager",
        "question": "Which managers have the most direct reports?",
        "expected_tool": "governed_sql",
        "expected_intent": "LLM_SQL"
    },
    {
        "id": "05",
        "name": "leave",
        "question": "Which employees have the most leave days in 2024?",
        "expected_tool": "governed_sql",
        "expected_intent": "LLM_SQL"
    },
    {
        "id": "06",
        "name": "open_ended",
        "question": "Identify delivery managers who have relatively high tenure but low skill diversity. Explain the evidence, identify any data limitations, and tell me whether this appears concentrated in any department or grade.",
        "expected_tool": "governed_sql",
        "expected_intent": "LLM_SQL"
    },
    {
        "id": "07",
        "name": "billable_utilization",
        "question": "What is our billable utilization?",
        "expected_tool": "direct",
        "expected_intent": "LLM_DIRECT"
    },
    {
        "id": "08",
        "name": "policy",
        "question": "What are the promotion hike criteria at ETS?",
        "expected_tool": "authoritative_rag",
        "expected_intent": "LLM_RAG"
    },
    {
        "id": "09",
        "name": "executive",
        "question": "Give me an evidence-based workforce assessment. Identify the most important workforce patterns you can establish from the available data, explain the supporting evidence, and clearly separate facts from interpretations and data limitations. Do not invent metrics that are not available.",
        "expected_tool": "governed_analytics",
        "expected_intent": "LLM_ANALYTICS"
    }
]

def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", "replace").decode("ascii"))

def run_suite():
    safe_print(f"Starting ETS Copilot Playwright Clean-Session Verification Suite at {datetime.datetime.now()}")
    results = []
    all_console_logs = []
    all_network_errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        page.on("console", lambda msg: all_console_logs.append(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] [{msg.type}] {msg.text}"))
        page.on("pageerror", lambda exc: all_console_logs.append(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] [PAGE_ERROR] {exc}"))
        page.on("requestfailed", lambda req: all_network_errors.append(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] [FAILED_REQ] {req.url} {req.failure}"))

        # Run primary tests 1 through 9 with clean fresh session per test
        for tc in TEST_CASES:
            tid = tc["id"]
            tname = tc["name"]
            q = tc["question"]
            safe_print(f"\n==========================================")
            safe_print(f"Running Test {tid}: {tname}")
            safe_print(f"Question: {q}")
            t_start = datetime.datetime.now().isoformat()
            t0 = time.perf_counter()

            page.goto(FRONTEND_URL, wait_until="networkidle", timeout=30000)
            time.sleep(1.5)

            genie_btn = page.locator("button[aria-label='Toggle ETS Genie assistant']").first
            if genie_btn.is_visible():
                genie_btn.click()
                time.sleep(1)

            input_box = page.locator("input[placeholder*='Ask AI']").first
            input_box.wait_for(state="visible", timeout=5000)
            input_box.fill(q)

            # Screenshot A: Question entered
            q_img_name = f"{tid}_{tname}_question.png"
            q_img_path = os.path.join(ARTIFACT_DIR, q_img_name)
            page.screenshot(path=q_img_path)
            safe_print(f"Captured Screenshot A: {q_img_name}")

            submit_btn = page.locator("button[type='submit']").first
            submit_btn.click()

            safe_print("Waiting for response to render in UI...")
            try:
                page.wait_for_function(
                    "() => document.querySelectorAll('div.flex.flex-col.gap-1.items-start').length >= 2",
                    timeout=55000
                )
                page.wait_for_selector("div:has-text('Analyzing workforce records...')", state="detached", timeout=55000)
                time.sleep(2)
                success = True
                error_msg = None
            except Exception as e:
                safe_print(f"Timeout or error waiting for response: {e}")
                success = False
                error_msg = str(e)

            dur_ms = round((time.perf_counter() - t0) * 1000, 1)

            assistant_messages = page.locator("div.flex.flex-col.gap-1.items-start").all()
            visible_text = ""
            visible_intent = None
            has_chart = False
            has_insights = False
            visible_src = None

            if len(assistant_messages) >= 2:
                last_msg = assistant_messages[-1]
                visible_text = last_msg.inner_text()
                
                chart_el = last_msg.locator("div.recharts-responsive-container, svg.recharts-surface").first
                has_chart = chart_el.is_visible() if chart_el.count() > 0 else False
                
                insights_el = last_msg.locator("span:has-text('Key Insights:')").first
                has_insights = insights_el.is_visible() if insights_el.count() > 0 else False

                intent_el = last_msg.locator("span[class*='bg-purple']").first
                if intent_el.count() > 0 and intent_el.is_visible():
                    visible_intent = intent_el.inner_text()

                src_el = last_msg.locator("span:has-text('Src:')").first
                if src_el.count() > 0 and src_el.is_visible():
                    visible_src = src_el.inner_text()

            # Screenshot B: Answer completely rendered
            a_img_name = f"{tid}_{tname}_answer.png"
            a_img_path = os.path.join(ARTIFACT_DIR, a_img_name)
            page.screenshot(path=a_img_path)
            safe_print(f"Captured Screenshot B: {a_img_name}")
            safe_print(f"Duration: {dur_ms}ms | Success: {success} | Intent: {visible_intent} | Chart: {has_chart}")

            res_entry = {
                "test_id": tid,
                "test_name": tname,
                "question": q,
                "timestamp": t_start,
                "duration_ms": dur_ms,
                "success": success,
                "error": error_msg,
                "screenshot_question": q_img_path,
                "screenshot_answer": a_img_path,
                "visible_intent": visible_intent,
                "visible_source": visible_src,
                "has_chart": has_chart,
                "has_insights": has_insights,
                "visible_answer_snippet": visible_text[:250].replace("\n", " ")
            }
            results.append(res_entry)

        # -----------------------------------------------------------------
        # TEST 11: EVIDENCE MUTATION TEST THROUGH REAL FRONTEND
        # -----------------------------------------------------------------
        safe_print(f"\n==========================================")
        safe_print("Running Evidence Mutation Test through Frontend")
        excel_path = r"c:\Users\affra\Documents\ETS\ETS-Dashboard\ETS_Dasboard_DS.xlsx"
        backup_path = r"c:\Users\affra\Documents\ETS\ETS-Dashboard\ETS_Dasboard_DS_bak.xlsx"
        shutil.copyfile(excel_path, backup_path)
        
        try:
            wb = openpyxl.load_workbook(excel_path)
            ws = wb['EMPLOYEES']
            dept_col = None
            for col in range(1, ws.max_column + 1):
                if ws.cell(row=1, column=col).value == 'DEPARTMENT':
                    dept_col = col
                    break
            if dept_col:
                for row in range(2, ws.max_row + 1):
                    val = ws.cell(row=row, column=dept_col).value
                    if val == 'IT':
                        ws.cell(row=row, column=dept_col).value = 'Engineering'
                    elif val == 'Core':
                        ws.cell(row=row, column=dept_col).value = 'Product'
            wb.save(excel_path)
            safe_print("Mutated Excel saved: IT -> Engineering, Core -> Product")

            safe_print("Restarting backend to load mutated dataset into SQLite...")
            subprocess.run(["powershell", "-Command", "$proc = Get-Process python | Where-Object { $_.CommandLine -like '*uvicorn*' -or $_.CommandLine -like '*backend.app.main*' }; if ($proc) { Stop-Process -Id $proc.Id -Force }"], check=False)
            time.sleep(2)
            subprocess.Popen(["powershell", "-Command", "python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 42006"], creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)
            for _ in range(20):
                time.sleep(1)
                try:
                    with urllib.request.urlopen("http://localhost:42006/api/health", timeout=2) as r:
                        if r.status == 200:
                            safe_print("Backend ready with mutated dataset!")
                            break
                except:
                    pass

            # Submit question through frontend
            t11_q = "Which 3 departments have the highest headcount?"
            page.goto(FRONTEND_URL, wait_until="networkidle", timeout=30000)
            time.sleep(2)
            genie_btn = page.locator("button[aria-label='Toggle ETS Genie assistant']").first
            genie_btn.click()
            time.sleep(1)

            input_box = page.locator("input[placeholder*='Ask AI']").first
            input_box.wait_for(state="visible", timeout=5000)
            input_box.fill(t11_q)

            q11_path = os.path.join(ARTIFACT_DIR, "11_mutated_evidence_question.png")
            page.screenshot(path=q11_path)
            safe_print("Captured: 11_mutated_evidence_question.png")

            page.locator("button[type='submit']").first.click()

            page.wait_for_function("() => document.querySelectorAll('div.flex.flex-col.gap-1.items-start').length >= 2", timeout=55000)
            page.wait_for_selector("div:has-text('Analyzing workforce records...')", state="detached", timeout=55000)
            time.sleep(2)

            a11_path = os.path.join(ARTIFACT_DIR, "11_mutated_evidence_answer.png")
            page.screenshot(path=a11_path)
            safe_print("Captured: 11_mutated_evidence_answer.png")

            msgs11 = page.locator("div.flex.flex-col.gap-1.items-start").all()
            mutated_text = msgs11[-1].inner_text() if len(msgs11) >= 2 else ""
            safe_print(f"Mutated answer in UI: {mutated_text[:150]}")

            is_mutated_correct = "engineering" in mutated_text.lower() or "product" in mutated_text.lower()
            results.append({
                "test_id": "11",
                "test_name": "evidence_mutation",
                "question": t11_q,
                "timestamp": datetime.datetime.now().isoformat(),
                "success": is_mutated_correct,
                "screenshot_question": q11_path,
                "screenshot_answer": a11_path,
                "visible_answer_snippet": mutated_text[:250].replace("\n", " ")
            })
        finally:
            safe_print("Restoring original Excel dataset and restarting backend...")
            shutil.copyfile(backup_path, excel_path)
            os.remove(backup_path)
            subprocess.run(["powershell", "-Command", "$proc = Get-Process python | Where-Object { $_.CommandLine -like '*uvicorn*' -or $_.CommandLine -like '*backend.app.main*' }; if ($proc) { Stop-Process -Id $proc.Id -Force }"], check=False)
            time.sleep(2)
            subprocess.Popen(["powershell", "-Command", "python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 42006"], creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)
            for _ in range(20):
                time.sleep(1)
                try:
                    with urllib.request.urlopen("http://localhost:42006/api/health", timeout=2) as r:
                        if r.status == 200:
                            safe_print("Backend restored to original dataset!")
                            break
                except:
                    pass

        # -----------------------------------------------------------------
        # TEST 10: REAL OLLAMA OFFLINE TEST THROUGH FRONTEND
        # -----------------------------------------------------------------
        safe_print(f"\n==========================================")
        safe_print("Running Test 10: Ollama Offline Failure Test")
        t0 = time.perf_counter()
        t10_q = "Which 3 departments have the highest headcount?"
        
        safe_print("Stopping Ollama process to test real offline failure...")
        subprocess.run(["powershell", "-Command", "Stop-Process -Name 'ollama*' -Force -ErrorAction SilentlyContinue"], check=False)
        time.sleep(2)
        
        ollama_offline = False
        try:
            with urllib.request.urlopen(f"{OLLAMA_URL}/api/tags", timeout=1.5):
                pass
        except Exception:
            ollama_offline = True
        safe_print(f"Confirmed Ollama is offline: {ollama_offline}")

        page.goto(FRONTEND_URL, wait_until="networkidle", timeout=30000)
        time.sleep(1.5)
        genie_btn = page.locator("button[aria-label='Toggle ETS Genie assistant']").first
        genie_btn.click()
        time.sleep(1)

        input_box = page.locator("input[placeholder*='Ask AI']").first
        input_box.wait_for(state="visible", timeout=5000)
        input_box.fill(t10_q)

        # Screenshot A: 10_ollama_offline_question.png
        q10_path = os.path.join(ARTIFACT_DIR, "10_ollama_offline_question.png")
        page.screenshot(path=q10_path)
        safe_print(f"Captured: 10_ollama_offline_question.png")

        submit_btn = page.locator("button[type='submit']").first
        submit_btn.click()

        try:
            page.wait_for_function(
                "() => document.querySelectorAll('div.flex.flex-col.gap-1.items-start').length >= 2",
                timeout=30000
            )
            time.sleep(2)
            t10_success = True
        except Exception as e:
            t10_success = False
            safe_print(f"Timeout waiting for offline message: {e}")

        # Screenshot B: 10_ollama_offline_result.png
        a10_path = os.path.join(ARTIFACT_DIR, "10_ollama_offline_result.png")
        page.screenshot(path=a10_path)
        safe_print(f"Captured: 10_ollama_offline_result.png")

        msgs10 = page.locator("div.flex.flex-col.gap-1.items-start").all()
        last_text = msgs10[-1].inner_text() if len(msgs10) >= 2 else ""
        dur10 = round((time.perf_counter() - t0) * 1000, 1)

        is_offline_answer = "unavailable" in last_text.lower() or "offline" in last_text.lower() or "ai_unavailable" in last_text.lower()

        t10_entry = {
            "test_id": "10",
            "test_name": "ollama_offline",
            "question": t10_q,
            "timestamp": datetime.datetime.now().isoformat(),
            "duration_ms": dur10,
            "success": is_offline_answer,
            "screenshot_question": q10_path,
            "screenshot_answer": a10_path,
            "visible_answer_snippet": last_text[:250].replace("\n", " ")
        }
        results.append(t10_entry)

        # Restart Ollama service
        safe_print("Restarting Ollama daemon...")
        subprocess.Popen(["powershell", "-Command", "Start-Process ollama -ArgumentList 'serve'"], creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)
        for _ in range(15):
            time.sleep(1)
            try:
                with urllib.request.urlopen(f"{OLLAMA_URL}/api/tags", timeout=1.5) as r:
                    if r.status == 200:
                        safe_print("Ollama restarted successfully and responsive!")
                        break
            except Exception:
                pass

        browser.close()

    summary_path = os.path.join(ARTIFACT_DIR, "playwright_verification_summary.json")
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump({
            "generated_at": datetime.datetime.now().isoformat(),
            "results": results,
            "console_logs_count": len(all_console_logs),
            "console_logs_sample": all_console_logs[:25],
            "network_errors_count": len(all_network_errors),
            "network_errors": all_network_errors
        }, f, indent=2)
    safe_print(f"\nVerification Suite Completed! Summary written to: {summary_path}")

if __name__ == "__main__":
    run_suite()
