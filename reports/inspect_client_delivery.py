from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto("http://127.0.0.1:42005/login")
    page.locator("input").first.fill("employee")
    page.locator("input[type=password]").fill("Employee@2026!")
    page.locator("button[type=submit]").click()
    page.wait_for_url("**/dashboard**", timeout=10000)
    page.wait_for_timeout(2000)

    # Click on "Client Delivery" tab
    page.locator("button:has-text('Client Delivery')").click()
    page.wait_for_timeout(2000)

    print("Client Delivery tab clicked.")
    # Check page text and elements
    text_sample = page.inner_text("main, .flex-1").replace("\n", " ")[:500]
    print("Content snippet:", text_sample)

    page.screenshot(path="reports/playwright_evidence/client_delivery_tab.png")
    print("Saved reports/playwright_evidence/client_delivery_tab.png")

    browser.close()
