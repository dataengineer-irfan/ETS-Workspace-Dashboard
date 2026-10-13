import json
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})

    # Capture network requests
    requests_log = []
    def handle_request(req):
        if "/api/copilot/query" in req.url:
            post_data = None
            try:
                post_data = req.post_data_json
            except:
                post_data = req.post_data
            requests_log.append({
                "url": req.url,
                "method": req.method,
                "post_data": post_data
            })
    page.on("request", handle_request)

    responses_log = []
    def handle_response(res):
        if "/api/copilot/query" in res.url:
            body = None
            try:
                body = res.json()
            except:
                body = res.text()
            responses_log.append({
                "url": res.url,
                "status": res.status,
                "body": body
            })
    page.on("response", handle_response)

    page.goto("http://127.0.0.1:42005/login")
    page.locator("input").first.fill("employee")
    page.locator("input[type=password]").fill("Employee@2026!")
    page.locator("button[type=submit]").click()
    page.wait_for_url("**/dashboard**", timeout=10000)
    page.wait_for_timeout(2000)

    # Click Project dropdown and select NH
    page.locator("text='Project (All)'").first.click()
    page.wait_for_timeout(500)
    page.locator("[class*='-option']:has-text('NH')").first.click()
    page.wait_for_timeout(1000)

    # Open ETS Genie
    page.locator("button:has-text('ETS Genie')").click()
    page.wait_for_timeout(1500)

    # Type query in ETS Genie input
    q = "Break down workforce by job level and project"
    input_box = page.locator("input[placeholder*='Ask'], textarea[placeholder*='Ask'], input[placeholder*='Genie'], input[placeholder*='question']").first
    input_box.fill(q)
    input_box.press("Enter")

    # Wait for copilot response
    page.wait_for_timeout(5000)

    print("=== CAPTURED REQUESTS ===")
    for r in requests_log:
        print(json.dumps(r, indent=2))

    print("\n=== CAPTURED RESPONSES ===")
    for res in responses_log:
        print("Status:", res["status"])
        body = res["body"]
        if isinstance(body, dict):
            print("Answer:", body.get("answer"))
            print("Intent:", body.get("intent"))
            print("Filters in resp:", body.get("filters"))
            print("Result items:", len(body.get("result_items", [])))
            for item in body.get("result_items", []):
                print("  Item:", item.get("title"), "| mode:", item.get("presentation_mode"))
                if item.get("table_spec"):
                    print("  Columns:", item["table_spec"].get("columns"))
                    print("  Rows count:", len(item["table_spec"].get("rows", [])))
                    print("  Sample rows:", item["table_spec"].get("rows", [])[:3])

    page.screenshot(path="reports/playwright_evidence/test_project_nh_genie.png")
    browser.close()
