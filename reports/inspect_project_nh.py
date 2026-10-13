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

    # Click the Project dropdown
    proj_control = page.locator("text='Project (All)'").first
    proj_control.click()
    page.wait_for_timeout(1000)

    # List options in menu
    options = page.locator("[class*='-option']").all()
    print("Project options:")
    for opt in options:
        print("  -", opt.inner_text())

    # Click NH option
    nh_opt = page.locator("[class*='-option']:has-text('NH')").first
    if nh_opt:
        nh_opt.click()
        page.wait_for_timeout(1000)
        print("Clicked NH option")

    # Check active filter chips
    chips = page.locator("[class*='Active Filters'], [class*='activeEntries'], span:has-text('PROJECT:'), span:has-text('STATE:'), span:has-text('NH')").all()
    print("Found chips:", len(chips))
    for c in chips:
        print("  Chip:", c.inner_text().replace("\n", " "))

    page.screenshot(path="reports/playwright_evidence/project_nh_selected.png")
    browser.close()
