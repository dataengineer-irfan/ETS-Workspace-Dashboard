"""Build the India workforce entry workbooks from the current dashboard source.

The dashboard file is not modified. Salary is written only to the compensation workbook.
"""
from __future__ import annotations

import re
from datetime import datetime, date
from pathlib import Path

import pandas as pd
from openpyxl import Workbook
from openpyxl.chart.shapes import GraphicalProperties
from openpyxl.styles import Alignment, Border, Font, PatternFill, Protection, Side
from openpyxl.utils import get_column_letter
from openpyxl.workbook.properties import CalcProperties
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.table import Table, TableStyleInfo
from openpyxl.chart.legend import Legend
from openpyxl.formatting.rule import FormulaRule
from openpyxl.comments import Comment
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.worksheet.page import PageMargins

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "ETS_Dasboard_DS.xlsx"
OUT_DIR = ROOT / "templates"

NAVY = "0B3A5B"
TEAL = "1F6F6A"
MAROON = "7A2E2E"
GOLD = "F4E8D0"
INK = "1F2933"
MUTED = "5C6B73"
WHITE = "FFFFFF"
ZEBRA = "F4F7F8"
AMBER = "FFF6E5"
PALE = "E7EEF3"
RED_PALE = "F8EAEA"
LINE = "D5DDE3"

# Published Infinite offices. City dropdown, region, and country stay in lockstep.
# The filled POC rows use Bangalore, Chennai, Hyderabad, and Pune only.
LOCATIONS = [
    ("Bangalore", "Karnataka", "India"),
    ("Chennai", "Tamil Nadu", "India"),
    ("Hyderabad", "Telangana", "India"),
    ("Pune", "Maharashtra", "India"),
    ("Mumbai", "Maharashtra", "India"),
    ("Gurugram", "Haryana", "India"),
    ("New Delhi", "Delhi", "India"),
    ("Noida", "Uttar Pradesh", "India"),
    ("Visakhapatnam", "Andhra Pradesh", "India"),
    ("Dehradun", "Uttarakhand", "India"),
    ("Dubai", "Dubai", "United Arab Emirates"),
    ("Rockville", "Maryland", "United States"),
    ("Alpharetta", "Georgia", "United States"),
    ("Arlington Heights", "Illinois", "United States"),
    ("Irving", "Texas", "United States"),
    ("Las Vegas", "Nevada", "United States"),
    ("Clayton", "Missouri", "United States"),
    ("Toronto", "Ontario", "Canada"),
    ("San Jose", "San Jose", "Costa Rica"),
    ("Bogota", "Bogota", "Colombia"),
    ("Barranquilla", "Atlantico", "Colombia"),
    ("Munich", "Bavaria", "Germany"),
    ("Cyberjaya", "Selangor", "Malaysia"),
    ("Singapore", "Singapore", "Singapore"),
    ("Kathmandu", "Bagmati", "Nepal"),
    ("Makati", "Metro Manila", "Philippines"),
]
OFFICES = [
    "Bengaluru — Whitefield EPIP (India headquarters)",
    "Bengaluru — Whitefield GEIPL-SEZ",
    "Chennai — MEPZ, Tambaram",
    "Chennai — SSPDL, OMR Navalur",
    "Chennai — Pacifica Tech Park, Navalur",
    "Hyderabad — Western Aqua, HITEC City",
    "Pune — Phoenix Fountainhead, Viman Nagar",
    "Mumbai — Colaba",
    "Gurugram — Sector 44",
    "New Delhi — Bhikaji Cama Place",
    "Noida — Sector 58",
    "Visakhapatnam — Rushikonda SEZ",
    "Dehradun — GMS Road",
    "Dubai — Burlington Tower, Business Bay",
    "Rockville — Tower Oaks (global headquarters)",
    "Alpharetta — Amber Park",
    "Arlington Heights — N Wilke Road",
    "Irving — Decker Drive",
    "Las Vegas — West Lake Mead",
    "Clayton — Hanley Corporate Tower",
    "Toronto — Yonge Street",
    "San Jose — EPIC Corporate Center",
    "Bogota — Calle 127a",
    "Munich — Viktualienmarkt",
    "Cyberjaya — Coplace",
    "Singapore — Tampines Grande",
    "Kathmandu — Hattisar Sadak",
    "Makati — Legaspi Village",
]
GRADE_ORDER = [f"E{i}" for i in range(1, 11)]
WORK_MODELS = ["Not recorded yet", "Office", "Hybrid", "Remote", "Client site"]
TRAINING_STATUS = ["Planned", "In progress", "Completed", "Cancelled"]
AI_DOMAINS = ["Development", "QA"]
AI_DOMAIN_FIT = ["Development", "QA", "Both"]
AI_TOOLS = ["Cursor", "GitHub Copilot", "ChatGPT", "Claude", "Other"]
AI_PROVIDERS = ["Cursor", "Microsoft", "OpenAI", "Anthropic", "Other"]
AI_USE_CASES = [
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
AI_SOURCES = ["Manual", "Export", "Estimated"]
AI_OUTCOME_STATUS = ["Draft", "Submitted", "Reviewed"]
AI_UTILIZATION_HEADERS = [
    "Release", "Domain", "Team", "Manager", "Employee number", "Employee name",
    "Period start", "Period end", "Tool", "Provider", "Use case", "Activity",
    "Request count", "Input tokens", "Output tokens", "Total tokens",
    "Hours saved", "Baseline hours without AI", "Benefit note", "Source",
    "Challenges", "Notes",
    "Sprint", "Project", "Account", "Cached input tokens", "Cost (USD)",
    "Accepted lines", "Generated lines", "Policy flag", "External id",
]
AI_OUTCOME_HEADERS = [
    "Release", "Domain", "Team", "Owner", "Headcount in scope", "People using AI",
    "Adoption %", "Total tokens", "Total hours saved", "Tools used", "Top use cases",
    "Measurable benefits", "Gaps", "Challenges", "Opportunities next release",
    "Status", "Submitted on", "Reviewed by",
]
AI_CATALOG_HEADERS = [
    "Tool", "Provider", "Domain fit", "Allowed use cases", "Active", "Security notes", "Owner",
]


def as_date(value):
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        if pd.isna(value):
            return None
    except TypeError:
        pass
    parsed = pd.to_datetime(value, errors="coerce")
    if pd.isna(parsed):
        return None
    return parsed.date()


def as_int(value):
    number = pd.to_numeric(value, errors="coerce")
    if pd.isna(number) or int(number) <= 0:
        return None
    return int(number)


def as_text(value):
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except TypeError:
        pass
    text = str(value).strip()
    if text in ("", "nan", "None", "NaT"):
        return None
    return text


def as_number(value):
    number = pd.to_numeric(value, errors="coerce")
    if pd.isna(number):
        return None
    return float(number)


def employee_id_from_label(value):
    text = as_text(value)
    if not text:
        return None
    match = re.search(r"\((\d+)\)\s*$", text)
    if match:
        return int(match.group(1))
    return as_int(text)


def fill(hex_color):
    return PatternFill("solid", fgColor=hex_color)


def font(size=11, bold=False, color=INK, name="Calibri"):
    return Font(name=name, size=size, bold=bold, color=color)


thin = Border(
    left=Side(style="thin", color=LINE),
    right=Side(style="thin", color=LINE),
    top=Side(style="thin", color=LINE),
    bottom=Side(style="thin", color=LINE),
)
wrap = Alignment(wrap_text=True, vertical="center")
left_align = Alignment(vertical="center", wrap_text=True)


def style_header(ws, row, start_col, end_col, color):
    for col in range(start_col, end_col + 1):
        cell = ws.cell(row, col)
        cell.fill = fill(color)
        cell.font = font(11, True, WHITE)
        cell.alignment = Alignment(wrap_text=True, vertical="center", horizontal="left")
        cell.border = thin


def set_widths(ws, widths):
    for index, width in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(index)].width = width


def add_table(ws, name, rows, cols):
    if rows < 2:
        return
    ref = f"A1:{get_column_letter(cols)}{rows}"
    table = Table(displayName=name, ref=ref)
    table.tableStyleInfo = TableStyleInfo(name="TableStyleMedium2", showRowStripes=True)
    ws.add_table(table)


def add_list_validation(ws, cell_range, formula):
    check = DataValidation(type="list", formula1=formula, allow_blank=True, showDropDown=False, showErrorMessage=True, errorTitle="Pick from the list", error="Choose a value from Lists, or add the new value there first.")
    check.add(cell_range)
    ws.add_data_validation(check)


def write_title_block(ws, title, subtitle, color):
    ws.sheet_view.showGridLines = False
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_margins = PageMargins(left=0.5, right=0.5, top=0.6, bottom=0.5)
    ws.oddHeader.left.text = "Infinite Computer Solutions"
    ws.oddFooter.left.text = "India POC  |  Internal"
    ws.oddFooter.right.text = "Page &P"
    ws["A1"] = title
    ws["A1"].font = font(22, True, color)
    ws["A2"] = subtitle
    ws["A2"].font = font(12, False, MUTED)
    ws.row_dimensions[1].height = 28
    ws.row_dimensions[2].height = 20
    ws.freeze_panes = "A4"
    ws.sheet_properties.tabColor = color
    ws.print_title_rows = "1:3"
    ws.sheet_view.zoomScale = 110


def write_lines(ws, start_row, lines, color=INK, size=12, bold=False):
    row = start_row
    for line in lines:
        ws.cell(row, 1, line).font = font(size, bold, color)
        ws.cell(row, 1).alignment = Alignment(wrap_text=True, vertical="center")
        ws.row_dimensions[row].height = 22 if len(line) < 140 else 36
        row += 1
    return row


def load_source():
    employees = pd.read_excel(SOURCE, sheet_name="EMPLOYEES", skiprows=2)
    employees = employees.loc[:, [c for c in employees.columns if not str(c).startswith("Unnamed")]].copy()
    employees["EMPLOYEE NUMBER"] = pd.to_numeric(employees["EMPLOYEE NUMBER"], errors="coerce")
    employees = employees[employees["EMPLOYEE NUMBER"] > 0].copy()
    skills = pd.read_excel(SOURCE, sheet_name="SKILL")
    leave = pd.read_excel(SOURCE, sheet_name="LEAVE", skiprows=2)
    leave = leave.loc[:, [c for c in leave.columns if not str(c).startswith("Unnamed")]].copy()
    finance = pd.read_excel(SOURCE, sheet_name="Finance_History")
    return employees, skills, leave, finance


def unique_sorted(series):
    values = []
    for value in series.dropna().unique():
        text = as_text(value)
        if text:
            values.append(text)
    return sorted(set(values), key=str.lower)


def build_lists(employees, skills, leave):
    grades = [g for g in GRADE_ORDER if g in set(unique_sorted(employees["JOB LEVEL"]))]
    return {
        "City": [city for city, _region, _country in LOCATIONS],
        "Geographic state": [region for _city, region, _country in LOCATIONS],
        "Country": [country for _city, _region, country in LOCATIONS],
        "Account": ["NH", "ND", "AK"],
        "Department": unique_sorted(employees["DEPARTMENT"]),
        "Grade": grades,
        "Gender": ["Female", "Male"],
        "Leave type": unique_sorted(leave["LEAVE TYPE"]),
        "Work model": WORK_MODELS,
        "Skill level": unique_sorted(skills["Skill Level"]) or ["Beginner", "Intermediate", "Advanced"],
        "Skill type": ["Primary", "Secondary"],
        "Employment type": ["Full-time"],
        "Training status": TRAINING_STATUS,
        "Yes or no": ["Yes", "No"],
        "Skill category": unique_sorted(skills["Skill Category"]) or ["Functional", "Technical"],
        "Module": unique_sorted(employees["Module"]),
        "Job title": unique_sorted(employees["JOB TITLE"]),
        "Office": OFFICES,
        "AI domain": AI_DOMAINS,
        "AI domain fit": AI_DOMAIN_FIT,
        "AI tool": AI_TOOLS,
        "AI provider": AI_PROVIDERS,
        "AI use case": AI_USE_CASES,
        "AI source": AI_SOURCES,
        "AI outcome status": AI_OUTCOME_STATUS,
    }


def write_lists_sheet(wb, lists):
    ws = wb.create_sheet("Lists")
    ws.sheet_properties.tabColor = TEAL
    ws.sheet_view.showGridLines = False
    ws.freeze_panes = "A2"
    headers = list(lists.keys())
    for col, header in enumerate(headers, 1):
        ws.cell(1, col, header)
    style_header(ws, 1, 1, len(headers), TEAL)
    height = 1
    for col, header in enumerate(headers, 1):
        for offset, value in enumerate(lists[header], 2):
            ws.cell(offset, col, value).font = font(11)
            height = max(height, offset)
        letter = get_column_letter(col)
        ws.column_dimensions[letter].width = max(18, len(header) + 2)
        # City is paired with geographic state in the first two columns for the lookup.
    # Pair city with its geographic state in columns A and B for the People lookup.
    # The generic columns above already wrote City and Geographic state as independent lists.
    # Rebuild A:B as the city map so a city change fills the state.
    for row in range(2, height + 1):
        for col in range(1, 4):
            ws.cell(row, col).value = None
    for row, (city, region, country) in enumerate(LOCATIONS, 2):
        ws.cell(row, 1, city).font = font(11)
        ws.cell(row, 2, region).font = font(11)
        ws.cell(row, 3, country).font = font(11)
    ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}1"
    ws.auto_filter.ref = None
    note_row = height + 2
    ws.cell(note_row, 1, "Add a new allowed value under its heading. Dropdowns on the other sheets read this sheet.").font = font(11, False, MUTED)
    ws.oddHeader.left.text = "Infinite Computer Solutions"
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 1
    ws.sheet_view.zoomScale = 120
    ranges = {
        "CityList": f"Lists!$A$2:$A${1 + len(LOCATIONS)}",
        "StateList": f"Lists!$B$2:$B${1 + len(LOCATIONS)}",
        "CountryList": f"Lists!$C$2:$C${1 + len(LOCATIONS)}",
        "AccountList": f"Lists!$D$2:$D${1 + len(lists['Account'])}",
        "DepartmentList": f"Lists!$E$2:$E${1 + len(lists['Department'])}",
        "GradeList": f"Lists!$F$2:$F${1 + len(lists['Grade'])}",
        "GenderList": f"Lists!$G$2:$G${1 + len(lists['Gender'])}",
        "LeaveList": f"Lists!$H$2:$H${1 + len(lists['Leave type'])}",
        "WorkModelList": f"Lists!$I$2:$I${1 + len(lists['Work model'])}",
        "SkillLevelList": f"Lists!$J$2:$J${1 + len(lists['Skill level'])}",
        "SkillTypeList": f"Lists!$K$2:$K${1 + len(lists['Skill type'])}",
        "EmploymentList": f"Lists!$L$2:$L${1 + len(lists['Employment type'])}",
        "TrainingStatusList": f"Lists!$M$2:$M${1 + len(lists['Training status'])}",
        "YesNoList": f"Lists!$N$2:$N${1 + len(lists['Yes or no'])}",
        "SkillCategoryList": f"Lists!$O$2:$O${1 + len(lists['Skill category'])}",
        "ModuleList": f"Lists!$P$2:$P${1 + len(lists['Module'])}",
        "JobTitleList": f"Lists!$Q$2:$Q${1 + len(lists['Job title'])}",
        "OfficeList": f"Lists!$R$2:$R${1 + len(lists['Office'])}",
        "AIDomainList": f"Lists!$S$2:$S${1 + len(lists['AI domain'])}",
        "AIDomainFitList": f"Lists!$T$2:$T${1 + len(lists['AI domain fit'])}",
        "AIToolList": f"Lists!$U$2:$U${1 + len(lists['AI tool'])}",
        "AIProviderList": f"Lists!$V$2:$V${1 + len(lists['AI provider'])}",
        "AIUseCaseList": f"Lists!$W$2:$W${1 + len(lists['AI use case'])}",
        "AISourceList": f"Lists!$X$2:$X${1 + len(lists['AI source'])}",
        "AIOutcomeStatusList": f"Lists!$Y$2:$Y${1 + len(lists['AI outcome status'])}",
    }
    for name, ref in ranges.items():
        wb.defined_names.add(DefinedName(name=name, attr_text=ref))
    return ws


def write_people(wb, employees):
    ws = wb.create_sheet("People", 0)
    headers = [
        "Employee number", "First name", "Last name", "Email", "Date of birth", "Start date", "Exit date",
        "Gender", "Country", "Geographic state", "City", "Account", "Department", "Grade", "Job title",
        "Manager employee number", "Manager name", "Module", "Prior experience (years)", "Work model", "Employment type", "Office",
    ]
    for col, header in enumerate(headers, 1):
        ws.cell(1, col, header)
    style_header(ws, 1, 1, len(headers), NAVY)
    employees = employees.sort_values(["State", "LOCATION", "EMPLOYEE FIRST NAME", "EMPLOYEE LAST NAME"])
    row = 2
    for record in employees.to_dict("records"):
        number = as_int(record["EMPLOYEE NUMBER"])
        city = as_text(record["LOCATION"])
        account = as_text(record["State"])
        values = [
            number,
            as_text(record["EMPLOYEE FIRST NAME"]),
            as_text(record["EMPLOYEE LAST NAME"]),
            as_text(record["EMAIL"]),
            as_date(record["DATE OF BIRTH"]),
            as_date(record["START DATE"]),
            as_date(record["EXIT DATE"]),
            as_text(record["GENDER"]),
            f'=IF(K{row}="","",IFERROR(VLOOKUP(K{row},Lists!A:C,3,FALSE),""))',
            f'=IF(K{row}="","",IFERROR(VLOOKUP(K{row},Lists!A:C,2,FALSE),""))',
            city,
            account,
            as_text(record["DEPARTMENT"]),
            as_text(record["JOB LEVEL"]),
            as_text(record["JOB TITLE"]),
            employee_id_from_label(record["MANAGER"]),
            f'=IF(P{row}="","",IFERROR(INDEX(B:B,MATCH(P{row},A:A,0))&" "&INDEX(C:C,MATCH(P{row},A:A,0)),""))',
            as_text(record["Module"]),
            as_number(record["Prior EXPERIENCE1"]),
            "Not recorded yet",
            "Full-time",
            None,
        ]
        for col, value in enumerate(values, 1):
            cell = ws.cell(row, col, value)
            cell.font = font(11)
            cell.alignment = Alignment(vertical="center")
            cell.border = thin
        row += 1
    last = row - 1
    extra = last + 400
    for blank in range(row, extra + 1):
        ws.cell(blank, 9, f'=IF(K{blank}="","",IFERROR(VLOOKUP(K{blank},Lists!A:C,3,FALSE),""))')
        ws.cell(blank, 10, f'=IF(K{blank}="","",IFERROR(VLOOKUP(K{blank},Lists!A:C,2,FALSE),""))')
        ws.cell(blank, 17, f'=IF(P{blank}="","",IFERROR(INDEX(B:B,MATCH(P{blank},A:A,0))&" "&INDEX(C:C,MATCH(P{blank},A:A,0)),""))')
    for date_col in (5, 6, 7):
        for r in range(2, extra + 1):
            ws.cell(r, date_col).number_format = "DD-MMM-YYYY"
    for r in range(2, extra + 1):
        ws.cell(r, 1).number_format = "0"
        ws.cell(r, 16).number_format = "0"
        ws.cell(r, 19).number_format = "0.0"
    add_list_validation(ws, f"H2:H{extra}", "=GenderList")
    add_list_validation(ws, f"K2:K{extra}", "=CityList")
    add_list_validation(ws, f"L2:L{extra}", "=AccountList")
    add_list_validation(ws, f"M2:M{extra}", "=DepartmentList")
    add_list_validation(ws, f"N2:N{extra}", "=GradeList")
    add_list_validation(ws, f"O2:O{extra}", "=JobTitleList")
    add_list_validation(ws, f"R2:R{extra}", "=ModuleList")
    add_list_validation(ws, f"T2:T{extra}", "=WorkModelList")
    add_list_validation(ws, f"U2:U{extra}", "=EmploymentList")
    add_list_validation(ws, f"V2:V{extra}", "=OfficeList")
    add_table(ws, "People", last, len(headers))
    set_widths(ws, [18, 18, 18, 32, 16, 16, 16, 12, 22, 20, 18, 12, 16, 12, 32, 24, 28, 22, 24, 20, 18, 42])
    ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{last}"
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:U{last}"
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = NAVY
    ws.auto_filter.ref = None
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.print_title_rows = "1:1"
    ws.page_setup.horizontalCentered = True
    ws.oddHeader.left.text = "Infinite Computer Solutions — People"
    ws.oddFooter.right.text = "No salary on this sheet"
    ws.sheet_view.zoomScale = 110
    ws.auto_filter.ref = f"A1:U{last}"
    # Table already filters. A second auto filter on the same range raises. Remove the manual one.
    ws.auto_filter.ref = None
    comment = Comment("Blank exit date means the person is active. Account is NH, ND, or AK.", "ETS")
    comment.width = 240
    comment.height = 50
    ws["G1"].comment = comment
    ws["K1"].comment = Comment("Choose the city. Country and region fill from Lists. Dubai and the other international offices are on this list. The current rows are the India POC.", "ETS")
    ws["V1"].comment = Comment("Optional building. Use this when one city has more than one Infinite office.", "ETS")
    ws["T1"].comment = Comment("Current work model. When it changes, add a row on the Work model sheet and update this cell.", "ETS")
    return last - 1


def write_child_sheet(wb, title, headers, rows, widths, validations, tab_color, table_name):
    ws = wb.create_sheet(title)
    for col, header in enumerate(headers, 1):
        ws.cell(1, col, header)
    style_header(ws, 1, 1, len(headers), tab_color)
    for r_index, values in enumerate(rows, 2):
        for col, value in enumerate(values, 1):
            cell = ws.cell(r_index, col, value)
            cell.font = font(11)
            cell.alignment = Alignment(vertical="center")
            cell.border = thin
    last = 1 + len(rows)
    extra = max(last + 200, 50)
    for cell_range, formula in validations:
        add_list_validation(ws, cell_range.format(extra=extra), formula)
    for r in range(2, extra + 1):
        ws.cell(r, 1).number_format = "0"
    add_table(ws, table_name, last, len(headers))
    set_widths(ws, widths)
    ws.freeze_panes = "A2"
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = tab_color
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.print_title_rows = "1:1"
    ws.oddHeader.left.text = f"Infinite Computer Solutions — {title}"
    ws.sheet_view.zoomScale = 110
    return ws, last


def write_skills(wb, skills):
    skills = skills.copy()
    skills["EMPLOYEE NUMBER"] = pd.to_numeric(skills["EMPLOYEE NUMBER"], errors="coerce")
    skills = skills[skills["EMPLOYEE NUMBER"] > 0]
    skills = skills[skills["Skill Name"].notna()]
    skills = skills.sort_values(["EMPLOYEE NUMBER", "Skill Type", "Skill Name"])
    rows = []
    for record in skills.to_dict("records"):
        rows.append([
            as_int(record["EMPLOYEE NUMBER"]),
            as_text(record["Skill Name"]),
            as_text(record["Skill Level"]) or "Intermediate",
            as_text(record["Skill Type"]) or "Secondary",
            as_number(record["Skill_Exp"]),
            as_text(record["Skill Category"]),
            as_text(record["IsActive"]) or "Yes",
        ])
    ws, last = write_child_sheet(
        wb, "Skills",
        ["Employee number", "Skill", "Level", "Primary or secondary", "Years", "Category", "Active"],
        rows,
        [18, 36, 16, 22, 12, 16, 12],
        [
            ("C2:C{extra}", "=SkillLevelList"),
            ("D2:D{extra}", "=SkillTypeList"),
            ("F2:F{extra}", "=SkillCategoryList"),
            ("G2:G{extra}", "=YesNoList"),
        ],
        TEAL, "Skills",
    )
    for r in range(2, last + 1):
        ws.cell(r, 5).number_format = "0.0"
    return len(rows)


def write_leave(wb, leave):
    rows = []
    frame = leave.copy()
    frame["_id"] = frame["EMPLOYEE"].map(employee_id_from_label)
    frame = frame[frame["_id"].notna()].sort_values(["_id", "START DATE"])
    for record in frame.to_dict("records"):
        rows.append([
            int(record["_id"]),
            as_date(record["START DATE"]),
            as_date(record["END DATE"]),
            as_text(record["LEAVE TYPE"]) or "Casual / Sick",
            as_number(record["DAY VALUE"]) if as_number(record["DAY VALUE"]) is not None else 1,
        ])
    ws, last = write_child_sheet(
        wb, "Leave",
        ["Employee number", "Start date", "End date", "Leave type", "Days"],
        rows,
        [18, 16, 16, 20, 12],
        [("D2:D{extra}", "=LeaveList")],
        "3D6B8C", "Leave",
    )
    for r in range(2, last + 1):
        ws.cell(r, 2).number_format = "DD-MMM-YYYY"
        ws.cell(r, 3).number_format = "DD-MMM-YYYY"
        ws.cell(r, 5).number_format = "0.0"
    return ws


def write_future_sheet(wb, title, headers, example, widths, validations, tab_color, table_name, note):
    ws = wb.create_sheet(title)
    for col, header in enumerate(headers, 1):
        ws.cell(1, col, header)
    style_header(ws, 1, 1, len(headers), tab_color)
    for col, value in enumerate(example, 1):
        cell = ws.cell(2, col, value)
        cell.font = Font(name="Calibri", size=11, italic=True, color="7A5B20")
        cell.fill = fill(AMBER)
        cell.alignment = Alignment(vertical="center", wrap_text=True)
        cell.border = thin
    ws.row_dimensions[2].height = 32
    extra = 200
    for cell_range, formula in validations:
        add_list_validation(ws, cell_range.format(extra=extra), formula)
    set_widths(ws, widths)
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}2"
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = tab_color
    ws.oddHeader.left.text = f"Infinite Computer Solutions — {title}"
    ws.cell(4, 1, note).font = font(11, False, MUTED)
    ws.merge_cells(start_row=4, start_column=1, end_row=4, end_column=min(6, len(headers)))
    ws.row_dimensions[4].height = 36
    ws.sheet_view.zoomScale = 110
    return ws


def _style_example_row(ws, row, headers):
    for col in range(1, len(headers) + 1):
        cell = ws.cell(row, col)
        cell.font = Font(name="Calibri", size=11, italic=True, color="7A5B20")
        cell.fill = fill(AMBER)
        cell.alignment = Alignment(vertical="center", wrap_text=True)
        cell.border = thin
    ws.row_dimensions[row].height = 36


def write_guided_sheet(wb, title, headers, example, rows, widths, validations, tab_color, note, number_formats=None):
    """Sheet with an amber EXAMPLE row, then real sample rows managers can copy."""
    if title in wb.sheetnames:
        del wb[title]
    ws = wb.create_sheet(title)
    for col, header in enumerate(headers, 1):
        ws.cell(1, col, header)
    style_header(ws, 1, 1, len(headers), tab_color)
    for col, value in enumerate(example, 1):
        ws.cell(2, col, value)
    _style_example_row(ws, 2, headers)
    for r_index, values in enumerate(rows, 3):
        for col, value in enumerate(values, 1):
            cell = ws.cell(r_index, col, value)
            cell.font = font(11)
            cell.alignment = Alignment(vertical="center", wrap_text=True)
            cell.border = thin
        ws.row_dimensions[r_index].height = 42
        if number_formats:
            for col, fmt in number_formats.items():
                ws.cell(r_index, col).number_format = fmt
    last = 2 + len(rows)
    extra = max(last + 200, 50)
    for cell_range, formula in validations:
        add_list_validation(ws, cell_range.format(extra=extra), formula)
    set_widths(ws, widths)
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{last}"
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = tab_color
    ws.oddHeader.left.text = f"Infinite Computer Solutions — {title}"
    note_row = last + 2
    ws.cell(note_row, 1, note).font = font(11, False, MUTED)
    ws.merge_cells(start_row=note_row, start_column=1, end_row=note_row, end_column=min(8, len(headers)))
    ws.row_dimensions[note_row].height = 48
    ws.sheet_view.zoomScale = 110
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    return ws, last


def ai_utilization_sample_rows():
    """Release-level sample rows for Monday walkthrough. Row formulas fill Total tokens."""
    # Columns follow AI_UTILIZATION_HEADERS. Total tokens is column 16 (=N+O).
    start = date(2026, 10, 1)
    end = date(2026, 10, 28)
    samples = [
        [
            "2026.10", "Development", "Cognos", "Peer SDM", 1023755, "Abhijit Mohapatra",
            start, end, "Cursor", "Cursor", "Code generation",
            "Cognos report change stubs and review notes with Cursor",
            36, 82000, 28000, None, 8, 18,
            "Report change ready one day earlier", "Manual",
            "Two Cognos seats still pending", "",
            "Sprint 42", "NH", "NH", None, None, 210, 340, "", "",
        ],
        [
            "2026.10", "Development", "Cognos", "Peer SDM", None, None,
            start, end, "Cursor", "Cursor", "Code review",
            "Team rollup: Cognos squad Cursor usage for the ten reportees",
            70, 38000, 12000, None, 6, 12,
            "Eight of ten engineers active on Cursor", "Estimated",
            "", "Team total while person-level export is pending",
            "Sprint 42", "NH", "NH", None, None, None, None, "", "",
        ],
        [
            "2026.10", "Development", "Informatica", "Ravi SDM", None, None,
            start, end, "Cursor", "Cursor", "Refactoring",
            "Team rollup: Informatica mapping cleanup with Cursor",
            40, 70000, 28000, None, 11, 24,
            "Two mappings cleaned without weekend overtime", "Manual",
            "", "",
            "Sprint 42", "NH", "NH", None, None, None, None, "", "",
        ],
        [
            "2026.10", "QA", "NH QA", "Priya QA Manager", 1020246, "S Suneetha",
            start, end, "ChatGPT", "OpenAI", "Test design",
            "Drafted regression cases for work-model and training screens",
            28, 74000, 31000, None, 10, 22,
            "Regression pack authored two days earlier", "Manual",
            "Client data must stay out of prompts", "",
            "Sprint 42", "NH", "NH", None, None, None, None, "", "",
        ],
        [
            "2026.10", "QA", "NH QA", "Priya QA Manager", None, None,
            start, end, "Claude", "Anthropic", "Test automation",
            "Team rollup: Playwright helpers and locator repairs",
            18, 51000, 24000, None, 6, 14,
            "Automation suite green for Profile training band", "Export",
            "Token export only covers Claude seats", "",
            "Sprint 42", "NH", "NH", None, None, None, None, "", "",
        ],
        [
            "2026.09", "Development", "Cognos", "Peer SDM", None, None,
            date(2026, 9, 1), date(2026, 9, 30), "Cursor", "Cursor", "Refactoring",
            "Team rollup: Cognos legacy cleanup assisted by Cursor",
            40, 54000, 20000, None, 8, 16,
            "Cleanup finished inside the release window", "Estimated",
            "Adoption only six of ten", "",
            "Sprint 40", "NH", "NH", None, None, None, None, "", "",
        ],
        [
            "2026.09", "Development", "Informatica", "Ravi SDM", None, None,
            date(2026, 9, 1), date(2026, 9, 30), "Cursor", "Cursor", "Refactoring",
            "Team rollup: Informatica pipeline cleanup",
            35, 64000, 24000, None, 9, 18,
            "One pipeline cleanup finished without overtime", "Manual",
            "", "",
            "Sprint 40", "NH", "NH", None, None, None, None, "", "",
        ],
    ]
    return samples


def ai_outcome_sample_rows():
    # One row per Release × Domain × Team (e.g. 2026.10 + Development + Cognos).
    return [
        [
            "2026.10", "Development", "Cognos", "Peer SDM", 10, 8, None, 120000, 14,
            "Cursor", "Code generation, Code review",
            "Cognos report changes delivered one day earlier with Cursor on eight of ten engineers",
            "Two reportees still without Cursor seats",
            "Seat rollout incomplete; tokens still entered Manual until export is available",
            "Finish Cursor seats for all ten; keep Claude listed for a later pilot only",
            "Submitted", date(2026, 10, 28), "",
        ],
        [
            "2026.10", "Development", "Informatica", "Ravi SDM", 12, 9, None, 98000, 11,
            "Cursor, GitHub Copilot", "Code generation, Refactoring",
            "Two Informatica mappings refactored without weekend overtime",
            "Copilot export not yet wired for the squad",
            "Mixed Manual and Estimated token sources",
            "Align Informatica rows to the same Tool names as Cognos; import Copilot CSV next release",
            "Submitted", date(2026, 10, 28), "",
        ],
        [
            "2026.10", "QA", "NH QA", "Priya QA Manager", 22, 14, None, 180000, 16,
            "ChatGPT, Claude", "Test design, Test automation",
            "Regression pack for work-model and training ready two days earlier; Profile automation green",
            "Night-shift QA not yet on Claude; no defect-analysis playbook",
            "Prompt policy friction on client logs; Claude export covers only some seats",
            "Publish allowed-prompt checklist; expand Claude seats; add defect-analysis use case training",
            "Submitted", date(2026, 10, 28), "",
        ],
        [
            "2026.09", "Development", "Cognos", "Peer SDM", 10, 6, None, 74000, 8,
            "Cursor", "Refactoring, Docs",
            "Legacy Cognos cleanup completed inside the release window",
            "Adoption only six of ten",
            "No shared use-case names yet",
            "Move the squad onto catalog use-case names before 2026.10 close",
            "Reviewed", date(2026, 9, 30), "Delivery lead",
        ],
        [
            "2026.09", "Development", "Informatica", "Ravi SDM", 12, 7, None, 88000, 9,
            "Cursor", "Refactoring",
            "One Informatica pipeline cleanup finished without overtime",
            "Team names were free text and hard to roll up",
            "No Team column discipline across squads",
            "Use Team = Informatica on every outcome and utilization row",
            "Reviewed", date(2026, 9, 30), "Delivery lead",
        ],
    ]


def ai_catalog_rows():
    return [
        ["Cursor", "Cursor", "Development", "Code generation|Code review|Refactoring|Docs", "Yes", "Do not paste client PII, credentials, or production secrets into prompts.", "Platform"],
        ["GitHub Copilot", "Microsoft", "Development", "Code generation|Code review|Refactoring", "Yes", "Use only on Infinite-managed repos. No client data in inline comments fed to the model.", "Platform"],
        ["ChatGPT", "OpenAI", "Both", "Docs|Test design|Defect analysis|Other", "Yes", "Strip client names and identifiers before pasting logs or tickets.", "Platform"],
        ["Claude", "Anthropic", "Both", "Test automation|Docs|Code review|Other", "Yes", "Approved for anonymized logs and test assets only.", "Platform"],
        ["Other", "Other", "Both", "Other", "Yes", "Name the tool in Notes on AI utilization and get SDM or QA Manager approval first.", "SDM / QA Manager"],
    ]


def write_ai_utilization_sheets(wb):
    """Add or replace the three AI utilization sheets used by SDMs and QA Managers."""
    example_util = [
        "EXAMPLE", "Development", "Sample team", "Sample SDM", None, None,
        None, None, "Cursor", "Cursor", "Code generation",
        "EXAMPLE ROW. Delete when real release rows are added.",
        None, None, None, None, None, None,
        "", "Manual", "", "EXAMPLE ROW",
        "", "", "", None, None, None, None, "", "",
    ]
    util_rows = ai_utilization_sample_rows()
    # Fill Total tokens formulas for sample rows (row index starts at 3).
    for index, row in enumerate(util_rows):
        excel_row = index + 3
        row[15] = f"=IF(OR(N{excel_row}=\"\",O{excel_row}=\"\"),\"\",N{excel_row}+O{excel_row})"
    ws_util, last_util = write_guided_sheet(
        wb,
        "AI utilization",
        AI_UTILIZATION_HEADERS,
        example_util,
        util_rows,
        [12, 14, 14, 18, 16, 20, 14, 14, 16, 14, 16, 42, 12, 14, 14, 14, 12, 14, 36, 12, 28, 24, 12, 12, 10, 14, 12, 12, 12, 12, 14],
        [
            ("B2:B{extra}", "=AIDomainList"),
            ("I2:I{extra}", "=AIToolList"),
            ("J2:J{extra}", "=AIProviderList"),
            ("K2:K{extra}", "=AIUseCaseList"),
            ("T2:T{extra}", "=AISourceList"),
        ],
        "5B4B8A",
        "Sheet 1 — evidence. One row per person or team × release × domain × tool × use case. Blank Employee number means a team rollup. Total tokens is Input + Output. Sprint through External id are optional for later vendor exports. The amber EXAMPLE row is ignored.",
        number_formats={7: "DD-MMM-YYYY", 8: "DD-MMM-YYYY", 13: "#,##0", 14: "#,##0", 15: "#,##0", 16: "#,##0", 17: "0.0", 18: "0.0", 26: "#,##0", 27: "0.00", 28: "#,##0", 29: "#,##0"},
    )
    for r in range(3, last_util + 1):
        ws_util.cell(r, 5).number_format = "0"

    example_outcome = [
        "EXAMPLE", "Development", "Cognos", "Sample SDM", None, None, None, None, None,
        "Cursor", "Code generation",
        "EXAMPLE ROW. Delete when a real release outcome is written.",
        "", "", "", "Draft", None, "",
    ]
    outcome_rows = ai_outcome_sample_rows()
    for index, row in enumerate(outcome_rows):
        excel_row = index + 3
        # Adoption % = People using AI / Headcount (columns F / E after Team was added).
        row[6] = f"=IF(OR(E{excel_row}=\"\",E{excel_row}=0),\"\",F{excel_row}/E{excel_row})"
    ws_out, last_out = write_guided_sheet(
        wb,
        "AI release outcomes",
        AI_OUTCOME_HEADERS,
        example_outcome,
        outcome_rows,
        [12, 14, 14, 18, 16, 14, 12, 14, 14, 28, 28, 48, 36, 36, 42, 12, 14, 16],
        [
            ("B2:B{extra}", "=AIDomainList"),
            ("P2:P{extra}", "=AIOutcomeStatusList"),
        ],
        "0F766E",
        "Sheet 2 — executive page. One row per Release × Domain × Team (e.g. 2026.10 + Development + Cognos, and another row for Informatica). Open this first for the boss. Match Release and Team to AI utilization. Adoption % is People using AI ÷ Headcount in scope.",
        number_formats={5: "#,##0", 6: "#,##0", 7: "0.0%", 8: "#,##0", 9: "0.0", 17: "DD-MMM-YYYY"},
    )

    example_catalog = [
        "EXAMPLE", "Other", "Both", "Other", "Yes",
        "EXAMPLE ROW. Delete when the catalog is maintained.", "Platform",
    ]
    write_guided_sheet(
        wb,
        "AI tools catalog",
        AI_CATALOG_HEADERS,
        example_catalog,
        ai_catalog_rows(),
        [18, 14, 14, 48, 10, 56, 18],
        [
            ("C2:C{extra}", "=AIDomainFitList"),
            ("E2:E{extra}", "=YesNoList"),
        ],
        TEAL,
        "Sheet 3 — shared vocabulary. Every team picks Tool and Use case names from here so cross-team reports stay consistent. Pipe-separate allowed use cases. Security notes travel with the tool.",
    )
    return ws_util, ws_out


AI_TARGET_HEADERS = ["Metric", "Target", "Tolerance", "Lower_Is_Better", "Unit", "Notes"]
AI_RELEASE_ORDER_HEADERS = ["Release", "Sequence"]


def ai_target_rows():
    """Targets for the AI use Executive Command Center. Metric names match docs/AI_UTILIZATION_DASHBOARD_DESIGN.md."""
    return [
        ["Adoption_Pct", 80, 0.10, "No", "%", "Active users / headcount in scope. Health component C1 (weight 25) and KPI 3 / 4."],
        ["Dev_Adoption_Pct", 80, 0.10, "No", "%", "Development domain adoption. Health component C2 (weight 10)."],
        ["QA_Adoption_Pct", 50, 0.10, "No", "%", "QA domain adoption. Health component C3 (weight 10); n/a when no QA outcome row."],
        ["Hours_per_User", 8, 0.10, "No", "h / release", "Hours saved per active user per release. Health component C4 (weight 20); KPI 5 target = value x headcount."],
        ["Hours_per_100USD", 30, 0.10, "No", "h / $100", "Hours saved per $100 of tool spend. Health component C5 (weight 10), primary."],
        ["Hours_per_100kTokens", 20, 0.10, "No", "h / 100k tokens", "Hours saved per 100k tokens. Health component C5 fallback when no spend is attributable."],
        ["Release_Coverage_Pct", 100, 0.10, "No", "%", "Releases with quantified evidence / releases in scope. Health component C6 (weight 15)."],
        ["ROI_Index", 5, 0.10, "No", "x", "(Est cost savings - tool spend) / tool spend. KPI 8 and matrix ROI column."],
        ["Loaded_Rate_USD", 40, None, "No", "USD / h", "Loaded hourly rate used for Est cost savings and AI Value."],
        ["Loaded_Rate_INR", 3000, None, "No", "INR / h", "Loaded hourly rate for the INR display toggle."],
        ["Attention_Adoption_Pct", 60, None, "No", "%", "Leadership Attention rule ATT-1 fires when project adoption is below this."],
        ["Trend_Decline_Pts", 5, None, "No", "pts", "Leadership Attention rule ATT-4 fires when adoption falls by more than this vs the previous release."],
    ]


def ai_release_order_rows():
    """Interim Release_Sequence list until AI release outcomes carries its own column."""
    return [["R15.4", 1], ["R15.6", 2], ["R15.7", 3], ["2026.10", 4]]


def write_ai_targets_sheet(wb):
    """Add or replace the AI targets sheet (targets table in A:F, release order in H:I)."""
    title = "AI targets"
    if title in wb.sheetnames:
        del wb[title]
    ws = wb.create_sheet(title)
    for col, header in enumerate(AI_TARGET_HEADERS, 1):
        ws.cell(1, col, header)
    style_header(ws, 1, 1, len(AI_TARGET_HEADERS), "7C3AED")
    rows = ai_target_rows()
    for r_index, values in enumerate(rows, 2):
        for col, value in enumerate(values, 1):
            cell = ws.cell(r_index, col, value)
            cell.font = font(11)
            cell.alignment = Alignment(vertical="center", wrap_text=True)
            cell.border = thin
        ws.cell(r_index, 2).number_format = "#,##0.##"
        ws.cell(r_index, 3).number_format = "0%"
        ws.row_dimensions[r_index].height = 30
    add_list_validation(ws, f"D2:D{1 + len(rows) + 50}", "=YesNoList")
    order_col = len(AI_TARGET_HEADERS) + 2
    for offset, header in enumerate(AI_RELEASE_ORDER_HEADERS):
        ws.cell(1, order_col + offset, header)
    style_header(ws, 1, order_col, order_col + len(AI_RELEASE_ORDER_HEADERS) - 1, TEAL)
    for r_index, values in enumerate(ai_release_order_rows(), 2):
        for offset, value in enumerate(values):
            cell = ws.cell(r_index, order_col + offset, value)
            cell.font = font(11)
            cell.border = thin
    note_row = len(rows) + 3
    ws.cell(
        note_row, 1,
        "Targets for the AI use tab (Executive Command Center). Tolerance is the Amber band below (or above, when Lower_Is_Better is Yes) the target; blank means 10%. "
        "Change a Target here and press Refresh on the dashboard; nothing else needs editing. Release / Sequence orders releases for trend and sparklines until AI release outcomes has a Release_Sequence column.",
    ).font = font(11, False, MUTED)
    ws.merge_cells(start_row=note_row, start_column=1, end_row=note_row, end_column=6)
    ws.row_dimensions[note_row].height = 60
    set_widths(ws, [24, 10, 11, 15, 16, 70, 3, 12, 10])
    ws.freeze_panes = "A2"
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = "7C3AED"
    ws.sheet_view.zoomScale = 110
    return ws


def write_start(wb, people_count, skill_count, leave_count):
    ws = wb.create_sheet("Start here", 0)
    write_title_block(
        ws,
        "Infinite Computer Solutions",
        "India workforce template  ·  other Infinite offices, including Dubai, are on the city list",
        NAVY,
    )
    ws.merge_cells("A1:F1")
    ws.merge_cells("A2:F2")
    lines = [
        "",
        "This file is the sheet a delivery manager updates. It has no salary.",
        "Salary lives in a second file, Infinite_ETS_India_Compensation.xlsx, shared only with HR Analytics, Executive Leadership, and System Admin.",
        "",
        "What this POC covers",
        "Country: the filled rows are India. The city list also includes Infinite's other offices, including Dubai, the United States, Canada, Costa Rica, Colombia, Germany, Malaysia, Singapore, Nepal, and the Philippines.",
        "Delivery accounts on the filled rows: NH, ND, and AK. India offices in those rows: Bangalore, Chennai, Hyderabad, and Pune.",
        "Those four cities are in Karnataka, Tamil Nadu, Telangana, and Maharashtra. Pick Office when a city has more than one building, such as Chennai or Bengaluru.",
        f"Already filled: {people_count} people, {skill_count} skills, {leave_count} leave spells.",
        "",
        "How to update",
        "1. On People, filter Account to yours. Edit that row, or add the next person on the first blank row.",
        "2. Use the same employee number on Skills and Leave. Exit date stays blank while the person is active.",
        "3. Pick City, Account, Department, Grade, and Leave type from the dropdown. Add a brand-new value on Lists first.",
        "4. Work model is on People. Use the Work model sheet only when someone's arrangement changes.",
        "5. Training is ready for the next phase. The amber row is an example. Delete it when a real program is added.",
        "6. AI utilization: SDM and QA Manager fill AI utilization (tokens and activities) and AI release outcomes (Dev and QA separately). Pick tools and use cases from AI tools catalog / Lists.",
        "",
        "What you do not type",
        "Monthly salary, salary band, age, tenure, and headcount. The dashboard calculates those.",
        "Header Refresh reloads this file. Salary stays in Infinite_ETS_India_Compensation.xlsx.",
        "Do not put secrets, passwords, API keys, or raw client PII on AI utilization sheets. Token counts and hours only.",
        "",
        "Room to extend",
        "Add columns to the right of People, Skills, Leave, Work model, Training, or the AI sheets. Do not rename the sheet tabs or the existing headings.",
        "SharePoint access is on the Access sheet. One shared file cannot hide salary by person, so salary is a separate file.",
        "Dashboard tab, loader, and cloud sync for AI utilization are parked until this sheet design is signed off.",
    ]
    row = 4
    for line in lines:
        cell = ws.cell(row, 1, line)
        heading = line and line[:1].isdigit() is False and line in {
            "What this POC covers", "How to update", "What you do not type", "Room to extend",
        }
        cell.font = font(14 if heading else 12, heading, NAVY if heading else INK)
        cell.alignment = Alignment(wrap_text=True, vertical="center")
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=6)
        ws.row_dimensions[row].height = 18 if not line else (24 if len(line) < 120 else 36)
        row += 1
    set_widths(ws, [28, 22, 22, 22, 22, 28])
    ws.row_dimensions[1].height = 32
    ws.sheet_view.zoomScale = 120
    ws.freeze_panes = "A4"
    ws.print_area = f"A1:F{row}"
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 1


def write_access(wb):
    ws = wb.create_sheet("Access", 1)
    write_title_block(ws, "Who can open which file", "SharePoint and OneDrive permissions for the India POC", NAVY)
    ws.merge_cells("A1:G1")
    ws.merge_cells("A2:G2")
    headers = ["SharePoint library", "File", "Can edit", "Can view", "Salary in the file", "Dashboard role", "What they maintain"]
    for col, header in enumerate(headers, 1):
        ws.cell(4, col, header)
    style_header(ws, 4, 1, len(headers), NAVY)
    rows = [
        ["ETS-India-Workforce", "Infinite_ETS_India_Workforce.xlsx", "Delivery Manager, SDM, QA Manager, HR Analytics, System Admin", "Executive Leadership", "No", "Delivery Manager", "People, skills, leave, work model, training, AI utilization"],
        ["ETS-India-Compensation", "Infinite_ETS_India_Compensation.xlsx", "HR Analytics, System Admin", "Executive Leadership", "Yes", "HR Analytics, Executive, System Admin", "Current pay and pay history"],
        ["Not shared", "Either file", "Nobody", "Employee", "No", "Employee", "Sees the dashboard only. Does not edit the workbook."],
    ]
    for r_index, values in enumerate(rows, 5):
        for col, value in enumerate(values, 1):
            cell = ws.cell(r_index, col, value)
            cell.font = font(11)
            cell.alignment = wrap
            cell.border = thin
            if r_index == 6:
                cell.fill = fill(RED_PALE)
        ws.row_dimensions[r_index].height = 36
    ws.cell(9, 1, "Delivery accounts in this POC").font = font(14, True, NAVY)
    for col, header in enumerate(["Account", "Bangalore", "Chennai", "Hyderabad", "Pune", "Suggested folder later"], 1):
        ws.cell(10, col, header)
    style_header(ws, 10, 1, 6, TEAL)
    coverage = [
        ["NH", 226, 11, 121, 6, "Optional later split: ETS-India-Workforce/NH"],
        ["ND", 89, 2, 26, 1, "Optional later split: ETS-India-Workforce/ND"],
        ["AK", 81, 0, 24, 3, "Optional later split: ETS-India-Workforce/AK"],
    ]
    for r_index, values in enumerate(coverage, 11):
        for col, value in enumerate(values, 1):
            cell = ws.cell(r_index, col, value)
            cell.font = font(11)
            cell.alignment = Alignment(vertical="center", wrap_text=True)
            cell.border = thin
    ws.cell(15, 1, "The filled people are the India accounts NH, ND, and AK. Dubai and the other international cities are on Lists, ready for a person to be added. Salary still stays in the compensation file, including for Dubai.").font = font(12)
    ws.merge_cells("A15:G15")
    ws.row_dimensions[15].height = 36
    set_widths(ws, [32, 42, 46, 28, 18, 36, 42])
    ws.freeze_panes = "A5"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 1
    ws.page_setup.orientation = "landscape"
    ws.sheet_view.zoomScale = 110


def write_checks(wb, people_count, skill_count, leave_count):
    ws = wb.create_sheet("Checks")
    write_title_block(ws, "Checks before you send the file", "These formulas look at People, Skills, and Leave.", TEAL)
    ws.merge_cells("A1:C1")
    ws.merge_cells("A2:C2")
    labels = [
        (4, "People with an employee number", f'=COUNTA(People!A2:A{people_count + 1})'),
        (5, "People missing a city", f'=COUNTIFS(People!A2:A{people_count + 400},"<>",People!K2:K{people_count + 400},"")'),
        (6, "People missing an account", f'=COUNTIFS(People!A2:A{people_count + 400},"<>",People!L2:L{people_count + 400},"")'),
        (7, "People missing a start date", f'=COUNTIFS(People!A2:A{people_count + 400},"<>",People!F2:F{people_count + 400},"")'),
        (8, "Duplicate employee numbers", f'=SUMPRODUCT((People!A2:A{people_count + 400}<>"")*(COUNTIF(People!A2:A{people_count + 400},People!A2:A{people_count + 400})>1))/2'),
        (9, "Skill rows", f'=COUNTA(Skills!A2:A{skill_count + 1})'),
        (10, "Leave rows", f'=COUNTA(Leave!A2:A{leave_count + 1})'),
    ]
    ws.cell(4, 1, "Check").font = font(11, True, WHITE)
    ws.cell(4, 2, "Result").font = font(11, True, WHITE)
    # rewrite properly
    ws.cell(3, 1, "Check")
    ws.cell(3, 2, "Result")
    style_header(ws, 3, 1, 2, TEAL)
    for row, label, formula in labels:
        ws.cell(row, 1, label).font = font(12)
        ws.cell(row, 1).alignment = Alignment(vertical="center")
        cell = ws.cell(row, 2, formula)
        cell.font = font(12, True, NAVY)
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin
        ws.cell(row, 1).border = thin
        ws.row_dimensions[row].height = 22
    ws.cell(12, 1, "A missing city, a missing account, a missing start date, or a duplicate employee number should be 0 before the file is treated as ready.").font = font(12, False, MUTED)
    ws.merge_cells("A12:C12")
    ws.row_dimensions[12].height = 32
    set_widths(ws, [42, 16, 28])
    ws.freeze_panes = "A4"


def build_workforce(employees, skills, leave, lists):
    wb = Workbook()
    default = wb.active
    wb.remove(default)
    write_lists_sheet(wb, lists)
    people_count = write_people(wb, employees)
    skill_count = write_skills(wb, skills)
    write_leave(wb, leave)
    write_future_sheet(
        wb, "Work model",
        ["Employee number", "Effective date", "Work model", "Office days per week", "City", "Notes"],
        [None, None, "Hybrid", 3, "Bangalore", "EXAMPLE ROW. Delete this when you record a real change. The current model stays on People."],
        [18, 18, 20, 22, 16, 78],
        [("C2:C{extra}", "=WorkModelList"), ("E2:E{extra}", "=CityList")],
        "C47B4A", "WorkModel",
        "Use this sheet as the history. One row each time a person moves between office, hybrid, remote, or a client site.",
    )
    write_future_sheet(
        wb, "Training",
        ["Employee number", "Training", "Provider", "Start date", "End date", "Status", "Hours", "Mandatory", "Skill it supports"],
        [None, "Information security refresher", "Infinite learning", None, None, "Planned", 2, "Yes", "EXAMPLE ROW. Delete this when a real program is added."],
        [18, 36, 24, 16, 16, 16, 12, 14, 42],
        [("F2:F{extra}", "=TrainingStatusList"), ("H2:H{extra}", "=YesNoList")],
        "C47B4A", "Training",
        "Add a row when a program starts. The amber EXAMPLE row is ignored. Header Refresh reads this sheet.",
    )
    write_ai_utilization_sheets(wb)
    write_ai_targets_sheet(wb)
    write_access(wb)
    write_checks(wb, people_count, skill_count, len(leave))
    write_start(wb, people_count, skill_count, len(leave))
    # Sheet order
    order = [
        "Start here", "Access", "People", "Skills", "Leave", "Work model", "Training",
        "AI release outcomes", "AI utilization", "AI tools catalog", "AI targets", "Lists", "Checks",
    ]
    for index, name in enumerate(order):
        wb.move_sheet(name, offset=index - wb.sheetnames.index(name))
    wb.calculation.calcMode = "auto"
    wb.properties.title = "Infinite ETS India workforce"
    wb.properties.creator = "Infinite Computer Solutions"
    wb.properties.subject = "India POC workforce entry template"
    path = OUT_DIR / "Infinite_ETS_India_Workforce.xlsx"
    wb.save(path)
    return path, people_count, skill_count


def build_compensation(employees, finance):
    wb = Workbook()
    ws = wb.active
    ws.title = "Start here"
    write_title_block(ws, "Restricted  ·  Compensation", "Infinite Computer Solutions  ·  India POC  ·  do not share with delivery managers", MAROON)
    ws.merge_cells("A1:E1")
    ws.merge_cells("A2:E2")
    lines = [
        "",
        "This file contains salary, bonus, and hike. Store it in the SharePoint library ETS-India-Compensation.",
        "Edit access: HR Analytics and System Admin. View access: Executive Leadership. Delivery managers and employees do not receive this file.",
        "Current pay is one row per person, the annual CTC the dashboard uses today.",
        "Pay history is only the compensation years that were actually recorded. The dashboard estimates other years itself. Do not type those estimates here.",
        "Match people by employee number. Names are here so the row is readable. The workforce file has the rest of the person.",
        "Header Refresh reloads this file together with the workforce workbook. Do not copy these rows into the workforce file.",
    ]
    row = 4
    for line in lines:
        ws.cell(row, 1, line).font = font(12, False, INK)
        ws.cell(row, 1).alignment = Alignment(wrap_text=True, vertical="center")
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=5)
        ws.row_dimensions[row].height = 32 if line else 12
        row += 1
    set_widths(ws, [28, 24, 24, 24, 36])
    ws.freeze_panes = "A4"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 1

    current = wb.create_sheet("Current pay")
    headers = ["Employee number", "First name", "Last name", "Account", "City", "Annual CTC (INR)", "Previous CTC (INR)", "Last bonus (INR)", "Last hike percent"]
    for col, header in enumerate(headers, 1):
        current.cell(1, col, header)
    style_header(current, 1, 1, len(headers), MAROON)
    people = employees.sort_values(["State", "LOCATION", "EMPLOYEE FIRST NAME", "EMPLOYEE LAST NAME"])
    row = 2
    for record in people.to_dict("records"):
        values = [
            as_int(record["EMPLOYEE NUMBER"]),
            as_text(record["EMPLOYEE FIRST NAME"]),
            as_text(record["EMPLOYEE LAST NAME"]),
            as_text(record["State"]),
            as_text(record["LOCATION"]),
            as_number(record["EMP_CTC1"]),
            as_number(record["Prev_CTC2"]),
            as_number(record["Last_Bonus"]),
            as_number(record["Hike_Percentage"]),
        ]
        for col, value in enumerate(values, 1):
            cell = current.cell(row, col, value)
            cell.font = font(11)
            cell.border = thin
        row += 1
    last = row - 1
    for r in range(2, last + 1):
        current.cell(r, 1).number_format = "0"
        for col in (6, 7, 8):
            current.cell(r, col).number_format = '#,##0'
        current.cell(r, 9).number_format = '0.00'
    add_table(current, "CurrentPay", last, len(headers))
    set_widths(current, [18, 18, 18, 12, 16, 20, 22, 18, 20])
    current.freeze_panes = "A2"
    current.sheet_properties.tabColor = MAROON
    current.sheet_view.showGridLines = False
    current.page_setup.orientation = "landscape"
    current.page_setup.fitToPage = True
    current.page_setup.fitToWidth = 1
    current.page_setup.fitToHeight = 0
    current.print_title_rows = "1:1"
    current.oddHeader.left.text = "Restricted — Infinite compensation"
    current.sheet_view.zoomScale = 110

    history = wb.create_sheet("Pay history")
    headers = ["Employee number", "Year", "Base salary (INR)", "Bonus (INR)", "Perks (INR)", "Other pay (INR)", "Promotion", "Promotion date", "Hike percent"]
    for col, header in enumerate(headers, 1):
        history.cell(1, col, header)
    style_header(history, 1, 1, len(headers), MAROON)
    frame = finance.copy()
    frame["EMPLOYEE NUMBER"] = pd.to_numeric(frame["EMPLOYEE NUMBER"], errors="coerce")
    frame = frame[frame["EMPLOYEE NUMBER"] > 0].sort_values(["EMPLOYEE NUMBER", "Year"])
    row = 2
    for record in frame.to_dict("records"):
        values = [
            as_int(record["EMPLOYEE NUMBER"]),
            as_int(record["Year"]) or as_number(record["Year"]),
            as_number(record["Base_Salary"]),
            as_number(record["Bonus"]),
            as_number(record["Perks"]),
            as_number(record["Other_Comp"]),
            as_text(record["Is_Promotion"]) or "No",
            as_date(record["Prom_Eve_Date"]),
            as_number(record["Hike"]),
        ]
        for col, value in enumerate(values, 1):
            cell = history.cell(row, col, value)
            cell.font = font(11)
            cell.border = thin
        row += 1
    last_h = max(row - 1, 2)
    add_list_validation(history, f"G2:G{last_h + 100}", "=YesNoList")
    # YesNoList is in the other workbook. Use a local list.
    history.data_validations.dataValidation.clear()
    local = DataValidation(type="list", formula1='"Yes,No"', allow_blank=True)
    local.add(f"G2:G{last_h + 100}")
    history.add_data_validation(local)
    for r in range(2, last_h + 1):
        history.cell(r, 1).number_format = "0"
        history.cell(r, 2).number_format = "0"
        for col in (3, 4, 5, 6):
            history.cell(r, col).number_format = '#,##0'
        history.cell(r, 8).number_format = "DD-MMM-YYYY"
        history.cell(r, 9).number_format = "0.00"
    if last_h >= 2:
        add_table(history, "PayHistory", last_h, len(headers))
    set_widths(history, [18, 12, 20, 16, 16, 18, 14, 18, 16])
    history.freeze_panes = "A2"
    history.sheet_properties.tabColor = MAROON
    history.sheet_view.showGridLines = False
    history.page_setup.orientation = "landscape"
    history.page_setup.fitToWidth = 1
    history.page_setup.fitToHeight = 0
    history.page_setup.paperSize = history.PAPERSIZE_A4
    history.print_title_rows = "1:1"
    history.oddHeader.left.text = "Restricted — pay history"
    history.sheet_view.zoomScale = 110
    wb.calculation.calcMode = "auto"
    wb.properties.title = "Infinite ETS India compensation"
    wb.properties.creator = "Infinite Computer Solutions"
    wb.properties.subject = "Restricted India compensation template"
    path = OUT_DIR / "Infinite_ETS_India_Compensation.xlsx"
    wb.save(path)
    return path, last_h - 1


def main():
    OUT_DIR.mkdir(exist_ok=True)
    employees, skills, leave, finance = load_source()
    lists = build_lists(employees, skills, leave)
    workforce, people_count, skill_count = build_workforce(employees, skills, leave, lists)
    compensation, history_rows = build_compensation(employees, finance)
    print("workforce", workforce.name, "people", people_count, "skills", skill_count)
    print("compensation", compensation.name, "history", history_rows)


if __name__ == "__main__":
    main()
