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

    # List all tabs
    tabs = page.locator("nav button, header button").all()
    print("=== NAV / HEADER BUTTONS ===")
    for t in tabs:
        txt = t.inner_text().replace("\n", " ").strip()
        if txt:
            print("  Tab/Button:", txt)

    # List all selects / placeholders in FilterBar
    print("\n=== FILTER BAR CONTROLS ===")
    placeholders = page.locator(".css-1wa3eu0-placeholder, [class*='placeholder'], input[id*='react-select']").all()
    for ph in placeholders:
        print("  Control:", ph.inner_text() or ph.get_attribute("id") or ph.get_attribute("placeholder"))

    browser.close()
