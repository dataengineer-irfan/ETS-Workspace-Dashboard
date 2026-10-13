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

    # Inspect filter elements
    print("Dashboard loaded. URL:", page.url)

    # Find Copilot button
    copilot_btn = page.locator("button:has-text('ETS Genie'), button:has-text('Copilot'), button[title*='Genie'], button[title*='Copilot']").all()
    print("Copilot buttons found:", len(copilot_btn))
    for b in copilot_btn:
        print("  Button text:", b.inner_text(), "aria-label:", b.get_attribute("aria-label"))

    # Find State filter element
    state_filter = page.locator("text=State, select[name*='state'], [aria-label*='state'], [aria-label*='State']").all()
    print("State filter candidates:", len(state_filter))

    # Take screenshot of dashboard
    page.screenshot(path="reports/playwright_evidence/dashboard_home.png")
    print("Screenshot saved to reports/playwright_evidence/dashboard_home.png")

    browser.close()
