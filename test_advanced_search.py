import time
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    
    # Test on 1366x768 (User's laptop resolution)
    context = browser.new_context(viewport={"width": 1366, "height": 768}, device_scale_factor=1)
    page = context.new_page()
    page.goto("http://localhost:42005", wait_until="networkidle")
    page.wait_for_timeout(2000)
    
    # 1. Click Employee Profile tab
    page.click("button:has-text('Employee Profile')")
    page.wait_for_timeout(2000)
    page.screenshot(path="scratch/test_v2_profile_initial.png")
    print("Saved scratch/test_v2_profile_initial.png")
    
    # 2. Open Slicer dropdown
    slicer_input = page.locator("div:has-text('Advanced Search')").locator("..").locator("input").first
    slicer_input.click()
    page.wait_for_timeout(600)
    page.screenshot(path="scratch/test_v2_slicer_open.png")
    print("Saved scratch/test_v2_slicer_open.png")
    
    # 3. Press Escape to close slicer
    page.keyboard.press("Escape")
    page.wait_for_timeout(500)
    
    # 4. Click Advanced Search button
    page.click("button:has-text('Advanced Search')")
    page.wait_for_timeout(1000)
    page.screenshot(path="scratch/test_v2_advanced_modal_open.png")
    print("Saved scratch/test_v2_advanced_modal_open.png")
    
    # 5. Type into advanced search input: 'Harshit'
    page.locator("input[placeholder*='Search by Employee Name']").fill("Harshit")
    page.wait_for_timeout(800)
    page.screenshot(path="scratch/test_v2_advanced_modal_filtered.png")
    print("Saved scratch/test_v2_advanced_modal_filtered.png")
    
    # 6. Click on Harshit card to select
    page.locator("div:has-text('Harshit Tiwari')").last.click()
    page.wait_for_timeout(2000)
    page.screenshot(path="scratch/test_v2_harshit_profile_selected.png")
    print("Saved scratch/test_v2_harshit_profile_selected.png")
    
    browser.close()
