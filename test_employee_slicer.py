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
    page.screenshot(path="scratch/test_laptop_1366_profile.png")
    print("Saved scratch/test_laptop_1366_profile.png")
    
    # 2. Open Employee Slicer dropdown
    slicer = page.locator("div:has-text('Employee Slicer:') + div").first
    slicer.click()
    page.wait_for_timeout(800)
    page.screenshot(path="scratch/test_slicer_open.png")
    print("Saved scratch/test_slicer_open.png")
    
    # 3. Type into search: 'Harshit'
    page.keyboard.type("Harshit")
    page.wait_for_timeout(800)
    page.screenshot(path="scratch/test_slicer_search.png")
    print("Saved scratch/test_slicer_search.png")
    
    # 4. Press Enter to select
    page.keyboard.press("Enter")
    page.wait_for_timeout(2000)
    page.screenshot(path="scratch/test_harshit_profile.png")
    print("Saved scratch/test_harshit_profile.png")
    
    browser.close()
