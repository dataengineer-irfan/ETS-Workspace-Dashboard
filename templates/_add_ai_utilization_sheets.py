"""Add AI utilization sheets to the live India workforce workbook without rebuilding People.

Run from the repo root:
  backend\\.venv\\Scripts\\python.exe templates\\_add_ai_utilization_sheets.py
"""
from __future__ import annotations

import sys
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.workbook.defined_name import DefinedName

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "templates"))

from openpyxl.styles import Alignment  # noqa: E402

from _build_india_template import (  # noqa: E402
    AI_DOMAIN_FIT,
    AI_DOMAINS,
    AI_OUTCOME_STATUS,
    AI_PROVIDERS,
    AI_SOURCES,
    AI_TOOLS,
    AI_USE_CASES,
    font,
    write_ai_targets_sheet,
    write_ai_utilization_sheets,
)

OUT = ROOT / "templates" / "Infinite_ETS_India_Workforce.xlsx"

AI_LIST_COLUMNS = [
    ("AI domain", AI_DOMAINS, "AIDomainList"),
    ("AI domain fit", AI_DOMAIN_FIT, "AIDomainFitList"),
    ("AI tool", AI_TOOLS, "AIToolList"),
    ("AI provider", AI_PROVIDERS, "AIProviderList"),
    ("AI use case", AI_USE_CASES, "AIUseCaseList"),
    ("AI source", AI_SOURCES, "AISourceList"),
    ("AI outcome status", AI_OUTCOME_STATUS, "AIOutcomeStatusList"),
]


def _header_map(ws):
    return {str(ws.cell(1, col).value or "").strip(): col for col in range(1, ws.max_column + 1) if ws.cell(1, col).value}


def ensure_ai_lists(wb):
    from openpyxl.utils import get_column_letter

    if "Lists" not in wb.sheetnames:
        raise SystemExit("Lists sheet missing from workforce workbook")
    ws = wb["Lists"]
    headers = _header_map(ws)
    next_col = max(headers.values(), default=0) + 1
    for title, values, defined_name in AI_LIST_COLUMNS:
        col = headers.get(title)
        if col is None:
            col = next_col
            next_col += 1
            ws.cell(1, col, title)
            headers[title] = col
        for offset, value in enumerate(values, 2):
            ws.cell(offset, col, value).font = font(11)
        for row in range(2 + len(values), max(ws.max_row, 2 + len(values)) + 1):
            if row > 1 + len(values):
                ws.cell(row, col).value = None
        letter = get_column_letter(col)
        ref = f"Lists!${letter}$2:${letter}${1 + len(values)}"
        if defined_name in wb.defined_names:
            del wb.defined_names[defined_name]
        wb.defined_names.add(DefinedName(name=defined_name, attr_text=ref))


def reorder_sheets(wb):
    preferred = [
        "Start here", "Access", "People", "Skills", "Leave", "Work model", "Training",
        "AI release outcomes", "AI utilization", "AI tools catalog", "AI targets", "Cursor billing", "Lists", "Checks",
    ]
    for index, name in enumerate(preferred):
        if name in wb.sheetnames:
            wb.move_sheet(name, offset=index - wb.sheetnames.index(name))


def patch_start_here(wb):
    if "Start here" not in wb.sheetnames:
        return
    ws = wb["Start here"]
    marker = "AI utilization: SDM and QA Manager"
    for row in range(1, ws.max_row + 1):
        value = str(ws.cell(row, 1).value or "")
        if marker in value:
            return
    # Append guidance under How to update if present; otherwise at the bottom.
    insert_at = ws.max_row + 2
    lines = [
        "6. AI utilization: SDM and QA Manager fill AI utilization (tokens and activities) and AI release outcomes (Dev and QA separately). Pick tools and use cases from AI tools catalog / Lists.",
        "Do not put secrets, passwords, API keys, or raw client PII on AI utilization sheets. Token counts and hours only.",
        "Dashboard tab, loader, and cloud sync for AI utilization are parked until this sheet design is signed off.",
    ]
    for offset, line in enumerate(lines):
        cell = ws.cell(insert_at + offset, 1, line)
        cell.font = font(12)
        cell.alignment = Alignment(wrap_text=True, vertical="center")


def patch_access(wb):
    if "Access" not in wb.sheetnames:
        return
    ws = wb["Access"]
    for row in range(1, min(ws.max_row, 20) + 1):
        for col in range(1, min(ws.max_column, 10) + 1):
            value = str(ws.cell(row, col).value or "")
            if value == "People, skills, leave, work model, training":
                ws.cell(row, col, "People, skills, leave, work model, training, AI utilization")
            if "Delivery Manager, HR Analytics, System Admin" == value and "Workforce" in str(ws.cell(row, 1).value or ""):
                ws.cell(row, col, "Delivery Manager, SDM, QA Manager, HR Analytics, System Admin")


def main():
    if not OUT.exists():
        raise SystemExit(f"Missing {OUT}")
    wb = load_workbook(OUT)
    ensure_ai_lists(wb)
    write_ai_utilization_sheets(wb)
    write_ai_targets_sheet(wb)
    patch_start_here(wb)
    patch_access(wb)
    reorder_sheets(wb)
    wb.save(OUT)
    print(f"Updated {OUT}")
    print("Sheets:", ", ".join(wb.sheetnames))


if __name__ == "__main__":
    main()
