"""
ETS Genie — AI Evaluation Report Generator
Parses raw evaluation telemetry JSON and produces:
1. Multi-tab Excel report (reports/ets_genie_ai_evaluation_<timestamp>.xlsx) with all 13 worksheets
2. Markdown summary scorecard (reports/ETS_GENIE_EVALUATION_REPORT.md)
"""

import os
import sys
import json
import argparse
import datetime
import numpy as np
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from typing import Dict, Any, List

def style_header(cell, text, fill_color="1E293B", font_color="FFFFFF"):
    cell.value = text
    cell.font = Font(name="Calibri", size=11, bold=True, color=font_color)
    cell.fill = PatternFill(start_color=fill_color, end_color=fill_color, fill_type="solid")
    cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

def auto_fit_columns(ws, max_cols=30):
    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )
    for col in ws.iter_cols(min_row=1, max_col=min(ws.max_column, max_cols), max_row=ws.max_row):
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            cell.border = thin_border
            val_str = str(cell.value or '')
            if len(val_str) > max_len:
                max_len = len(val_str)
        ws.column_dimensions[col_letter].width = min(max(max_len + 3, 12), 55)

def generate_evaluation_reports(json_path: str, output_dir: str = "reports") -> str:
    print(f"Loading raw telemetry from {json_path}...")
    with open(json_path, "r", encoding="utf-8") as f:
        run_data = json.load(f)

    questions = run_data.get("questions", [])
    total_q = len(questions)
    if total_q == 0:
        print("No questions found in telemetry JSON.")
        return ""

    # Metric Calculations
    passed_cnt = sum(1 for q in questions if "PASS" in q.get("evaluation_result", ""))
    failed_cnt = total_q - passed_cnt
    expected_failures = sum(1 for q in questions if "EXPECTED FAILURE" in q.get("evaluation_result", ""))
    unexpected_failures = sum(1 for q in questions if "FAIL" in q.get("evaluation_result", ""))

    accuracy = round((passed_cnt / total_q) * 100, 2)
    latencies = [q.get("total_latency", 0.0) for q in questions]
    avg_latency = round(float(np.mean(latencies)), 2)
    p50_latency = round(float(np.percentile(latencies, 50)), 2)
    p95_latency = round(float(np.percentile(latencies, 95)), 2)
    p99_latency = round(float(np.percentile(latencies, 99)), 2)

    fallback_cnt = sum(1 for q in questions if q.get("fallback_detected"))
    mock_cnt = sum(1 for q in questions if q.get("mock_detected"))
    hardcoded_cnt = sum(1 for q in questions if q.get("hardcoded_behavior_detected"))

    # Create Excel Workbook
    wb = openpyxl.Workbook()
    # Remove default sheet
    default_sheet = wb.active

    # 1. Executive_Summary
    ws_exec = wb.create_sheet("Executive_Summary")
    ws_exec.views.sheetView[0].showGridLines = True
    ws_exec.merge_cells("A1:D1")
    ws_exec["A1"] = "ETS GENIE AI EVALUATION — EXECUTIVE SCORECARD"
    ws_exec["A1"].font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    ws_exec["A1"].fill = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")
    ws_exec["A1"].alignment = Alignment(horizontal="center", vertical="center")

    summary_rows = [
        ("Run ID", run_data.get("run_id", "N/A")),
        ("Timestamp", run_data.get("timestamp", "N/A")),
        ("Total Questions Executed", total_q),
        ("Total Passed", passed_cnt),
        ("Total Failed", failed_cnt),
        ("Expected Failures (Governed Hard-Gates)", expected_failures),
        ("Unexpected Failures", unexpected_failures),
        ("Overall System Accuracy", f"{accuracy}%"),
        ("Average Pipeline Latency", f"{avg_latency}s"),
        ("P50 Latency", f"{p50_latency}s"),
        ("P95 Latency", f"{p95_latency}s"),
        ("P99 Latency", f"{p99_latency}s"),
        ("Unexpected Fallbacks Detected", fallback_cnt),
        ("Mocks / Fakes Detected", mock_cnt),
        ("Hardcoded Answers Detected", hardcoded_cnt),
    ]

    for idx, (k, v) in enumerate(summary_rows, start=3):
        ws_exec.cell(row=idx, column=1, value=k).font = Font(bold=True)
        ws_exec.cell(row=idx, column=2, value=v)

    auto_fit_columns(ws_exec)

    # 2. Question_Results (Master Sheet)
    ws_qr = wb.create_sheet("Question_Results")
    headers_qr = [
        "Question ID", "Page", "Category", "Subcategory", "Difficulty",
        "Question", "Expected Cap", "Actual Cap", "Expected Outcome", "Actual Outcome",
        "Evaluation Result", "Failure Stage", "Total Latency (s)", "Confidence",
        "Final Intent", "Answer", "Fallback", "Mock"
    ]
    for c_idx, h in enumerate(headers_qr, start=1):
        style_header(ws_qr.cell(row=1, column=c_idx), h)

    for r_idx, q in enumerate(questions, start=2):
        ws_qr.cell(row=r_idx, column=1, value=q.get("question_id"))
        ws_qr.cell(row=r_idx, column=2, value=q.get("page"))
        ws_qr.cell(row=r_idx, column=3, value=q.get("category"))
        ws_qr.cell(row=r_idx, column=4, value=q.get("subcategory"))
        ws_qr.cell(row=r_idx, column=5, value=q.get("difficulty"))
        ws_qr.cell(row=r_idx, column=6, value=q.get("question"))
        ws_qr.cell(row=r_idx, column=7, value=q.get("expected_capability"))
        ws_qr.cell(row=r_idx, column=8, value=q.get("actual_capability"))
        ws_qr.cell(row=r_idx, column=9, value=q.get("expected_outcome"))
        ws_qr.cell(row=r_idx, column=10, value=q.get("actual_outcome"))
        res_cell = ws_qr.cell(row=r_idx, column=11, value=q.get("evaluation_result"))
        if "PASS" in str(res_cell.value):
            res_cell.font = Font(color="166534", bold=True)
        else:
            res_cell.font = Font(color="991B1B", bold=True)
        ws_qr.cell(row=r_idx, column=12, value=q.get("failure_stage"))
        ws_qr.cell(row=r_idx, column=13, value=q.get("total_latency"))
        ws_qr.cell(row=r_idx, column=14, value=q.get("final_confidence"))
        ws_qr.cell(row=r_idx, column=15, value=q.get("final_intent"))
        ws_qr.cell(row=r_idx, column=16, value=q.get("answer"))
        ws_qr.cell(row=r_idx, column=17, value="YES" if q.get("fallback_detected") else "NO")
        ws_qr.cell(row=r_idx, column=18, value="YES" if q.get("mock_detected") else "NO")

    auto_fit_columns(ws_qr)

    # 3. Planner Sheet
    ws_pl = wb.create_sheet("Planner")
    headers_pl = ["Question ID", "Question", "Expected Cap", "Actual Cap", "Planner Status", "Planner Output", "Latency (ms)"]
    for c_idx, h in enumerate(headers_pl, start=1):
        style_header(ws_pl.cell(row=1, column=c_idx), h)
    for r_idx, q in enumerate(questions, start=2):
        ws_pl.cell(row=r_idx, column=1, value=q.get("question_id"))
        ws_pl.cell(row=r_idx, column=2, value=q.get("question"))
        ws_pl.cell(row=r_idx, column=3, value=q.get("expected_capability"))
        ws_pl.cell(row=r_idx, column=4, value=q.get("actual_capability"))
        ws_pl.cell(row=r_idx, column=5, value=q.get("planner_status"))
        ws_pl.cell(row=r_idx, column=6, value=str(q.get("planner_output", "")))
        ws_pl.cell(row=r_idx, column=7, value=q.get("planner_latency"))
    auto_fit_columns(ws_pl)

    # 4. SQL Sheet
    ws_sql = wb.create_sheet("SQL")
    headers_sql = ["Question ID", "Question", "Generated SQL", "Governance Status", "Execution Status", "Rows Returned"]
    for c_idx, h in enumerate(headers_sql, start=1):
        style_header(ws_sql.cell(row=1, column=c_idx), h)
    sql_qs = [q for q in questions if q.get("expected_capability") == "SQL" or q.get("actual_capability") == "SQL"]
    for r_idx, q in enumerate(sql_qs, start=2):
        ws_sql.cell(row=r_idx, column=1, value=q.get("question_id"))
        ws_sql.cell(row=r_idx, column=2, value=q.get("question"))
        ws_sql.cell(row=r_idx, column=3, value=q.get("generated_sql"))
        ws_sql.cell(row=r_idx, column=4, value=q.get("sql_governance_status"))
        ws_sql.cell(row=r_idx, column=5, value=q.get("sql_execution_status"))
        ws_sql.cell(row=r_idx, column=6, value=q.get("row_count"))
    auto_fit_columns(ws_sql)

    # 5. RAG Sheet
    ws_rag = wb.create_sheet("RAG")
    headers_rag = ["Question ID", "Question", "Retrieved Docs", "Scores", "Threshold", "RAG Status", "Evidence Count"]
    for c_idx, h in enumerate(headers_rag, start=1):
        style_header(ws_rag.cell(row=1, column=c_idx), h)
    rag_qs = [q for q in questions if q.get("expected_capability") == "RAG" or q.get("actual_capability") == "RAG"]
    for r_idx, q in enumerate(rag_qs, start=2):
        ws_rag.cell(row=r_idx, column=1, value=q.get("question_id"))
        ws_rag.cell(row=r_idx, column=2, value=q.get("question"))
        ws_rag.cell(row=r_idx, column=3, value=", ".join(q.get("retrieved_document_ids", [])))
        ws_rag.cell(row=r_idx, column=4, value=str(q.get("similarity_scores", [])))
        ws_rag.cell(row=r_idx, column=5, value=q.get("rag_threshold"))
        ws_rag.cell(row=r_idx, column=6, value=q.get("rag_status"))
        ws_rag.cell(row=r_idx, column=7, value=q.get("evidence_count"))
    auto_fit_columns(ws_rag)

    # 6. Grounding Sheet
    ws_gr = wb.create_sheet("Grounding")
    headers_gr = ["Question ID", "Question", "Grounding Status", "Supported Claims", "Unsupported Claims", "Failure Reason"]
    for c_idx, h in enumerate(headers_gr, start=1):
        style_header(ws_gr.cell(row=1, column=c_idx), h)
    for r_idx, q in enumerate(questions, start=2):
        ws_gr.cell(row=r_idx, column=1, value=q.get("question_id"))
        ws_gr.cell(row=r_idx, column=2, value=q.get("question"))
        ws_gr.cell(row=r_idx, column=3, value=q.get("grounding_status"))
        ws_gr.cell(row=r_idx, column=4, value=q.get("supported_claim_count"))
        ws_gr.cell(row=r_idx, column=5, value=q.get("unsupported_claim_count"))
        ws_gr.cell(row=r_idx, column=6, value=q.get("grounding_failure_reason"))
    auto_fit_columns(ws_gr)

    # 7. Authorization Sheet
    ws_auth = wb.create_sheet("Authorization")
    headers_auth = ["Question ID", "Question", "Security Class", "Authorization Status", "Outcome"]
    for c_idx, h in enumerate(headers_auth, start=1):
        style_header(ws_auth.cell(row=1, column=c_idx), h)
    sec_qs = [q for q in questions if q.get("category") == "security" or q.get("security_class") != "normal"]
    for r_idx, q in enumerate(sec_qs, start=2):
        ws_auth.cell(row=r_idx, column=1, value=q.get("question_id"))
        ws_auth.cell(row=r_idx, column=2, value=q.get("question"))
        ws_auth.cell(row=r_idx, column=3, value=q.get("security_class"))
        ws_auth.cell(row=r_idx, column=4, value=q.get("authorization_status"))
        ws_auth.cell(row=r_idx, column=5, value=q.get("evaluation_result"))
    auto_fit_columns(ws_auth)

    # 8. Failures Sheet
    ws_fl = wb.create_sheet("Failures")
    headers_fl = ["Question ID", "Question", "Expected Outcome", "Actual Outcome", "Failure Stage", "Error Code", "Error Message"]
    for c_idx, h in enumerate(headers_fl, start=1):
        style_header(ws_fl.cell(row=1, column=c_idx), h, fill_color="991B1B")
    fail_qs = [q for q in questions if "FAIL" in q.get("evaluation_result", "")]
    for r_idx, q in enumerate(fail_qs, start=2):
        ws_fl.cell(row=r_idx, column=1, value=q.get("question_id"))
        ws_fl.cell(row=r_idx, column=2, value=q.get("question"))
        ws_fl.cell(row=r_idx, column=3, value=q.get("expected_outcome"))
        ws_fl.cell(row=r_idx, column=4, value=q.get("actual_outcome"))
        ws_fl.cell(row=r_idx, column=5, value=q.get("failure_stage"))
        ws_fl.cell(row=r_idx, column=6, value=q.get("error_code"))
        ws_fl.cell(row=r_idx, column=7, value=q.get("error_message"))
    auto_fit_columns(ws_fl)

    # 9. Page_Coverage
    ws_pc = wb.create_sheet("Page_Coverage")
    headers_pc = ["Page", "Total Questions", "Passed", "Failed", "Accuracy (%)"]
    for c_idx, h in enumerate(headers_pc, start=1):
        style_header(ws_pc.cell(row=1, column=c_idx), h)
    pages = ["home", "techwise", "statewise", "salarywise", "calendar", "employee_details"]
    for r_idx, p in enumerate(pages, start=2):
        p_qs = [q for q in questions if q.get("page") == p]
        p_tot = len(p_qs)
        p_pass = sum(1 for q in p_qs if "PASS" in q.get("evaluation_result", ""))
        p_fail = p_tot - p_pass
        p_acc = round((p_pass / p_tot * 100) if p_tot else 0.0, 1)
        ws_pc.cell(row=r_idx, column=1, value=p)
        ws_pc.cell(row=r_idx, column=2, value=p_tot)
        ws_pc.cell(row=r_idx, column=3, value=p_pass)
        ws_pc.cell(row=r_idx, column=4, value=p_fail)
        ws_pc.cell(row=r_idx, column=5, value=f"{p_acc}%")
    auto_fit_columns(ws_pc)

    # 10. Category_Coverage
    ws_cc = wb.create_sheet("Category_Coverage")
    headers_cc = ["Category", "Total Questions", "Passed", "Failed", "Accuracy (%)"]
    for c_idx, h in enumerate(headers_cc, start=1):
        style_header(ws_cc.cell(row=1, column=c_idx), h)
    cats = sorted(list({q.get("category", "unknown") for q in questions}))
    for r_idx, c in enumerate(cats, start=2):
        c_qs = [q for q in questions if q.get("category") == c]
        c_tot = len(c_qs)
        c_pass = sum(1 for q in c_qs if "PASS" in q.get("evaluation_result", ""))
        c_fail = c_tot - c_pass
        c_acc = round((c_pass / c_tot * 100) if c_tot else 0.0, 1)
        ws_cc.cell(row=r_idx, column=1, value=c)
        ws_cc.cell(row=r_idx, column=2, value=c_tot)
        ws_cc.cell(row=r_idx, column=3, value=c_pass)
        ws_cc.cell(row=r_idx, column=4, value=c_fail)
        ws_cc.cell(row=r_idx, column=5, value=f"{c_acc}%")
    auto_fit_columns(ws_cc)

    # 11. Difficulty
    ws_df = wb.create_sheet("Difficulty")
    headers_df = ["Difficulty Level", "Total Questions", "Passed", "Failed", "Accuracy (%)"]
    for c_idx, h in enumerate(headers_df, start=1):
        style_header(ws_df.cell(row=1, column=c_idx), h)
    diffs = ["easy", "medium", "hard"]
    for r_idx, d in enumerate(diffs, start=2):
        d_qs = [q for q in questions if q.get("difficulty") == d]
        d_tot = len(d_qs)
        d_pass = sum(1 for q in d_qs if "PASS" in q.get("evaluation_result", ""))
        d_fail = d_tot - d_pass
        d_acc = round((d_pass / d_tot * 100) if d_tot else 0.0, 1)
        ws_df.cell(row=r_idx, column=1, value=d.title())
        ws_df.cell(row=r_idx, column=2, value=d_tot)
        ws_df.cell(row=r_idx, column=3, value=d_pass)
        ws_df.cell(row=r_idx, column=4, value=d_fail)
        ws_df.cell(row=r_idx, column=5, value=f"{d_acc}%")
    auto_fit_columns(ws_df)

    # 12. Latency
    ws_lat = wb.create_sheet("Latency")
    headers_lat = ["Latency Metric", "Value (Seconds)"]
    for c_idx, h in enumerate(headers_lat, start=1):
        style_header(ws_lat.cell(row=1, column=c_idx), h)
    lat_rows = [
        ("Average Pipeline Latency", avg_latency),
        ("P50 (Median) Latency", p50_latency),
        ("P95 Latency", p95_latency),
        ("P99 Latency", p99_latency),
        ("Fastest Query Latency", round(float(np.min(latencies)), 2) if latencies else 0.0),
        ("Slowest Query Latency", round(float(np.max(latencies)), 2) if latencies else 0.0),
    ]
    for r_idx, (k, v) in enumerate(lat_rows, start=2):
        ws_lat.cell(row=r_idx, column=1, value=k)
        ws_lat.cell(row=r_idx, column=2, value=f"{v}s")
    auto_fit_columns(ws_lat)

    # 13. Fallback_Audit
    ws_fa = wb.create_sheet("Fallback_Audit")
    headers_fa = ["Question ID", "Question", "Expected Cap", "Actual Cap", "Fallback Detected", "Mock Detected", "Details"]
    for c_idx, h in enumerate(headers_fa, start=1):
        style_header(ws_fa.cell(row=1, column=c_idx), h)
    for r_idx, q in enumerate(questions, start=2):
        ws_fa.cell(row=r_idx, column=1, value=q.get("question_id"))
        ws_fa.cell(row=r_idx, column=2, value=q.get("question"))
        ws_fa.cell(row=r_idx, column=3, value=q.get("expected_capability"))
        ws_fa.cell(row=r_idx, column=4, value=q.get("actual_capability"))
        ws_fa.cell(row=r_idx, column=5, value="YES" if q.get("fallback_detected") else "NO")
        ws_fa.cell(row=r_idx, column=6, value="YES" if q.get("mock_detected") else "NO")
        ws_fa.cell(row=r_idx, column=7, value="Strict zero-trust verified: zero heuristic fallback" if not q.get("fallback_detected") else "UNEXPECTED FALLBACK PATH")
    auto_fit_columns(ws_fa)

    # Remove the initial blank sheet
    wb.remove(default_sheet)

    # Save Excel
    timestamp = run_data.get("timestamp", datetime.datetime.now().strftime("%Y%m%d_%H%M%S"))
    xlsx_path = os.path.join(output_dir, f"ets_genie_ai_evaluation_{timestamp}.xlsx")
    wb.save(xlsx_path)
    print(f"Generated 13-worksheet Excel report at: {xlsx_path}")

    # Generate Markdown Summary Report
    md_path = os.path.join(output_dir, "ETS_GENIE_EVALUATION_REPORT.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(f"""# ETS Genie AI Evaluation Report

**Evaluation Run ID**: `{run_data.get('run_id', 'RUN')}`  
**Generated At**: {datetime.datetime.now(datetime.timezone.utc).isoformat()}  
**Questions Executed**: {total_q}  

---

## 1. Executive Scorecard

```text
ETS GENIE AI EVALUATION SCORECARD
=================================
Questions Executed:              {total_q}

Overall Performance:
  Passed:                        {passed_cnt} ({accuracy}%)
  Failed:                        {failed_cnt}
  Expected Governed Rejections:  {expected_failures}
  Unexpected Failures:           {unexpected_failures}

Latency Statistics:
  Average Latency:               {avg_latency}s
  P50 (Median) Latency:          {p50_latency}s
  P95 Latency:                   {p95_latency}s
  P99 Latency:                   {p99_latency}s

Zero-Trust Integrity Verification:
  Unexpected Fallbacks:          {fallback_cnt} (0 expected)
  Mocks / Fakes Detected:        {mock_cnt} (0 expected)
  Hardcoded Answers Detected:    {hardcoded_cnt} (0 expected)
```

---

## 2. Six-Page Coverage Matrix

| Page Name | Route / Context | Questions | Passed | Failed | Accuracy |
|---|---|---:|---:|---:|---:|
""")
        for p in pages:
            p_qs = [q for q in questions if q.get("page") == p]
            p_tot = len(p_qs)
            p_pass = sum(1 for q in p_qs if "PASS" in q.get("evaluation_result", ""))
            p_fail = p_tot - p_pass
            p_acc = round((p_pass / p_tot * 100) if p_tot else 0.0, 1)
            f.write(f"| `{p}` | `/{p}` | {p_tot} | {p_pass} | {p_fail} | {p_acc}% |\n")

        f.write(f"""
---

## 3. Performance by Question Category

| Category | Total Questions | Passed | Failed | Accuracy |
|---|---:|---:|---:|---:|
""")
        for c in cats:
            c_qs = [q for q in questions if q.get("category") == c]
            c_tot = len(c_qs)
            c_pass = sum(1 for q in c_qs if "PASS" in q.get("evaluation_result", ""))
            c_fail = c_tot - c_pass
            c_acc = round((c_pass / c_tot * 100) if c_tot else 0.0, 1)
            f.write(f"| `{c}` | {c_tot} | {c_pass} | {c_fail} | {c_acc}% |\n")

        f.write(f"""
---

## 4. Failure Triage & Diagnostics

Total Unexpected Failures: **{len(fail_qs)}**

""")
        if fail_qs:
            f.write("| Question ID | Question | Expected Outcome | Actual Outcome | Failure Stage | Error Message |\n")
            f.write("|---|---|---|---|---|---|\n")
            for q in fail_qs:
                f.write(f"| `{q.get('question_id')}` | {q.get('question')} | `{q.get('expected_outcome')}` | `{q.get('actual_outcome')}` | `{q.get('failure_stage')}` | {q.get('error_message') or 'N/A'} |\n")
        else:
            f.write("Zero unexpected failures recorded across this evaluation run.\n")

    print(f"Generated Markdown Evaluation Report at: {md_path}")
    return xlsx_path

def main():
    parser = argparse.ArgumentParser(description="Generate Evaluation Excel & MD Reports")
    parser.add_argument("json_file", type=str, help="Path to evaluation telemetry JSON file")
    parser.add_argument("--output-dir", type=str, default="reports")
    args = parser.parse_args()

    generate_evaluation_reports(args.json_file, args.output_dir)

if __name__ == "__main__":
    main()
