import os
import sys
import time
import json
from playwright.sync_api import sync_playwright

FRONTEND_URL = "http://localhost:42005"
ARTIFACT_DIR = r"c:\Users\affra\Documents\ETS\ETS-Dashboard\test-results\copilot-ui"
os.makedirs(ARTIFACT_DIR, exist_ok=True)

def test_rag_ui_playwright():
    print("[Playwright E2E] Starting Real UI-to-RAG End-to-End Verification...")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        print(f"[Playwright E2E] Navigating to {FRONTEND_URL}")
        page.goto(FRONTEND_URL, wait_until="networkidle", timeout=30000)
        time.sleep(2)

        # Open Genie drawer
        genie_btn = page.locator("button[aria-label='Toggle ETS Genie assistant']").first
        assert genie_btn.is_visible(), "Genie toggle button not visible"
        genie_btn.click()
        time.sleep(1)

        # Type question
        query = "What are the promotion hike criteria at ETS?"
        input_box = page.locator("input[placeholder*='Ask AI']").first
        input_box.wait_for(state="visible", timeout=5000)
        input_box.fill(query)

        # Screenshot question
        q_img_path = os.path.join(ARTIFACT_DIR, "final_gate_policy_question.png")
        page.screenshot(path=q_img_path)
        print(f"[Playwright E2E] Captured question screenshot: {q_img_path}")

        # Submit
        submit_btn = page.locator("button[type='submit']").first
        submit_btn.click()
        print("[Playwright E2E] Submitted query, waiting for AI response...")

        # Wait for response message
        page.wait_for_function(
            "() => document.querySelectorAll('div.flex.flex-col.gap-1.items-start').length >= 2",
            timeout=75000
        )
        page.wait_for_selector("div:has-text('Analyzing workforce records...')", state="detached", timeout=75000)
        time.sleep(2)

        # Screenshot answer
        a_img_path = os.path.join(ARTIFACT_DIR, "final_gate_policy_answer.png")
        page.screenshot(path=a_img_path)
        print(f"[Playwright E2E] Captured answer screenshot: {a_img_path}")

        # Inspect rendered message
        assistant_messages = page.locator("div.flex.flex-col.gap-1.items-start").all()
        assert len(assistant_messages) >= 2, "No response message found in UI"
        last_msg = assistant_messages[-1]
        msg_text = last_msg.inner_text()

        print("\n[Playwright E2E] Visible text in UI:\n", msg_text[:300])

        # Assertions
        assert "[LLM_RAG]" in msg_text or "LLM_RAG" in msg_text, f"Expected LLM_RAG intent in UI. Got: {msg_text[:150]}"
        assert "Src: /api/copilot/semantic_rag" in msg_text, f"Expected semantic_rag source in UI. Got: {msg_text[:150]}"
        assert "promotion" in msg_text.lower() or "grade" in msg_text.lower(), "Expected policy answer in UI"

        browser.close()
        print("\n[Playwright E2E] Real UI-to-RAG End-to-End Verification: PASSED")

if __name__ == "__main__":
    test_rag_ui_playwright()
