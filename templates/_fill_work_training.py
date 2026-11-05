"""Fill People work model/office, work-model history, and training for verification.

Values are stable from the employee number. Re-running writes the same cells.
"""
from datetime import datetime
from collections import defaultdict
from openpyxl import load_workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
import pandas as pd

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKBOOK = ROOT / "templates" / "Infinite_ETS_India_Workforce.xlsx"

OFFICE_BY_CITY = {
    "bangalore": "Bengaluru — Whitefield EPIP (India headquarters)",
    "bengaluru": "Bengaluru — Whitefield EPIP (India headquarters)",
    "chennai": "Chennai — MEPZ, Tambaram",
    "hyderabad": "Hyderabad — Western Aqua, HITEC City",
    "pune": "Pune — Phoenix Fountainhead, Viman Nagar",
}

PROGRAMS = [
    ("Information security refresher", "Infinite Learning", 4, "Yes"),
    ("Client delivery orientation", "ETS Academy", 8, "Yes"),
    ("Hands-on skill lab", "Infinite Learning", 16, "No"),
    ("Communication for client calls", "Client academy", 6, "No"),
]

STATUS_DATES = {
    "Completed": (datetime(2024, 2, 5), datetime(2024, 2, 7)),
    "In progress": (datetime(2024, 9, 2), datetime(2024, 10, 4)),
    "Planned": (datetime(2024, 10, 1), datetime(2024, 10, 3)),
    "Cancelled": (datetime(2024, 6, 10), datetime(2024, 6, 12)),
}

THIN = Border(
    left=Side(style="thin", color="D6DEE8"),
    right=Side(style="thin", color="D6DEE8"),
    top=Side(style="thin", color="D6DEE8"),
    bottom=Side(style="thin", color="D6DEE8"),
)
BODY_FONT = Font(name="Calibri", size=11, italic=False, color="1F2937")
BODY_FILL = PatternFill(fill_type=None)
BODY_ALIGN = Alignment(vertical="center", wrap_text=False)


def assign_model(employee_number: int) -> str:
    bucket = int(employee_number) % 100
    if bucket < 5:
        return "Not recorded yet"
    if bucket < 17:
        return "Remote"
    if bucket < 27:
        return "Client site"
    if bucket < 58:
        return "Hybrid"
    return "Office"


def office_for(city: str, model: str):
    if model not in ("Office", "Hybrid"):
        return None
    return OFFICE_BY_CITY.get(str(city or "").strip().casefold())


def header_map(ws):
    found = {}
    for cell in ws[1]:
        if cell.value:
            found[str(cell.value).strip()] = cell.column
    return found


def clear_body(ws):
    for merged in list(ws.merged_cells.ranges):
        if merged.min_row > 1:
            ws.unmerge_cells(str(merged))
    if ws.max_row < 2:
        return
    for row in ws.iter_rows(min_row=2, max_row=ws.max_row, max_col=ws.max_column):
        for cell in row:
            cell.value = None
            cell.font = BODY_FONT
            cell.fill = BODY_FILL
            cell.alignment = BODY_ALIGN
            cell.border = THIN


def write_row(ws, row_index, values, date_columns):
    for col, value in enumerate(values, 1):
        cell = ws.cell(row_index, col, value)
        cell.font = BODY_FONT
        cell.fill = BODY_FILL
        cell.alignment = BODY_ALIGN
        cell.border = THIN
        if col == 1 and isinstance(value, int):
            cell.number_format = "0"
        if col in date_columns and value is not None:
            cell.number_format = "DD-MMM-YYYY"
    ws.row_dimensions[row_index].height = 18


def skill_lists(skills: pd.DataFrame):
    grouped = defaultdict(list)
    frame = skills.copy()
    frame["Employee number"] = pd.to_numeric(frame["Employee number"], errors="coerce")
    frame = frame[frame["Employee number"] > 0]
    frame = frame[~frame["Skill"].astype(str).str.contains("EXAMPLE", case=False, na=False)]
    for record in frame.to_dict("records"):
        name = str(record.get("Skill") or "").strip()
        if not name or name.lower() in ("nan", "none"):
            continue
        grouped[int(record["Employee number"])].append(name)
    return grouped


def training_rows(people, skills_by_person):
    numbers = sorted(int(n) for n in people["Employee number"])
    specials = {1020246, 1023755}
    pool = [n for n in numbers if n not in specials and skills_by_person.get(n)]
    step = len(pool) / 118
    chosen = []
    seen = set()
    for index in range(118):
        candidate = pool[min(int(index * step), len(pool) - 1)]
        if candidate in seen:
            continue
        seen.add(candidate)
        chosen.append(candidate)
    scan = 0
    while len(chosen) < 118 and scan < len(pool):
        if pool[scan] not in seen:
            chosen.append(pool[scan])
            seen.add(pool[scan])
        scan += 1
    chosen = chosen[:118]
    doubles = set(chosen[:58])

    rows = []

    def add(employee_number, status, skill_offset, program_offset):
        skills = skills_by_person.get(employee_number) or ["General"]
        skill = skills[skill_offset % len(skills)]
        program, provider, hours, mandatory = PROGRAMS[program_offset % len(PROGRAMS)]
        start, end = STATUS_DATES[status]
        rows.append([employee_number, program, provider, start, end, status, hours, mandatory, skill])

    suneetha = skills_by_person.get(1020246) or ["QA Automation / SDET"]
    for offset, status in enumerate(("Completed", "In progress", "Planned")):
        add(1020246, status, offset, offset)
        rows[-1][8] = suneetha[offset % len(suneetha)]
    add(1023755, "Completed", 0, 1)

    statuses = ["Completed", "In progress", "Planned", "Cancelled"]
    cursor = 0
    for employee_number in chosen:
        copies = 2 if employee_number in doubles else 1
        for copy in range(copies):
            add(employee_number, statuses[cursor % 4], copy, cursor)
            cursor += 1
    return rows


def main():
    people = pd.read_excel(WORKBOOK, sheet_name="People")
    skills = pd.read_excel(WORKBOOK, sheet_name="Skills")
    people["Employee number"] = pd.to_numeric(people["Employee number"], errors="coerce")
    people = people[people["Employee number"] > 0].copy()
    if len(people) != 590:
        raise SystemExit(f"Expected 590 people, found {len(people)}")

    skills_by_person = skill_lists(skills)
    assignments = []
    for record in people.to_dict("records"):
        number = int(record["Employee number"])
        city = str(record.get("City") or "").strip()
        model = assign_model(number)
        assignments.append((number, model, office_for(city, model), city))

    history_people = [item for item in assignments if item[1] in ("Hybrid", "Remote")]
    history_people.sort(key=lambda item: item[0])
    history = []
    for number, model, _office, city in history_people[:40]:
        if model == "Hybrid":
            history.append([number, datetime(2024, 4, 1), "Hybrid", 3, city, "Moved to hybrid."])
        else:
            history.append([number, datetime(2024, 1, 15), "Remote", 0, city, "Moved to remote."])

    courses = training_rows(people, skills_by_person)

    wb = load_workbook(WORKBOOK)
    people_ws = wb["People"]
    columns = header_map(people_ws)
    model_col = columns["Work model"]
    office_col = columns["Office"]
    number_col = columns["Employee number"]
    by_number = {number: (model, office) for number, model, office, _city in assignments}
    written = 0
    for row in range(2, people_ws.max_row + 1):
        raw = people_ws.cell(row, number_col).value
        try:
            number = int(raw)
        except (TypeError, ValueError):
            continue
        if number not in by_number:
            continue
        model, office = by_number[number]
        people_ws.cell(row, model_col, model).font = BODY_FONT
        office_cell = people_ws.cell(row, office_col, office)
        office_cell.font = BODY_FONT
        written += 1
    if written != 590:
        raise SystemExit(f"Updated {written} People rows, expected 590")

    history_ws = wb["Work model"]
    clear_body(history_ws)
    for index, values in enumerate(history, 2):
        write_row(history_ws, index, values, date_columns={2})
        history_ws.cell(index, 4).number_format = "0"

    training_ws = wb["Training"]
    clear_body(training_ws)
    for index, values in enumerate(courses, 2):
        write_row(training_ws, index, values, date_columns={4, 5})
        training_ws.cell(index, 7).number_format = "0"

    wb.save(WORKBOOK)

    from collections import Counter
    print("people", written)
    print("models", Counter(item[1] for item in assignments))
    print("offices_filled", sum(1 for item in assignments if item[2]))
    print("history", len(history))
    print("training_rows", len(courses))
    print("training_people", len({row[0] for row in courses}))
    print("training_status", Counter(row[5] for row in courses))
    print("suneetha", [row for row in courses if row[0] == 1020246])
    print("abhijit", [row for row in courses if row[0] == 1023755])


if __name__ == "__main__":
    main()
