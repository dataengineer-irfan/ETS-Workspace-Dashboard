"""Fill remaining Cognos intake rows from roles/billing, then roll into master AI sheets.

Run:
  backend\\.venv\\Scripts\\python.exe templates\\_sync_ai_intake_to_master.py
"""
from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "templates"))
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

INTAKE = Path(
    r"c:\Users\peernayakgarib\OneDrive - Infinite Computer Solutions (India) Limited\Documents\Cursor\AI_Team_Intake_Cognos.xlsx"
)
MASTER = ROOT / "templates" / "Infinite_ETS_India_Workforce.xlsx"
MASTER_FALLBACK = ROOT / "templates" / "Infinite_ETS_India_Workforce_ai_updated.xlsx"

TEAL = "1F6F6A"
NAVY = "0B3A5B"
INK = "1F2933"
WHITE = "FFFFFF"
LINE = "D5DDE3"
thin = Border(
    left=Side(style="thin", color=LINE),
    right=Side(style="thin", color=LINE),
    top=Side(style="thin", color=LINE),
    bottom=Side(style="thin", color=LINE),
)


def font(size=11, bold=False, color=INK):
    return Font(name="Calibri", size=size, bold=bold, color=color)


def fill(hex_color):
    return PatternFill("solid", fgColor=hex_color)


def key(name):
    return " ".join(str(name or "").lower().split())


BILLING = {
    "Sriram Krishnakumar": {"usd": 34.00, "emp": 1033227, "role": "Associate Software Engineer"},
    "Chenchurathnam anjali": {"usd": 4.97, "emp": None, "role": "Associate / analyst"},
    "Veera Hema Chekkera": {"usd": 1.82, "emp": 1019823, "role": "Senior Software Engineer"},
    "Clement Govindaraj": {"usd": 29.90, "emp": 1033626, "role": "Senior Software Engineer"},
    "Eshaan Harish Rao": {"usd": 12.80, "emp": 1040931, "role": "Engineer"},
    "Shujaat Hussain": {"usd": 14.57, "emp": 1040187, "role": "Engineer"},
    "Peernayakgari IrfanBasha": {"usd": 8.00, "emp": 1017291, "role": "Technical Manager"},
    "Peernayakgari Irfan Basha": {"usd": 8.00, "emp": 1017291, "role": "Technical Manager"},
    "Obuli Sundar": {"usd": 25.76, "emp": 1027420, "role": "Software Engineer"},
}

# Role-based activity templates (honest manager-entered placeholders where person has not written yet).
ROLE_ACTIVITIES = {
    "Technical Manager": [
        ("Code review", "Reviewed Cognos delivery PRs and AI-assisted change summaries for the squad"),
        ("Docs", "Drafted AI utilization guidance and release notes for Cognos delivery"),
    ],
    "Senior Software Engineer": [
        ("Code generation", "Used Cursor to accelerate Cognos report XML and query scaffolding"),
        ("Refactoring", "Refactored legacy Cognos report modules with AI-assisted diffs"),
    ],
    "Software Engineer": [
        ("Code generation", "Generated Cognos report fragments and validation checks with Cursor"),
        ("Docs", "Documented mapping notes and test hints with Cursor"),
    ],
    "Associate Software Engineer": [
        ("Code generation", "Built Cognos XML stubs and test matrices with Cursor"),
        ("Defect analysis", "Analyzed defect vs baseline behavior with Cursor"),
    ],
    "Engineer": [
        ("Code generation", "Used Cursor for Cognos development and learning tasks"),
        ("Docs", "Captured implementation notes with Cursor"),
    ],
    "Associate / analyst": [
        ("Docs", "Used Cursor for requirements and checklist drafting"),
        ("Test design", "Drafted validation scenarios with Cursor"),
    ],
}


def header_map(ws, row=8):
    return {str(ws.cell(row, c).value or "").strip(): c for c in range(1, ws.max_column + 1) if ws.cell(row, c).value}


def existing_names(ws, hmap, header_row=8):
    names = set()
    col = hmap["Employee name"]
    for r in range(header_row + 1, ws.max_row + 1):
        nm = ws.cell(r, col).value
        if nm and "Example" not in str(nm):
            names.add(key(nm))
    return names


def write_row(ws, row, hmap, values):
    for name, value in values.items():
        col = hmap[name]
        cell = ws.cell(row, col, value)
        cell.border = thin
        cell.alignment = Alignment(vertical="center", wrap_text=True)
        cell.font = font(11)
    if "Employee number" in values and values["Employee number"]:
        ws.cell(row, hmap["Employee number"]).number_format = "0"
    for label in ("Period start", "Period end", "Billing start date", "Billing end date"):
        if label in values and values[label]:
            ws.cell(row, hmap[label]).number_format = "DD-MMM-YYYY"
    if "Cursor total usage (USD)" in values and values["Cursor total usage (USD)"] is not None:
        ws.cell(row, hmap["Cursor total usage (USD)"]).number_format = '"$"#,##0.00'


def fill_missing_intake(wb):
    ws = wb["Team intake"]
    hmap = header_map(ws)
    present = existing_names(ws, hmap)
    # next empty data row
    name_col = hmap["Employee name"]
    next_row = 9
    for r in range(9, ws.max_row + 1):
        if ws.cell(r, name_col).value:
            next_row = r + 1
    # skip note rows that aren't data
    while ws.cell(next_row, 1).value and str(ws.cell(next_row, 1).value).startswith("Amber"):
        next_row += 1

    b_start, b_end = date(2026, 10, 7), date(2026, 10, 31)
    added = 0
    # Canonical display names from billing (skip duplicate Irfan spelling)
    for display, meta in BILLING.items():
        if display == "Peernayakgari Irfan Basha":
            continue
        if key(display) in present or key("Peernayakgari Irfan Basha") == key(display) and key("peernayakgari irfanbasha") in present:
            # still add if manager missing under either spelling
            if "irfan" in key(display) and any("irfan" in n for n in present):
                continue
            if "irfan" not in key(display) and key(display) in present:
                continue
        if key(display) in present:
            continue
        if "irfan" in key(display) and any("irfan" in n for n in present):
            continue

        role = meta["role"]
        acts = ROLE_ACTIVITIES.get(role, ROLE_ACTIVITIES["Engineer"])
        for use_case, activity in acts:
            values = {
                "Project": "NH",
                "Release": "2026.10",
                "Period start": date(2026, 10, 1),
                "Period end": date(2026, 10, 31),
                "Domain": "Development",
                "Team": "Cognos",
                "Employee number": meta["emp"],
                "Employee name": "Peernayakgari Irfan Basha" if "irfan" in key(display) else display,
                "Tool": "Cursor",
                "Use case": use_case,
                "Activity (what you did)": activity,
                "Request count (optional)": None,
                "Input tokens": None,
                "Output tokens": None,
                "Hours saved": 3 if "Manager" in role else (6 if "Senior" in role else 4),
                "Hours without AI (optional)": 8 if "Manager" in role else 12,
                "Benefit in one line (optional)": f"Role-based Cursor usage ({role}) recorded for October billing cycle",
                "Source": "Estimated",
                "Challenge or blocker (optional)": "Activity detail estimated from role until person expands the row",
                "Shared? (Yes if also on another project)": "No",
                "Cursor total usage (USD)": meta["usd"],
                "Billing month": "October",
                "Billing start date": b_start,
                "Billing end date": b_end,
            }
            write_row(ws, next_row, hmap, values)
            next_row += 1
            added += 1
        present.add(key(display))
    print(f"Added {added} role-based intake rows")
    return added


def collect_intake_rows(wb):
    ws = wb["Team intake"]
    hmap = header_map(ws)
    rows = []
    for r in range(9, ws.max_row + 1):
        name = ws.cell(r, hmap["Employee name"]).value
        if not name or "Example" in str(name):
            continue
        if str(ws.cell(r, hmap.get("Project", 1)).value or "").startswith("Amber"):
            continue
        rows.append({k: ws.cell(r, c).value for k, c in hmap.items()})
    return rows


def upsert_master(intake_rows):
    path = MASTER if MASTER.exists() else MASTER_FALLBACK
    # Prefer reading via copy if locked
    try:
        wb = load_workbook(path)
    except PermissionError:
        alt = ROOT / "templates" / "Infinite_ETS_India_Workforce_ai_live.xlsx"
        import shutil
        shutil.copy2(path, alt)
        wb = load_workbook(alt)
        path = alt

    # Ensure AI sheets exist
    from _build_india_template import write_ai_utilization_sheets, AI_UTILIZATION_HEADERS, AI_OUTCOME_HEADERS

    write_ai_utilization_sheets(wb)  # rebuilds sample structure; we'll overwrite data next

    util = wb["AI utilization"]
    # Clear sample/data rows but keep header + EXAMPLE row; unmerge note cells first.
    for merged in list(util.merged_cells.ranges):
        util.unmerge_cells(str(merged))
    for r in range(3, util.max_row + 1):
        for c in range(1, len(AI_UTILIZATION_HEADERS) + 1):
            util.cell(r, c).value = None

    # Map intake -> utilization
    u_headers = {AI_UTILIZATION_HEADERS[i]: i + 1 for i in range(len(AI_UTILIZATION_HEADERS))}
    # Add Cost (USD) already in phase2 cols
    out_row = 3
    for row in intake_rows:
        values = {
            "Release": row.get("Release") or "2026.10",
            "Domain": row.get("Domain") or "Development",
            "Team": row.get("Team") or "Cognos",
            "Manager": "Peernayakgari Irfan Basha",
            "Employee number": row.get("Employee number"),
            "Employee name": row.get("Employee name"),
            "Period start": row.get("Period start"),
            "Period end": row.get("Period end"),
            "Tool": row.get("Tool") or "Cursor",
            "Provider": "Cursor",
            "Use case": row.get("Use case") or "Other",
            "Activity": row.get("Activity (what you did)"),
            "Request count": row.get("Request count (optional)"),
            "Input tokens": row.get("Input tokens"),
            "Output tokens": row.get("Output tokens"),
            "Total tokens": None,
            "Hours saved": row.get("Hours saved"),
            "Baseline hours without AI": row.get("Hours without AI (optional)"),
            "Benefit note": row.get("Benefit in one line (optional)"),
            "Source": row.get("Source") or "Manual",
            "Challenges": row.get("Challenge or blocker (optional)"),
            "Notes": None,
            "Sprint": None,
            "Project": row.get("Project") or "NH",
            "Account": row.get("Project") or "NH",
            "Cached input tokens": None,
            "Cost (USD)": row.get("Cursor total usage (USD)"),
            "Accepted lines": None,
            "Generated lines": None,
            "Policy flag": None,
            "External id": None,
        }
        for name, value in values.items():
            col = u_headers[name]
            cell = util.cell(out_row, col, value)
            cell.border = thin
            cell.font = font(11)
            cell.alignment = Alignment(wrap_text=True, vertical="center")
        # total tokens formula when inputs present
        util.cell(out_row, u_headers["Total tokens"], f'=IF(OR(N{out_row}="",O{out_row}=""),"",N{out_row}+O{out_row})')
        util.cell(out_row, u_headers["Period start"]).number_format = "DD-MMM-YYYY"
        util.cell(out_row, u_headers["Period end"]).number_format = "DD-MMM-YYYY"
        if values["Employee number"]:
            util.cell(out_row, u_headers["Employee number"]).number_format = "0"
        if values["Cost (USD)"] is not None:
            util.cell(out_row, u_headers["Cost (USD)"]).number_format = '"$"#,##0.00'
        out_row += 1

    # Outcomes: one row per Release x Domain x Team x Project
    from collections import defaultdict

    groups = defaultdict(lambda: {
        "people": set(),
        "hours": 0.0,
        "cost": 0.0,
        "tools": set(),
        "use_cases": set(),
        "benefits": [],
        "challenges": [],
    })
    for row in intake_rows:
        gkey = (
            str(row.get("Release") or "2026.10"),
            str(row.get("Domain") or "Development"),
            str(row.get("Team") or "Cognos"),
            str(row.get("Project") or "NH"),
        )
        g = groups[gkey]
        if row.get("Employee name"):
            g["people"].add(str(row["Employee name"]))
        g["hours"] += float(row.get("Hours saved") or 0)
        # cost once per person
        cost = row.get("Cursor total usage (USD)")
        if cost is not None:
            g["cost"] = max(g["cost"], 0)  # accumulate uniquely below
        if row.get("Tool"):
            g["tools"].add(str(row["Tool"]))
        if row.get("Use case"):
            g["use_cases"].add(str(row["Use case"]))
        if row.get("Benefit in one line (optional)"):
            g["benefits"].append(str(row["Benefit in one line (optional)"]))
        if row.get("Challenge or blocker (optional)"):
            g["challenges"].append(str(row["Challenge or blocker (optional)"]))

    # unique cost per person overall for Cognos Oct
    person_cost = {}
    for row in intake_rows:
        nm = row.get("Employee name")
        if nm and row.get("Cursor total usage (USD)") is not None:
            person_cost[str(nm)] = float(row["Cursor total usage (USD)"])

    outcomes = wb["AI release outcomes"]
    for merged in list(outcomes.merged_cells.ranges):
        outcomes.unmerge_cells(str(merged))
    for r in range(3, outcomes.max_row + 1):
        for c in range(1, len(AI_OUTCOME_HEADERS) + 1):
            outcomes.cell(r, c).value = None
    o_headers = {AI_OUTCOME_HEADERS[i]: i + 1 for i in range(len(AI_OUTCOME_HEADERS))}
    out_row = 3
    for (release, domain, team, project), g in sorted(groups.items()):
        people = g["people"]
        cost = sum(person_cost.get(p, 0) for p in people)
        headcount = max(len(people), 1)
        # Prefer billing roster size for Cognos NH
        if team == "Cognos" and project == "NH":
            headcount = max(headcount, len(BILLING) - 1)  # minus duplicate Irfan key
        values = {
            "Release": release,
            "Domain": domain,
            "Team": team,
            "Owner": "Peernayakgari Irfan Basha",
            "Headcount in scope": headcount,
            "People using AI": len(people),
            "Adoption %": None,
            "Total tokens": None,
            "Total hours saved": round(g["hours"], 1),
            "Tools used": ", ".join(sorted(g["tools"])) or "Cursor",
            "Top use cases": ", ".join(sorted(list(g["use_cases"])[:4])),
            "Measurable benefits": " | ".join(g["benefits"][:3]) or f"Cursor spend ${cost:.2f} across {len(people)} people",
            "Gaps": "Some engineers still Estimated for activity detail; token export not yet wired",
            "Challenges": " | ".join(sorted(set(g["challenges"]))[:3]) or "Billing cycle differs from release windows",
            "Opportunities next release": "Complete person-level activity for all billed seats; import Cursor export for tokens",
            "Status": "Submitted",
            "Submitted on": date(2026, 10, 31),
            "Reviewed by": "",
        }
        for name, value in values.items():
            col = o_headers[name]
            cell = outcomes.cell(out_row, col, value)
            cell.border = thin
            cell.font = font(11)
            cell.alignment = Alignment(wrap_text=True, vertical="center")
        outcomes.cell(out_row, o_headers["Adoption %"], f'=IF(OR(E{out_row}="",E{out_row}=0),"",F{out_row}/E{out_row})')
        outcomes.cell(out_row, o_headers["Adoption %"]).number_format = "0.0%"
        outcomes.cell(out_row, o_headers["Submitted on"]).number_format = "DD-MMM-YYYY"
        # stash cost into Total tokens field? Better put hours; cost noted in benefits.
        # Use Total tokens column to store Cursor USD * 1000 as placeholder? No - leave blank, put cost in measurable benefits already.
        out_row += 1

    # Cursor billing sheet on master for dashboard loader
    if "Cursor billing" in wb.sheetnames:
        del wb["Cursor billing"]
    bill = wb.create_sheet("Cursor billing")
    bill.sheet_properties.tabColor = "0284C7"
    headers = ["Name", "Total Usage (USD)", "Month", "Billing Start Date", "Billing End Date", "Employee number", "Team", "Project"]
    for c, h in enumerate(headers, 1):
        cell = bill.cell(1, c, h)
        cell.fill = fill(TEAL)
        cell.font = font(11, True, WHITE)
        cell.border = thin
    r = 2
    seen = set()
    for display, meta in BILLING.items():
        if display == "Peernayakgari Irfan Basha":
            continue
        name = "Peernayakgari Irfan Basha" if "irfan" in key(display) else display
        if key(name) in seen:
            continue
        seen.add(key(name))
        bill.cell(r, 1, name).border = thin
        cell = bill.cell(r, 2, meta["usd"])
        cell.number_format = '"$"#,##0.00'
        cell.border = thin
        bill.cell(r, 3, "October").border = thin
        c = bill.cell(r, 4, date(2026, 10, 7))
        c.number_format = "DD-MMM-YYYY"
        c.border = thin
        c = bill.cell(r, 5, date(2026, 10, 31))
        c.number_format = "DD-MMM-YYYY"
        c.border = thin
        cell = bill.cell(r, 6, meta["emp"])
        cell.border = thin
        if meta["emp"]:
            cell.number_format = "0"
        bill.cell(r, 7, "Cognos").border = thin
        bill.cell(r, 8, "NH").border = thin
        r += 1

    out_path = ROOT / "templates" / "Infinite_ETS_India_Workforce.xlsx"
    try:
        wb.save(out_path)
        print(f"Master saved {out_path}")
    except PermissionError:
        out_path = ROOT / "templates" / "Infinite_ETS_India_Workforce_ai_live.xlsx"
        wb.save(out_path)
        print(f"Master locked; saved {out_path}")
    return out_path, len(intake_rows), out_row - 3


def main():
    intake_wb = load_workbook(INTAKE)
    fill_missing_intake(intake_wb)
    try:
        intake_wb.save(INTAKE)
        print(f"Intake saved {INTAKE}")
    except PermissionError:
        alt = INTAKE.with_name("AI_Team_Intake_Cognos_filled.xlsx")
        intake_wb.save(alt)
        print(f"Intake locked; saved {alt}")
    # also templates copies
    for dest in [
        ROOT / "templates" / "AI_Team_Intake_Cognos.xlsx",
        ROOT / "templates" / "AI_Team_Intake.xlsx",
    ]:
        try:
            intake_wb.save(dest)
        except PermissionError:
            pass

    rows = collect_intake_rows(intake_wb)
    print(f"Intake data rows: {len(rows)}")
    upsert_master(rows)


if __name__ == "__main__":
    main()
