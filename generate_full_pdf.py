import os
import time
from playwright.sync_api import sync_playwright
import pymupdf

OUTPUT_DIR = os.path.abspath("pdf_exports")
os.makedirs(OUTPUT_DIR, exist_ok=True)

PAGES_CONFIG = [
    {"id": "home", "name": "01_Workforce_Overview", "title": "Workforce Overview", "button_text": "Workforce Overview"},
    {"id": "statewise", "name": "02_State_Performance", "title": "State Performance", "button_text": "State Performance"},
    {"id": "techwise", "name": "03_Skills_and_Capability", "title": "Skills & Capability", "button_text": "Skills & Capability"},
    {"id": "salarywise", "name": "04_Compensation_Analytics", "title": "Compensation Analytics", "button_text": "Compensation Analytics"},
    {"id": "salarywise2", "name": "05_Compensation_Trends", "title": "Compensation Trends", "button_text": "Compensation Trends"},
    {"id": "calendar", "name": "06_Leave_and_Attendance", "title": "Leave & Attendance", "button_text": "Leave & Attendance"},
    {"id": "employee_details", "name": "07_Employee_Profile", "title": "Employee Profile", "button_text": "Employee Profile"},
]

def run():
    individual_pdfs = []
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use a high-DPI viewport 1920x1120 so all executive cards and footers fit cleanly
        context = browser.new_context(
            viewport={"width": 1920, "height": 1100},
            device_scale_factor=2
        )
        page = context.new_page()
        page.emulate_media(media="screen")
        
        print("Navigating to http://localhost:42005 ...")
        page.goto("http://localhost:42005", wait_until="networkidle")
        page.wait_for_timeout(2500)
        
        for idx, tab in enumerate(PAGES_CONFIG, start=1):
            print(f"[{idx}/{len(PAGES_CONFIG)}] Navigating to {tab['title']}...")
            # Click tab button
            page.click(f"nav button:has-text(\"{tab['button_text']}\")")
            # Wait for any API calls to settle and animations to finish
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(2000)
            
            # Check content scrollHeight to determine optimal height
            scroll_h = page.evaluate("() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, 1080)")
            render_height = max(1080, scroll_h)
            
            # Export individual PDF
            pdf_path = os.path.join(OUTPUT_DIR, f"{tab['name']}.pdf")
            png_path = os.path.join(OUTPUT_DIR, f"{tab['name']}.png")
            
            page.pdf(
                path=pdf_path,
                width="1920px",
                height=f"{render_height}px",
                print_background=True,
                margin={"top": "0px", "bottom": "0px", "left": "0px", "right": "0px"}
            )
            page.screenshot(path=png_path, full_page=True)
            print(f"   -> Saved: {pdf_path} (height: {render_height}px)")
            individual_pdfs.append((tab['title'], pdf_path))
            
        # Also capture AI Copilot Drawer open on Workforce Overview
        print("[8/8] Capturing AI Copilot Drawer...")
        page.click("nav button:has-text(\"Workforce Overview\")")
        page.wait_for_timeout(1000)
        copilot_btn = page.query_selector("button:has-text(\"AI Copilot\")")
        if copilot_btn:
            copilot_btn.click()
            page.wait_for_timeout(1500)
            pdf_path = os.path.join(OUTPUT_DIR, "08_AI_Copilot_Drawer.pdf")
            png_path = os.path.join(OUTPUT_DIR, "08_AI_Copilot_Drawer.png")
            page.pdf(
                path=pdf_path,
                width="1920px",
                height="1100px",
                print_background=True,
                margin={"top": "0px", "bottom": "0px", "left": "0px", "right": "0px"}
            )
            page.screenshot(path=png_path, full_page=True)
            print(f"   -> Saved: {pdf_path}")
            individual_pdfs.append(("AI Copilot Assistant", pdf_path))

        # Also capture Universal Slide-over Drawer on State Performance
        print("[9/9] Capturing Universal Employee Profile Drawer...")
        if copilot_btn:
            copilot_btn.click() # Close copilot
            page.wait_for_timeout(500)
        page.click("nav button:has-text(\"State Performance\")")
        page.wait_for_timeout(1500)
        first_row = page.query_selector("table tbody tr")
        if first_row:
            first_row.click()
            page.wait_for_timeout(1500)
            pdf_path = os.path.join(OUTPUT_DIR, "09_Employee_SlideOver_Drawer.pdf")
            png_path = os.path.join(OUTPUT_DIR, "09_Employee_SlideOver_Drawer.png")
            page.pdf(
                path=pdf_path,
                width="1920px",
                height="1100px",
                print_background=True,
                margin={"top": "0px", "bottom": "0px", "left": "0px", "right": "0px"}
            )
            page.screenshot(path=png_path, full_page=True)
            print(f"   -> Saved: {pdf_path}")
            individual_pdfs.append(("Employee Profile Slide-over", pdf_path))

        browser.close()

    # Now merge all individual PDFs into a single Master PDF using PyMuPDF
    master_pdf_path = os.path.join(OUTPUT_DIR, "ETS_Enterprise_Dashboard_All_Pages.pdf")
    print("\nMerging all pages into single Master PDF...")
    merged_doc = pymupdf.open()
    
    toc = [] # Table of contents: [[lvl, title, pageno], ...]
    current_page_no = 1
    
    for title, pdf_file in individual_pdfs:
        doc = pymupdf.open(pdf_file)
        page_count = len(doc)
        toc.append([1, title, current_page_no])
        merged_doc.insert_pdf(doc)
        doc.close()
        current_page_no += page_count
        
    merged_doc.set_toc(toc)
    merged_doc.save(master_pdf_path)
    merged_doc.close()
    
    print(f"\n Master PDF successfully generated: {master_pdf_path}")
    print(f"Total pages merged: {current_page_no - 1}")

if __name__ == "__main__":
    run()
