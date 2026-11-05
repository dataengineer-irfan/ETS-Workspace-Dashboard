"""Generate realistic AI utilization rows from the People roster.

Idempotent: replaces only Source in (Generated, Estimated-generated).
Never overwrites Manual / Export / existing intake rows (Cognos NH/AK).

Run from repo root:
  .\\backend\\.venv\\Scripts\\python.exe templates\\_generate_ai_utilization_from_roster.py
"""
from __future__ import annotations

import random
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "templates" / "Infinite_ETS_India_Workforce.xlsx"

SEED = 42
GENERATED_SOURCES = {"generated", "estimated-generated"}
PROTECTED_BILLING_NAMES = {
    "sriram krishnakumar",
    "chenchurathnam anjali",
    "veera hema chekkera",
    "clement govindaraj",
    "eshaan harish rao",
    "shujaat hussain",
    "peernayakgari irfan basha",
    "peernayakgari irfanbasha",
    "obuli sundar",
}
PROTECTED_EMP = {1033227, 1040931, 1040187, 1019823, 1033626, 1017291, 1027420}

UTIL_NEW_COLS = [
    "Test cases generated",
    "Automation assets",
    "Artifacts generated",
    "Story ids",
]
OUTCOME_NEW_COLS = [
    "Project",
    "Stories delivered",
    "Stories using AI",
    "Defects baseline",
    "Defects actual",
    "Cycle time days saved",
    "Release sequence",
    "Release date",
]
BILLING_NEW_COLS = ["Source"]

USE_CASES_EXTRA = ["SQL development", "Unit testing"]
CATALOG_CURSOR_USES = (
    "Code generation|Code review|Refactoring|Docs|SQL development|Unit testing|"
    "Test design|Test automation|Defect analysis"
)

RELEASES_SHARED = [
    ("R15.4", 1, date(2026, 7, 1), date(2026, 7, 31), date(2026, 7, 15)),
    ("R15.6", 2, date(2026, 8, 1), date(2026, 8, 31), date(2026, 8, 12)),
    ("R15.7", 3, date(2026, 9, 1), date(2026, 9, 30), date(2026, 9, 18)),
    ("2026.10", 7, date(2026, 10, 1), date(2026, 10, 31), date(2026, 10, 8)),
]
RELEASES_ND = [
    ("R24.1", 4, date(2026, 7, 15), date(2026, 8, 14), date(2026, 7, 20)),
    ("R24.2", 5, date(2026, 8, 15), date(2026, 9, 14), date(2026, 8, 22)),
    ("R24.3", 6, date(2026, 9, 15), date(2026, 10, 7), date(2026, 9, 20)),
    ("2026.10", 7, date(2026, 10, 1), date(2026, 10, 31), date(2026, 10, 8)),
]
RELEASE_ORDER = {
    "R15.4": 1, "R15.6": 2, "R15.7": 3,
    "R24.1": 4, "R24.2": 5, "R24.3": 6, "2026.10": 7,
}

ADOPTION = {"NH": 0.72, "ND": 0.58, "AK": 0.38, "Maven": 0.64}
PRIOR_SHARE = {"NH": 0.55, "ND": 0.40, "AK": 0.22, "Maven": 0.48}
QA_PROJECTS_WITH_AI = {"NH", "ND", "Maven"}  # AK left with zero QA AI so Attention still fires
NO_QA_EVIDENCE_PROJECTS = {"AK"}
MAVEN_TARGET_HEADCOUNT = 72
MAVEN_SOURCE_ACCOUNT = "NH"
MAVEN_SOURCE_DEPARTMENTS = ("IT", "Core", "Informatica")

DEV_USES = [
    ("Code generation", "Scaffolded application and report code with Cursor"),
    ("Code review", "Reviewed diffs and flagged regressions with Cursor"),
    ("Refactoring", "Refactored legacy modules with AI-assisted patches"),
    ("Docs", "Drafted design notes and release comments with Cursor"),
    ("SQL development", "Wrote and tuned SQL from requirements with Cursor"),
    ("Unit testing", "Generated unit test stubs and assertions with Cursor"),
]
QA_USES = [
    ("Test design", "Drafted test scenarios from user stories with Cursor"),
    ("Test automation", "Generated automation script fragments with Cursor"),
    ("Defect analysis", "Triaged defect logs and reproduced steps with Cursor"),
    ("Docs", "Documented test evidence and exit criteria with Cursor"),
    ("Unit testing", "Expanded unit-level checks for the sprint pack"),
]
BA_USES = [
    ("Docs", "Drafted story acceptance notes with Cursor"),
    ("SQL development", "Sketched validation queries from mapping docs"),
    ("Defect analysis", "Compared expected vs actual for open defects"),
]
MGR_USES = [
    ("Code review", "Reviewed AI-assisted delivery notes for the squad"),
    ("Docs", "Summarised release AI outcomes for leadership"),
]

BENEFIT_DEV = [
    "Cut scaffolding time on the sprint pack and freed a review cycle.",
    "Reduced manual rewrite of boilerplate services and mappings.",
    "Accelerated query and report changes without waiting on a specialist.",
]
BENEFIT_QA = [
    "Expanded coverage of happy-path and negative cases before UAT.",
    "Shortened script authoring for the regression pack.",
    "Faster first-pass defect classification for the triage call.",
]
GAPS = [
    "Token export still missing for most seats; hours remain estimated.",
    "A few billed seats have no person-level activity this release.",
    "Use-case names need to stay on the catalog list for trend compare.",
]
CHALLENGES = [
    "Billing cycle is monthly while releases overlap mid-month.",
    "Engineers still learning what savings to record versus learning time.",
    "Client data must stay out of prompts; sample text is anonymised.",
]
OPPS = [
    "Import Cursor export for tokens and retire Estimated rows.",
    "Coach inactive billed seats and capture hours on every activity.",
    "Add at least one QA activity row where testers are on the project.",
    "Normalise free-text use cases to the catalog before the next release.",
]


def plain(value):
    if value is None:
        return ""
    text = str(value).strip()
    if not text or text.lower() in ("nan", "none", "nat"):
        return ""
    return text


def header_map(ws, row=1):
    return {
        plain(ws.cell(row, col).value): col
        for col in range(1, ws.max_column + 1)
        if plain(ws.cell(row, col).value)
    }


def ensure_columns(ws, titles, header_row=1):
    headers = header_map(ws, header_row)
    next_col = max(headers.values(), default=0) + 1
    for title in titles:
        if title not in headers:
            ws.cell(header_row, next_col, title)
            headers[title] = next_col
            next_col += 1
    return headers


def last_data_row(ws, header_row=1):
    end = header_row
    for row in range(header_row + 1, ws.max_row + 1):
        if any(plain(ws.cell(row, col).value) for col in range(1, ws.max_column + 1)):
            end = row
    return end


def is_example_row(ws, row, headers):
    for title, col in headers.items():
        if "EXAMPLE" in plain(ws.cell(row, col).value).upper():
            return True
    return False


def delete_generated_rows(ws, headers, source_title="Source", header_row=1, extra_pred=None):
    source_col = headers.get(source_title)
    removed = 0
    for row in range(ws.max_row, header_row, -1):
        if is_example_row(ws, row, headers):
            continue
        source = plain(ws.cell(row, source_col).value).casefold() if source_col else ""
        extra = extra_pred(ws, row, headers) if extra_pred else False
        if source in GENERATED_SOURCES or extra:
            ws.delete_rows(row, 1)
            removed += 1
    return removed


def role_profile(title, department):
    t = (title or "").casefold()
    d = (department or "").casefold()
    if any(k in t for k in ("vice president", "program director", "senior executive", "executive")) and "engineer" not in t:
        return "none"
    if d == "infra" or any(k in t for k in ("system administrator",)):
        return "none"
    if any(k in t for k in ("test", "qa")) or d == "qa":
        return "qa"
    if "business analyst" in t or t.endswith("analyst") and "it analyst" not in t:
        return "ba"
    if "technical writer" in t:
        return "writer"
    if any(k in t for k in ("project manager", "program manager", "project lead", "senior manager", "assistant manager")):
        return "manager"
    if t in {"manager"}:
        return "manager"
    if "support" in t:
        return "support"
    if any(k in t for k in (
        "software engineer", "technical lead", "technical manager", "technical architect",
        "system engineer", "database", "it analyst",
    )):
        return "dev"
    if d in ("cognos", "informatica", "it", "core"):
        return "dev"
    return "none"


def team_of(department, module):
    if department in ("Cognos", "Informatica", "QA", "Infra"):
        return department
    if module:
        return module
    return department or "IT"


def ensure_maven_on_roster(people_ws, people_headers, lists_ws, protected_emps, rng):
    """Idempotent: ensure ~MAVEN_TARGET_HEADCOUNT People rows use Account=Maven.

    Reassigns from NH IT/Core/Informatica (never protected Cognos seats). Adds
    Maven to Lists Account so filters and dropdowns stay consistent with NH/ND/AK.
    """
    account_col = people_headers["Account"]
    dept_col = people_headers["Department"]
    emp_col = people_headers["Employee number"]
    maven_emps = []
    candidates = []
    for r in range(2, people_ws.max_row + 1):
        emp = people_ws.cell(r, emp_col).value
        try:
            emp = int(emp) if emp is not None else None
        except (TypeError, ValueError):
            continue
        if emp is None or emp <= 0:
            continue
        account = plain(people_ws.cell(r, account_col).value)
        department = plain(people_ws.cell(r, dept_col).value)
        if account == "Maven":
            maven_emps.append((r, emp))
            continue
        if (
            account == MAVEN_SOURCE_ACCOUNT
            and department in MAVEN_SOURCE_DEPARTMENTS
            and emp not in protected_emps
        ):
            candidates.append((r, emp, department))

    need = max(0, MAVEN_TARGET_HEADCOUNT - len(maven_emps))
    moved = 0
    if need:
        pool = list(candidates)
        rng.shuffle(pool)
        # Prefer IT so Cognos/Informatica NH samples stay denser on NH.
        pool.sort(key=lambda item: 0 if item[2] == "IT" else 1)
        for r, _emp, _dept in pool[:need]:
            people_ws.cell(r, account_col, "Maven")
            moved += 1

    if lists_ws is not None:
        list_headers = header_map(lists_ws)
        account_list_col = list_headers.get("Account")
        if account_list_col:
            existing = {
                plain(lists_ws.cell(r, account_list_col).value)
                for r in range(2, lists_ws.max_row + 1)
            }
            if "Maven" not in existing:
                cursor = 2
                while plain(lists_ws.cell(cursor, account_list_col).value):
                    cursor += 1
                lists_ws.cell(cursor, account_list_col, "Maven")

    return len(maven_emps) + moved, moved


def write_row(ws, row, headers, payload):
    for key, value in payload.items():
        col = headers.get(key)
        if col:
            ws.cell(row, col, value)


def pick_uses(rng, profile, n):
    pool = {
        "dev": DEV_USES, "qa": QA_USES, "ba": BA_USES,
        "manager": MGR_USES, "writer": [("Docs", "Drafted delivery notes with Cursor")],
        "support": [("Docs", "Captured support runbooks with Cursor")],
    }[profile]
    n = min(n, len(pool))
    return rng.sample(pool, n)


def source_for(rng, hours, tokens):
    if hours <= 0 and tokens <= 0:
        return "Generated"
    if tokens > 0 and rng.random() < 0.18:
        return "Generated"
    if rng.random() < 0.42:
        return "Estimated-generated"
    return "Generated"


def main():
    if not MASTER.exists():
        raise SystemExit(f"Missing {MASTER}")

    print(f"Loading {MASTER}")
    wb = load_workbook(MASTER)
    people_ws = wb["People"]
    people_headers = header_map(people_ws)
    rng = random.Random(SEED)

    # Resolve protected seats first so Maven reassignment never moves Cognos anchors.
    protected_emps = set(PROTECTED_EMP)
    for r in range(2, people_ws.max_row + 1):
        emp = people_ws.cell(r, people_headers["Employee number"]).value
        try:
            emp = int(emp) if emp is not None else None
        except (TypeError, ValueError):
            continue
        if emp is None or emp <= 0:
            continue
        first = plain(people_ws.cell(r, people_headers["First name"]).value)
        last = plain(people_ws.cell(r, people_headers["Last name"]).value)
        name = f"{first} {last}".strip().casefold()
        if name in PROTECTED_BILLING_NAMES:
            protected_emps.add(emp)

    lists_ws = wb["Lists"] if "Lists" in wb.sheetnames else None
    maven_headcount, maven_moved = ensure_maven_on_roster(
        people_ws, people_headers, lists_ws, protected_emps, rng
    )
    print(f"maven_roster headcount={maven_headcount} moved={maven_moved}")

    people_count_before = 0
    people_rows = []
    names_by_emp = {}
    for r in range(2, people_ws.max_row + 1):
        emp = people_ws.cell(r, people_headers["Employee number"]).value
        if emp is None:
            continue
        try:
            emp = int(emp)
        except (TypeError, ValueError):
            continue
        if emp <= 0:
            continue
        people_count_before += 1
        first = plain(people_ws.cell(r, people_headers["First name"]).value)
        last = plain(people_ws.cell(r, people_headers["Last name"]).value)
        name = f"{first} {last}".strip()
        names_by_emp[emp] = name
        mgr_emp = people_ws.cell(r, people_headers["Manager employee number"]).value
        try:
            mgr_emp = int(mgr_emp) if mgr_emp is not None else None
        except (TypeError, ValueError):
            mgr_emp = None
        people_rows.append({
            "emp": emp,
            "name": name,
            "account": plain(people_ws.cell(r, people_headers["Account"]).value) or "NH",
            "department": plain(people_ws.cell(r, people_headers["Department"]).value),
            "module": plain(people_ws.cell(r, people_headers.get("Module", 1)).value) if "Module" in people_headers else "",
            "title": plain(people_ws.cell(r, people_headers["Job title"]).value),
            "mgr_emp": mgr_emp,
        })

    for row in people_rows:
        row["manager"] = names_by_emp.get(row["mgr_emp"], "") or "Unassigned"
        row["team"] = team_of(row["department"], row["module"])
        row["profile"] = role_profile(row["title"], row["department"])
        row["domain"] = "QA" if row["profile"] == "qa" else "Development"

    in_scope = [r for r in people_rows if r["profile"] != "none"]
    protected_people = [
        r for r in people_rows
        if r["emp"] in PROTECTED_EMP or r["name"].casefold() in PROTECTED_BILLING_NAMES
    ]
    protected_emps = {r["emp"] for r in protected_people}
    candidates = [r for r in in_scope if r["emp"] not in protected_emps]

    by_project = defaultdict(list)
    for row in candidates:
        by_project[row["account"]].append(row)

    actives = []
    active_keys = set()
    for project, rows in by_project.items():
        rows = list(rows)
        rng.shuffle(rows)
        qa_rows = [r for r in rows if r["profile"] == "qa"]
        others = [r for r in rows if r["profile"] != "qa"]
        target = max(1, int(round(len(rows) * ADOPTION.get(project, 0.6))))
        chosen = []
        if project in QA_PROJECTS_WITH_AI and qa_rows:
            qa_take = max(1, int(round(len(qa_rows) * (0.55 if project == "NH" else 0.40))))
            chosen.extend(qa_rows[:qa_take])
        remain = max(0, target - len(chosen))
        chosen.extend(others[:remain])
        for person in chosen:
            actives.append(person)
            active_keys.add(person["emp"])

    # Guarantee mixed health: keep AK adoption low even if rounding drifts.
    ak_actives = [p for p in actives if p["account"] == "AK"]
    if len(ak_actives) > int(len(by_project["AK"]) * 0.42):
        drop = ak_actives[int(len(by_project["AK"]) * 0.38):]
        for person in drop:
            active_keys.discard(person["emp"])
        actives = [p for p in actives if p["emp"] in active_keys]

    activity_rows = []
    billed_unused = []

    def add_activity(person, release, start, end, use_case, activity, hours, tokens, source, extra=None):
        extra = extra or {}
        baseline = round(hours / 0.35, 1) if hours > 0 else None
        payload = {
            "Release": release,
            "Domain": person["domain"],
            "Team": person["team"],
            "Manager": person["manager"],
            "Employee number": person["emp"],
            "Employee name": person["name"],
            "Period start": start,
            "Period end": end,
            "Tool": "Cursor",
            "Provider": "Cursor",
            "Use case": use_case,
            "Activity": activity,
            "Request count": rng.randint(4, 28) if hours > 0 else rng.randint(1, 6),
            "Input tokens": int(tokens * 0.62) if tokens else None,
            "Output tokens": int(tokens * 0.38) if tokens else None,
            "Total tokens": int(tokens) if tokens else None,
            "Hours saved": hours if hours else 0,
            "Baseline hours without AI": baseline,
            "Benefit note": rng.choice(BENEFIT_QA if person["domain"] == "QA" else BENEFIT_DEV) if hours else "",
            "Source": source,
            "Notes": "Generated from People roster; not a vendor export.",
            "Project": person["account"],
            "Account": person["account"],
        }
        if person["domain"] == "QA" and hours > 0:
            payload["Test cases generated"] = rng.randint(6, 28)
            payload["Automation assets"] = rng.randint(0, 3) if use_case == "Test automation" else 0
        if hours > 0 and use_case in ("Code generation", "Refactoring", "SQL development"):
            payload["Artifacts generated"] = rng.randint(1, 8)
            payload["Generated lines"] = rng.randint(40, 420)
        payload.update(extra)
        activity_rows.append(payload)

    latest = "2026.10"
    for person in actives:
        project = person["account"]
        series = RELEASES_ND if project == "ND" else RELEASES_SHARED
        latest_meta = next(item for item in series if item[0] == latest)
        n_uses = 1 if person["profile"] in ("manager", "support", "writer") else rng.randint(1, 3)
        uses = pick_uses(rng, person["profile"], n_uses)
        # Unquantified minority so ATT-5 can still fire on NH.
        unquant = project == "NH" and rng.random() < 0.06
        hours_budget = 0 if unquant else rng.uniform(2.0, 16.0)
        if person["profile"] in ("manager", "support", "writer"):
            hours_budget = 0 if unquant else rng.uniform(2.0, 6.5)
        if person["account"] == "AK":
            hours_budget = min(hours_budget, rng.uniform(2.0, 7.0)) if hours_budget else 0
        token_user = (not unquant) and rng.random() < (0.16 if project == "NH" else 0.08)
        heavy = token_user and project == "NH" and rng.random() < 0.12
        tokens_total = 0
        if token_user:
            tokens_total = rng.randint(140000, 260000) if heavy else rng.randint(8000, 90000)
            if heavy:
                hours_budget = min(hours_budget, rng.uniform(2.0, 5.5))
        remaining_h = hours_budget
        remaining_t = tokens_total
        for index, (use_case, activity) in enumerate(uses):
            last = index == len(uses) - 1
            hours = remaining_h if last else round(remaining_h * rng.uniform(0.25, 0.55), 1)
            remaining_h = max(0.0, remaining_h - hours)
            tokens = remaining_t if last else int(remaining_t * rng.uniform(0.3, 0.6)) if remaining_t else 0
            remaining_t = max(0, remaining_t - tokens)
            hours = round(hours, 1)
            source = source_for(rng, hours, tokens)
            add_activity(person, latest, latest_meta[2], latest_meta[3], use_case, activity, hours, tokens, source)

        if rng.random() < PRIOR_SHARE.get(project, 0.4):
            prior = [item for item in series if item[0] != latest]
            take = rng.sample(prior, k=min(len(prior), rng.randint(1, 2)))
            for rel, _seq, start, end, _rd in take:
                use_case, activity = pick_uses(rng, person["profile"], 1)[0]
                hours = 0 if rng.random() < 0.25 else round(rng.uniform(1.0, 6.0), 1)
                tokens = rng.randint(5000, 40000) if hours and rng.random() < 0.08 else 0
                add_activity(person, rel, start, end, use_case, activity, hours, tokens, source_for(rng, hours, tokens))

    # Unused licences: billed non-adopters (not protected, not active).
    unused_pool = [r for r in candidates if r["emp"] not in active_keys and r["profile"] in ("dev", "qa", "ba")]
    rng.shuffle(unused_pool)
    billed_unused = unused_pool[:12]

    # Outcomes: Team x Project x Release x Domain
    groups = defaultdict(list)
    for row in people_rows:
        if row["profile"] == "none":
            continue
        groups[(row["team"], row["account"], row["domain"])].append(row)

    active_by_key = defaultdict(set)
    hours_by_key = defaultdict(float)
    tokens_by_key = defaultdict(float)
    uses_by_key = defaultdict(list)
    for row in activity_rows:
        key = (row["Team"], row["Project"], row["Release"], row["Domain"])
        active_by_key[key].add(row["Employee number"])
        hours_by_key[key] += float(row.get("Hours saved") or 0)
        tokens_by_key[key] += float(row.get("Total tokens") or 0)
        if row["Use case"]:
            uses_by_key[key].append(row["Use case"])

    outcome_rows = []
    for (team, project, domain), members in groups.items():
        if project == "AK" and domain == "QA":
            # Outcome row exists (so C3 is 0, not n/a) but zero activity — ATT-3 adoption gap.
            pass
        series = RELEASES_ND if project == "ND" else RELEASES_SHARED
        owner = members[0]["manager"]
        mgr_counts = defaultdict(int)
        for person in members:
            mgr_counts[person["manager"]] += 1
        owner = max(mgr_counts.items(), key=lambda item: item[1])[0]
        headcount = len(members)
        for rel, seq, start, end, rel_date in series:
            key = (team, project, rel, domain)
            using = len(active_by_key.get(key, set()))
            hours = round(hours_by_key.get(key, 0.0), 1)
            tokens = int(tokens_by_key.get(key, 0))
            top = []
            seen = set()
            for use in uses_by_key.get(key, []):
                if use not in seen:
                    seen.add(use)
                    top.append(use)
            stories = max(4, int(round(headcount * rng.uniform(2.2, 3.6))))
            stories_ai = 0 if using == 0 else max(1, min(stories - 1, int(round(stories * rng.uniform(0.35, 0.72)))))
            defects_base = None
            defects_act = None
            if using and rng.random() < (0.7 if rel == latest else 0.35):
                defects_base = rng.randint(18, 70)
                drop = rng.randint(2, 14) if domain == "QA" or rng.random() < 0.6 else rng.randint(0, 6)
                defects_act = max(0, defects_base - drop)
            cycle = rng.randint(1, 4) if using and rng.random() < 0.25 else None
            qa_note = "QA evidence still thin for this slice." if domain == "QA" and using == 0 else ""
            outcome_rows.append({
                "Release": rel,
                "Domain": domain,
                "Team": team,
                "Owner": owner,
                "Headcount in scope": headcount,
                "People using AI": using,
                "Adoption %": round(using / headcount, 4) if headcount else 0,
                "Total tokens": tokens or None,
                "Total hours saved": hours or None,
                "Tools used": "Cursor",
                "Top use cases": ", ".join(top[:4]) or ("(none)" if using == 0 else "Docs"),
                "Measurable benefits": (
                    "No quantified AI hours this release."
                    if using == 0 else
                    rng.choice(BENEFIT_QA if domain == "QA" else BENEFIT_DEV)
                ),
                "Gaps": qa_note or rng.choice(GAPS),
                "Challenges": rng.choice(CHALLENGES),
                "Opportunities next release": rng.choice(OPPS),
                "Status": "Submitted" if using else "Draft",
                "Submitted on": end if using else None,
                "Project": project,
                "Stories delivered": stories,
                "Stories using AI": stories_ai,
                "Defects baseline": defects_base,
                "Defects actual": defects_act,
                "Cycle time days saved": cycle,
                "Release sequence": seq,
                "Release date": rel_date,
            })

    billing_rows = []
    billed_people = [p for p in actives]
    for person in billed_people:
        billing_rows.append({
            "Name": person["name"],
            "Total Usage (USD)": round(rng.uniform(15.0, 40.0), 2),
            "Month": "October",
            "Billing Start Date": date(2026, 10, 7),
            "Billing End Date": date(2026, 10, 31),
            "Employee number": person["emp"],
            "Team": person["team"],
            "Project": person["account"],
            "Source": "Generated",
        })
    for person in billed_unused:
        billing_rows.append({
            "Name": person["name"],
            "Total Usage (USD)": round(rng.uniform(16.0, 32.0), 2),
            "Month": "October",
            "Billing Start Date": date(2026, 10, 7),
            "Billing End Date": date(2026, 10, 31),
            "Employee number": person["emp"],
            "Team": person["team"],
            "Project": person["account"],
            "Source": "Generated",
        })

    # --- write sheets --------------------------------------------------------
    util_ws = wb["AI utilization"]
    util_headers = ensure_columns(util_ws, UTIL_NEW_COLS)
    removed_util = delete_generated_rows(util_ws, util_headers)
    start = last_data_row(util_ws) + 1
    for offset, payload in enumerate(activity_rows):
        write_row(util_ws, start + offset, util_headers, payload)

    out_ws = wb["AI release outcomes"]
    out_headers = ensure_columns(out_ws, OUTCOME_NEW_COLS)
    # Generated outcomes have Project filled and Source is not on this sheet;
    # delete prior generated by Notes/Opportunities marker or Project+Owner from this run.
    # Safer: delete rows whose Opportunities or Gaps look generated AND Project is set AND
    # Status in Draft/Submitted and Owner is a roster manager — but that could hit Cognos.
    # Marker: write Reviewed by = "Generated" on new rows; never touch blank/other Reviewed by.
    if "Reviewed by" not in out_headers:
        out_headers = ensure_columns(out_ws, ["Reviewed by"])

    def outcome_generated(ws, row, headers):
        reviewed = plain(ws.cell(row, headers.get("Reviewed by", 1)).value)
        return reviewed.casefold() == "generated"

    for payload in outcome_rows:
        payload["Reviewed by"] = "Generated"
    removed_out = delete_generated_rows(out_ws, out_headers, source_title="Reviewed by", extra_pred=outcome_generated)
    start = last_data_row(out_ws) + 1
    for offset, payload in enumerate(outcome_rows):
        write_row(out_ws, start + offset, out_headers, payload)

    bill_ws = wb["Cursor billing"]
    bill_headers = ensure_columns(bill_ws, BILLING_NEW_COLS)

    def billing_generated(ws, row, headers):
        source = plain(ws.cell(row, headers.get("Source", 1)).value)
        name = plain(ws.cell(row, headers.get("Name", 1)).value).casefold()
        if source.casefold() in GENERATED_SOURCES or source.casefold() == "generated":
            return True
        # Legacy generated without Source: not the protected Cognos eight.
        return bool(name) and name not in PROTECTED_BILLING_NAMES and source.casefold() == "generated"

    removed_bill = delete_generated_rows(bill_ws, bill_headers, extra_pred=billing_generated)
    start = last_data_row(bill_ws) + 1
    for offset, payload in enumerate(billing_rows):
        write_row(bill_ws, start + offset, bill_headers, payload)

    # Lists: extra use cases
    lists = wb["Lists"]
    list_headers = header_map(lists)
    use_col = list_headers.get("AI use case")
    if use_col:
        existing = {plain(lists.cell(r, use_col).value) for r in range(2, lists.max_row + 1)}
        cursor = 2
        while plain(lists.cell(cursor, use_col).value):
            cursor += 1
        for value in USE_CASES_EXTRA:
            if value not in existing:
                lists.cell(cursor, use_col, value)
                cursor += 1
    source_col = list_headers.get("AI source")
    if source_col:
        existing = {plain(lists.cell(r, source_col).value) for r in range(2, lists.max_row + 1)}
        cursor = 2
        while plain(lists.cell(cursor, source_col).value):
            cursor += 1
        for value in ("Generated", "Estimated-generated"):
            if value not in existing:
                lists.cell(cursor, source_col, value)
                cursor += 1

    catalog = wb["AI tools catalog"]
    cat_headers = header_map(catalog)
    tool_col = cat_headers.get("Tool")
    allow_col = cat_headers.get("Allowed use cases")
    if tool_col and allow_col:
        for r in range(2, catalog.max_row + 1):
            if plain(catalog.cell(r, tool_col).value).casefold() == "cursor":
                catalog.cell(r, allow_col, CATALOG_CURSOR_USES)
                break

    targets = wb["AI targets"]
    tgt_headers = header_map(targets)
    rel_col = tgt_headers.get("Release")
    seq_col = tgt_headers.get("Sequence")
    if rel_col and seq_col:
        have = {}
        last_order_row = 1
        for r in range(2, targets.max_row + 1):
            release = plain(targets.cell(r, rel_col).value)
            if release:
                have[release] = r
                last_order_row = max(last_order_row, r)
        for release, seq in RELEASE_ORDER.items():
            if release in have:
                cell = targets.cell(have[release], seq_col)
                if getattr(cell, "value", None) is not None or not hasattr(cell, "value"):
                    try:
                        cell.value = seq
                    except AttributeError:
                        pass
                continue
            last_order_row += 1
            try:
                targets.cell(last_order_row, rel_col, release)
                targets.cell(last_order_row, seq_col, seq)
            except AttributeError:
                pass

    people_count_after = 0
    for r in range(2, people_ws.max_row + 1):
        emp = people_ws.cell(r, people_headers["Employee number"]).value
        try:
            if emp is not None and int(emp) > 0:
                people_count_after += 1
        except (TypeError, ValueError):
            pass
    if people_count_after != people_count_before:
        raise SystemExit(f"People count changed {people_count_before} -> {people_count_after}; aborting save")

    print(f"Saving {MASTER}")
    wb.save(MASTER)

    delivery = len(in_scope)
    adoption_pct = (len(actives) / delivery * 100) if delivery else 0
    projects = sorted({p["account"] for p in actives})
    print("employees_scanned", people_count_after)
    print("delivery_in_scope", delivery)
    print("active_users_generated", len(actives))
    print("portfolio_adoption_pct", round(adoption_pct, 1))
    print("activity_rows_added", len(activity_rows), "replaced", removed_util)
    print("outcome_rows_added", len(outcome_rows), "replaced", removed_out)
    print("billing_rows_added", len(billing_rows), "replaced", removed_bill, "unused_licences", len(billed_unused))
    print("projects_covered", ",".join(projects))
    for project in ("NH", "ND", "AK", "Maven"):
        n = sum(1 for p in actives if p["account"] == project)
        d = len(by_project[project])
        print(f"  {project}: active {n}/{d} ({(n / d * 100) if d else 0:.1f}%)")
    print("protected_cognos_people", len(protected_emps))
    print("ok")


if __name__ == "__main__":
    try:
        main()
    except PermissionError:
        print("Workbook is open in Excel. Close it and re-run.", file=sys.stderr)
        sys.exit(2)
