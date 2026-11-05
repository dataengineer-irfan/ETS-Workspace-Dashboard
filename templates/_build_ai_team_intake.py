"""Build the employee/team AI intake sheet (before master workbook roll-up).

Supports different projects (NH, AK, ND, NH enhancements, Maven examples),
shared teams, and per-row release dates.

Run:
  backend\\.venv\\Scripts\\python.exe templates\\_build_ai_team_intake.py
"""
from __future__ import annotations

from datetime import date
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "templates" / "AI_Team_Intake.xlsx"
# Keep the Cognos-named copy in sync for anyone still using the old path.
OUT_ALIAS = ROOT / "templates" / "AI_Team_Intake_Cognos.xlsx"

NAVY = "0B3A5B"
TEAL = "1F6F6A"
INK = "1F2933"
MUTED = "5C6B73"
WHITE = "FFFFFF"
LINE = "D5DDE3"
AMBER = "FFF6E5"
PALE = "E7EEF3"

PROJECTS = [
    "NH",
    "AK",
    "ND",
    "NH enhancements",
    "Maven examples",
    "Shared",
]
TEAMS = [
    "Cognos",
    "Informatica",
    "QA",
    "Shared",
    "Other",
]
DOMAINS = ["Development", "QA"]
USE_CASES = [
    "Code generation",
    "Code review",
    "Test design",
    "Test automation",
    "Defect analysis",
    "Docs",
    "Refactoring",
    "Security review",
    "Other",
]
TOOLS = ["Cursor", "GitHub Copilot", "ChatGPT", "Claude", "Other"]
SOURCES = ["Manual", "Export", "Estimated"]

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


def add_list(ws, col_letter, values, first_row, last_row):
    dv = DataValidation(
        type="list",
        formula1='"' + ",".join(values) + '"',
        allow_blank=True,
        showErrorMessage=True,
        errorTitle="Pick from the list",
        error="Choose a listed value, or ask your manager to add it on the Lists sheet.",
    )
    dv.add(f"{col_letter}{first_row}:{col_letter}{last_row}")
    ws.add_data_validation(dv)


def main():
    wb = Workbook()

    lists = wb.active
    lists.title = "Lists"
    lists.sheet_properties.tabColor = TEAL
    for col, (title, values) in enumerate(
        [
            ("Project", PROJECTS),
            ("Team", TEAMS),
            ("Domain", DOMAINS),
            ("Tool", TOOLS),
            ("Use case", USE_CASES),
            ("Source", SOURCES),
        ],
        1,
    ):
        lists.cell(1, col, title).font = font(11, True, WHITE)
        lists.cell(1, col).fill = fill(TEAL)
        for row, value in enumerate(values, 2):
            lists.cell(row, col, value).font = font(11)
        lists.column_dimensions[get_column_letter(col)].width = 20
    lists["A10"] = "Manager: add a project or team name under the heading if it is missing. Shared = person or squad counted on more than one delivery account."
    lists["A10"].font = font(11, False, MUTED)
    lists.merge_cells("A10:F10")

    how = wb.create_sheet("How to fill", 0)
    how["A1"] = "Employee / team AI intake"
    how["A1"].font = font(16, True, NAVY)
    lines = [
        "",
        "Purpose: collect AI usage from people first. Manager rolls this into the master workbook later (AI utilization + AI release outcomes).",
        "",
        "Projects are different calendars",
        "NH, AK, ND, NH enhancements, and Maven examples can each have their own Release name and period dates. Put Project, Release, Period start, and Period end on every row — do not assume one global release.",
        "",
        "Shared teams and shared people",
        "If someone works Cognos for NH and also supports a Shared or Maven examples line, they add one row per Project (and per Tool + Use case). Team can be Cognos, Informatica, QA, Shared, or Other.",
        "",
        "Who fills what",
        "1. Manager sets the default Project / Team / Domain hint in the amber cells (optional shortcut only).",
        "2. Each employee fills their own rows on Team intake. One row = one Project + Release + Tool + Use case.",
        "3. Tokens from Cursor when known; otherwise leave blank or estimate and set Source = Estimated.",
        "4. No client PII, passwords, or secrets in Activity or Benefit.",
        "5. Manager later copies rows into the master AI utilization sheet; one AI release outcomes row per Release × Domain × Team × Project.",
        "",
        "Cursor billing",
        "Paste monthly Cursor Total Usage from the Cursor app into the Cursor billing sheet (Name, Total Usage, Month, Billing Start/End). Stamp the same amounts onto matching Team intake rows when the employee name matches. Billing cycle can differ from Project release dates.",
        "",
        "Boss does not fill this file.",
    ]
    for row, line in enumerate(lines, 2):
        cell = how.cell(row, 1, line)
        heading = line in {
            "Projects are different calendars",
            "Shared teams and shared people",
            "Who fills what",
        }
        cell.font = font(13 if heading else 12, heading, NAVY if heading else INK)
        how.merge_cells(start_row=row, start_column=1, end_row=row, end_column=8)
        how.row_dimensions[row].height = 22 if line else 10
    how.column_dimensions["A"].width = 110

    ws = wb.create_sheet("Team intake", 1)
    ws.sheet_properties.tabColor = NAVY
    ws["A1"] = "AI utilization — employee / team intake"
    ws["A1"].font = font(16, True, NAVY)
    ws.merge_cells("A1:N1")
    ws["A2"] = (
        "Each row carries its own Project, Release, and dates. Shared people add multiple rows when they touch more than one project. "
        "Manager copies completed rows into the master workbook later."
    )
    ws["A2"].font = font(11, False, MUTED)
    ws["A2"].alignment = Alignment(wrap_text=True)
    ws.merge_cells("A2:N2")
    ws.row_dimensions[2].height = 36

    ws["A4"] = "Optional defaults (manager). Rows below still need Project / Release / dates filled — defaults are only a reminder."
    ws["A4"].font = font(11, True, NAVY)
    ws.merge_cells("A4:N4")
    defaults = [
        ("A5", "Default project"), ("B5", "NH"),
        ("C5", "Default team"), ("D5", "Cognos"),
        ("E5", "Default domain"), ("F5", "Development"),
        ("G5", "Manager"), ("H5", ""),
    ]
    for cell, value in defaults:
        ws[cell] = value
        ws[cell].border = thin
        ws[cell].font = font(11, cell[0] in "ACEG")
    for cell in ("B5", "D5", "F5", "H5"):
        ws[cell].fill = fill(AMBER)

    headers = [
        "Project",
        "Release",
        "Period start",
        "Period end",
        "Domain",
        "Team",
        "Employee number",
        "Employee name",
        "Tool",
        "Use case",
        "Activity (what you did)",
        "Request count (optional)",
        "Input tokens",
        "Output tokens",
        "Hours saved",
        "Hours without AI (optional)",
        "Benefit in one line (optional)",
        "Source",
        "Challenge or blocker (optional)",
        "Shared? (Yes if also on another project)",
        "Cursor total usage (USD)",
        "Billing month",
        "Billing start date",
        "Billing end date",
    ]
    header_row = 8
    ws.cell(7, 1, "Employees fill from this row down — one row per Project + Release + Tool + Use case").font = font(12, True, NAVY)
    for col, header in enumerate(headers, 1):
        cell = ws.cell(header_row, col, header)
        cell.fill = fill(TEAL)
        cell.font = font(11, True, WHITE)
        cell.alignment = Alignment(wrap_text=True, vertical="center")
        cell.border = thin
    ws.row_dimensions[header_row].height = 40

    first_data = header_row + 1
    last_data = header_row + 40
    for row in range(first_data, last_data + 1):
        for col in range(1, len(headers) + 1):
            cell = ws.cell(row, col, None)
            cell.border = thin
            cell.alignment = Alignment(vertical="center", wrap_text=True)
        ws.cell(row, 7).number_format = "0"
        ws.cell(row, 3).number_format = "DD-MMM-YYYY"
        ws.cell(row, 4).number_format = "DD-MMM-YYYY"
        for col in (12, 13, 14):
            ws.cell(row, col).number_format = "#,##0"
        for col in (15, 16):
            ws.cell(row, col).number_format = "0.0"

    # Sample rows: different projects / releases / shared person
    samples = [
        [
            "NH", "2026.10", date(2026, 10, 1), date(2026, 10, 28), "Development", "Cognos",
            1023755, "Example Cognos engineer", "Cursor", "Code generation",
            "EXAMPLE — Cognos report change on NH release 2026.10",
            20, 50000, 15000, 4, 10, "Finished one day earlier", "Manual", "", "No",
        ],
        [
            "NH enhancements", "Enh-2026.10b", date(2026, 10, 15), date(2026, 11, 5), "Development", "Cognos",
            1023755, "Example Cognos engineer", "Cursor", "Refactoring",
            "EXAMPLE — same person on NH enhancements with a different release window",
            8, 12000, 4000, 2, 5, "Patch ready inside the enh window", "Estimated", "", "Yes",
        ],
        [
            "AK", "AK-R12", date(2026, 9, 20), date(2026, 10, 10), "Development", "Shared",
            1024001, "Example shared engineer", "Cursor", "Code review",
            "EXAMPLE — shared team supporting AK with its own release dates",
            12, 22000, 6000, 3, 6, "Review cycle shortened", "Manual", "Split across AK and ND", "Yes",
        ],
        [
            "Maven examples", "Maven-2026.Q4", date(2026, 10, 1), date(2026, 12, 15), "Development", "Other",
            1024002, "Example Maven engineer", "Cursor", "Docs",
            "EXAMPLE — Maven examples uses a quarter-style release label",
            5, 8000, 3000, 1.5, 4, "Doc pack drafted faster", "Manual", "", "No",
        ],
    ]
    for offset, values in enumerate(samples):
        row = first_data + offset
        for col, value in enumerate(values, 1):
            cell = ws.cell(row, col, value)
            cell.fill = fill(AMBER)
            cell.font = Font(name="Calibri", size=11, italic=True, color="7A5B20")
            cell.border = thin
            cell.alignment = Alignment(vertical="center", wrap_text=True)
        ws.row_dimensions[row].height = 36

    add_list(ws, "A", PROJECTS, first_data, last_data)
    add_list(ws, "E", DOMAINS, first_data, last_data)
    add_list(ws, "F", TEAMS, first_data, last_data)
    add_list(ws, "I", TOOLS, first_data, last_data)
    add_list(ws, "J", USE_CASES, first_data, last_data)
    add_list(ws, "R", SOURCES, first_data, last_data)
    add_list(ws, "T", ["Yes", "No"], first_data, last_data)

    for row in range(first_data, last_data + 1):
        ws.cell(row, 21).number_format = '"$"#,##0.00'
        ws.cell(row, 23).number_format = "DD-MMM-YYYY"
        ws.cell(row, 24).number_format = "DD-MMM-YYYY"

    widths = [16, 14, 13, 13, 13, 12, 14, 22, 14, 16, 44, 12, 12, 12, 11, 14, 28, 12, 26, 18, 16, 12, 15, 15]
    for index, width in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(index)].width = width
    ws.freeze_panes = f"A{header_row + 1}"
    ws.auto_filter.ref = f"A{header_row}:{get_column_letter(len(headers))}{last_data}"
    ws.sheet_view.zoomScale = 110

    note_row = last_data + 2
    ws.cell(
        note_row,
        1,
        "Amber rows are examples — delete or overwrite. Cursor total usage is the monthly Cursor bill for that person (see Cursor billing sheet). Master workbook roll-up comes after this intake is complete.",
    ).font = font(11, False, MUTED)
    ws.merge_cells(start_row=note_row, start_column=1, end_row=note_row, end_column=8)

    # Cursor billing sheet (monthly $ from Cursor app)
    bill = wb.create_sheet("Cursor billing")
    bill.sheet_properties.tabColor = "0284C7"
    bill["A1"] = "Cursor app usage (billing cycle)"
    bill["A1"].font = font(16, True, NAVY)
    bill.merge_cells("A1:E1")
    bill["A2"] = "One row per person per billing month. Billing dates can differ from Project release dates on Team intake."
    bill["A2"].font = font(11, False, MUTED)
    bill["A2"].alignment = Alignment(wrap_text=True)
    bill.merge_cells("A2:E2")
    bill.row_dimensions[2].height = 28
    bheaders = ["Name", "Total Usage (USD)", "Month", "Billing Start Date", "Billing End Date", "Employee number (if known)", "Team", "Notes"]
    for col, header in enumerate(bheaders, 1):
        cell = bill.cell(4, col, header)
        cell.fill = fill(TEAL)
        cell.font = font(11, True, WHITE)
        cell.border = thin
    for col, width in enumerate([28, 16, 12, 16, 16, 18, 12, 28], 1):
        bill.column_dimensions[get_column_letter(col)].width = width
    for row in range(5, 20):
        for col in range(1, 9):
            bill.cell(row, col).border = thin
        bill.cell(row, 2).number_format = '"$"#,##0.00'
        bill.cell(row, 4).number_format = "DD-MMM-YYYY"
        bill.cell(row, 5).number_format = "DD-MMM-YYYY"
        bill.cell(row, 6).number_format = "0"
    bill.freeze_panes = "A5"

    # Sheet order
    for index, name in enumerate(["How to fill", "Team intake", "Cursor billing", "Lists"]):
        wb.move_sheet(name, offset=index - wb.sheetnames.index(name))

    wb.save(OUT)
    wb.save(OUT_ALIAS)
    print(f"Wrote {OUT}")
    print(f"Wrote {OUT_ALIAS}")


if __name__ == "__main__":
    main()
