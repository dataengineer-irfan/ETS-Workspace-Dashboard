from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1366, 'height': 768}, device_scale_factor=1)
    page = context.new_page()
    page.goto('http://localhost:42005', wait_until='networkidle')
    page.wait_for_timeout(2000)
    
    page.screenshot(path='filter_test_1366_default.png')
    print('Default 1366 screenshot saved')
    
    body_text = page.inner_text('body')
    print('Initial contains 590:', '590' in body_text)
    
    # Click State slicer
    page.locator('text=State (All)').first.click()
    page.wait_for_timeout(500)
    page.screenshot(path='filter_test_state_dropdown.png')
    print('State dropdown screenshot saved')
    
    # Click option AK
    page.locator('div[id*="option"]:has-text("AK")').first.click()
    page.wait_for_timeout(1500)
    
    body_text_ak = page.inner_text('body')
    print('After AK filter contains 108:', '108' in body_text_ak)
    page.screenshot(path='filter_test_ak_filtered.png')
    print('AK filter screenshot saved')
    
    # Multi-select: click ND as well
    page.locator('text=AK').first.click()
    page.wait_for_timeout(500)
    page.locator('div[id*="option"]:has-text("ND")').first.click()
    page.wait_for_timeout(1500)
    body_text_multi = page.inner_text('body')
    print('After AK+ND filter contains 226:', '226' in body_text_multi)
    page.screenshot(path='filter_test_ak_nd_filtered.png')
    print('AK+ND filter screenshot saved')
    
    # Test Reset
    page.locator('button:has-text("Reset")').click()
    page.wait_for_timeout(1500)
    body_text_reset = page.inner_text('body')
    print('After Reset contains 590:', '590' in body_text_reset)
    page.screenshot(path='filter_test_reset.png')
    print('Reset screenshot saved')
    
    browser.close()
