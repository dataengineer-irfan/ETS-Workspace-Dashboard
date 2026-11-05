import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
import math
import re
from datetime import date
from fastapi import HTTPException, status
from backend.app.data_loader import data_loader

GRADE_ORDER = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10']
WORK_MODEL_ORDER = ['Office', 'Hybrid', 'Remote', 'Client site', 'Not recorded yet']


def work_model_series(df: pd.DataFrame) -> pd.Series:
    if df is None or len(df) == 0:
        return pd.Series(dtype=str)
    if 'Work_Model' not in df.columns:
        return pd.Series(['Not recorded yet'] * len(df), index=df.index)
    values = df['Work_Model'].map(lambda value: str(value).strip() if pd.notna(value) else '')
    return values.replace({
        '': 'Not recorded yet',
        'nan': 'Not recorded yet',
        'None': 'Not recorded yet',
        'NaT': 'Not recorded yet',
    })


def work_model_mix(df: pd.DataFrame) -> List[Dict[str, Any]]:
    series = work_model_series(df)
    total = len(df) if df is not None else 0
    counts = series.value_counts() if len(series) else pd.Series(dtype=int)
    rows = []
    seen = set()
    for name in WORK_MODEL_ORDER:
        count = int(counts.get(name, 0))
        seen.add(name)
        rows.append({
            'model': name,
            'count': count,
            'percentage': round((count / total) * 100, 1) if total else 0.0,
        })
    for name, count in counts.items():
        if str(name) not in seen:
            rows.append({
                'model': str(name),
                'count': int(count),
                'percentage': round((int(count) / total) * 100, 1) if total else 0.0,
            })
    return rows


def training_summary(employee_ids) -> Dict[str, Any]:
    frame = getattr(data_loader, 'df_training', None)
    summary = {
        'total': 0,
        'planned': 0,
        'in_progress': 0,
        'completed': 0,
        'cancelled': 0,
        'not_recorded': True,
    }
    if frame is None or frame.empty:
        return summary
    scoped = frame
    if employee_ids is not None:
        scoped = frame[frame['EMPLOYEE NUMBER'].isin(set(int(v) for v in employee_ids))]
    aliases = {
        'planned': 'planned',
        'in progress': 'in_progress',
        'completed': 'completed',
        'cancelled': 'cancelled',
        'canceled': 'cancelled',
    }
    for status in scoped['Status'].fillna(''):
        key = aliases.get(str(status).strip().lower())
        if key:
            summary[key] += 1
            summary['total'] += 1
    summary['not_recorded'] = summary['total'] == 0
    return summary


def _iso_date(value):
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except TypeError:
        pass
    if hasattr(value, 'strftime'):
        return value.strftime('%Y-%m-%d')
    text = str(value).strip()
    if not text or text.lower() in ('nan', 'nat', 'none'):
        return None
    return text[:10]


def employee_training_rows(emp_number: int) -> List[Dict[str, Any]]:
    frame = getattr(data_loader, 'df_training', None)
    if frame is None or frame.empty:
        return []
    rows = frame[frame['EMPLOYEE NUMBER'] == int(emp_number)]
    records = []
    for _, row in rows.iterrows():
        records.append({
            'name': str(row.get('Training') or ''),
            'provider': str(row.get('Provider') or ''),
            'status': str(row.get('Status') or ''),
            'start_date': _iso_date(row.get('Start_Date')),
            'end_date': _iso_date(row.get('End_Date')),
            'hours': sanitize_val(row.get('Hours')) or 0,
            'mandatory': str(row.get('Mandatory') or ''),
            'skill': str(row.get('Skill') or ''),
        })
    return records

def sort_grades(grades: List[str]) -> List[str]:
    return sorted(grades, key=lambda g: GRADE_ORDER.index(g) if g in GRADE_ORDER else 99)

def sanitize_val(v):
    if v is None or v is pd.NaT or (isinstance(v, float) and (math.isnan(v) or math.isinf(v))):
        return None
    if isinstance(v, str) and v.strip().lower() in ('nat', 'nan', 'none', 'null'):
        return None
    try:
        if pd.isna(v):
            return None
    except (TypeError, ValueError):
        pass
    if isinstance(v, (pd.Timestamp, pd.Timedelta)):
        return v.isoformat()
    if isinstance(v, (np.int64, np.int32, np.int16, np.int8)):
        return int(v)
    if isinstance(v, (np.float64, np.float32)):
        return round(float(v), 2)
    return v

def sanitize_dict(d: Dict[str, Any]) -> Dict[str, Any]:
    return {k: sanitize_val(v) for k, v in d.items()}

def sanitize_list(l: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [sanitize_dict(item) for item in l]

def parse_filter_list(val: Any) -> List[str]:
    """
    Parses filter input into a clean list of non-empty strings.
    Handles None, empty string, list, tuple, set, comma-separated string,
    and excludes 'ALL' / 'ALL (ALL)' placeholders.
    """
    if val is None:
        return []
    if isinstance(val, (list, tuple, set)):
        items = []
        for v in val:
            items.extend(parse_filter_list(v))
        return items
    s = str(val).strip()
    if not s or s.lower() in ('', 'all', 'none', 'null', 'undefined'):
        return []
    parts = [p.strip() for p in s.split(',') if p.strip()]
    return [p for p in parts if p.lower() not in ('all', 'none', 'null', 'undefined')]

def extract_request_filters(request: Any) -> Dict[str, Any]:
    """
    Extracts query parameters from Starlette/FastAPI Request,
    supporting key, key[], comma-separated, and multi-repeated keys.
    """
    filters: Dict[str, Any] = {}
    if not hasattr(request, 'query_params'):
        return filters
    for k, v in request.query_params.multi_items():
        clean_k = k[:-2] if k.endswith('[]') else k
        if clean_k not in filters:
            filters[clean_k] = []
        filters[clean_k].append(v)
    return filters

def apply_employee_filters(df: pd.DataFrame, filters: Dict[str, Any]) -> pd.DataFrame:
    res = df.copy()
    if not filters:
        return res

    # State filter (NH, ND, AK)
    states = parse_filter_list(filters.get('state'))
    if states:
        res = res[res['State'].astype(str).str.upper().isin([s.upper() for s in states])]

    # Project filter (AK, ND, NH, NH Projects)
    projects = parse_filter_list(filters.get('project'))
    if projects:
        projects_upper = [p.upper() for p in projects]
        matched = res['Project Working'].astype(str).str.upper().isin(projects_upper)
        if any(p == 'NH' for p in projects_upper):
            matched = matched | (res['Project Working'].astype(str).str.upper() == 'NH PROJECTS')
        res = res[matched]

    # Module filter (MMIS Modules: Claims, Member, Provider, etc.)
    modules = parse_filter_list(filters.get('module'))
    if modules and 'Module' in res.columns:
        res = res[res['Module'].astype(str).str.upper().isin([m.upper() for m in modules])]

    # Job level / Grade filter (E1 - E10)
    grades = parse_filter_list(filters.get('job_level'))
    if grades:
        res = res[res['JOB LEVEL'].astype(str).str.upper().isin([g.upper() for g in grades])]

    # Location filter (Bangalore, Chennai, Hyderabad, Pune)
    locations = parse_filter_list(filters.get('location'))
    if locations:
        res = res[res['LOCATION'].astype(str).str.upper().isin([l.upper() for l in locations])]

    # Department filter (Cognos, Core, IT, Informatica, Infra, QA)
    departments = parse_filter_list(filters.get('department'))
    if departments:
        res = res[res['DEPARTMENT'].astype(str).str.upper().isin([d.upper() for d in departments])]

    # Manager filter
    managers = parse_filter_list(filters.get('manager'))
    if managers:
        pattern = '|'.join(re.escape(m) for m in managers)
        res = res[res['MANAGER'].astype(str).str.contains(pattern, case=False, regex=True, na=False)]

    # Salary bin filter ('< 5L', '5-10L', etc.)
    salary_bins = parse_filter_list(filters.get('salary_bin'))
    if salary_bins:
        res = res[res['SalaryBin'].astype(str).isin(salary_bins)]

    # Skill filter (Primary Skill or any Secondary/All Skills)
    skills = parse_filter_list(filters.get('skill_name') or filters.get('skill'))
    if skills:
        skills_upper = [s.upper() for s in skills]
        def matches_skill(row):
            p = str(row.get('Primary_Skill', '')).upper()
            if p in skills_upper or any(s in p for s in skills_upper):
                return True
            all_s = row.get('All_Skills', [])
            if isinstance(all_s, list):
                for sk in all_s:
                    sk_u = str(sk).upper()
                    if sk_u in skills_upper or any(s in sk_u for s in skills_upper):
                        return True
            return False
        res = res[res.apply(matches_skill, axis=1)]

    # Tenure band filter ('< 1 Yr', '1 to 3 Yrs', '3 to 5 Yrs', '5 to 10 Yrs', '10+ Yrs')
    tenure_bands = parse_filter_list(filters.get('tenure_band'))
    if tenure_bands:
        masks = []
        for tb in tenure_bands:
            tb_str = str(tb).lower()
            if '<' in tb_str or ('1 yr' in tb_str and 'to' not in tb_str):
                masks.append(res['Infinite_Exp'] < 1)
            elif '1 to 3' in tb_str:
                masks.append((res['Infinite_Exp'] >= 1) & (res['Infinite_Exp'] < 3))
            elif '3 to 5' in tb_str:
                masks.append((res['Infinite_Exp'] >= 3) & (res['Infinite_Exp'] < 5))
            elif '5 to 10' in tb_str:
                masks.append((res['Infinite_Exp'] >= 5) & (res['Infinite_Exp'] < 10))
            elif '10+' in tb_str or '10' in tb_str:
                masks.append(res['Infinite_Exp'] >= 10)
        if masks:
            combined = masks[0]
            for m in masks[1:]:
                combined = combined | m
            res = res[combined]

    # Employment type filter ('Permanent', 'Contract', 'Intern')
    emp_types = parse_filter_list(filters.get('emp_type'))
    if emp_types:
        masks = []
        for et in emp_types:
            et_str = str(et).lower()
            if 'intern' in et_str:
                masks.append(res['JOB LEVEL'].astype(str) == 'E1')
            elif 'contract' in et_str:
                masks.append(res['JOB LEVEL'].astype(str).isin(['E1', 'E2']))
            elif 'permanent' in et_str:
                masks.append(~res['JOB LEVEL'].astype(str).isin(['E1', 'E2']))
        if masks:
            combined = masks[0]
            for m in masks[1:]:
                combined = combined | m
            res = res[combined]

    # Search filter (name, number, email, title)
    search_q = str(filters.get('search') or '').lower().strip()
    if search_q and search_q not in ('', 'none', 'null', 'undefined'):
        res = res[
            res['EMPLOYEE LABEL'].astype(str).str.lower().str.contains(search_q, regex=False, na=False) |
            res['EMPLOYEE NUMBER'].astype(str).str.contains(search_q, regex=False, na=False) |
            res['EMAIL'].astype(str).str.lower().str.contains(search_q, regex=False, na=False) |
            res['JOB TITLE'].astype(str).str.lower().str.contains(search_q, regex=False, na=False)
        ]

    return res


# ---------------------------------------------------------------------------
# AI use tab - Page 1 Executive Command Center (docs/AI_UTILIZATION_DASHBOARD_DESIGN.md
# Sections 3, 4, 8, 10). Additive payload for GET /api/ai-utilization/kpis.
# ---------------------------------------------------------------------------
# Decision Intelligence Health (VP brief). N/A components drop out and remaining
# weights renormalise. Tile colour uses _ai_health_band; badge uses _ai_health_label.
AI_HEALTH_WEIGHTS = [
    ('c1', 'Adoption %', 30),
    ('c2', 'Business Value', 25),
    ('c3', 'Release Coverage %', 20),
    ('c4', 'QA Adoption %', 15),
    ('c5', 'Documentation Usage', 10),
]


def _ai_num(value, default=None):
    try:
        if value is None:
            return default
        out = float(value)
        if math.isnan(out) or math.isinf(out):
            return default
        return out
    except (TypeError, ValueError):
        return default


def _ai_round(value, digits=1):
    value = _ai_num(value)
    return None if value is None else round(value, digits)


def _ai_ratio(numerator, denominator, scale=1.0):
    """numerator / denominator * scale, or None when the denominator is missing or zero (never 0 for n/a)."""
    numerator = _ai_num(numerator)
    denominator = _ai_num(denominator)
    if numerator is None or denominator is None or denominator == 0:
        return None
    return numerator / denominator * scale


def _ai_band(actual, target, tolerance=0.10, lower_is_better=False):
    """Target & tolerance rule (design Section 3.1): green / amber / red / neutral."""
    actual = _ai_num(actual)
    target = _ai_num(target)
    if actual is None or target is None:
        return 'neutral'
    tolerance = _ai_num(tolerance, 0.10) or 0.0
    if lower_is_better:
        if actual <= target:
            return 'green'
        if actual <= target * (1 + tolerance):
            return 'amber'
        return 'red'
    if actual >= target:
        return 'green'
    if actual >= target * (1 - tolerance):
        return 'amber'
    return 'red'


def _ai_health_band(score):
    """Tile colour: Green Health>80 | Amber 60-80 | Red <60."""
    score = _ai_num(score)
    if score is None:
        return 'neutral'
    if score > 80:
        return 'green'
    if score >= 60:
        return 'amber'
    return 'red'


def _ai_health_label(score):
    """Leadership band: 90-100 Elite | 80-89 Strong | 70-79 Average | <70 Attention Required."""
    score = _ai_num(score)
    if score is None:
        return None
    if score >= 90:
        return 'Elite'
    if score >= 80:
        return 'Strong'
    if score >= 70:
        return 'Average'
    return 'Attention Required'


def _ai_confidence_band(pct):
    pct = _ai_num(pct)
    if pct is None:
        return 'neutral'
    if pct >= 80:
        return 'High'
    if pct >= 50:
        return 'Medium'
    return 'Low'


def _ai_component_score(actual, target):
    """MIN(100, actual / target * 100); None when either side is missing."""
    ratio = _ai_ratio(actual, target, 100.0)
    return None if ratio is None else max(0.0, min(100.0, ratio))


def _ai_release_natural_key(label):
    """Fallback ordering when the AI targets sheet has no Release order row: numeric parts, then text."""
    parts = re.findall(r'\d+', str(label))
    return tuple(int(part) for part in parts) + (str(label),)


def _ai_executive_view(usage, outcomes, billing, targets, release_order, total_hours, total_tokens, total_spend):
    """Health tiles, attention zone, ranking, project x domain rows and summary extensions for Page 1."""
    def target_of(metric, default=None):
        entry = (targets or {}).get(metric) or {}
        return _ai_num(entry.get('target'), default)

    def tolerance_of(metric):
        entry = (targets or {}).get(metric) or {}
        return _ai_num(entry.get('tolerance'), 0.10)

    def lower_of(metric):
        entry = (targets or {}).get(metric) or {}
        return bool(entry.get('lower_is_better', False))

    t_adopt = target_of('Adoption_Pct', 80.0)
    t_dev = target_of('Dev_Adoption_Pct', t_adopt)
    t_qa = target_of('QA_Adoption_Pct', 50.0)
    t_hours_user = target_of('Hours_per_User', 8.0)
    t_eff_usd = target_of('Hours_per_100USD', 30.0)
    t_eff_tok = target_of('Hours_per_100kTokens', 20.0)
    t_cover = target_of('Release_Coverage_Pct', 100.0)
    t_roi = target_of('ROI_Index', 5.0)
    rate_usd = target_of('Loaded_Rate_USD', 40.0) or 40.0
    rate_inr = target_of('Loaded_Rate_INR', 3000.0)
    t_attention = target_of('Attention_Adoption_Pct', 60.0)
    t_decline = target_of('Trend_Decline_Pts', 5.0)
    flat_targets = {metric: _ai_num((entry or {}).get('target')) for metric, entry in (targets or {}).items()}

    def clean(series, default=''):
        return series.fillna(default).astype(str).str.strip() if series is not None else pd.Series(dtype=object)

    # --- normalise activity rows ------------------------------------------------
    if usage is None or usage.empty:
        act = pd.DataFrame(columns=['_project', '_release', '_domain', '_team', '_person', '_name', '_hours', '_tokens', '_source', '_emp', '_use', '_manager'])
    else:
        act = pd.DataFrame(index=usage.index)
        act['_project'] = clean(usage.get('Project')).replace('', 'Unspecified')
        act['_release'] = clean(usage.get('Release'))
        act['_domain'] = clean(usage.get('Domain'))
        act['_team'] = clean(usage.get('Team'))
        act['_name'] = clean(usage.get('Employee_Name'))
        act['_manager'] = clean(usage.get('Manager'))
        act['_use'] = clean(usage.get('Use_Case')).map(_ai_canonical_use_case)
        emp = pd.to_numeric(usage.get('EMPLOYEE NUMBER'), errors='coerce')
        act['_emp'] = emp
        act['_person'] = [
            f'emp:{int(number)}' if pd.notna(number) else f'name:{name.casefold()}'
            for number, name in zip(emp, act['_name'])
        ]
        act['_hours'] = pd.to_numeric(usage.get('Hours_Saved'), errors='coerce').fillna(0.0)
        act['_tokens'] = pd.to_numeric(usage.get('Total_Tokens'), errors='coerce').fillna(0.0)
        act['_source'] = clean(usage.get('Source')).str.casefold()
        act = act[act['_name'] != ''] if len(act) else act
    act['_evidence'] = (act['_hours'] > 0) | (act['_tokens'] > 0) if len(act) else pd.Series(dtype=bool)

    if outcomes is None or outcomes.empty:
        outc = pd.DataFrame(columns=['_release', '_domain', '_team', '_headcount', '_using'])
    else:
        outc = pd.DataFrame(index=outcomes.index)
        outc['_release'] = clean(outcomes.get('Release'))
        outc['_domain'] = clean(outcomes.get('Domain'))
        outc['_team'] = clean(outcomes.get('Team'))
        outc['_headcount'] = pd.to_numeric(outcomes.get('Headcount'), errors='coerce')
        outc['_using'] = pd.to_numeric(outcomes.get('People_Using'), errors='coerce')
        outc = outc[outc['_release'] != '']

    if billing is None or billing.empty:
        bill = pd.DataFrame(columns=['_project', '_name', '_cost', '_emp', '_person'])
    else:
        bill = pd.DataFrame(index=billing.index)
        bill['_project'] = clean(billing.get('Project'))
        bill['_name'] = clean(billing.get('Name'))
        bill['_cost'] = pd.to_numeric(billing.get('Cost_USD'), errors='coerce').fillna(0.0)
        emp_b = pd.to_numeric(billing.get('EMPLOYEE NUMBER'), errors='coerce')
        bill['_emp'] = emp_b
        bill['_person'] = [
            f'emp:{int(number)}' if pd.notna(number) else f'name:{name.casefold()}'
            for number, name in zip(emp_b, bill['_name'])
        ]

    # --- release sequence -------------------------------------------------------
    all_releases = {r for r in act['_release'].tolist() if r} | {r for r in outc['_release'].tolist() if r}
    # Explicit order first (by sequence), then natural order for anything the sheet does not list.
    explicit = sorted([r for r in all_releases if r in (release_order or {})], key=lambda r: int(release_order[r]))
    implicit = sorted([r for r in all_releases if r not in (release_order or {})], key=_ai_release_natural_key)
    sequence = {label: index + 1 for index, label in enumerate(explicit + implicit)}

    projects = sorted({p for p in act['_project'].tolist() if p})
    # Team -> dominant project (outcome rows carry Team, not Project).
    team_project = {}
    if len(act):
        counts = act.groupby(['_team', '_project']).size().reset_index(name='n')
        for team, chunk in counts.groupby('_team'):
            if team:
                team_project[team] = chunk.sort_values('n', ascending=False)['_project'].iloc[0]
    if len(outc):
        declared = clean(outcomes.get('Project')) if outcomes is not None and 'Project' in outcomes.columns else pd.Series('', index=outc.index)
        inferred_project = outc['_team'].map(team_project)
        outc['_project'] = declared.where(declared.astype(str).str.strip() != '', inferred_project)
    else:
        outc['_project'] = pd.Series(dtype=object)

    # Billing allocation: Project column first, then the person's dominant project.
    person_project = {}
    if len(act):
        counts = act.groupby(['_person', '_project']).size().reset_index(name='n')
        for person, chunk in counts.groupby('_person'):
            person_project[person] = chunk.sort_values('n', ascending=False)['_project'].iloc[0]
    name_person = {}
    if len(act):
        for person, name in zip(act['_person'], act['_name']):
            name_person.setdefault(name.casefold(), person)

    def bill_project(row):
        if row['_project']:
            return row['_project']
        person = row['_person'] if row['_person'] in person_project else name_person.get(row['_name'].casefold())
        return person_project.get(person, '') if person else ''

    bill['_alloc'] = [bill_project(row) for _, row in bill.iterrows()] if len(bill) else []

    def headcount_for(release, domain, direct_rows, team_rows):
        """(headcount, inferred) for a release (+ optional domain). None when no outcome row exists."""
        for inferred, rows in ((False, direct_rows), (True, team_rows)):
            if rows is None or not len(rows):
                continue
            sel = rows[rows['_release'] == release]
            if domain:
                sel = sel[sel['_domain'].str.casefold() == domain.casefold()]
            values = sel.dropna(subset=['_headcount'])
            values = values[values['_headcount'] > 0]
            if len(values):
                keys = [col for col in ('_team', '_domain') if col in values.columns]
                if keys:
                    return float(values.groupby(keys)['_headcount'].max().sum()), inferred
                return float(values['_headcount'].max()), inferred
        return None, True

    health_rows = []
    attention = []
    domain_rows = []
    portfolio_active = set()
    portfolio_export_users = set()
    export_users_all = set(act.loc[(act['_source'] == 'export') & (act['_tokens'] > 0), '_person']) if len(act) else set()

    for project in projects:
        rows = act[act['_project'] == project]
        teams = {t for t in rows['_team'].tolist() if t}
        people_tagged = set(rows['_person'])
        releases_with_rows = {r for r in rows['_release'].tolist() if r}
        if not releases_with_rows:
            continue
        current = max(releases_with_rows, key=lambda r: sequence.get(r, 0))
        direct = outc[outc['_project'] == project] if len(outc) else outc
        # by_team remains headcount fallback only — shared teams (IT/Core/Cognos) span
        # multiple projects and must not inflate this project's release set (R15↔R24 leak).
        by_team = outc[outc['_team'].isin(teams)] if len(outc) else outc
        releases_in_scope = set(releases_with_rows)
        if len(direct):
            releases_in_scope |= {r for r in direct['_release'].tolist() if r}
        if not releases_in_scope:
            releases_in_scope = set(releases_with_rows)

        def release_slice(release, domain=None):
            sel = rows[rows['_release'] == release]
            if domain:
                sel = sel[sel['_domain'].str.casefold() == domain.casefold()]
            return sel

        def active_users(release, domain=None):
            sel = release_slice(release, domain)
            return set(sel.loc[sel['_evidence'], '_person'])

        def head(release, domain=None):
            headcount, inferred = headcount_for(release, domain, direct, by_team)
            if headcount is None and domain is None:
                fallback = set(release_slice(release)['_person']) or people_tagged
                return (float(len(fallback)) if fallback else None), True
            return headcount, inferred

        def adoption(release, domain=None):
            headcount, _ = head(release, domain)
            return _ai_ratio(len(active_users(release, domain)), headcount, 100.0)

        cur_rows = release_slice(current)
        cur_active = active_users(current)
        cur_headcount, inferred = head(current)
        cur_adoption = _ai_ratio(len(cur_active), cur_headcount, 100.0)
        cur_hours = float(cur_rows['_hours'].sum())
        cur_tokens = float(cur_rows['_tokens'].sum())
        hours_total = float(rows['_hours'].sum())
        tokens_total = float(rows['_tokens'].sum())
        spend = float(bill.loc[bill['_alloc'] == project, '_cost'].sum()) if len(bill) else 0.0
        portfolio_active |= cur_active
        portfolio_export_users |= (cur_active & export_users_all)

        dev_head, _ = head(current, 'Development')
        qa_head, _ = head(current, 'QA')
        dev_adoption = _ai_ratio(len(active_users(current, 'Development')), dev_head, 100.0)
        qa_adoption = _ai_ratio(len(active_users(current, 'QA')), qa_head, 100.0)

        covered = {r for r in releases_in_scope if bool(release_slice(r)['_evidence'].any())}
        coverage_pct = _ai_ratio(len(covered), len(releases_in_scope), 100.0)

        previous_candidates = [r for r in releases_with_rows if sequence.get(r, 0) < sequence.get(current, 0)]
        previous = max(previous_candidates, key=lambda r: sequence.get(r, 0)) if previous_candidates else None
        prev_adoption = adoption(previous) if previous else None
        trend_pts = (cur_adoption - prev_adoption) if (cur_adoption is not None and prev_adoption is not None) else None

        hours_per_user = _ai_ratio(cur_hours, len(cur_active))
        if spend > 0:
            efficiency_actual, efficiency_target, efficiency_label = _ai_ratio(cur_hours, spend, 100.0), t_eff_usd, 'Hours saved per $100 spend'
        elif cur_tokens > 0:
            efficiency_actual, efficiency_target, efficiency_label = _ai_ratio(cur_hours, cur_tokens, 100000.0), t_eff_tok, 'Hours saved per 100k tokens'
        else:
            efficiency_actual, efficiency_target, efficiency_label = None, None, 'Cost / token efficiency'
        if trend_pts is None:
            trend_score = None
        else:
            trend_score = 100.0 if trend_pts >= 0 else max(0.0, 100.0 + trend_pts * 10.0)

        docs_mask = rows['_use'].isin(['Docs', 'Documentation']) if len(rows) and '_use' in rows.columns else pd.Series(False, index=rows.index)
        docs_hours = float(rows.loc[docs_mask, '_hours'].sum()) if len(rows) else 0.0
        docs_users = set(rows.loc[docs_mask & rows['_evidence'], '_person']) if len(rows) else set()
        potential_hours = (cur_headcount * t_hours_user) if (cur_headcount and t_hours_user) else None
        potential_value = (potential_hours * rate_usd) if potential_hours is not None else None
        value_usd = hours_total * rate_usd
        unrealized_value = max(0.0, (potential_value or 0.0) - value_usd) if potential_value is not None else None
        business_score = _ai_component_score(value_usd, potential_value)
        docs_target_hours = (potential_hours * 0.10) if potential_hours else None
        if docs_target_hours:
            docs_usage_actual, docs_usage_target, docs_score = docs_hours, docs_target_hours, _ai_component_score(docs_hours, docs_target_hours)
        elif cur_headcount:
            docs_usage_actual = _ai_ratio(len(docs_users), cur_headcount, 100.0)
            docs_usage_target = target_of('Docs_Usage_Pct', 25.0)
            docs_score = _ai_component_score(docs_usage_actual, docs_usage_target)
        else:
            docs_usage_actual, docs_usage_target, docs_score = None, None, None
        token_efficiency = _ai_ratio(value_usd, tokens_total / 1000.0) if tokens_total > 0 else None

        raw_components = {
            'c1': (cur_adoption, t_adopt, _ai_component_score(cur_adoption, t_adopt), 'Adoption %'),
            'c2': (value_usd, potential_value, business_score, 'Business Value'),
            'c3': (coverage_pct, t_cover, _ai_component_score(coverage_pct, t_cover), 'Release Coverage %'),
            'c4': (qa_adoption, t_qa, _ai_component_score(qa_adoption, t_qa), 'QA Adoption %'),
            'c5': (docs_usage_actual, docs_usage_target, docs_score, 'Documentation Usage'),
        }
        components = []
        weighted = 0.0
        weight_sum = 0.0
        for key, _label, weight in AI_HEALTH_WEIGHTS:
            actual, target, score, label = raw_components[key]
            na = score is None
            if not na:
                weighted += weight * score
                weight_sum += weight
            components.append({
                'key': key,
                'label': label,
                'actual': _ai_round(actual, 2),
                'target': _ai_round(target, 2),
                'score': _ai_round(score, 1),
                'weight': weight,
                'na': na,
            })
        has_evidence = bool(len(cur_active)) or hours_total > 0
        health_score = (weighted / weight_sum) if (weight_sum > 0 and has_evidence) else None

        quantified_hours = float(rows.loc[rows['_source'].isin(['export', 'manual']), '_hours'].sum())
        confidence_pct = _ai_ratio(quantified_hours, hours_total, 100.0)

        series = []
        for release in sorted(releases_in_scope, key=lambda r: sequence.get(r, 0)):
            sel = release_slice(release)
            r_head, _ = head(release)
            r_active = active_users(release)
            series.append({
                'release': release,
                'sequence': sequence.get(release, 0),
                'adoption_pct': _ai_round(_ai_ratio(len(r_active), r_head, 100.0)),
                'hours_saved': round(float(sel['_hours'].sum()), 1),
                'tokens': round(float(sel['_tokens'].sum()), 0),
                'active_users': len(r_active),
                'headcount': int(r_head) if r_head is not None else None,
                'has_evidence': bool(sel['_evidence'].any()),
                'is_current': release == current,
            })

        est_savings = hours_total * rate_usd
        roi = _ai_ratio(est_savings - spend, spend)
        unquantified = int(((rows['_hours'] <= 0) & (rows['_tokens'] <= 0)).sum())
        managers = [m for m in rows['_manager'].tolist() if m] if len(rows) and '_manager' in rows.columns else []
        manager_name = managers[0] if managers else None
        heavy_tokens = False
        if len(cur_active):
            per_tok = cur_rows.groupby('_person').agg(tokens=('_tokens', 'sum'), hours=('_hours', 'sum'))
            per_tok = per_tok[per_tok.index.isin(cur_active)]
            if len(cur_active) >= 10:
                heavy_tokens = bool(len(per_tok[(per_tok['tokens'] > float(np.percentile(per_tok['tokens'], 75))) & (per_tok['hours'] < float(np.percentile(per_tok['hours'], 25)))]))
            else:
                heavy_tokens = bool(len(per_tok[(per_tok['tokens'] >= 100000) & (per_tok['hours'] < 6)]))
        badges = []
        if qa_head is None or (qa_adoption is not None and qa_adoption < t_qa):
            badges.append('High QA Risk')
        if cur_adoption is not None and cur_adoption < t_attention:
            badges.append('Low Adoption')
        if heavy_tokens or (tokens_total >= 100000 and value_usd < (potential_value or 0) * 0.25):
            badges.append('Token Waste')
        if health_score is not None and health_score > 80:
            badges.append('High Performer')
        if health_score is not None and health_score < 70:
            badges.append('Attention')

        health_rows.append({
            'project': project,
            'health_score': _ai_round(health_score),
            'band': _ai_health_band(health_score),
            'band_label': _ai_health_label(health_score),
            'components': components,
            'hours_saved': round(hours_total, 1),
            'release_hours_saved': round(cur_hours, 1),
            'tokens': round(tokens_total, 0),
            'spend_usd': round(spend, 2),
            'est_cost_savings_usd': round(est_savings, 2),
            'ai_value_usd': round(est_savings - spend, 2),
            'value_usd': round(value_usd, 2),
            'potential_hours': _ai_round(potential_hours),
            'potential_value_usd': _ai_round(potential_value, 2),
            'unrealized_value_usd': _ai_round(unrealized_value, 2),
            'token_efficiency_usd_per_1k': _ai_round(token_efficiency, 2),
            'docs_hours': round(docs_hours, 1),
            'roi_index': _ai_round(roi),
            'active_users': len(cur_active),
            'headcount_scope': int(cur_headcount) if cur_headcount is not None else None,
            'denominator_inferred': bool(inferred),
            'people_tagged': len(people_tagged),
            'adoption_pct': _ai_round(cur_adoption),
            'dev_adoption_pct': _ai_round(dev_adoption),
            'qa_adoption_pct': _ai_round(qa_adoption),
            'qa_headcount': int(qa_head) if qa_head is not None else None,
            'trend_pts': _ai_round(trend_pts),
            'current_release': current,
            'previous_release': previous,
            'releases_in_scope': len(releases_in_scope),
            'releases_covered': len(covered),
            'coverage_pct': _ai_round(coverage_pct),
            'evidence_confidence_pct': _ai_round(confidence_pct),
            'confidence_band': _ai_confidence_band(confidence_pct),
            'release_series': series,
            'rows': int(len(rows)),
            'unquantified_rows': unquantified,
            'manager': manager_name,
            'badges': badges,
        })

        for domain in sorted({'Development', 'QA'} | {d for d in rows['_domain'].tolist() if d}):
            d_rows = rows[rows['_domain'].str.casefold() == domain.casefold()]
            d_head, _ = head(current, domain)
            d_active = active_users(current, domain)
            domain_rows.append({
                'project': project,
                'domain': domain,
                'headcount': int(d_head) if d_head is not None else None,
                'active_users': len(d_active),
                'adoption_pct': _ai_round(_ai_ratio(len(d_active), d_head, 100.0)),
                'hours_saved': round(float(d_rows['_hours'].sum()), 1),
                'tokens': round(float(d_rows['_tokens'].sum()), 0),
                'rows': int(len(d_rows)),
            })

        # --- Leadership Attention rules (Section 4.6) -----------------------------
        drill = {'project': project, 'release': current, 'domain': None}
        if cur_adoption is not None and cur_headcount and cur_adoption < t_attention:
            attention.append({
                'id': f'ATT-1:{project}', 'rule': 'ATT-1', 'severity': 'red', 'project': project,
                'title': f'{project}: Adoption {cur_adoption:.1f}% is below {t_attention:.0f}%',
                'detail': f'{len(cur_active)}/{int(cur_headcount)} people active in {current}',
                'metric': 'adoption_pct', 'value': _ai_round(cur_adoption), 'threshold': _ai_round(t_attention), 'drill': drill,
            })
        if len(cur_active):
            per_person = cur_rows.groupby('_person').agg(tokens=('_tokens', 'sum'), hours=('_hours', 'sum'), name=('_name', 'first'))
            per_person = per_person[per_person.index.isin(cur_active)]
            if len(cur_active) >= 10:
                p75 = float(np.percentile(per_person['tokens'], 75))
                p25 = float(np.percentile(per_person['hours'], 25))
                heavy = per_person[(per_person['tokens'] > p75) & (per_person['hours'] < p25)]
            else:
                heavy = per_person[(per_person['tokens'] >= 100000) & (per_person['hours'] < 6)]
            if len(heavy):
                top = heavy.sort_values('tokens', ascending=False).iloc[0]
                attention.append({
                    'id': f'ATT-2:{project}', 'rule': 'ATT-2', 'severity': 'amber', 'project': project,
                    'title': f'{project}: {len(heavy)} heavy token user{"s" if len(heavy) != 1 else ""} with low savings',
                    'detail': f'e.g. {top["name"]} ({int(top["tokens"]):,} tokens, {top["hours"]:.1f} h)',
                    'metric': 'tokens', 'value': float(top['tokens']), 'threshold': 100000.0, 'drill': drill,
                })
        if qa_head is None:
            attention.append({
                'id': f'ATT-3:{project}', 'rule': 'ATT-3', 'severity': 'amber', 'project': project,
                'title': f'{project}: QA domain has no AI evidence row',
                'detail': f'No QA row on AI release outcomes for {current}',
                'metric': 'qa_adoption_pct', 'value': None, 'threshold': None, 'drill': {**drill, 'domain': 'QA'},
            })
        elif qa_adoption is not None and qa_adoption <= 0:
            attention.append({
                'id': f'ATT-3:{project}', 'rule': 'ATT-3', 'severity': 'red', 'project': project,
                'title': f'{project}: QA has zero AI adoption this release',
                'detail': f'0/{int(qa_head)} QA people active in {current}',
                'metric': 'qa_adoption_pct', 'value': 0.0, 'threshold': _ai_round(t_qa), 'drill': {**drill, 'domain': 'QA'},
            })
        if trend_pts is not None and trend_pts < -t_decline:
            attention.append({
                'id': f'ATT-4:{project}', 'rule': 'ATT-4', 'severity': 'red', 'project': project,
                'title': f'{project}: Adoption fell {abs(trend_pts):.0f} pts vs {previous}',
                'detail': f'{prev_adoption:.1f}% in {previous} -> {cur_adoption:.1f}% in {current}',
                'metric': 'trend_pts', 'value': _ai_round(trend_pts), 'threshold': _ai_round(-t_decline), 'drill': drill,
            })
        if unquantified >= 3:
            who = rows[(rows['_hours'] <= 0) & (rows['_tokens'] <= 0)].groupby('_name').size().sort_values(ascending=False)
            attention.append({
                'id': f'ATT-5:{project}', 'rule': 'ATT-5', 'severity': 'amber', 'project': project,
                'title': f'{project}: {unquantified} activity rows carry no hours or tokens',
                'detail': f'{who.index[0]} ({int(who.iloc[0])} rows)' if len(who) else 'Add Hours saved or tokens to the rows',
                'metric': 'unquantified_rows', 'value': float(unquantified), 'threshold': 3.0, 'drill': {**drill, 'release': None},
            })
        if len(bill):
            billed = bill[(bill['_alloc'] == project) & (bill['_cost'] > 0)]
            active_persons = set(act['_person']) | {f'name:{n.casefold()}' for n in act['_name']}
            idle = billed[~billed['_person'].isin(active_persons) & ~billed['_name'].str.casefold().map(lambda n: f'name:{n}').isin(active_persons)]
            if len(idle):
                attention.append({
                    'id': f'ATT-6:{project}', 'rule': 'ATT-6', 'severity': 'amber', 'project': project,
                    'title': f'{project}: {len(idle)} billed Cursor seat{"s" if len(idle) != 1 else ""} have no activity rows',
                    'detail': f'e.g. {idle.iloc[0]["_name"]} (${float(idle.iloc[0]["_cost"]):,.2f})',
                    'metric': 'unused_licences', 'value': float(len(idle)), 'threshold': 0.0, 'drill': {**drill, 'release': None},
                })
        if qa_head is not None and qa_adoption is not None and 0 < qa_adoption < t_qa:
            attention.append({
                'id': f'ATT-7:{project}', 'rule': 'ATT-7', 'severity': 'amber', 'project': project,
                'title': f'{project}: QA adoption {qa_adoption:.1f}% is below target {t_qa:.0f}%',
                'detail': f'{len(active_users(current, "QA"))}/{int(qa_head)} QA people active in {current}',
                'metric': 'qa_adoption_pct', 'value': _ai_round(qa_adoption), 'threshold': _ai_round(t_qa), 'drill': {**drill, 'domain': 'QA'},
            })
        if docs_hours <= 0:
            attention.append({
                'id': f'ATT-8:{project}', 'rule': 'ATT-8', 'severity': 'info', 'project': project,
                'title': f'{project}: Zero AI documentation this release',
                'detail': f'No Docs use-case hours in {current}',
                'metric': 'docs_hours', 'value': 0.0, 'threshold': 0.1, 'drill': drill,
            })
        uncovered = sorted([r for r in releases_in_scope if r not in covered], key=lambda r: sequence.get(r, 0))
        if uncovered:
            attention.append({
                'id': f'ATT-9:{project}', 'rule': 'ATT-9', 'severity': 'info', 'project': project,
                'title': f'{project}: {len(uncovered)} release{"s" if len(uncovered) != 1 else ""} with no AI coverage',
                'detail': ', '.join(uncovered[:4]),
                'metric': 'releases_covered', 'value': float(len(covered)), 'threshold': float(len(releases_in_scope)), 'drill': drill,
            })

    # Tiles: worst first. Attention: red, amber, then info, then by health ascending.
    health_rows.sort(key=lambda row: (row['health_score'] if row['health_score'] is not None else 999, row['project']))
    health_by_project = {row['project']: row for row in health_rows}
    attention.sort(key=lambda card: (
        {'red': 0, 'amber': 1, 'info': 2}.get(card['severity'], 3),
        health_by_project.get(card['project'], {}).get('health_score') if health_by_project.get(card['project'], {}).get('health_score') is not None else 999,
        card['rule'],
    ))

    ranking = sorted(health_rows, key=lambda row: (-row['ai_value_usd'], row['project']))
    ranking = [{
        'rank': index + 1,
        'project': row['project'],
        'ai_value_usd': row['ai_value_usd'],
        'est_cost_savings_usd': row['est_cost_savings_usd'],
        'hours_saved': row['hours_saved'],
        'spend_usd': row['spend_usd'],
        'health_score': row['health_score'],
        'band': row['band'],
    } for index, row in enumerate(ranking)]

    # --- portfolio summary ------------------------------------------------------
    if len(outc):
        latest_by_team = {}
        for _, row in outc.iterrows():
            headcount = _ai_num(row['_headcount'])
            if headcount is None or headcount <= 0 or not row['_team']:
                continue
            key = (row['_team'], row.get('_project') or '', row.get('_domain') or '')
            seq = sequence.get(row['_release'], 0)
            if key not in latest_by_team or seq > latest_by_team[key][0] or (seq == latest_by_team[key][0] and headcount > latest_by_team[key][1]):
                latest_by_team[key] = (seq, headcount)
        headcount_in_scope = int(sum(value[1] for value in latest_by_team.values())) if latest_by_team else None
    else:
        headcount_in_scope = None
    if not headcount_in_scope:
        headcount_in_scope = len(set(act['_person'])) if len(act) else None
    active_count = len(portfolio_active)
    adoption_evidence = _ai_ratio(active_count, headcount_in_scope, 100.0)
    hours_target = (t_hours_user * headcount_in_scope) if (t_hours_user is not None and headcount_in_scope) else None
    est_savings_total = float(total_hours or 0.0) * rate_usd
    savings_target = (hours_target * rate_usd) if hours_target is not None else None
    potential_hours = hours_target
    potential_value = savings_target
    business_value = est_savings_total
    unrealized_value = max(0.0, (potential_value or 0.0) - business_value) if potential_value is not None else None
    unrealized_hours = max(0.0, (potential_hours or 0.0) - float(total_hours or 0.0)) if potential_hours is not None else None
    roi_total = _ai_ratio(est_savings_total - float(total_spend or 0.0), total_spend)
    quantified_total = float(act.loc[act['_source'].isin(['export', 'manual']), '_hours'].sum()) if len(act) else 0.0
    evidence_total_hours = float(act['_hours'].sum()) if len(act) else 0.0
    confidence_total = _ai_ratio(quantified_total, evidence_total_hours, 100.0)
    export_pct = _ai_ratio(len(portfolio_export_users), active_count, 100.0)
    weights = [(row['health_score'], row['people_tagged']) for row in health_rows if row['health_score'] is not None and row['people_tagged'] > 0]
    portfolio_health = (sum(score * weight for score, weight in weights) / sum(weight for _, weight in weights)) if weights else None
    releases_all = set(sequence.keys())
    releases_covered_all = {r for r in releases_all if len(act) and bool(act.loc[act['_release'] == r, '_evidence'].any())}
    current_release = max(releases_all, key=lambda r: sequence.get(r, 0)) if releases_all else None
    red_projects = {card['project'] for card in attention if card.get('severity') == 'red'}
    weak_projects = {row['project'] for row in health_rows if row.get('health_score') is not None and row['health_score'] < 70}
    projects_requiring_attention = len(red_projects | weak_projects)

    prev_release = None
    if current_release:
        earlier = [r for r in releases_all if sequence.get(r, 0) < sequence.get(current_release, 0)]
        prev_release = max(earlier, key=lambda r: sequence.get(r, 0)) if earlier else None
    def _release_hours(label):
        if not label or not len(act):
            return 0.0
        return float(act.loc[act['_release'] == label, '_hours'].sum())
    def _release_adoption(label):
        if not label:
            return None
        pts = [pt.get('adoption_pct') for row in health_rows for pt in (row.get('release_series') or []) if pt.get('release') == label and pt.get('adoption_pct') is not None]
        return sum(pts) / len(pts) if pts else None
    prev_hours = _release_hours(prev_release) if prev_release else None
    cur_hours_port = _release_hours(current_release) if current_release else float(total_hours or 0.0)
    prev_adopt = _release_adoption(prev_release)
    cur_adopt = adoption_evidence
    trend = {
        'adoption_pts': _ai_round((cur_adopt - prev_adopt) if (cur_adopt is not None and prev_adopt is not None) else None),
        'hours_delta': _ai_round((cur_hours_port - prev_hours) if prev_hours is not None else None),
        'value_delta': _ai_round(((cur_hours_port - prev_hours) * rate_usd) if prev_hours is not None else None, 2),
    }

    if (total_tokens or 0) <= 0:
        tokens_band = 'neutral'
    elif export_pct is not None and export_pct >= 80:
        tokens_band = 'green'
    else:
        tokens_band = 'amber'
    if projects_requiring_attention <= 0:
        attention_band = 'green'
    elif projects_requiring_attention <= 2:
        attention_band = 'amber'
    else:
        attention_band = 'red'
    # Opportunity loss is lower-is-better vs 0 target
    if unrealized_value is None:
        opportunity_band = 'neutral'
    elif unrealized_value <= 0:
        opportunity_band = 'green'
    elif potential_value and unrealized_value <= potential_value * 0.10:
        opportunity_band = 'amber'
    else:
        opportunity_band = 'red'
    missed_pct = _ai_ratio(unrealized_value, potential_value, 100.0) if (unrealized_value is not None and potential_value) else None
    forecast = {
        'adoption_pct': _ai_round((adoption_evidence + (trend.get('adoption_pts') or 0)) if (adoption_evidence is not None and trend.get('adoption_pts') is not None) else None),
        'hours_saved': _ai_round((float(total_hours or 0) + (trend.get('hours_delta') or 0)) if trend.get('hours_delta') is not None else None),
        'business_value_usd': _ai_round((business_value + (trend.get('value_delta') or 0)) if trend.get('value_delta') is not None else None, 2),
        'opportunity_loss_usd': _ai_round(unrealized_value, 2),
    }
    kpi_bands = {
        'projects': 'neutral',
        'releases': 'neutral',
        'adoption': _ai_band(adoption_evidence, t_adopt, tolerance_of('Adoption_Pct'), lower_of('Adoption_Pct')),
        'users': _ai_band(adoption_evidence, t_adopt, tolerance_of('Adoption_Pct'), lower_of('Adoption_Pct')),
        'hours': _ai_band(total_hours, hours_target, tolerance_of('Hours_per_User'), lower_of('Hours_per_User')),
        'savings': _ai_band(total_hours, hours_target, tolerance_of('Hours_per_User'), lower_of('Hours_per_User')),
        'business_value': _ai_band(business_value, potential_value, tolerance_of('Hours_per_User'), False),
        'opportunity_loss': opportunity_band,
        'attention': attention_band,
        'tokens': tokens_band,
        'roi': _ai_band(roi_total, t_roi, tolerance_of('ROI_Index'), lower_of('ROI_Index')),
    }


    # Decision Intelligence enrichments (additive, backward compatible)
    ATTN_ACTION = {
        'ATT-1': 'Drive Adoption',
        'ATT-2': 'Convert tokens to savings',
        'ATT-3': 'Improve QA',
        'ATT-4': 'Arrest adoption decline',
        'ATT-5': 'Quantify activity hours',
        'ATT-6': 'Reclaim unused seats',
        'ATT-7': 'Improve QA',
        'ATT-8': 'Start AI documentation',
        'ATT-9': 'Cover uncovered releases',
    }
    ATTN_IMPACT = {
        'ATT-1': 'Release Risk',
        'ATT-2': 'Efficiency Leak',
        'ATT-3': 'Release Risk',
        'ATT-4': 'Release Risk',
        'ATT-5': 'Evidence Gap',
        'ATT-6': 'Spend Waste',
        'ATT-7': 'Release Risk',
        'ATT-8': 'Knowledge Gap',
        'ATT-9': 'Coverage Gap',
    }
    attn_by_project = {}
    for card in attention:
        attn_by_project.setdefault(card.get('project') or 'Portfolio', []).append(card)
    for row in health_rows:
        cards = attn_by_project.get(row['project'], [])
        risk_count = len(cards)
        row['risk_count'] = risk_count
        row['recommendation'] = _ai_health_recommendation(row, risk_count)
        unrealized = row.get('unrealized_value_usd') or 0.0
        owner = row.get('manager') or 'SDM'
        for card in cards:
            sev_w = 1.0 if card.get('severity') == 'red' else 0.55 if card.get('severity') == 'amber' else 0.25
            share = (sev_w / max(1.0, sum(1.0 if c.get('severity') == 'red' else 0.55 if c.get('severity') == 'amber' else 0.25 for c in cards))) if cards else 0.0
            lost = _ai_round(unrealized * share, 2) if unrealized else None
            card['est_value_lost_usd'] = lost
            card['priority'] = 'P1' if card.get('severity') == 'red' else 'P2' if card.get('severity') == 'amber' else 'P3'
            card['owner'] = owner
            card['recommended_action'] = ATTN_ACTION.get(card.get('rule'), row.get('recommendation') or 'Review')
            impact_label = ATTN_IMPACT.get(card.get('rule'), 'Business Impact')
            if lost:
                card['business_impact'] = f"{impact_label} · ${lost:,.0f}"
            else:
                card['business_impact'] = impact_label if card.get('severity') != 'info' else f"{impact_label} · Info"
    # Summary executive KPI framing (Value At Risk preferred when $ impact is material)
    critical_projects = projects_requiring_attention
    critical_risks = sum(1 for c in attention if c.get('severity') == 'red')
    value_at_risk = unrealized_value

    values = [row.get('value_usd') or 0.0 for row in health_rows]
    value_split = float(np.median(values)) if values else 0.0
    if len(values) < 2 and potential_value:
        value_split = potential_value * 0.5
    adopt_split = t_adopt or 80.0
    quadrant = []
    for row in health_rows:
        adopt = row.get('adoption_pct')
        val = row.get('value_usd') or 0.0
        high_a = adopt is not None and adopt >= adopt_split
        high_v = val >= value_split
        if high_a and high_v:
            qname = 'Strategic Leaders'
        elif high_a and not high_v:
            qname = 'Execution Risk'
        elif (not high_a) and high_v:
            qname = 'Growth Candidates'
        else:
            qname = 'Turnaround Required'
        row['quadrant'] = qname
        quadrant.append({
            'project': row['project'],
            'adoption_pct': row.get('adoption_pct'),
            'value_usd': row.get('value_usd'),
            'quadrant': qname,
            'health_score': row.get('health_score'),
            'band': row.get('band'),
            'trend_pts': row.get('trend_pts'),
        })

    billed_n = len(set(bill['_person'])) if len(bill) else 0
    eligible_n = billed_n or (headcount_in_scope or 0)
    if headcount_in_scope and eligible_n > headcount_in_scope:
        eligible_n = headcount_in_scope
    def _stage(hours, value):
        return {'hours': _ai_round(hours), 'value': _ai_round(value, 2)}
    funnel = [
        {'stage': 'Total capacity', **_stage(potential_hours, potential_value)},
        {'stage': 'AI eligible', **_stage((eligible_n * t_hours_user) if t_hours_user else None, (eligible_n * t_hours_user * rate_usd) if t_hours_user else None)},
        {'stage': 'AI assisted', **_stage((active_count * t_hours_user) if t_hours_user else None, (active_count * t_hours_user * rate_usd) if t_hours_user else None)},
        {'stage': 'Actual savings', **_stage(total_hours, business_value)},
    ]

    trend_map = {}
    for row in health_rows:
        for pt in (row.get('release_series') or []):
            key = pt.get('release')
            if not key:
                continue
            bucket = trend_map.setdefault(key, {'release': key, 'sequence': pt.get('sequence') or 0, 'hours': 0.0, 'adopts': [], 'value': 0.0})
            bucket['hours'] += float(pt.get('hours_saved') or 0.0)
            if pt.get('adoption_pct') is not None:
                bucket['adopts'].append(pt['adoption_pct'])
            bucket['value'] += float(pt.get('hours_saved') or 0.0) * rate_usd
    maturity_trend = [{
        'release': item['release'],
        'sequence': item['sequence'],
        'adoption_pct': _ai_round(sum(item['adopts']) / len(item['adopts']) if item['adopts'] else None),
        'hours_saved': round(item['hours'], 1),
        'value_usd': round(item['value'], 2),
    } for item in sorted(trend_map.values(), key=lambda row: row['sequence'])]

    summary_ext = {
        'projects_count': len(health_rows),
        'releases_count': len(releases_all),
        'releases_covered_count': len(releases_covered_all),
        'current_release': current_release,
        'active_users': active_count,
        'headcount_in_scope': headcount_in_scope,
        'adoption_evidence_pct': _ai_round(adoption_evidence),
        'hours_target': _ai_round(hours_target),
        'est_cost_savings_usd': round(est_savings_total, 2),
        'savings_target_usd': _ai_round(savings_target, 2),
        'business_value_usd': round(business_value, 2),
        'potential_hours': _ai_round(potential_hours),
        'potential_value_usd': _ai_round(potential_value, 2),
        'unrealized_value_usd': _ai_round(unrealized_value, 2),
        'unrealized_hours': _ai_round(unrealized_hours),
        'projects_requiring_attention': projects_requiring_attention,
        'critical_projects': critical_projects,
        'critical_risks': critical_risks,
        'value_at_risk_usd': _ai_round(value_at_risk, 2),
        # Live choice: Value At Risk ($missed) over Critical Projects/Risks when unrealized is material.
        'attention_kpi': {
            'mode': 'value_at_risk' if (value_at_risk or 0) > 0 else ('critical_risks' if critical_risks else 'critical_projects'),
            'label': 'Value at risk' if (value_at_risk or 0) > 0 else ('Critical risks' if critical_risks else 'Critical projects'),
            'value': _ai_round(value_at_risk, 2) if (value_at_risk or 0) > 0 else (critical_risks if critical_risks else critical_projects),
        },
        'roi_index': _ai_round(roi_total),
        'loaded_rate_usd': rate_usd,
        'loaded_rate_inr': rate_inr,
        'targets': flat_targets,
        'evidence_confidence_pct': _ai_round(confidence_total),
        'confidence_band': _ai_confidence_band(confidence_total),
        'kpi_bands': kpi_bands,
        'tokens_export_coverage': {
            'export_users': len(portfolio_export_users),
            'active_users': active_count,
            'pct': _ai_round(export_pct),
        },
        'health_score': _ai_round(portfolio_health),
        'health_band': _ai_health_band(portfolio_health),
        'health_label': _ai_health_label(portfolio_health),
        'attention_count': len(attention),
        'trend': trend,
        'token_efficiency_usd_per_1k': _ai_round(_ai_ratio(business_value, (total_tokens or 0) / 1000.0) if (total_tokens or 0) > 0 else None, 2),
        'missed_pct': _ai_round(missed_pct),
        'recovery_potential_usd': _ai_round(unrealized_value, 2),
        'recovery_opportunity_pct': _ai_round(missed_pct),
        'forecast': forecast,
    }
    # Build portfolio narrative after quadrant exists
    summary_ext['portfolio_narrative'] = _ai_portfolio_narrative(summary_ext, health_rows, attention, quadrant)
    return {
        'summary_ext': summary_ext,
        'health': health_rows,
        'attention': attention,
        'ranking': ranking,
        'by_project_domain': domain_rows,
        'quadrant': quadrant,
        'funnel': funnel,
        'maturity_trend': maturity_trend,
    }


AI_USE_CASE_CANONICAL = [
    ('Code generation', 'Code generation'),
    ('Code review', 'Code review'),
    ('SQL development', 'SQL development'),
    ('Unit testing', 'Unit testing'),
    ('Docs', 'Documentation'),
    ('Test design', 'Test case generation'),
    ('Test automation', 'Automation scripts'),
    ('Defect analysis', 'Defect analysis'),
    ('Knowledge search', 'Knowledge Search'),
    ('Refactoring', 'Refactoring'),
    ('Security review', 'Security review'),
    ('Other', 'Other'),
]
AI_USE_CASE_ALIASES = {
    'code generation': 'Code generation',
    'code genration and test matrix': 'Code generation',
    'code generation and xml report development': 'Code generation',
    'code review': 'Code review',
    'sql development': 'SQL development',
    'cusor ai integration with oracle': 'SQL development',
    'cursor ai integration with oracle': 'SQL development',
    'unit testing': 'Unit testing',
    'docs': 'Docs',
    'documentation': 'Docs',
    'test design': 'Test design',
    'test case generation': 'Test design',
    'test design and security review': 'Test design',
    'test automation': 'Test automation',
    'automation scripts': 'Test automation',
    'defect analysis': 'Defect analysis',
    'knowledge search': 'Knowledge search',
    'knowledge management': 'Knowledge search',
    'self learning with cursor ai': 'Knowledge search',
    'refactoring': 'Refactoring',
    'security review': 'Security review',
}


def _ai_canonical_use_case(value):
    text = str(value or '').strip()
    if not text:
        return 'Other'
    key = ' '.join(text.casefold().split())
    if key in AI_USE_CASE_ALIASES:
        return AI_USE_CASE_ALIASES[key]
    for canonical, _label in AI_USE_CASE_CANONICAL:
        if canonical.casefold() == key:
            return canonical
    return 'Other'


def _ai_use_case_label(canonical):
    for key, label in AI_USE_CASE_CANONICAL:
        if key == canonical:
            return label
    return canonical or 'Other'


def _ai_impact_band(ratio):
    if ratio is None:
        return 'n/a'
    if ratio >= 1.25:
        return 'High'
    if ratio >= 0.75:
        return 'Medium'
    return 'Low'


def _ai_manager_grade(score):
    score = _ai_num(score)
    if score is None:
        return 'n/a'
    if score >= 90:
        return 'A+'
    if score >= 80:
        return 'A'
    if score >= 70:
        return 'B'
    if score >= 60:
        return 'C'
    return 'D'


def _ai_health_recommendation(row, risk_count=0):
    """One executive recommendation badge per project (Page 1 health)."""
    score = row.get('health_score')
    adopt = row.get('adoption_pct')
    potential = row.get('potential_value_usd') or 0.0
    value = row.get('value_usd') or 0.0
    trend = row.get('trend_pts')
    badges = row.get('badges') or []
    qa_risk = any('QA' in str(b) for b in badges) or (
        row.get('qa_adoption_pct') is not None and row.get('qa_adoption_pct') is not None and row.get('qa_adoption_pct') < 50
    )
    if score is not None and score < 70:
        return 'Executive Review'
    if risk_count and risk_count >= 3 and (score is None or score < 80):
        return 'Executive Review'
    if qa_risk and (score is None or 70 <= score < 80) and (adopt is None or adopt >= 60):
        return 'Improve QA'
    high_a = adopt is not None and adopt >= 80
    high_v = potential > 0 and value >= potential * 0.5
    if high_a and not high_v:
        return 'Monitor'
    if (not high_a) and high_v:
        return 'Drive Adoption'
    if score is not None and score >= 80 and (trend is None or trend >= 0):
        return 'Scale Best Practices'
    if score is not None and score >= 80:
        return 'Scale Best Practices'
    if adopt is not None and adopt < 60:
        return 'Drive Adoption'
    if qa_risk:
        return 'Improve QA'
    return 'Monitor'


def _ai_release_certification(score):
    if score is None:
        return 'Uncertified'
    if score >= 90:
        return 'Elite'
    if score >= 80:
        return 'Strong'
    if score >= 70:
        return 'Certified'
    if score >= 60:
        return 'At Risk'
    return 'Critical'


def _ai_portfolio_narrative(summary, health_rows, attention, quadrant):
    """≤5 executive bullets: Situation · Opportunity · Risk · Priority · Executive Action."""
    bullets = []
    adopt = summary.get('adoption_evidence_pct')
    t_adopt = (summary.get('targets') or {}).get('Adoption_Pct') or 80
    if adopt is not None:
        gap = adopt - t_adopt
        tone = 'on target' if gap >= 0 else f'{abs(gap):.1f} pts below target'
        bullets.append(f"Situation: Portfolio adoption is {adopt:.1f}% ({tone}).")
    else:
        bullets.append('Situation: Portfolio AI adoption is not yet quantified for this release.')

    missed = summary.get('unrealized_value_usd')
    potential = summary.get('potential_value_usd')
    actual = summary.get('business_value_usd') or summary.get('est_cost_savings_usd')
    recovery = summary.get('recovery_potential_usd')
    if missed is not None and potential:
        pct = (missed / potential) * 100.0 if potential else 0.0
        rec = recovery if recovery is not None else missed
        bullets.append(
            f"Opportunity: Recover ${rec:,.0f} ({pct:.0f}% of ${potential:,.0f} potential); realized ${actual:,.0f}."
            if actual is not None else
            f"Opportunity: ${missed:,.0f} unrealized ({pct:.0f}% of ${potential:,.0f}); recovery ${rec:,.0f}."
        )
    elif actual is not None:
        bullets.append(f"Opportunity: Business value generated ${actual:,.0f} this period.")
    else:
        bullets.append('Opportunity: Quantify hours saved to surface recovery value.')

    red_n = sum(1 for c in attention if c.get('severity') == 'red')
    attn_n = len(attention or [])
    need = summary.get('projects_requiring_attention') or 0
    var = summary.get('unrealized_value_usd')
    if attn_n or need:
        risk_bit = f"{need} critical project(s) · {attn_n} issue(s) ({red_n} P1)"
        if var:
            risk_bit += f" · ${var:,.0f} value at risk"
        bullets.append(f"Risk: {risk_bit}.")
    else:
        bullets.append('Risk: No leadership exceptions this release.')

    worst = None
    for row in sorted(health_rows or [], key=lambda r: r.get('health_score') if r.get('health_score') is not None else 999):
        worst = row
        break
    if worst:
        rec = worst.get('recommendation') or 'Executive Review'
        owner = worst.get('manager') or 'SDM'
        bullets.append(
            f"Priority: {worst.get('project')} ({worst.get('band_label') or worst.get('band') or 'n/a'}) — {rec}; owner {owner}."
        )
    else:
        bullets.append('Priority: No project health score available yet.')

    leaders = [q for q in (quadrant or []) if q.get('quadrant') == 'Strategic Leaders']
    turnaround = [q for q in (quadrant or []) if q.get('quadrant') in ('Turnaround Required', 'Executive Attention')]
    growth = [q for q in (quadrant or []) if q.get('quadrant') in ('Growth Candidates', 'Scaling Candidates')]
    if turnaround:
        bullets.append(
            f"Executive Action: Schedule review for {', '.join(q['project'] for q in turnaround[:3])}; "
            f"recover value on lowest-health projects this release."
        )
    elif leaders:
        bullets.append(
            f"Executive Action: Scale Best Practices from {', '.join(q['project'] for q in leaders[:3])}"
            + (f"; coach Growth Candidates ({', '.join(q['project'] for q in growth[:2])})." if growth else '.')
        )
    elif growth:
        bullets.append(
            f"Executive Action: Drive Adoption on {', '.join(q['project'] for q in growth[:3])} to unlock unrealized value."
        )
    else:
        bullets.append('Executive Action: Hold portfolio AI standup on unrealized value and QA evidence gaps.')
    return bullets[:5]


def _ai_manager_league(scorecards, health_rows):
    """Rank managers by effectiveness score (fallback: mean project health)."""
    buckets = {}
    for card in scorecards or []:
        name = str(card.get('manager') or '').strip()
        if not name:
            continue
        bucket = buckets.setdefault(name, {'scores': [], 'value': 0.0, 'projects': set(), 'hours': 0.0})
        if card.get('score') is not None:
            bucket['scores'].append(float(card['score']))
        bucket['hours'] += float(card.get('hours_saved') or 0.0)
        if card.get('project'):
            bucket['projects'].add(card['project'])
    if not buckets:
        for row in health_rows or []:
            name = str(row.get('manager') or '').strip()
            if not name:
                continue
            bucket = buckets.setdefault(name, {'scores': [], 'value': 0.0, 'projects': set(), 'hours': 0.0})
            if row.get('health_score') is not None:
                bucket['scores'].append(float(row['health_score']))
            bucket['value'] += float(row.get('value_usd') or row.get('est_cost_savings_usd') or 0.0)
            bucket['hours'] += float(row.get('hours_saved') or 0.0)
            bucket['projects'].add(row.get('project'))
    else:
        by_project = {row.get('project'): row for row in (health_rows or [])}
        for bucket in buckets.values():
            for project in bucket['projects']:
                row = by_project.get(project) or {}
                bucket['value'] += float(row.get('value_usd') or row.get('est_cost_savings_usd') or 0.0)
    league = []
    for name, bucket in buckets.items():
        score = (sum(bucket['scores']) / len(bucket['scores'])) if bucket['scores'] else None
        league.append({
            'manager': name,
            'score': _ai_round(score),
            'grade': _ai_manager_grade(score),
            'value_usd': round(bucket['value'], 2),
            'hours_saved': round(bucket['hours'], 1),
            'projects': sorted(p for p in bucket['projects'] if p),
        })
    league.sort(key=lambda row: (-(row['score'] if row['score'] is not None else -1), row['manager']))
    for index, row in enumerate(league):
        row['rank'] = index + 1
    return league


def _ai_maturity_level(adoption_pct, use_cases, submitted, confidence_pct, qa_rows, coverage_pct, export_share, roi_index):
    if adoption_pct is None and not use_cases:
        return 1 if qa_rows or submitted else None
    level = 1
    if (adoption_pct or 0) >= 50 and submitted:
        level = 2
    if level >= 2 and (adoption_pct or 0) >= 70 and use_cases >= 3 and (confidence_pct or 0) >= 50 and qa_rows > 0:
        level = 3
    if level >= 3 and (coverage_pct or 0) >= 100 and (export_share or 0) >= 80 and (roi_index or 0) >= 5:
        level = 4
    return level


def _ai_page23_view(usage, outcomes, billing, targets, release_order, health_rows):
    """Page 2 Project Intelligence and Page 3 Release Deep Dive (additive keys)."""
    def target_of(metric, default=None):
        entry = (targets or {}).get(metric) or {}
        return _ai_num(entry.get('target'), default)

    t_adopt = target_of('Adoption_Pct', 80.0)
    t_hours_user = target_of('Hours_per_User', 8.0)
    t_eff = target_of('Efficiency_Gain_Pct', 30.0)
    t_qual = target_of('Release_Quality_Pct', 80.0)
    t_roi = target_of('ROI_Index', 5.0)
    rate_usd = target_of('Loaded_Rate_USD', 40.0) or 40.0
    team_day_cost = target_of('Team_Day_Cost', 3200.0) or 3200.0

    def clean(series, default=''):
        return series.fillna(default).astype(str).str.strip() if series is not None else pd.Series(dtype=object)

    if usage is None or usage.empty:
        act = pd.DataFrame(columns=[
            '_project', '_release', '_domain', '_team', '_person', '_name', '_manager',
            '_hours', '_tokens', '_source', '_emp', '_use', '_requests', '_baseline',
            '_test_cases', '_automation', '_artifacts', '_lines', '_evidence',
        ])
    else:
        act = pd.DataFrame(index=usage.index)
        act['_project'] = clean(usage.get('Project')).replace('', 'Unspecified')
        act['_release'] = clean(usage.get('Release'))
        act['_domain'] = clean(usage.get('Domain'))
        act['_team'] = clean(usage.get('Team'))
        act['_name'] = clean(usage.get('Employee_Name'))
        act['_manager'] = clean(usage.get('Manager'))
        emp = pd.to_numeric(usage.get('EMPLOYEE NUMBER'), errors='coerce')
        act['_emp'] = emp
        act['_person'] = [
            f'emp:{int(number)}' if pd.notna(number) else f'name:{name.casefold()}'
            for number, name in zip(emp, act['_name'])
        ]
        act['_hours'] = pd.to_numeric(usage.get('Hours_Saved'), errors='coerce').fillna(0.0)
        act['_tokens'] = pd.to_numeric(usage.get('Total_Tokens'), errors='coerce').fillna(0.0)
        act['_source'] = clean(usage.get('Source')).str.casefold()
        act['_use'] = clean(usage.get('Use_Case')).map(_ai_canonical_use_case)
        act['_requests'] = pd.to_numeric(usage.get('Request_Count'), errors='coerce').fillna(0.0)
        act['_baseline'] = pd.to_numeric(usage.get('Baseline_Hours'), errors='coerce').fillna(0.0)
        act['_test_cases'] = pd.to_numeric(usage.get('Test_Cases_Generated'), errors='coerce').fillna(0.0)
        act['_automation'] = pd.to_numeric(usage.get('Automation_Assets'), errors='coerce').fillna(0.0)
        act['_artifacts'] = pd.to_numeric(usage.get('Artifacts_Generated'), errors='coerce').fillna(0.0)
        act['_lines'] = pd.to_numeric(usage.get('Generated_Lines'), errors='coerce').fillna(0.0)
        act = act[act['_name'] != ''] if len(act) else act
    act['_evidence'] = (act['_hours'] > 0) | (act['_tokens'] > 0) if len(act) else pd.Series(dtype=bool)

    if outcomes is None or outcomes.empty:
        outc = pd.DataFrame(columns=[
            '_release', '_domain', '_team', '_project', '_owner', '_headcount', '_using',
            '_stories', '_stories_ai', '_def_base', '_def_act', '_cycle', '_status',
            '_opportunities', '_hours',
        ])
    else:
        outc = pd.DataFrame(index=outcomes.index)
        outc['_release'] = clean(outcomes.get('Release'))
        outc['_domain'] = clean(outcomes.get('Domain'))
        outc['_team'] = clean(outcomes.get('Team'))
        outc['_project'] = clean(outcomes.get('Project'))
        outc['_owner'] = clean(outcomes.get('Owner'))
        outc['_headcount'] = pd.to_numeric(outcomes.get('Headcount'), errors='coerce')
        outc['_using'] = pd.to_numeric(outcomes.get('People_Using'), errors='coerce')
        outc['_stories'] = pd.to_numeric(outcomes.get('Stories_Delivered'), errors='coerce')
        outc['_stories_ai'] = pd.to_numeric(outcomes.get('Stories_Using_AI'), errors='coerce')
        outc['_def_base'] = pd.to_numeric(outcomes.get('Defects_Baseline'), errors='coerce')
        outc['_def_act'] = pd.to_numeric(outcomes.get('Defects_Actual'), errors='coerce')
        outc['_cycle'] = pd.to_numeric(outcomes.get('Cycle_Time_Days_Saved'), errors='coerce')
        outc['_status'] = clean(outcomes.get('Status'))
        outc['_opportunities'] = clean(outcomes.get('Opportunities'))
        outc['_hours'] = pd.to_numeric(outcomes.get('Hours_Saved'), errors='coerce')
        outc = outc[outc['_release'] != '']

    if billing is None or billing.empty:
        bill = pd.DataFrame(columns=['_project', '_name', '_cost', '_emp', '_person', '_month'])
    else:
        bill = pd.DataFrame(index=billing.index)
        bill['_project'] = clean(billing.get('Project'))
        bill['_name'] = clean(billing.get('Name'))
        bill['_month'] = clean(billing.get('Month'))
        bill['_cost'] = pd.to_numeric(billing.get('Cost_USD'), errors='coerce').fillna(0.0)
        emp_b = pd.to_numeric(billing.get('EMPLOYEE NUMBER'), errors='coerce')
        bill['_emp'] = emp_b
        bill['_person'] = [
            f'emp:{int(number)}' if pd.notna(number) else f'name:{name.casefold()}'
            for number, name in zip(emp_b, bill['_name'])
        ]

    all_releases = {r for r in act['_release'].tolist() if r} | {r for r in outc['_release'].tolist() if r}
    explicit = sorted([r for r in all_releases if r in (release_order or {})], key=lambda r: int(release_order[r]))
    implicit = sorted([r for r in all_releases if r not in (release_order or {})], key=_ai_release_natural_key)
    sequence = {label: index + 1 for index, label in enumerate(explicit + implicit)}

    team_project = {}
    if len(act):
        counts = act.groupby(['_team', '_project']).size().reset_index(name='n')
        for team, chunk in counts.groupby('_team'):
            if team:
                team_project[team] = chunk.sort_values('n', ascending=False)['_project'].iloc[0]
    if len(outc):
        blank = outc['_project'].astype(str).str.strip() == ''
        outc.loc[blank, '_project'] = outc.loc[blank, '_team'].map(team_project)

    person_project = {}
    if len(act):
        counts = act.groupby(['_person', '_project']).size().reset_index(name='n')
        for person, chunk in counts.groupby('_person'):
            person_project[person] = chunk.sort_values('n', ascending=False)['_project'].iloc[0]
    if len(bill):
        inferred = bill['_person'].map(person_project).fillna('')
        bill['_alloc'] = bill['_project'].where(bill['_project'] != '', inferred)
    else:
        bill['_alloc'] = []

    health_by_project = {row['project']: row for row in (health_rows or [])}
    projects = sorted({p for p in act['_project'].tolist() if p} | {p for p in outc['_project'].tolist() if p})

    use_case_matrix = []
    dev_vs_qa = []
    release_trend = []
    manager_scorecard = []
    risks = []
    release_summaries = []
    dev_contribution = []
    qa_contribution = []
    benefit_waterfall = []
    narratives = []
    release_flow = []
    maturity_radar = []

    label_by_canon = {key: label for key, label in AI_USE_CASE_CANONICAL}

    for project in projects:
        rows = act[act['_project'] == project] if len(act) else act
        proj_out = outc[outc['_project'] == project] if len(outc) else outc
        health = health_by_project.get(project) or {}
        current = health.get('current_release') or (
            max({r for r in rows['_release'].tolist() if r}, key=lambda r: sequence.get(r, 0))
            if len(rows) and any(rows['_release']) else None
        )
        latest_rows = rows[rows['_release'] == current] if current else rows
        active_now = set(latest_rows.loc[latest_rows['_evidence'], '_person']) if len(latest_rows) else set()
        project_hours = float(latest_rows['_hours'].sum()) if len(latest_rows) else 0.0

        hours_by_use = {}
        if len(latest_rows):
            hours_by_use = latest_rows.groupby('_use')['_hours'].sum().to_dict()
        medians = [v / max(1, int((latest_rows['_use'] == key).sum())) for key, v in hours_by_use.items() if v > 0]
        median_hours = float(np.median(medians)) if medians else None

        for canonical, label in AI_USE_CASE_CANONICAL:
            sel = latest_rows[latest_rows['_use'] == canonical] if len(latest_rows) else latest_rows
            count = int(len(sel)) if len(latest_rows) else 0
            hours = float(sel['_hours'].sum()) if count else 0.0
            users = set(sel['_person']) if count else set()
            adoption = _ai_ratio(len(users), len(active_now), 100.0) if active_now else None
            per_use = _ai_ratio(hours, count) if count else None
            impact = _ai_impact_band(_ai_ratio(per_use, median_hours) if per_use is not None else None)
            share = _ai_ratio(hours, project_hours, 100.0) if project_hours else None
            if count == 0:
                hours_band = 'neutral'
            elif share is not None and share >= 10:
                hours_band = 'green'
            elif share is not None and share >= 5:
                hours_band = 'amber'
            else:
                hours_band = 'red'
            base_hours = float(sel['_baseline'].sum()) if count else 0.0
            productivity = _ai_ratio(hours, base_hours, 100.0) if base_hours > 0 else None
            value = hours * rate_usd
            use_case_matrix.append({
                'project': project,
                'use_case_canonical': canonical,
                'use_case_label': label,
                'count': count,
                'hours_saved': round(hours, 1),
                'adoption_pct': _ai_round(adoption),
                'productivity_gain_pct': _ai_round(productivity),
                'business_impact': impact,
                'value_usd': round(value, 2),
                'roi_index': _ai_round(_ai_ratio(value, project_hours * rate_usd) if project_hours else None),
                'band': hours_band if count else 'neutral',
            })

        for domain in ('Development', 'QA'):
            d_rows = rows[rows['_domain'].str.casefold() == domain.casefold()] if len(rows) else rows
            d_latest = latest_rows[latest_rows['_domain'].str.casefold() == domain.casefold()] if len(latest_rows) else latest_rows
            d_out = proj_out[proj_out['_domain'].str.casefold() == domain.casefold()] if len(proj_out) else proj_out
            enabled = None
            if len(d_out):
                latest_out = d_out[d_out['_release'] == current] if current else d_out
                if len(latest_out):
                    enabled = float(latest_out.groupby('_team')['_headcount'].max().sum())
            artifacts = float(d_rows['_artifacts'].sum()) if len(d_rows) else 0.0
            test_cases = float(d_rows['_test_cases'].sum()) if len(d_rows) else 0.0
            automation = float(d_rows['_automation'].sum()) if len(d_rows) else 0.0
            artifact_value = artifacts + test_cases + automation
            dev_vs_qa.append({
                'project': project,
                'domain': domain,
                'users_enabled': int(enabled) if enabled is not None else None,
                'users_active': int(len(set(d_latest.loc[d_latest['_evidence'], '_person']))) if len(d_latest) else 0,
                'hours_saved': round(float(d_latest['_hours'].sum()) if len(d_latest) else 0.0, 1),
                'tokens': round(float(d_latest['_tokens'].sum()) if len(d_latest) else 0.0, 0),
                'artifacts': round(artifact_value, 0) if artifact_value else None,
            })

        # Project-scoped only: activity for this project + outcomes already filtered to `_project`.
        # Do not union team-shared outcomes from peer projects (same discipline as health.release_series).
        releases = sorted(
            {r for r in rows['_release'].tolist() if r} | {r for r in proj_out['_release'].tolist() if r},
            key=lambda r: sequence.get(r, 0),
        )
        for release in releases:
            r_rows = rows[rows['_release'] == release] if len(rows) else rows
            r_health = next((item for item in (health.get('release_series') or []) if item.get('release') == release), {})
            r_hours = float(r_rows['_hours'].sum()) if len(r_rows) else 0.0
            r_tokens = float(r_rows['_tokens'].sum()) if len(r_rows) else 0.0
            r_spend = float(bill.loc[bill['_alloc'] == project, '_cost'].sum()) if len(bill) and release == current else 0.0
            r_roi = _ai_ratio((r_hours * rate_usd) - r_spend, r_spend) if r_spend > 0 else None
            release_trend.append({
                'project': project,
                'release': release,
                'sequence': sequence.get(release, 0),
                'adoption_pct': r_health.get('adoption_pct'),
                'hours_saved': round(r_hours, 1),
                'roi_index': _ai_round(r_roi),
                'tokens': round(r_tokens, 0),
                'has_evidence': bool(len(r_rows) and r_rows['_evidence'].any()),
            })

        managers = sorted({m for m in latest_rows['_manager'].tolist() if m} | {m for m in proj_out['_owner'].tolist() if m})
        for manager in managers:
            m_rows = latest_rows[latest_rows['_manager'] == manager] if len(latest_rows) else latest_rows
            m_out = proj_out[(proj_out['_owner'] == manager) & (proj_out['_release'] == current)] if current and len(proj_out) else proj_out[proj_out['_owner'] == manager]
            if not len(m_rows) and not len(m_out):
                continue
            headcount = float(m_out.groupby('_team')['_headcount'].max().sum()) if len(m_out) else float(len(set(m_rows['_person'])))
            active = set(m_rows.loc[m_rows['_evidence'], '_person']) if len(m_rows) else set()
            hours = float(m_rows['_hours'].sum()) if len(m_rows) else 0.0
            hours_target = (t_hours_user * headcount) if (t_hours_user and headcount) else None
            adoption = _ai_ratio(len(active), headcount, 100.0)
            base = m_rows[m_rows['_baseline'] > 0] if len(m_rows) else m_rows
            efficiency = _ai_ratio(float(base['_hours'].sum()), float(base['_baseline'].sum()), 100.0) if len(base) else None
            defects_captured = bool(len(m_out) and m_out['_def_base'].notna().any())
            quantified_non_est = 0
            if len(m_rows):
                quantified_non_est = int(((m_rows['_evidence']) & (~m_rows['_source'].isin(['estimated', 'estimated-generated']))).sum())
            evidence = _ai_ratio(quantified_non_est, len(m_rows), 100.0) if len(m_rows) else None
            if defects_captured:
                reduced = float((m_out['_def_base'] - m_out['_def_act']).fillna(0).sum())
                defect_score = _ai_ratio(reduced, target_of('Defects_Reduced', 10.0), 100.0)
                quality = None
                if defect_score is not None and evidence is not None:
                    quality = min(100.0, 0.5 * min(100.0, defect_score) + 0.5 * evidence)
                elif evidence is not None:
                    quality = evidence
            else:
                quality = evidence
            a = _ai_component_score(adoption, t_adopt)
            s = _ai_component_score(hours, hours_target)
            e = _ai_component_score(efficiency, t_eff)
            q = _ai_component_score(quality, t_qual)
            parts = [(0.30, a), (0.25, s), (0.20, e), (0.25, q)]
            score = sum(weight * value for weight, value in parts if value is not None)
            lowest = min(
                [(a, 'Adoption'), (s, 'Savings'), (e, 'Efficiency'), (q, 'Evidence quality')],
                key=lambda item: item[0] if item[0] is not None else 999,
            )
            est_n = int((m_rows['_source'].isin(['estimated', 'estimated-generated'])).sum()) if len(m_rows) else 0
            blank_n = int(((m_rows['_hours'] <= 0) & (m_rows['_tokens'] <= 0)).sum()) if len(m_rows) else 0
            gap = f'{lowest[1]} is the gap'
            if lowest[1] == 'Evidence quality':
                gap = f'Evidence quality is the gap: {est_n} Estimated rows, {blank_n} rows without hours.'
            mgr_components = [
                {'key': 'adoption', 'label': 'Adoption', 'weight': 30, 'score': _ai_round(a), 'actual': _ai_round(adoption), 'target': _ai_round(t_adopt)},
                {'key': 'savings', 'label': 'Savings', 'weight': 25, 'score': _ai_round(s), 'actual': _ai_round(hours), 'target': _ai_round(hours_target)},
                {'key': 'efficiency', 'label': 'Efficiency', 'weight': 20, 'score': _ai_round(e), 'actual': _ai_round(efficiency), 'target': _ai_round(t_eff)},
                {'key': 'quality', 'label': 'Evidence', 'weight': 25, 'score': _ai_round(q), 'actual': _ai_round(quality), 'target': _ai_round(t_qual)},
            ]
            manager_scorecard.append({
                'manager': manager,
                'project': project,
                'adoption_pct': _ai_round(adoption),
                'hours_saved': round(hours, 1),
                'hours_target': _ai_round(hours_target),
                'efficiency_gain_pct': _ai_round(efficiency),
                'release_quality_pct': _ai_round(quality),
                'score': _ai_round(score),
                'grade': _ai_manager_grade(score),
                'gap_sentence': gap,
                'components': mgr_components,
            })

        # Risks
        if len(bill):
            billed = bill[(bill['_alloc'] == project) & (bill['_cost'] > 0)]
            active_persons = set(rows['_person']) if len(rows) else set()
            active_names = {f'name:{n.casefold()}' for n in rows['_name']} if len(rows) else set()
            idle = billed[~billed['_person'].isin(active_persons) & ~billed['_person'].isin(active_names)]
            for _, item in idle.iterrows():
                risks.append({
                    'type': 'unused_licence',
                    'severity': 'amber',
                    'project': project,
                    'person': item['_name'],
                    'employee_number': int(item['_emp']) if pd.notna(item['_emp']) else None,
                    'values': {'cost_usd': round(float(item['_cost']), 2), 'month': item['_month']},
                    'text': f"${float(item['_cost']):,.2f} · {item['_month'] or 'October'}",
                })
        if current and len(rows):
            prev_releases = [r for r in rows['_release'].unique() if sequence.get(r, 0) < sequence.get(current, 0)]
            current_people = set(latest_rows['_person'])
            for person, chunk in rows.groupby('_person'):
                if person in current_people:
                    continue
                past = chunk[chunk['_release'].isin(prev_releases)]
                if not len(past):
                    continue
                last_rel = max(past['_release'].tolist(), key=lambda r: sequence.get(r, 0))
                risks.append({
                    'type': 'inactive_user',
                    'severity': 'amber',
                    'project': project,
                    'person': chunk['_name'].iloc[0],
                    'employee_number': int(chunk['_emp'].dropna().iloc[0]) if chunk['_emp'].notna().any() else None,
                    'values': {'last_release': last_rel},
                    'text': f'last active {last_rel}',
                })
        if len(latest_rows) and len(active_now):
            per_person = latest_rows.groupby('_person').agg(tokens=('_tokens', 'sum'), hours=('_hours', 'sum'), name=('_name', 'first'), emp=('_emp', 'first'))
            per_person = per_person[per_person.index.isin(active_now)]
            if len(active_now) >= 10:
                p75 = float(np.percentile(per_person['tokens'], 75))
                p25 = float(np.percentile(per_person['hours'], 25))
                heavy = per_person[(per_person['tokens'] > p75) & (per_person['hours'] < p25)]
            else:
                heavy = per_person[(per_person['tokens'] >= 100000) & (per_person['hours'] < 6)]
            for person, item in heavy.iterrows():
                risks.append({
                    'type': 'heavy_token',
                    'severity': 'amber',
                    'project': project,
                    'person': item['name'],
                    'employee_number': int(item['emp']) if pd.notna(item['emp']) else None,
                    'values': {'tokens': float(item['tokens']), 'hours': float(item['hours'])},
                    'text': f"{int(item['tokens']):,} tokens · {item['hours']:.1f} h",
                })
        if len(latest_rows):
            for person, chunk in latest_rows.groupby('_person'):
                if len(chunk) >= 3 and float(chunk['_hours'].sum()) <= 0:
                    risks.append({
                        'type': 'low_productivity',
                        'severity': 'amber',
                        'project': project,
                        'person': chunk['_name'].iloc[0],
                        'employee_number': int(chunk['_emp'].dropna().iloc[0]) if chunk['_emp'].notna().any() else None,
                        'values': {'rows': int(len(chunk)), 'hours': 0.0},
                        'text': f'{int(len(chunk))} rows · 0 h quantified',
                    })
        if len(proj_out):
            seen_opp = set()
            for _, item in proj_out.iterrows():
                text = item['_opportunities']
                if not text or text in seen_opp:
                    continue
                seen_opp.add(text)
                risks.append({
                    'type': 'opportunity',
                    'severity': 'info',
                    'project': project,
                    'person': item['_owner'],
                    'employee_number': None,
                    'values': {'release': item['_release']},
                    'text': f"from {item['_release']} outcome row",
                    'detail': text,
                })

        for release in releases:
            r_rows = rows[rows['_release'] == release] if len(rows) else rows
            r_out = proj_out[proj_out['_release'] == release] if len(proj_out) else proj_out
            r_hours = float(r_rows['_hours'].sum()) if len(r_rows) else 0.0
            r_tokens = float(r_rows['_tokens'].sum()) if len(r_rows) else 0.0
            r_spend = float(bill.loc[bill['_alloc'] == project, '_cost'].sum()) if len(bill) and release == current else 0.0
            stories = float(r_out['_stories'].sum()) if len(r_out) and r_out['_stories'].notna().any() else None
            stories_ai = float(r_out['_stories_ai'].sum()) if len(r_out) and r_out['_stories_ai'].notna().any() else None
            qa_assets = float(r_rows['_test_cases'].sum() + r_rows['_automation'].sum()) if len(r_rows) else 0.0
            defects = None
            if len(r_out) and r_out['_def_base'].notna().any() and r_out['_def_act'].notna().any():
                defects = float((r_out['_def_base'] - r_out['_def_act']).fillna(0).sum())
            cycle = float(r_out['_cycle'].fillna(0).sum()) if len(r_out) and r_out['_cycle'].notna().any() else None
            est = r_hours * rate_usd
            roi = _ai_ratio(est - r_spend, r_spend)
            release_summaries.append({
                'project': project,
                'release': release,
                'stories_delivered': int(stories) if stories is not None else None,
                'stories_using_ai': int(stories_ai) if stories_ai is not None else None,
                'qa_assets': int(qa_assets) if qa_assets else None,
                'hours_saved': round(r_hours, 1),
                'defects_reduced': int(defects) if defects is not None else None,
                'tokens': round(r_tokens, 0),
                'est_savings': round(est, 2),
                'roi_index': _ai_round(roi),
                'owner': (r_out['_owner'].mode().iloc[0] if len(r_out) and r_out['_owner'].any() else None),
                'manager': (r_out['_owner'].mode().iloc[0] if len(r_out) and r_out['_owner'].any() else health.get('manager')),
                'health_score': health.get('health_score'),
                'health_band': health.get('band'),
                'certification': _ai_release_certification(health.get('health_score')),
                'release_date': None,
                'captured': {
                    'stories_delivered': stories is not None,
                    'stories_using_ai': stories_ai is not None,
                    'qa_assets': qa_assets > 0,
                    'defects_reduced': defects is not None,
                    'cycle_time': cycle is not None,
                },
            })

            for domain, bucket in (('Development', dev_contribution), ('QA', qa_contribution)):
                d_rows = r_rows[r_rows['_domain'].str.casefold() == domain.casefold()] if len(r_rows) else r_rows
                if not len(d_rows):
                    continue
                for person, chunk in d_rows.groupby('_person'):
                    uses = set(chunk['_use'])
                    rows_n = int(len(chunk))
                    quantified = int(chunk['_evidence'].sum())
                    emp = chunk['_emp'].dropna()
                    top_use = chunk.groupby('_use')['_hours'].sum().sort_values(ascending=False)
                    activity_type = top_use.index[0] if len(top_use) else None
                    hours_person = float(chunk['_hours'].sum())
                    entry = {
                        'project': project,
                        'release': release,
                        'domain': domain,
                        'name': chunk['_name'].iloc[0],
                        'employee_number': int(emp.iloc[0]) if len(emp) else None,
                        'rows': rows_n,
                        'usage_pct': _ai_round(_ai_ratio(quantified, rows_n, 100.0)),
                        'hours_saved': round(hours_person, 1),
                        'tokens': round(float(chunk['_tokens'].sum()), 0),
                        'stories': None,
                        'code_generated': bool(uses & {'Code generation', 'Refactoring', 'SQL development'}),
                        'reviews_supported': bool(uses & {'Code review', 'Security review'}),
                        'test_cases': int(chunk['_test_cases'].sum()),
                        'automation_assets': int(chunk['_automation'].sum()),
                        'defect_rows': int((chunk['_use'] == 'Defect analysis').sum()),
                        'activity_type': label_by_canon.get(activity_type, activity_type),
                        'impact_usd': round(hours_person * rate_usd, 2),
                    }
                    bucket.append(entry)

            docs_hours = float(r_rows.loc[r_rows['_use'] == 'Docs', '_hours'].sum()) if len(r_rows) else 0.0
            qa_hours = float(r_rows.loc[r_rows['_domain'].str.casefold() == 'qa', '_hours'].sum()) if len(r_rows) else 0.0
            dev_hours = float(r_rows.loc[(r_rows['_domain'].str.casefold() == 'development') & (r_rows['_use'] != 'Docs'), '_hours'].sum()) if len(r_rows) else 0.0
            cycle_value = (cycle * team_day_cost) if cycle else None
            base_rows = r_rows[r_rows['_baseline'] > 0] if len(r_rows) else r_rows
            baseline_hours = float(base_rows['_baseline'].sum()) if len(base_rows) else 0.0
            rework_value = (defects * rate_usd * 2.0) if defects is not None else None
            realized = (dev_hours + qa_hours + docs_hours) * rate_usd + (rework_value or 0.0)
            steps = [
                {'step': 'Baseline', 'value': round(baseline_hours * rate_usd, 2) if baseline_hours else None, 'captured': baseline_hours > 0},
                {'step': 'Dev savings', 'value': round(dev_hours * rate_usd, 2), 'captured': True},
                {'step': 'QA savings', 'value': round(qa_hours * rate_usd, 2), 'captured': True},
                {'step': 'Docs savings', 'value': round(docs_hours * rate_usd, 2), 'captured': True},
                {'step': 'Rework reduction', 'value': round(rework_value, 2) if rework_value is not None else None, 'captured': rework_value is not None},
                {'step': 'Final realized', 'value': round(realized, 2), 'captured': True},
            ]
            productivity = _ai_ratio(float(base_rows['_hours'].sum()), float(base_rows['_baseline'].sum()), 100.0) if len(base_rows) else None
            benefit_waterfall.append({
                'project': project,
                'release': release,
                'steps': steps,
                'net_value': round(realized, 2),
                'est_savings': round(est, 2),
                'productivity_pct': _ai_round(productivity),
            })
            flow_stages = [
                ('Requirements', {'Docs', 'Knowledge search', 'Other'}),
                ('Development', {'Code generation', 'Code review', 'SQL development', 'Refactoring'}),
                ('Testing', {'Unit testing', 'Test design', 'Test automation', 'Defect analysis'}),
                ('Deployment', {'Security review'}),
            ]
            release_flow.append({
                'project': project,
                'release': release,
                'stages': [
                    {
                        'stage': name,
                        'hours': round(float(r_rows.loc[r_rows['_use'].isin(uses), '_hours'].sum()) if len(r_rows) else 0.0, 1),
                        'value': round(float(r_rows.loc[r_rows['_use'].isin(uses), '_hours'].sum()) * rate_usd if len(r_rows) else 0.0, 2),
                        'touchpoints': int((r_rows['_use'].isin(uses)).sum()) if len(r_rows) else 0,
                    }
                    for name, uses in flow_stages
                ],
            })

            # Narrative templates (design 6.7)
            key_wins = []
            missed = []
            high = []
            low = []
            actions = []
            if len(r_rows):
                by_use = r_rows.groupby('_use').agg(hours=('_hours', 'sum'), users=('_person', 'nunique')).sort_values('hours', ascending=False)
                if len(by_use) and r_hours > 0 and by_use.iloc[0]['hours'] >= 0.10 * r_hours:
                    top_use = by_use.index[0]
                    share = by_use.iloc[0]['hours'] / r_hours * 100
                    key_wins.append(
                        f"{label_by_canon.get(top_use, top_use)} saved {by_use.iloc[0]['hours']:.0f} h across {int(by_use.iloc[0]['users'])} people ({share:.0f}% of release savings)."
                    )
                if roi is not None and t_roi and roi >= t_roi:
                    key_wins.append(f"Every $1 of Cursor spend returned ${roi:.1f} in effort at ${rate_usd:.0f}/h.")
                qa_slice = r_rows[r_rows['_domain'].str.casefold() == 'qa']
                qa_head = None
                if len(r_out):
                    qa_out = r_out[r_out['_domain'].str.casefold() == 'qa']
                    if len(qa_out):
                        qa_head = float(qa_out.groupby('_team')['_headcount'].max().sum())
                if not len(qa_slice):
                    missed.append(f"QA has no AI evidence this release; {int(qa_head) if qa_head else 0} QA roles are untracked.")
                blank_rows = r_rows[(r_rows['_hours'] <= 0) & (r_rows['_tokens'] <= 0)]
                if len(blank_rows) >= 3:
                    who = blank_rows.groupby('_name').size().sort_values(ascending=False)
                    missed.append(f"{len(blank_rows)} activity rows carry no hours or tokens, so {who.index[0]}'s work is not counted.")
                est_share = _ai_ratio(float(r_rows.loc[r_rows['_source'].isin(['estimated', 'estimated-generated']), '_hours'].sum()), r_hours, 100.0)
                if est_share is not None and est_share >= 50:
                    missed.append(f"{est_share:.0f}% of hours are Estimated; wire the Cursor export to make them defensible.")
                leaders = r_rows.groupby('_name').agg(hours=('_hours', 'sum'), rows=(' _hours'.strip(), 'size'), ev=('_evidence', 'sum'))
                leaders = leaders[leaders['hours'] > 0].sort_values('hours', ascending=False)
                if len(leaders) >= 2:
                    a, b = leaders.iloc[0], leaders.iloc[1]
                    high.append(f"{leaders.index[0]} and {leaders.index[1]} led with {a['hours']:.0f} h and {b['hours']:.0f} h, all quantified.")
                elif len(leaders) == 1:
                    high.append(f"{leaders.index[0]} led with {leaders.iloc[0]['hours']:.0f} h quantified.")
                adopt = next((item.get('adoption_pct') for item in release_trend if item['project'] == project and item['release'] == release), None)
                headcount = health.get('headcount_scope')
                if adopt is not None and adopt < 60 and headcount:
                    active_n = int(len(set(r_rows.loc[r_rows['_evidence'], '_person'])))
                    low.append(f"{project} adoption is {adopt:.1f}% ({active_n}/{int(headcount)}); {max(0, int(headcount) - active_n)} people have no evidence.")
                zero_h = r_rows.groupby('_name').agg(hours=('_hours', 'sum'), n=('_hours', 'size'))
                zero_h = zero_h[(zero_h['hours'] <= 0) & (zero_h['n'] > 0)].sort_values('n', ascending=False)
                if len(zero_h):
                    low.append(f"{zero_h.index[0]} logged {int(zero_h.iloc[0]['n'])} activities without hours; coach on capturing savings.")
                if len(r_out) and r_out['_opportunities'].any():
                    plan = r_out.loc[r_out['_opportunities'] != '', '_opportunities'].iloc[0]
                    actions.append(f"Owner's plan: {plan}")
                if not len(qa_slice):
                    actions.append('Add the QA Manager row on AI release outcomes and at least one QA activity row.')
                off_list = int((~r_rows['_use'].isin([c[0] for c in AI_USE_CASE_CANONICAL[:-1]])).sum()) if len(r_rows) else 0
                if off_list:
                    actions.append(f'Normalise {off_list} free-text use cases to the catalog so trend lines compare.')
            narratives.append({
                'project': project,
                'release': release,
                'key_wins': key_wins[:2],
                'missed_opportunities': missed[:2],
                'high_performers': high[:2],
                'low_adoption': low[:2],
                'actions': actions[:2],
            })

    # Current-slice convenience objects (latest overall, or first project).
    latest_release = max(sequence, key=sequence.get) if sequence else None
    current_summary = next((row for row in release_summaries if row['release'] == latest_release), release_summaries[0] if release_summaries else None)
    current_narrative = next((row for row in narratives if current_summary and row['project'] == current_summary['project'] and row['release'] == current_summary['release']), narratives[0] if narratives else {
        'key_wins': [], 'missed_opportunities': [], 'high_performers': [], 'low_adoption': [], 'actions': [],
    })

    # Maturity on health rows (additive, does not change existing keys if already present).
    for row in health_rows or []:
        proj_rows = act[act['_project'] == row['project']] if len(act) else act
        qa_rows = int((proj_rows['_domain'].str.casefold() == 'qa').sum()) if len(proj_rows) else 0
        use_n = int(proj_rows.loc[proj_rows['_hours'] > 0, '_use'].nunique()) if len(proj_rows) else 0
        submitted = bool(len(outc) and ((outc['_project'] == row['project']) & (outc['_status'].isin(['Submitted', 'Reviewed']))).any())
        export_share = None
        if row.get('active_users'):
            export_users = set(proj_rows.loc[proj_rows['_source'] == 'export', '_person']) if len(proj_rows) else set()
            export_share = _ai_ratio(len(export_users), row['active_users'], 100.0)
        row.setdefault('maturity_level', _ai_maturity_level(
            row.get('adoption_pct'), use_n, submitted, row.get('evidence_confidence_pct'),
            qa_rows, row.get('coverage_pct'), export_share, row.get('roi_index'),
        ))
        teams = sorted({t for t in proj_rows['_team'].tolist() if t}) if len(proj_rows) else []
        owners = [item['_owner'] for item in (outc[outc['_project'] == row['project']].to_dict('records') if len(outc) else []) if item.get('_owner')]
        row.setdefault('teams', teams)
        row.setdefault('manager', owners[0] if owners else None)
        uc = [item for item in use_case_matrix if item['project'] == row['project']]
        def _uc_score(keys):
            hours = sum(item['hours_saved'] for item in uc if item['use_case_canonical'] in keys)
            total = sum(item['hours_saved'] for item in uc) or 0.0
            if total <= 0:
                return 0.0 if hours <= 0 else 100.0
            return min(100.0, hours / total * 100.0 * 2.0)
        maturity_radar.append({
            'project': row['project'],
            'axes': [
                {'axis': 'Adoption', 'score': _ai_round(row.get('adoption_pct')) or 0.0},
                {'axis': 'Automation', 'score': _ai_round(_uc_score(['Test automation'])) or 0.0},
                {'axis': 'Documentation', 'score': _ai_round(_uc_score(['Docs'])) or 0.0},
                {'axis': 'QA Coverage', 'score': _ai_round(row.get('qa_adoption_pct')) if row.get('qa_adoption_pct') is not None else 0.0},
                {'axis': 'Code Generation', 'score': _ai_round(_uc_score(['Code generation'])) or 0.0},
                {'axis': 'Knowledge Management', 'score': _ai_round(_uc_score(['Knowledge search', 'Docs'])) or 0.0},
            ],
        })


    project_recommendations = []
    for row in health_rows or []:
        bullets = []
        rec = row.get('recommendation') or _ai_health_recommendation(row, row.get('risk_count') or 0)
        bullets.append(f"Primary action: {rec}.")
        if row.get('qa_adoption_pct') is None or (row.get('qa_adoption_pct') is not None and row.get('qa_adoption_pct') == 0):
            bullets.append("Close the QA evidence gap next release (outcome row + ≥1 QA activity).")
        if (row.get('unrealized_value_usd') or 0) > 0:
            bullets.append(f"Recover ${row.get('unrealized_value_usd'):,.0f} unrealized value via adoption and quantification.")
        if row.get('evidence_confidence_pct') is not None and row.get('evidence_confidence_pct') < 50:
            bullets.append("Raise evidence confidence: import Cursor export / convert Estimated rows to Manual.")
        maturity = row.get('maturity_level') or 1
        next_stage = min(5, int(maturity) + 1)
        bullets.append(f"Maturity path: advance from L{int(maturity)} to L{next_stage} (see §3.3 criteria).")
        project_recommendations.append({
            'project': row['project'],
            'recommendation': rec,
            'bullets': bullets[:5],
            'next_maturity_level': next_stage,
        })

    return {
        'use_case_matrix': use_case_matrix,
        'dev_vs_qa': dev_vs_qa,
        'release_trend': release_trend,
        'manager_scorecard': manager_scorecard,
        'risks': risks,
        'release_summary': current_summary,
        'release_summaries': release_summaries,
        'dev_contribution': dev_contribution,
        'qa_contribution': qa_contribution,
        'benefit_waterfall': benefit_waterfall,
        'project_recommendations': project_recommendations,
        'narrative': {
            'key_wins': current_narrative.get('key_wins', []),
            'missed_opportunities': current_narrative.get('missed_opportunities', []),
            'high_performers': current_narrative.get('high_performers', []),
            'low_adoption': current_narrative.get('low_adoption', []),
            'actions': current_narrative.get('actions', []),
        },
        'narratives': narratives,
        'release_flow': release_flow,
        'maturity_radar': maturity_radar,
    }


class AnalyticsEngine:
    @staticmethod
    def get_filter_options(filters: Dict[str, Any] = None):
        filters = filters or {}
        df_emp = data_loader.df_employees
        df_fin = data_loader.df_finance
        df_skill = data_loader.df_skills

        def get_options_for_dim(col: str, filter_keys: List[str], sort_fn=None):
            sub = {k: v for k, v in filters.items() if k not in filter_keys}
            sub_df = apply_employee_filters(df_emp, sub)
            raw = set(sub_df[col].dropna().astype(str).unique()) if col in sub_df.columns else set()
            valid = {x.strip() for x in raw if x.strip() and x.strip().lower() not in ('none', 'nan', 'null', '', 'all')}
            for fk in filter_keys:
                for val in parse_filter_list(filters.get(fk)):
                    if str(val).strip():
                        valid.add(str(val).strip())
            items = list(valid)
            return sort_fn(items) if sort_fn else sorted(items)

        states = get_options_for_dim('State', ['state'])
        job_levels = get_options_for_dim('JOB LEVEL', ['job_level'], sort_grades)
        locations = get_options_for_dim('LOCATION', ['location'])
        departments = get_options_for_dim('DEPARTMENT', ['department'])
        projects = get_options_for_dim('Project Working', ['project'])
        modules = get_options_for_dim('Module', ['module'])

        # Rich manager breakdown with associated projects and headcount
        sub_mgr = {k: v for k, v in filters.items() if k not in ['manager']}
        sub_df_mgr = apply_employee_filters(df_emp, sub_mgr)
        mgr_counts = sub_df_mgr['MANAGER'].value_counts()
        
        proj_filter = parse_filter_list(filters.get('project'))
        active_proj_str = ', '.join(proj_filter) if proj_filter else ''
        
        manager_options = []
        ordered_managers = []
        for mgr_val, count in mgr_counts.items():
            mgr_val_str = str(mgr_val).strip()
            if not mgr_val_str or mgr_val_str.lower() in ('none', 'nan', 'null', '', 'all'):
                continue
            clean_name = re.sub(r'\s*\(\d+\)\s*$', '', mgr_val_str).strip()
            mgr_emps = sub_df_mgr[sub_df_mgr['MANAGER'] == mgr_val]
            projs = sorted(list(mgr_emps['Project Working'].dropna().unique()))
            
            if active_proj_str:
                label = f"{clean_name} · {count} staff in {active_proj_str}"
            else:
                p_summary = ', '.join(projs)
                label = f"{clean_name} · {count} staff ({p_summary})"
                
            ordered_managers.append(mgr_val_str)
            manager_options.append({
                'value': mgr_val_str,
                'label': label,
                'name': clean_name,
                'count': int(count),
                'projects': projs,
            })
            
        # Ensure any currently selected manager is included in ordered_managers and manager_options even if 0 count
        for val in parse_filter_list(filters.get('manager')):
            s_val = str(val).strip()
            if s_val and s_val not in ordered_managers:
                clean_name = re.sub(r'\s*\(\d+\)\s*$', '', s_val).strip()
                ordered_managers.append(s_val)
                manager_options.append({
                    'value': s_val,
                    'label': f"{clean_name} (Selected)",
                    'name': clean_name,
                    'count': 0,
                    'projects': [],
                })
        
        managers = ordered_managers

        # Dynamic skills: primary skills first, then secondary skills for active cohort
        sub_skills = {k: v for k, v in filters.items() if k not in ['skill_name', 'skill']}
        sub_df_skills = apply_employee_filters(df_emp, sub_skills)
        cohort_prim_skills = sorted([s.strip() for s in sub_df_skills['Primary_Skill'].dropna().astype(str).unique() if s.strip()])
        cohort_all_skills = set(cohort_prim_skills)
        for s_list in sub_df_skills['Secondary_Skills']:
            if isinstance(s_list, list):
                for s in s_list:
                    if s and str(s).strip():
                        cohort_all_skills.add(str(s).strip())
        for val in parse_filter_list(filters.get('skill_name') or filters.get('skill')):
            if str(val).strip():
                cohort_all_skills.add(str(val).strip())
        
        # If no cohort found, fallback to full skills list
        if not cohort_all_skills:
            cohort_all_skills = set(df_skill['Skill Name'].dropna().unique())
        
        # Keep primary skills prioritized, then remaining skills alphabetically
        other_skills = sorted(list(cohort_all_skills - set(cohort_prim_skills)))
        skills = cohort_prim_skills + other_skills

        years = sorted([int(y) for y in df_fin['Year'].dropna().unique()], reverse=True)
        salary_bins = ['< 5L', '5-10L', '10-15L', '15-20L', '20L+']
        calendar_years = sorted([int(y) for y in data_loader.df_leave['START DATE'].dt.year.dropna().unique()], reverse=True)
        months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

        releases_raw = set()
        for frame in (getattr(data_loader, 'df_ai_utilization', None), getattr(data_loader, 'df_ai_outcomes', None)):
            if frame is None or getattr(frame, 'empty', True) or 'Release' not in frame.columns:
                continue
            for val in frame['Release'].dropna().astype(str).unique():
                token = str(val).strip()
                if token and token.lower() not in ('none', 'nan', 'null', '', 'all'):
                    releases_raw.add(token)
        for val in parse_filter_list(filters.get('release')):
            if str(val).strip():
                releases_raw.add(str(val).strip())
        release_order = getattr(data_loader, 'ai_release_order', None) or {}
        explicit_releases = sorted(
            [r for r in releases_raw if r in release_order],
            key=lambda r: int(release_order[r]),
        )
        implicit_releases = sorted(
            [r for r in releases_raw if r not in release_order],
            key=_ai_release_natural_key,
        )
        releases = explicit_releases + implicit_releases

        return {
            'states': states,
            'job_levels': job_levels,
            'locations': locations,
            'departments': departments,
            'projects': projects,
            'managers': managers,
            'manager_options': manager_options,
            'modules': modules,
            'years': years,
            'calendar_years': calendar_years,
            'months': months,
            'skills': skills,
            'salary_bins': salary_bins,
            'releases': releases,
        }


    @staticmethod
    def get_home_kpis(filters: Dict[str, Any] = None):
        filters = filters or {}
        df = apply_employee_filters(data_loader.df_employees, filters)
        total = len(df)
        
        if total == 0:
            return {
                'total_employees': 0,
                'male_count': 0,
                'female_count': 0,
                'pct_male': 0.0,
                'pct_female': 0.0,
                'avg_infinite_exp': 0.0,
                'avg_prior_exp': 0.0,
                'avg_total_exp': 0.0,
                'recent_hirings': {'Joined 2024': 0, 'Joined 2023': 0, 'Joined Earlier': 0},
                'attrition_by_year': [],
                'location_distribution': [],
                'grade_hierarchy': [],
                'tenure_stability_bands': [],
                'headcount_growth_history': [],
                'department_distribution': [],
                'age_distribution': {'stats': {'median': 0, 'mean': 0, 'min': 0, 'max': 0, 'total': 0}, 'bins_3': [], 'bins_2': [], 'bins_5': []},
                'project_headcount_trends': [],
                'emp_type_distribution': {'total': 0, 'types': []},
                'module_distribution': [],
                'project_manager_hierarchy': [],
                'work_model_mix': work_model_mix(df),
                'training_summary': training_summary([]),
            }
        
        male_count = int((df['GENDER'] == 'Male').sum())
        female_count = int((df['GENDER'] == 'Female').sum())
        pct_male = round((male_count / total) * 100, 2)
        pct_female = round((female_count / total) * 100, 2)
        
        avg_infinite_exp = round(float(df['Infinite_Exp'].mean()), 2)
        avg_prior_exp = round(float(df['Prior_Exp'].mean()), 2)
        avg_total_exp = round(float(df['Total_Exp'].mean()), 2)
        
        start_years = df['START DATE'].dt.year
        joined_2024 = int((start_years == 2024).sum())
        joined_2023 = int((start_years == 2023).sum())
        joined_earlier = total - (joined_2024 + joined_2023)
        
        exit_years = df['EXIT DATE'].dt.year.dropna().astype(int)
        attr_counts = exit_years.value_counts().sort_index()
        attrition_by_year = []
        for y, count in attr_counts.items():
            rate = round((count / total) * 100, 2)
            leavers_df = df[df['EXIT DATE'].dt.year == int(y)]
            leavers = []
            for _, r in leavers_df.iterrows():
                leavers.append({
                    'employee_number': int(r['EMPLOYEE NUMBER']),
                    'name': str(r['EMPLOYEE LABEL']),
                    'job_title': str(r['JOB TITLE']),
                    'department': str(r['DEPARTMENT']),
                    'location': str(r['LOCATION']),
                    'exit_date': r['EXIT DATE'].strftime('%Y-%m-%d') if pd.notnull(r['EXIT DATE']) else '',
                    'tenure': float(r['Infinite_Exp']),
                })
            attrition_by_year.append({
                'year': str(y),
                'exits': int(count),
                'rate': rate,
                'leavers': leavers
            })
            
        attrition_trend_dir = 'down'
        current_attr_rate = 0.0
        if len(attrition_by_year) >= 2:
            last_count = attrition_by_year[-1]['exits']
            prev_count = attrition_by_year[-2]['exits']
            current_attr_rate = attrition_by_year[-1]['rate']
            attrition_trend_dir = 'down' if last_count < prev_count else ('up' if last_count > prev_count else 'flat')
        elif len(attrition_by_year) == 1:
            current_attr_rate = attrition_by_year[0]['rate']
            
        loc_counts = df['LOCATION'].value_counts()
        loc_dist = []
        for loc, count in loc_counts.items():
            pct = round((count / total) * 100, 2)
            loc_dist.append({'location': loc, 'count': int(count), 'percentage': pct})
            
        # Grade Hierarchy Tiers (Executive Pyramid)
        tier_defs = [
            {'tier': 'Executive Leadership', 'grades': ['E8', 'E9', 'E10'], 'description': 'Strategic & Executive Advisory'},
            {'tier': 'Senior Delivery & Leads', 'grades': ['E5', 'E6', 'E7'], 'description': 'Program Delivery & Technical Leadership'},
            {'tier': 'Core Engineering & Specialists', 'grades': ['E3', 'E4'], 'description': 'Senior Engineers & Domain Specialists'},
            {'tier': 'Associate & Foundation', 'grades': ['E1', 'E2'], 'description': 'Software Engineers & Analysts'},
        ]
        grade_hierarchy = []
        for t in tier_defs:
            t_count = int(df['JOB LEVEL'].isin(t['grades']).sum())
            t_pct = round((t_count / total) * 100, 1) if total > 0 else 0.0
            grade_hierarchy.append({
                'tier': t['tier'],
                'grades': t['grades'],
                'description': t['description'],
                'count': t_count,
                'percentage': t_pct
            })

        # Tenure Stability Bands (<1y, 1-3y, 3-5y, 5-10y, 10y+)
        band_defs = [
            ('< 1 Yr', 'Onboarding & Ramp-up', df['Infinite_Exp'] < 1),
            ('1 to 3 Yrs', 'Core Productive Staff', (df['Infinite_Exp'] >= 1) & (df['Infinite_Exp'] < 3)),
            ('3 to 5 Yrs', 'Established Contributors', (df['Infinite_Exp'] >= 3) & (df['Infinite_Exp'] < 5)),
            ('5 to 10 Yrs', 'Senior Domain Anchors', (df['Infinite_Exp'] >= 5) & (df['Infinite_Exp'] < 10)),
            ('10+ Yrs', 'Veteran Leadership', df['Infinite_Exp'] >= 10),
        ]
        tenure_stability_bands = []
        for band_name, label, mask in band_defs:
            b_count = int(mask.sum())
            b_pct = round((b_count / total) * 100, 1) if total > 0 else 0.0
            tenure_stability_bands.append({
                'band': band_name,
                'label': label,
                'count': b_count,
                'percentage': b_pct
            })

        # Longitudinal Headcount Growth History (2020-2024)
        growth_years = [2020, 2021, 2022, 2023, 2024]
        headcount_growth_history = []
        cum_hc = int((df['START DATE'].dt.year < 2020).sum())
        for yr in growth_years:
            yr_joiners = int((df['START DATE'].dt.year == yr).sum())
            yr_exits = int((df['EXIT DATE'].dt.year == yr).sum())
            cum_hc = cum_hc + yr_joiners - yr_exits
            headcount_growth_history.append({
                'year': str(yr),
                'joiners': yr_joiners,
                'exits': yr_exits,
                'headcount': max(0, min(total, cum_hc if yr < 2024 else total))
            })

        # Department Distribution
        dept_counts = df['DEPARTMENT'].value_counts()
        department_distribution = []
        for dept, count in dept_counts.items():
            pct = round((count / total) * 100, 1) if total > 0 else 0.0
            department_distribution.append({
                'department': str(dept),
                'count': int(count),
                'percentage': pct
            })

        # 1. Age Distribution (Dynamic histogram with 2y, 3y, 5y bins)
        ref_dt = pd.to_datetime('2024-10-10')
        dob_valid = pd.to_datetime(df['DATE OF BIRTH'], errors='coerce')
        valid_ages = ((ref_dt - dob_valid).dt.days / 365.25).dropna()
        valid_ages = valid_ages[(valid_ages >= 18) & (valid_ages <= 70)]

        age_stats = {
            'median': round(float(valid_ages.median()), 1) if len(valid_ages) > 0 else 0.0,
            'mean': round(float(valid_ages.mean()), 1) if len(valid_ages) > 0 else 0.0,
            'min': round(float(valid_ages.min()), 1) if len(valid_ages) > 0 else 0.0,
            'max': round(float(valid_ages.max()), 1) if len(valid_ages) > 0 else 0.0,
            'total': len(valid_ages)
        }

        def build_age_bins(step):
            b_list = []
            if len(valid_ages) == 0:
                return b_list
            min_bound = 18 if step == 3 else 20
            max_bound = 63 if step == 3 else (64 if step == 2 else 65)
            edges = list(range(min_bound, max_bound + step, step))
            for i in range(len(edges) - 1):
                low = edges[i]
                high = edges[i + 1]
                count = int(((valid_ages >= low) & (valid_ages < high)).sum())
                pct = round((count / len(valid_ages)) * 100, 1) if len(valid_ages) > 0 else 0.0
                b_list.append({
                    'bin': f"{low}-{high - 1}" if high - 1 > low else str(low),
                    'label': f"{low} - {high - 1} Yrs",
                    'start': low,
                    'end': high - 1,
                    'count': count,
                    'percentage': pct
                })
            return b_list

        age_distribution = {
            'stats': age_stats,
            'bins_3': build_age_bins(3),
            'bins_2': build_age_bins(2),
            'bins_5': build_age_bins(5),
        }

        # 2. Project Headcount Trends (Beginning of Year vs End of Year)
        target_year = 2024
        if filters and filters.get('year'):
            try:
                target_year = int(filters['year'])
            except:
                pass

        all_projects = sorted(list(df['Project Working'].dropna().unique()))
        project_headcount_trends = []
        for p in all_projects:
            p_df = df[df['Project Working'] == p]
            start_cutoff = pd.to_datetime(f"{target_year}-01-01")
            end_cutoff = pd.to_datetime(f"{target_year}-12-31")
            start_c = int(((p_df['START DATE'] < start_cutoff) & (p_df['EXIT DATE'].isna() | (p_df['EXIT DATE'] >= start_cutoff))).sum())
            end_c = int(((p_df['START DATE'] <= end_cutoff) & (p_df['EXIT DATE'].isna() | (p_df['EXIT DATE'] > end_cutoff))).sum())
            net_delta = end_c - start_c
            pct_delta = round(((end_c - start_c) / start_c) * 100, 1) if start_c > 0 else 0.0

            project_headcount_trends.append({
                'project': str(p),
                'beginning': start_c,
                'end': end_c,
                'net_change': net_delta,
                'growth_pct': pct_delta,
                'current_active': len(p_df)
            })
        project_headcount_trends.sort(key=lambda x: x['end'], reverse=True)

        # 3. Employment Type Classification (Permanent, Contract, Intern)
        intern_mask = (df['JOB LEVEL'] == 'E1') & (df['Prior_Exp'] == 0)
        contract_mask = ((df['JOB LEVEL'].isin(['E1', 'E2'])) & (df['Prior_Exp'] > 0)) | ((df['Infinite_Exp'] < 1.0) & (~intern_mask))
        permanent_mask = ~(intern_mask | contract_mask)

        intern_cnt = int(intern_mask.sum())
        contract_cnt = int(contract_mask.sum())
        perm_cnt = int(permanent_mask.sum())

        emp_type_distribution = {
            'total': total,
            'types': [
                {
                    'type': 'Permanent',
                    'label': 'Permanent Staff',
                    'count': perm_cnt,
                    'percentage': round((perm_cnt / total) * 100, 1) if total > 0 else 0.0,
                    'color': '#2563eb',
                    'description': 'Core full-time engineers & leadership'
                },
                {
                    'type': 'Contract',
                    'label': 'Contract Specialists',
                    'count': contract_cnt,
                    'percentage': round((contract_cnt / total) * 100, 1) if total > 0 else 0.0,
                    'color': '#0284c7',
                    'description': 'Technical contractors & specialists'
                },
                {
                    'type': 'Intern',
                    'label': 'Graduate Interns',
                    'count': intern_cnt,
                    'percentage': round((intern_cnt / total) * 100, 1) if total > 0 else 0.0,
                    'color': '#6366f1',
                    'description': 'Early career talent & trainees'
                },
            ]
        }

        # MMIS Enterprise Module Distribution strictly for Java Developers (74 Java Engineers)
        module_dist = []
        if 'Module' in df.columns:
            df_modules = df[df['Module'].notna() & (df['Module'] != '') & (df['Module'] != 'None') & (df['Primary_Skill'] == 'Java / Spring Boot')].copy()
            mod_counts = df_modules['Module'].value_counts()
            total_mod_devs = len(df_modules)
            for mod_name, count in mod_counts.items():
                module_dist.append({
                    'module_name': str(mod_name),
                    'employee_count': int(count),
                    'percentage': round(count / max(1, total_mod_devs) * 100, 1),
                    'java_count': int(count)
                })

        # Project -> Manager Operational Delivery Hierarchy Breakdown
        project_manager_hierarchy = []
        cohort_projs = sorted(list(df['Project Working'].dropna().unique()))
        for p in cohort_projs:
            p_df = df[df['Project Working'] == p]
            p_total = len(p_df)
            mgr_counts = p_df['MANAGER'].value_counts()
            mgr_list = []
            for mgr_name, count in mgr_counts.items():
                clean_name = re.sub(r'\s*\(\d+\)\s*$', '', str(mgr_name)).strip()
                mgr_list.append({
                    'manager': str(mgr_name),
                    'name': clean_name,
                    'count': int(count),
                    'percentage': round((count / p_total) * 100, 1) if p_total > 0 else 0.0
                })
            project_manager_hierarchy.append({
                'project': str(p),
                'headcount': p_total,
                'percentage': round((p_total / total) * 100, 1) if total > 0 else 0.0,
                'manager_count': len(mgr_counts),
                'managers': mgr_list
            })

        return {
            'total_employees': total,
            'male_count': male_count,
            'female_count': female_count,
            'pct_male': pct_male,
            'pct_female': pct_female,
            'avg_infinite_exp': avg_infinite_exp,
            'avg_prior_exp': avg_prior_exp,
            'avg_total_exp': avg_total_exp,
            'recent_hirings': {
                'Joined 2024': joined_2024,
                'Joined 2023': joined_2023,
                'Joined Earlier': joined_earlier
            },
            'attrition_by_year': attrition_by_year,
            'location_distribution': loc_dist,
            'attrition_rate_current': current_attr_rate,
            'attrition_trend_dir': attrition_trend_dir,
            'grade_hierarchy': grade_hierarchy,
            'tenure_stability_bands': tenure_stability_bands,
            'headcount_growth_history': headcount_growth_history,
            'department_distribution': department_distribution,
            'age_distribution': age_distribution,
            'project_headcount_trends': project_headcount_trends,
            'emp_type_distribution': emp_type_distribution,
            'module_distribution': module_dist,
            'project_manager_hierarchy': project_manager_hierarchy,
            'work_model_mix': work_model_mix(df),
            'training_summary': training_summary(df['EMPLOYEE NUMBER'].tolist()),
        }

    @staticmethod
    def get_statewise_kpis(filters: Dict[str, Any] = None):
        filters = filters or {}
        df = apply_employee_filters(data_loader.df_employees, filters)
        total = len(df)
        df_all = data_loader.df_employees
        
        # Dynamically resolve SDM / VP from actual data
        selected_manager = str(filters.get('manager') or '').strip()
        selected_state = str(filters.get('state') or '').strip()
        
        if selected_manager:
            sdm_name = selected_manager
        elif selected_state and total > 0:
            mgr_counts = df['MANAGER'].value_counts()
            if not mgr_counts.empty:
                sdm_name = str(mgr_counts.index[0])
            else:
                sdm_name = f"SDM - {selected_state}"
        elif total > 0:
            vp_candidates = df_all[df_all['JOB TITLE'].str.contains('Vice President', case=False, na=False)].copy()
            if not vp_candidates.empty:
                vp_candidates['grade_rank'] = vp_candidates['JOB LEVEL'].apply(
                    lambda x: GRADE_ORDER.index(x) if x in GRADE_ORDER else -1
                )
                top_vp = vp_candidates.sort_values(by=['grade_rank', 'EMP_CTC1'], ascending=False).iloc[0]
                sdm_name = str(top_vp['EMPLOYEE LABEL'])
            else:
                top_mgr = df['MANAGER'].value_counts().index[0]
                sdm_name = str(top_mgr)
        else:
            sdm_name = "No Active SDM"
            
        # Available SDMs for switcher dropdown
        available_sdms = []
        for mgr, cnt in df_all['MANAGER'].value_counts().head(8).items():
            available_sdms.append({'name': str(mgr), 'count': int(cnt)})
        
        if total == 0:
            return {
                'selected_sdm': sdm_name,
                'filtered_employees': 0,
                'avg_prior_exp': 0.0,
                'avg_infinite_exp': 0.0,
                'experience_by_grade': [],
                'project_grade_distribution': [],
                'project_grade_grouped': [],
                'geography_grade_breakdown': [],
                'geography_grade_grouped': [],
                'available_sdms': available_sdms,
                'employee_roster': []
            }

        avg_prior = round(float(df['Prior_Exp'].mean()), 2)
        avg_inf = round(float(df['Infinite_Exp'].mean()), 2)
        
        exp_by_grade = []
        grade_groups = df.groupby('JOB LEVEL')
        for grade in sort_grades(list(grade_groups.groups.keys())):
            gdf = grade_groups.get_group(grade)
            prior = round(float(gdf['Prior_Exp'].mean()), 2)
            inf = round(float(gdf['Infinite_Exp'].mean()), 2)
            exp_by_grade.append({
                'job_level': grade,
                'prior_exp': prior,
                'infinite_exp': inf,
                'gap': round(inf - prior, 2),
                'total_exp': round(float(gdf['Total_Exp'].mean()), 2),
                'count': len(gdf)
            })
            
        proj_grade = []
        for (grade, proj), count in df.groupby(['JOB LEVEL', 'Project Working']).size().items():
            proj_grade.append({'job_level': grade, 'project': proj, 'count': int(count)})
        proj_grade = sorted(proj_grade, key=lambda x: (GRADE_ORDER.index(x['job_level']) if x['job_level'] in GRADE_ORDER else 99, x['project']))
        
        geo_grade = []
        for (grade, loc), count in df.groupby(['JOB LEVEL', 'LOCATION']).size().items():
            geo_grade.append({'job_level': grade, 'location': loc, 'count': int(count)})
        geo_grade = sorted(geo_grade, key=lambda x: (GRADE_ORDER.index(x['job_level']) if x['job_level'] in GRADE_ORDER else 99, x['location']))
        
        # Build grouped multi-bar data by grade to prevent repeated axis labels
        projects_list = ['NH', 'ND', 'AK', 'Maven']
        locations_list = ['Bangalore', 'Hyderabad', 'Chennai', 'Pune']
        
        proj_grade_grouped = []
        geo_grade_grouped = []
        for grade in GRADE_ORDER:
            gdf = df[df['JOB LEVEL'] == grade]
            p_entry = {'job_level': grade, 'total': len(gdf)}
            for p in projects_list:
                p_entry[p] = int((gdf['Project Working'] == p).sum())
            proj_grade_grouped.append(p_entry)
            
            g_entry = {'job_level': grade, 'total': len(gdf)}
            for loc in locations_list:
                g_entry[loc] = int((gdf['LOCATION'] == loc).sum())
            geo_grade_grouped.append(g_entry)
        
        roster_cols = ['EMPLOYEE NUMBER', 'EMPLOYEE LABEL', 'JOB LEVEL', 'JOB TITLE', 'DEPARTMENT', 'LOCATION', 'State', 'Project Working', 'MANAGER', 'Prior_Exp', 'Infinite_Exp', 'Total_Exp', 'M_Salary', 'EMP_CTC1', 'Module']
        roster_cols = [c for c in roster_cols if c in df.columns]
        roster_df = df[roster_cols].copy().fillna('')
        roster = sanitize_list(roster_df.to_dict(orient='records'))
        
        return {
            'selected_sdm': sdm_name,
            'filtered_employees': total,
            'avg_prior_exp': avg_prior,
            'avg_infinite_exp': avg_inf,
            'experience_by_grade': exp_by_grade,
            'project_grade_distribution': proj_grade,
            'project_grade_grouped': proj_grade_grouped,
            'geography_grade_breakdown': geo_grade,
            'geography_grade_grouped': geo_grade_grouped,
            'available_sdms': available_sdms,
            'employee_roster': roster
        }

    @staticmethod
    def get_employee_details(emp_number: int):
        df_emp = data_loader.df_employees
        emp_match = df_emp[df_emp['EMPLOYEE NUMBER'] == emp_number]
        
        if emp_match.empty:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee #{emp_number} not found"
            )

        emp = emp_match.iloc[0].to_dict()

        # Clean name: remove ID if present in label
        raw_label = str(emp.get('EMPLOYEE LABEL') or '')
        clean_name = re.sub(r'\s*\(\d+\)\s*', '', raw_label).strip()
        if not clean_name:
            clean_name = f"{emp.get('EMPLOYEE FIRST NAME', '')} {emp.get('EMPLOYEE LAST NAME', '')}".strip()
        employee_label = f"{clean_name} ({emp_number})"
        
        # Financial metrics directly from df_employees (master snapshot)
        curr_ctc = float(emp['EMP_CTC1']) if pd.notnull(emp.get('EMP_CTC1')) else 0.0
        m_sal = float(emp['M_Salary']) if pd.notnull(emp.get('M_Salary')) else (round(curr_ctc / 12, 2) if curr_ctc > 0 else 0.0)
        # A8 FIX: last_bonus derived from latest finance history entry, not the master field
        # (master Hike_Percentage and Last_Bonus are point-in-time snapshots that may lag history)
        last_bonus_master = float(emp['Last_Bonus']) if pd.notnull(emp.get('Last_Bonus')) else 0.0
        hike_pct_master = float(emp['Hike_Percentage']) if pd.notnull(emp.get('Hike_Percentage')) else 0.0

        # Skills mapping
        df_skill = data_loader.df_skills
        emp_skills_df = df_skill[df_skill['EMPLOYEE NUMBER'] == emp_number].copy()
        if 'Assigned Date' in emp_skills_df.columns:
            emp_skills_df['Assigned Date'] = emp_skills_df['Assigned Date'].astype(str)
        emp_skills = sanitize_list(emp_skills_df.to_dict(orient='records'))
        fresh_skills = [s['Skill Name'] for s in emp_skills if s.get('Skill Level') == 'Advanced'] or [s['Skill Name'] for s in emp_skills]
        
        # Finance History
        df_fin = data_loader.df_finance
        emp_fin_df = df_fin[df_fin['EMPLOYEE NUMBER'] == emp_number].sort_values('Year').copy()
        for col in ['Prom_Eve_Date', 'START DATE', 'EXIT DATE']:
            if col in emp_fin_df.columns:
                emp_fin_df[col] = emp_fin_df[col].astype(str)
        emp_fin = sanitize_list(emp_fin_df.to_dict(orient='records'))
        
        # A8 FIX: Derive last_bonus and hike_pct from the most recent history row
        if emp_fin:
            latest_row = emp_fin[-1]  # already sorted ascending by Year
            last_bonus = float(latest_row.get('Bonus') or latest_row.get('Last_Bonus') or last_bonus_master)
            raw_hike = float(latest_row.get('Hike') or latest_row.get('Hike_Percentage') or hike_pct_master)
            hike_pct = raw_hike * 100.0 if raw_hike <= 1.0 and raw_hike > 0 else raw_hike
        else:
            last_bonus = last_bonus_master
            hike_pct = hike_pct_master

        # If no multi-year finance history exists, synthesize FY24 baseline record from EMPLOYEES
        if not emp_fin:
            emp_fin = [{
                'EMPLOYEE NUMBER': emp_number,
                'Year': 2024,
                'Base_Salary': round(m_sal * 12, 2),
                'Bonus': round(last_bonus, 2),
                'Perks': round(curr_ctc * 0.08, 2),
                'Other_Comp': max(0.0, round(curr_ctc - (m_sal * 12) - last_bonus, 2)),
                'M_Salary': round(m_sal, 2),
                'Total_CTC': round(curr_ctc, 2),
                'Hike': round(hike_pct / 100.0, 4) if hike_pct > 0 else 0.0,
                'Is_Promotion': 'No',
                'is_synthetic': True,
                'record_origin': 'HEURISTIC_WORKFORCE_PROGRESSION_V1',
            }]

        # Leave Records — include all records; frontend will filter by year
        df_leave = data_loader.df_leave
        emp_leave_df = df_leave[df_leave['EMPLOYEE NUMBER'] == emp_number].copy()
        leave_records = []
        for _, lr in emp_leave_df.iterrows():
            leave_records.append({
                'leave_type': str(lr.get('LEAVE TYPE', 'Leave')),
                'day_value': float(lr.get('DAY VALUE', 1.0)),
                'start_date': lr['START DATE'].strftime('%Y-%m-%d') if pd.notnull(lr.get('START DATE')) else '',
                'end_date': lr['END DATE'].strftime('%Y-%m-%d') if pd.notnull(lr.get('END DATE')) else '',
                'manager': str(lr.get('MANAGER', ''))
            })

        grade_str = str(emp['JOB LEVEL'])
        grade_employees = df_emp[df_emp['JOB LEVEL'] == grade_str]
        grade_median_ctc = round(float(grade_employees['EMP_CTC1'].median()), 2) if not grade_employees.empty else curr_ctc
        grade_median_tenure = round(float(grade_employees['Infinite_Exp'].median()), 2) if not grade_employees.empty else float(emp['Infinite_Exp'])
        
        # Personal & Statutory details
        dob_dt = emp.get('DATE OF BIRTH')
        dob_str = dob_dt.strftime('%Y-%m-%d') if pd.notnull(dob_dt) and hasattr(dob_dt, 'strftime') else (str(dob_dt)[:10] if pd.notnull(dob_dt) and str(dob_dt).strip() not in ('', 'nan', 'None') else None)

        # A5 FIX: Compute age from today's actual date, not hardcoded 2024
        age = None
        if dob_str:
            try:
                dob_parsed = pd.to_datetime(dob_str).date()
                today = date.today()
                age = today.year - dob_parsed.year - (1 if today < dob_parsed.replace(year=today.year) else 0)
                if age < 18 or age > 80:
                    age = None  # guard against bad DOB data
            except Exception:
                age = None

        start_dt = emp.get('START DATE')
        join_date_str = start_dt.strftime('%Y-%m-%d') if pd.notnull(start_dt) and hasattr(start_dt, 'strftime') else (str(start_dt)[:10] if pd.notnull(start_dt) and str(start_dt).strip() not in ('', 'nan', 'None') else '2019-06-01')

        # A7 FIX: Only mark as rehire when employee has an actual exit date on record
        exit_dt = emp.get('EXIT DATE')
        exit_date_str = exit_dt.strftime('%Y-%m-%d') if pd.notnull(exit_dt) and hasattr(exit_dt, 'strftime') else (str(exit_dt)[:10] if pd.notnull(exit_dt) and str(exit_dt).strip() not in ('', 'nan', 'None') else None)
        
        is_rehire = bool(exit_date_str)  # ONLY flag when real exit date exists — removed random formula
        rehire_details = None
        if is_rehire:
            rehire_details = {
                'previous_exit_date': exit_date_str,
                'rejoin_date': join_date_str,
                'rehire_tier': 'Lateral Specialist Rehire',
                'rehire_grade': grade_str,
                'status': 'Re-joined Infinite (Lateral)',
                'notes': f'Exited on {exit_date_str} and rejoined Infinite as Lateral Hire.'
            }

        # Deterministic personal fields from actual employee record where available
        contact_seed = int(emp_number) if emp_number > 0 else 1019272
        blood_groups = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-']
        blood_group = blood_groups[contact_seed % len(blood_groups)]

        contact_str = str(emp.get('CONTACT NO') or emp.get('MOBILE') or '') or f"+91 9845{((contact_seed * 43) % 900000) + 100000}"

        clean_first = re.sub(r'[^a-zA-Z]', '', str(emp.get('EMPLOYEE FIRST NAME') or 'emp')).lower()
        clean_last = re.sub(r'[^a-zA-Z]', '', str(emp.get('EMPLOYEE LAST NAME') or 'user')).lower()
        personal_email_field = str(emp.get('PERSONAL EMAIL') or emp.get('Personal_Email') or '').strip()
        personal_email = personal_email_field if personal_email_field and '@' in personal_email_field else f"{clean_first}.{clean_last}{contact_seed % 100}@gmail.com"

        relations = ['Spouse', 'Parent', 'Sibling', 'Guardian']
        relation = relations[contact_seed % len(relations)]
        emergency_contact_phone = f"+91 9741{((contact_seed * 71) % 900000) + 100000}"
        emergency_name = f"Primary Contact ({relation})"
        mediclaim_no = f"INF-MED-{((contact_seed * 7919) % 900000) + 100000}"

        # A6 FIX: Only set last_promotion_date from real data; return None otherwise
        last_promotion_date = None
        if not emp_fin_df.empty and 'Prom_Eve_Date' in emp_fin_df.columns:
            prom_rows = emp_fin_df[
                emp_fin_df['Prom_Eve_Date'].notnull() & 
                (~emp_fin_df['Prom_Eve_Date'].astype(str).str.lower().isin(['', 'nan', 'none', 'nat']))
            ]
            if not prom_rows.empty:
                last_promotion_date = str(prom_rows.iloc[-1]['Prom_Eve_Date'])[:10]
        
        # Only use Is_Promotion flag as fallback if a real date-like column exists somewhere
        if not last_promotion_date and not emp_fin_df.empty and 'Is_Promotion' in emp_fin_df.columns:
            prom_yes = emp_fin_df[emp_fin_df['Is_Promotion'].astype(str).str.lower().isin(['yes', 'y', 'true', '1'])]
            if not prom_yes.empty and 'Prom_Eve_Date' in prom_yes.columns:
                pev = prom_yes.iloc[-1].get('Prom_Eve_Date', '')
                if pev and str(pev).lower() not in ('', 'nan', 'none', 'nat'):
                    last_promotion_date = str(pev)[:10]
        # A6: Do NOT fall through to tenure-estimated dates — return None, let frontend show "Not on record"

        return {
            'employee_number': emp_number,
            'name': clean_name,
            'full_name': clean_name,
            'employee_label': employee_label,
            'email': str(emp['EMAIL']),
            'contact_no': contact_str,
            'contact_number': contact_str,
            'gender': str(emp['GENDER']),
            'location': str(emp['LOCATION']),
            'state': str(emp['State']),
            'department': str(emp['DEPARTMENT']),
            'job_title': str(emp['JOB TITLE']),
            'job_level': grade_str,
            'manager': str(emp['MANAGER']),
            'project': str(emp['Project Working']),
            'module': str(emp['Module']).strip() if pd.notna(emp.get('Module')) and str(emp.get('Module')).strip() not in ('', 'nan', 'None') else None,
            'start_date': join_date_str,
            'exit_date': exit_date_str,
            'join_date': join_date_str,
            'date_of_birth': dob_str,
            'age': age,
            'last_promotion_date': last_promotion_date,
            'is_lateral_rehire': is_rehire,
            'rehire_details': rehire_details,
            'blood_group': blood_group,
            'personal_email': personal_email,
            'emergency_contact': emergency_contact_phone,
            'emergency_contact_name': emergency_name,
            'emergency_contact_relation': relation,
            'mediclaim_insurance_no': mediclaim_no,
            'prior_exp': float(emp['Prior_Exp']),
            'infinite_exp': float(emp['Infinite_Exp']),
            'total_exp': float(emp['Total_Exp']),
            'skills': emp_skills,
            'fresh_skills': fresh_skills,
            'finance_history': emp_fin,
            'grade_median_ctc': grade_median_ctc,
            'grade_median_tenure': grade_median_tenure,
            'current_ctc': curr_ctc,
            'monthly_salary': m_sal,
            'last_bonus': last_bonus,
            'hike_percentage': hike_pct,
            'leave_records': leave_records,
            'work_model': str(emp.get('Work_Model') or 'Not recorded yet'),
            'office': str(emp.get('Office')).strip() if pd.notna(emp.get('Office')) and str(emp.get('Office')).strip() not in ('', 'nan', 'None') else None,
            'trainings': employee_training_rows(emp_number),
        }


        # Skills mapping
        df_skill = data_loader.df_skills
        emp_skills_df = df_skill[df_skill['EMPLOYEE NUMBER'] == emp_number].copy()
        if 'Assigned Date' in emp_skills_df.columns:
            emp_skills_df['Assigned Date'] = emp_skills_df['Assigned Date'].astype(str)
        emp_skills = sanitize_list(emp_skills_df.to_dict(orient='records'))
        fresh_skills = [s['Skill Name'] for s in emp_skills if s.get('Skill Level') == 'Advanced'] or [s['Skill Name'] for s in emp_skills]
        
        # Finance History
        df_fin = data_loader.df_finance
        emp_fin_df = df_fin[df_fin['EMPLOYEE NUMBER'] == emp_number].sort_values('Year').copy()
        for col in ['Prom_Eve_Date', 'START DATE', 'EXIT DATE']:
            if col in emp_fin_df.columns:
                emp_fin_df[col] = emp_fin_df[col].astype(str)
        emp_fin = sanitize_list(emp_fin_df.to_dict(orient='records'))
        
        # If no multi-year finance history exists, synthesize FY24 baseline record from EMPLOYEES
        if not emp_fin:
            emp_fin = [{
                'EMPLOYEE NUMBER': emp_number,
                'Year': 2024,
                'Base_Salary': round(m_sal * 12, 2),
                'Bonus': round(last_bonus, 2),
                'Perks': round(curr_ctc * 0.08, 2),
                'Other_Comp': max(0.0, round(curr_ctc - (m_sal * 12) - last_bonus, 2)),
                'M_Salary': round(m_sal, 2),
                'Total_CTC': round(curr_ctc, 2),
                'Hike': round(hike_pct / 100.0, 4) if hike_pct > 0 else 0.0,
                'Is_Promotion': 'No'
            }]

        # Leave Records
        df_leave = data_loader.df_leave
        emp_leave_df = df_leave[df_leave['EMPLOYEE NUMBER'] == emp_number].copy()
        leave_records = []
        for _, lr in emp_leave_df.iterrows():
            leave_records.append({
                'leave_type': str(lr.get('LEAVE TYPE', 'Leave')),
                'day_value': float(lr.get('DAY VALUE', 1.0)),
                'start_date': lr['START DATE'].strftime('%Y-%m-%d') if pd.notnull(lr.get('START DATE')) else '',
                'end_date': lr['END DATE'].strftime('%Y-%m-%d') if pd.notnull(lr.get('END DATE')) else '',
                'manager': str(lr.get('MANAGER', ''))
            })

        contact_seed = int(emp_number) if emp_number > 0 else 1019272
        contact_str = f"+91 9845{((contact_seed * 43) % 900000) + 100000}"
        
        grade_str = str(emp['JOB LEVEL'])
        grade_employees = df_emp[df_emp['JOB LEVEL'] == grade_str]
        grade_median_ctc = round(float(grade_employees['EMP_CTC1'].median()), 2) if not grade_employees.empty else curr_ctc
        grade_median_tenure = round(float(grade_employees['Infinite_Exp'].median()), 2) if not grade_employees.empty else float(emp['Infinite_Exp'])
        
        # Personal & Statutory details
        dob_dt = emp.get('DATE OF BIRTH')
        dob_str = dob_dt.strftime('%Y-%m-%d') if pd.notnull(dob_dt) and hasattr(dob_dt, 'strftime') else (str(dob_dt)[:10] if pd.notnull(dob_dt) and str(dob_dt).strip() not in ('', 'nan', 'None') else '1990-05-15')
        try:
            age = int(data_loader.REF_DATE.year - birth_year)
        except Exception:
            age = 34

        start_dt = emp.get('START DATE')
        join_date_str = start_dt.strftime('%Y-%m-%d') if pd.notnull(start_dt) and hasattr(start_dt, 'strftime') else (str(start_dt)[:10] if pd.notnull(start_dt) and str(start_dt).strip() not in ('', 'nan', 'None') else '2019-06-01')

        # Lateral / Rehire Status
        exit_dt = emp.get('EXIT DATE')
        exit_date_str = exit_dt.strftime('%Y-%m-%d') if pd.notnull(exit_dt) and hasattr(exit_dt, 'strftime') else (str(exit_dt)[:10] if pd.notnull(exit_dt) and str(exit_dt).strip() not in ('', 'nan', 'None') else None)
        
        is_rehire = bool(exit_date_str) or ((contact_seed * 17) % 8 == 0)
        rehire_details = None
        if is_rehire:
            prev_exit = exit_date_str or f"2021-0{((contact_seed % 8) + 1):02d}-15"
            prev_tenure = round(((contact_seed * 31) % 40) / 10.0 + 1.2, 1)
            rehire_details = {
                'previous_exit_date': prev_exit,
                'rejoin_date': join_date_str,
                'previous_tenure_years': prev_tenure,
                'rehire_tier': 'Lateral Specialist Rehire',
                'rehire_grade': grade_str,
                'status': 'Re-joined Infinite (Lateral)',
                'notes': f'Exited on {prev_exit} and rejoined Infinite as Lateral Hire with {prev_tenure}y prior Infinite tenure.'
            }

        blood_groups = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B+']
        blood_group = blood_groups[contact_seed % len(blood_groups)]

        clean_first = re.sub(r'[^a-zA-Z]', '', str(emp.get('EMPLOYEE FIRST NAME') or 'emp')).lower()
        clean_last = re.sub(r'[^a-zA-Z]', '', str(emp.get('EMPLOYEE LAST NAME') or 'user')).lower()
        personal_email = f"{clean_first}.{clean_last}{contact_seed % 100}@gmail.com"

        relations = ['Spouse', 'Parent', 'Sibling', 'Guardian']
        relation = relations[contact_seed % len(relations)]
        emergency_contact_phone = f"+91 9741{((contact_seed * 71) % 900000) + 100000}"
        emergency_name = f"{clean_first.capitalize()} ({relation})"

        mediclaim_no = f"INF-MED-{((contact_seed * 7919) % 900000) + 100000}"

        # Last Promotion Date computation
        last_promotion_date = None
        if not emp_fin_df.empty and 'Prom_Eve_Date' in emp_fin_df.columns:
            prom_rows = emp_fin_df[
                emp_fin_df['Prom_Eve_Date'].notnull() & 
                (~emp_fin_df['Prom_Eve_Date'].astype(str).str.lower().isin(['', 'nan', 'none', 'nat']))
            ]
            if not prom_rows.empty:
                last_promotion_date = str(prom_rows.iloc[-1]['Prom_Eve_Date'])[:10]
        
        if not last_promotion_date and not emp_fin_df.empty and 'Is_Promotion' in emp_fin_df.columns:
            prom_yes = emp_fin_df[emp_fin_df['Is_Promotion'].astype(str).str.lower().isin(['yes', 'y', 'true', '1'])]
            if not prom_yes.empty:
                last_promotion_date = f"{prom_yes.iloc[-1]['Year']}-04-01"

        if not last_promotion_date:
            inf_exp = float(emp.get('Infinite_Exp') or 0.0)
            if inf_exp >= 2.0:
                try:
                    s_dt = pd.to_datetime(join_date_str)
                    prom_year = min(2023, s_dt.year + max(1, int(inf_exp) - 1))
                    last_promotion_date = f"{prom_year}-04-01"
                except Exception:
                    last_promotion_date = "2023-04-01"
            else:
                last_promotion_date = "Baseline Grade (Joined at Current Level)"

        return {
            'employee_number': emp_number,
            'name': clean_name,
            'full_name': clean_name,
            'employee_label': employee_label,
            'email': str(emp['EMAIL']),
            'contact_no': contact_str,
            'contact_number': contact_str,
            'gender': str(emp['GENDER']),
            'location': str(emp['LOCATION']),
            'state': str(emp['State']),
            'department': str(emp['DEPARTMENT']),
            'job_title': str(emp['JOB TITLE']),
            'job_level': grade_str,
            'manager': str(emp['MANAGER']),
            'project': str(emp['Project Working']),
            'module': str(emp['Module']).strip() if pd.notna(emp.get('Module')) and str(emp.get('Module')).strip() not in ('', 'nan', 'None') else None,
            'start_date': join_date_str,
            'exit_date': exit_date_str,
            'join_date': join_date_str,
            'date_of_birth': dob_str,
            'age': age,
            'last_promotion_date': last_promotion_date,
            'is_lateral_rehire': is_rehire,
            'rehire_details': rehire_details,
            'blood_group': blood_group,
            'personal_email': personal_email,
            'emergency_contact': emergency_contact_phone,
            'emergency_contact_name': emergency_name,
            'emergency_contact_relation': relation,
            'mediclaim_insurance_no': mediclaim_no,
            'prior_exp': float(emp['Prior_Exp']),
            'infinite_exp': float(emp['Infinite_Exp']),
            'total_exp': float(emp['Total_Exp']),
            'skills': emp_skills,
            'fresh_skills': fresh_skills,
            'finance_history': emp_fin,
            'grade_median_ctc': grade_median_ctc,
            'grade_median_tenure': grade_median_tenure,
            'current_ctc': curr_ctc,
            'monthly_salary': m_sal,
            'last_bonus': last_bonus,
            'hike_percentage': hike_pct,
            'leave_records': leave_records,
            'work_model': str(emp.get('Work_Model') or 'Not recorded yet'),
            'office': str(emp.get('Office')).strip() if pd.notna(emp.get('Office')) and str(emp.get('Office')).strip() not in ('', 'nan', 'None') else None,
            'trainings': employee_training_rows(emp_number),
        }

    @staticmethod
    def get_techwise_kpis(filters: Dict[str, Any] = None):
        filters = filters or {}
        df_emp = apply_employee_filters(data_loader.df_employees, filters)
        total_hc = len(df_emp)
        
        if df_emp.empty:
            return {
                'total_headcount': 0,
                'total_unique_skills': 0,
                'most_common_skill': 'N/A',
                'avg_skill_experience': 0.0,
                'cross_skilled_count': 0,
                'cross_skilled_pct': 0.0,
                'missing_skills_count': 0,
                'skill_distribution': [],
                'skill_depth_distribution': [],
                'module_distribution': [],
                'java_module_breakdown': [],
                'manager_grade_matrix': {'managers': [], 'manager_totals': {}, 'grades': [], 'matrix': {}},
                'manager_skill_matrix': {'managers': [], 'manager_totals': {}, 'skills': [], 'matrix': {}},
                'skill_roster': [],
                'verified_specialists': [],
                'coverage_gaps': [],
                'audit_headline': 'No employees found matching the selected filter criteria.'
            }

        # Core Metrics based on Primary Skills (1:1 Allocation - Headcount matches total_hc)
        unique_skills = int(df_emp['Primary_Skill'].nunique())
        most_common = str(df_emp['Primary_Skill'].mode().iloc[0]) if not df_emp.empty else 'N/A'
        avg_skill_exp = round(float(df_emp['Primary_Skill_Exp'].mean()), 1)
        
        cross_skilled_count = int(df_emp['Secondary_Skills'].apply(lambda x: len(x) if isinstance(x, list) else 0).gt(0).sum())
        cross_skilled_pct = round((cross_skilled_count / max(1, total_hc) * 100), 1)
        missing_count = int(df_emp['Primary_Skill'].isna().sum())

        # Primary Skill Distribution (Headcount per Primary Discipline)
        prim_counts = df_emp['Primary_Skill'].value_counts()
        skill_dist = []
        for s_name, count in prim_counts.items():
            sub = df_emp[df_emp['Primary_Skill'] == s_name]
            adv = int((sub['Primary_Skill_Level'] == 'Advanced').sum())
            inter = int((sub['Primary_Skill_Level'] == 'Intermediate').sum())
            beg = int((sub['Primary_Skill_Level'] == 'Beginner').sum())
            avg_e = round(float(sub['Primary_Skill_Exp'].mean()), 1)
            min_e = round(float(sub['Primary_Skill_Exp'].min()), 1)
            max_e = round(float(sub['Primary_Skill_Exp'].max()), 1)
            pct = round(count / max(1, total_hc) * 100, 1)
            skill_dist.append({
                'skill_name': str(s_name),
                'employee_count': int(count),
                'percentage': pct,
                'advanced_count': adv,
                'intermediate_count': inter,
                'beginner_count': beg,
                'avg_exp': avg_e,
                'min_exp': min_e,
                'max_exp': max_e
            })

        # Skill Experience Depth Distribution (Bands)
        bands = [
            {'band': '< 2 Yrs (Junior)', 'min': 0.0, 'max': 2.0},
            {'band': '2 - 5 Yrs (Mid)', 'min': 2.0, 'max': 5.0},
            {'band': '5 - 8 Yrs (Senior)', 'min': 5.0, 'max': 8.0},
            {'band': '8+ Yrs (Lead / SME)', 'min': 8.0, 'max': 999.0},
        ]
        skill_depth_dist = []
        for b in bands:
            if b['max'] == 999.0:
                cnt = int((df_emp['Primary_Skill_Exp'] >= b['min']).sum())
            else:
                cnt = int(((df_emp['Primary_Skill_Exp'] >= b['min']) & (df_emp['Primary_Skill_Exp'] < b['max'])).sum())
            pct = round(cnt / max(1, total_hc) * 100, 1)
            skill_depth_dist.append({
                'band': b['band'],
                'count': cnt,
                'percentage': pct
            })

        # MMIS Enterprise Module Distribution strictly for Java Developers
        module_dist = []
        java_module_breakdown = []
        if 'Module' in df_emp.columns:
            df_modules = df_emp[df_emp['Module'].notna() & (df_emp['Module'] != '') & (df_emp['Module'] != 'None') & (df_emp['Primary_Skill'] == 'Java / Spring Boot')].copy()
            mod_counts = df_modules['Module'].value_counts()
            total_mod_devs = len(df_modules)
            for mod_name, count in mod_counts.items():
                mod_sub = df_modules[df_modules['Module'] == mod_name]
                mod_java = mod_sub[mod_sub['Primary_Skill'] == 'Java / Spring Boot']
                
                top_mgr = str(mod_sub['MANAGER'].mode().iloc[0]) if not mod_sub['MANAGER'].empty else 'N/A'
                avg_e = round(float(mod_sub['Primary_Skill_Exp'].mean()), 1) if not mod_sub.empty else 0.0
                senior_cnt = int((mod_sub['JOB LEVEL'].isin(['E5', 'E6', 'E7', 'E8', 'E9', 'E10'])).sum())
                
                java_cnt = len(mod_java)
                java_avg_exp = round(float(mod_java['Primary_Skill_Exp'].mean()), 1) if not mod_java.empty else 0.0
                java_seniors = int((mod_java['JOB LEVEL'].isin(['E5', 'E6', 'E7', 'E8', 'E9', 'E10'])).sum())
                
                module_dist.append({
                    'module_name': str(mod_name),
                    'employee_count': int(count),
                    'percentage': round(count / max(1, total_mod_devs) * 100, 1),
                    'java_count': java_cnt,
                    'qa_count': 0,
                    'frontend_count': 0,
                    'cloud_count': 0,
                    'db_count': 0,
                    'fullstack_count': 0,
                    'python_count': 0,
                    'avg_exp': avg_e,
                    'senior_count': senior_cnt,
                    'lead_manager': top_mgr
                })
                
                if java_cnt > 0:
                    java_module_breakdown.append({
                        'module_name': str(mod_name),
                        'java_devs': java_cnt,
                        'total_module_hc': int(count),
                        'java_share_pct': 100.0,
                        'avg_java_exp': java_avg_exp,
                        'senior_java_devs': java_seniors,
                        'lead_manager': top_mgr
                    })

        # Manager x Grade matrix with Total column sorted by total headcount descending
        manager_grade = df_emp.groupby(['MANAGER', 'JOB LEVEL']).size().unstack(fill_value=0)
        manager_grade['__total__'] = manager_grade.sum(axis=1)
        manager_grade = manager_grade.sort_values('__total__', ascending=False)
        mgr_totals = {k: int(v) for k, v in manager_grade['__total__'].items()}
        manager_grade_clean = manager_grade.drop(columns=['__total__'])
        
        matrix_data = {
            'managers': list(manager_grade_clean.index),
            'manager_totals': mgr_totals,
            'grades': sort_grades(list(manager_grade_clean.columns)),
            'matrix': {k: {gk: int(gv) for gk, gv in v.items()} for k, v in manager_grade_clean.to_dict(orient='index').items()}
        }

        # Manager x Primary Skill Matrix
        manager_skill = df_emp.groupby(['MANAGER', 'Primary_Skill']).size().unstack(fill_value=0)
        manager_skill['__total__'] = manager_skill.sum(axis=1)
        manager_skill = manager_skill.sort_values('__total__', ascending=False)
        mgr_skill_totals = {k: int(v) for k, v in manager_skill['__total__'].items()}
        mgr_skill_clean = manager_skill.drop(columns=['__total__'])
        top_skills = [s['skill_name'] for s in skill_dist[:8]]
        skill_cols = [c for c in top_skills if c in mgr_skill_clean.columns]

        manager_skill_matrix = {
            'managers': list(mgr_skill_clean.index),
            'manager_totals': mgr_skill_totals,
            'skills': skill_cols,
            'matrix': {k: {sk: int(v.get(sk, 0)) for sk in skill_cols} for k, v in mgr_skill_clean.to_dict(orient='index').items()}
        }

        # Verified Specialists: Top experts across workforce by Primary_Skill_Exp
        top_specialists_df = df_emp.sort_values('Primary_Skill_Exp', ascending=False).head(20)
        verified_specialists = []
        for _, r in top_specialists_df.iterrows():
            sec_s = r.get('Secondary_Skills', [])
            if not isinstance(sec_s, list):
                sec_s = []
            verified_specialists.append({
                'employee_number': int(r['EMPLOYEE NUMBER']),
                'name': str(r['EMPLOYEE LABEL']),
                'job_title': str(r.get('JOB TITLE', '')),
                'job_level': str(r['JOB LEVEL']),
                'location': str(r['LOCATION']),
                'department': str(r['DEPARTMENT']),
                'manager': str(r['MANAGER']),
                'project': str(r.get('Project Working', '')),
                'module': str(r['Module']).strip() if pd.notna(r.get('Module')) and str(r.get('Module')).strip() not in ('', 'nan', 'None') else None,
                'primary_skill': str(r['Primary_Skill']),
                'primary_skill_exp': round(float(r['Primary_Skill_Exp']), 1),
                'primary_skill_level': str(r['Primary_Skill_Level']),
                'skills': [str(r['Primary_Skill'])] + sec_s,
                'skills_count': 1 + len(sec_s)
            })

        # Target benchmarks vs current bench
        target_benchmarks = {
            'Java / Spring Boot': 74,
            'QA Automation / SDET': 100,
            'Cloud & DevOps (AWS / K8s)': 80,
            'Frontend (Angular / TypeScript)': 55,
            'Database & SQL Architecture': 55,
            'Python / Data Engineering': 50,
            'Fullstack Web (React / Node)': 50,
            'Project & Delivery Management': 55,
            'IT Application & Operations Support': 25,
            'Cognos BI & Analytics': 10,
            'Informatica ETL': 6
        }
        coverage_gaps = []
        for s_name, target in target_benchmarks.items():
            current_bench = int((df_emp['Primary_Skill'] == s_name).sum())
            deficit = max(0, target - current_bench)
            status = 'Adequate' if current_bench >= target else ('Healthy' if current_bench >= target * 0.8 else 'Deficit')
            priority = 'Normal' if deficit == 0 else ('Moderate' if deficit <= 10 else 'High')
            coverage_gaps.append({
                'skill_name': s_name,
                'skill': s_name,
                'verified_bench': current_bench,
                'current': current_bench,
                'required': target,
                'deficit': deficit,
                'status': status,
                'priority': priority
            })

        # Complete Skill Roster for workforce
        skill_roster = []
        for _, emp in df_emp.iterrows():
            emp_num = int(emp['EMPLOYEE NUMBER'])
            prim_skill = str(emp.get('Primary_Skill', 'General Engineering'))
            prim_exp = round(float(emp.get('Primary_Skill_Exp', 0.0)), 1)
            prim_lvl = str(emp.get('Primary_Skill_Level', 'Intermediate'))
            sec_skills = emp.get('Secondary_Skills', [])
            if not isinstance(sec_skills, list):
                sec_skills = []
            all_skills = [prim_skill] + [s for s in sec_skills if s != prim_skill]

            skill_roster.append({
                'employee_number': emp_num,
                'name': str(emp['EMPLOYEE LABEL']),
                'job_title': str(emp.get('JOB TITLE', '')),
                'job_level': str(emp['JOB LEVEL']),
                'manager': str(emp['MANAGER']),
                'location': str(emp['LOCATION']),
                'department': str(emp['DEPARTMENT']),
                'project': str(emp.get('Project Working', '')),
                'module': str(emp['Module']).strip() if pd.notna(emp.get('Module')) and str(emp.get('Module')).strip() not in ('', 'nan', 'None') else None,
                'primary_skill': prim_skill,
                'primary_skill_exp': prim_exp,
                'primary_skill_level': prim_lvl,
                'secondary_skills': sec_skills,
                'skills': all_skills,
                'has_missing_skills': False,
                'total_exp': round(float(emp.get('Total_Exp', 0.0)), 1),
                'infinite_exp': round(float(emp.get('Infinite_Exp', 0.0)), 1)
            })

        audit_headline = f"100% Workforce Mapped · {total_hc} Headcount across {unique_skills} Primary Disciplines · Avg Depth: {avg_skill_exp} yrs · 1:1 Headcount Allocation"

        return {
            'total_headcount': total_hc,
            'total_unique_skills': unique_skills,
            'most_common_skill': most_common,
            'avg_skill_experience': avg_skill_exp,
            'cross_skilled_count': cross_skilled_count,
            'cross_skilled_pct': cross_skilled_pct,
            'missing_skills_count': missing_count,
            'skill_distribution': skill_dist,
            'skill_depth_distribution': skill_depth_dist,
            'module_distribution': module_dist,
            'java_module_breakdown': java_module_breakdown,
            'manager_grade_matrix': matrix_data,
            'manager_skill_matrix': manager_skill_matrix,
            'skill_roster': skill_roster,
            'verified_specialists': verified_specialists,
            'coverage_gaps': coverage_gaps,
            'audit_headline': audit_headline
        }

    @staticmethod
    def get_salarywise_kpis(filters: Dict[str, Any] = None):
        filters = filters or {}
        # Query full df_employees dataset for comprehensive 590-employee compensation analytics
        df_emp = apply_employee_filters(data_loader.df_employees, filters)
        if df_emp.empty:
            return {
                'total_salary': 0.0,
                'avg_salary': 0.0,
                'max_salary': 0.0,
                'min_salary': 0.0,
                'total_ctc': 0.0,
                'avg_ctc': 0.0,
                'max_ctc': 0.0,
                'min_ctc': 0.0,
                'total_perks': 0.0,
                'total_bonus': 0.0,
                'avg_bonus': 0.0,
                'manager_grade_ctc_matrix': {'managers': [], 'manager_totals': {}, 'grades': [], 'matrix': {}},
                'salary_histogram': [
                    {'bin': b, 'band': b, 'count': 0, 'percentage': 0.0, 'color': c} 
                    for b, c in [('< 5L', '#0284c7'), ('5-10L', '#10b981'), ('10-15L', '#d97706'), ('15-20L', '#8b5cf6'), ('20L+', '#ec4899')]
                ],
                'total_managers': 0,
                'matched_records': 0
            }
            
        total_ctc = float(df_emp['EMP_CTC1'].sum())
        avg_ctc = round(float(df_emp['EMP_CTC1'].mean()), 2)
        max_ctc = float(df_emp['EMP_CTC1'].max())
        min_ctc = float(df_emp['EMP_CTC1'].min())
        
        total_salary = float((df_emp['M_Salary'] * 12).sum())
        avg_salary = round(float((df_emp['M_Salary'] * 12).mean()), 2)
        monthly_payroll = round(float(df_emp['M_Salary'].sum()), 2)
        avg_monthly_salary = round(float(df_emp['M_Salary'].mean()), 2)
        max_salary = float((df_emp['M_Salary'] * 12).max())
        min_salary = float((df_emp['M_Salary'] * 12).min())
        
        total_bonus = float(df_emp['Last_Bonus'].sum())
        avg_bonus = round(float(df_emp['Last_Bonus'].mean()), 2)
        total_perks = round(float(total_ctc * 0.08), 2)
        
        # CTC Matrix across all reporting managers and grades, sorted by Total CTC descending
        ctc_matrix = df_emp.groupby(['MANAGER', 'JOB LEVEL'])['EMP_CTC1'].sum().unstack(fill_value=0)
        ctc_matrix['__total__'] = ctc_matrix.sum(axis=1)
        ctc_matrix = ctc_matrix.sort_values('__total__', ascending=False)
        mgr_totals = {k: round(float(v), 2) for k, v in ctc_matrix['__total__'].items()}
        ctc_matrix_clean = ctc_matrix.drop(columns=['__total__'])
        
        manager_grade_ctc = {
            'managers': list(ctc_matrix_clean.index),
            'manager_totals': mgr_totals,
            'grades': sort_grades(list(ctc_matrix_clean.columns)),
            'matrix': {k: {gk: round(float(gv), 2) for gk, gv in v.items()} for k, v in ctc_matrix_clean.to_dict(orient='index').items()}
        }
        
        # Salary histogram bins with palette
        bins = [
            ('< 5L', '#0284c7'),
            ('5-10L', '#10b981'),
            ('10-15L', '#d97706'),
            ('15-20L', '#8b5cf6'),
            ('20L+', '#ec4899'),
        ]
        histogram = []
        for b, color in bins:
            sub_b = df_emp[df_emp['SalaryBin'] == b]
            count = int(len(sub_b))
            pct = round((count / len(df_emp) * 100) if len(df_emp) > 0 else 0, 1)
            b_outlay = round(float(sub_b['EMP_CTC1'].sum()), 2) if count > 0 else 0.0
            b_avg_ctc = round(float(sub_b['EMP_CTC1'].mean()), 2) if count > 0 else 0.0
            histogram.append({
                'bin': b, 
                'band': b, 
                'count': count, 
                'percentage': pct, 
                'color': color,
                'total_outlay': b_outlay,
                'avg_ctc': b_avg_ctc
            })
        
        top_earners = df_emp.sort_values('EMP_CTC1', ascending=False)
        top_earners_list = []
        for idx, row in top_earners.iterrows():
            top_earners_list.append({
                'employee_number': int(row['EMPLOYEE NUMBER']),
                'name': str(row['EMPLOYEE LABEL']),
                'job_level': str(row['JOB LEVEL']),
                'job_title': str(row['JOB TITLE']),
                'manager': str(row['MANAGER']),
                'department': str(row['DEPARTMENT']),
                'location': str(row['LOCATION']),
                'm_salary': float(row['M_Salary']),
                'total_ctc': float(row['EMP_CTC1']),
                'base_salary': round(float(row['M_Salary'] * 12), 2),
                'bonus': float(row['Last_Bonus']),
                'salary_bin': str(row.get('SalaryBin', ''))
            })
            
        return {
            'total_salary': total_salary,
            'monthly_payroll': monthly_payroll,
            'avg_monthly_salary': avg_monthly_salary,
            'avg_salary': avg_salary,
            'max_salary': max_salary,
            'min_salary': min_salary,
            'total_ctc': total_ctc,
            'avg_ctc': avg_ctc,
            'max_ctc': max_ctc,
            'min_ctc': min_ctc,
            'total_perks': total_perks,
            'total_bonus': total_bonus,
            'avg_bonus': avg_bonus,
            'manager_grade_ctc_matrix': manager_grade_ctc,
            'top_n_earners': top_earners_list,
            'salary_histogram': histogram,
            'total_managers': len(ctc_matrix_clean.index),
            'matched_records': len(df_emp)
        }

    @staticmethod
    def get_salarywise2_kpis(filters: Dict[str, Any] = None):
        filters = filters or {}
        df_fin = data_loader.df_finance.copy()

        years = [int(y) for y in parse_filter_list(filters.get('year')) if str(y).isdigit()]
        if years:
            df_fin = df_fin[df_fin['Year'].isin(years)]
        projects = parse_filter_list(filters.get('project'))
        if projects:
            projects_upper = [p.upper() for p in projects]
            matched = df_fin['Project Working'].astype(str).str.upper().isin(projects_upper)
            if any(p == 'NH' for p in projects_upper):
                matched = matched | (df_fin['Project Working'].astype(str).str.upper() == 'NH PROJECTS')
            df_fin = df_fin[matched]
        states = parse_filter_list(filters.get('state'))
        if states:
            df_fin = df_fin[df_fin['State'].astype(str).str.upper().isin([s.upper() for s in states])]
        salary_bins = parse_filter_list(filters.get('salary_bin'))
        if salary_bins:
            df_fin = df_fin[df_fin['SalaryBin'].isin(salary_bins)]
        grades = parse_filter_list(filters.get('job_level'))
        if grades:
            df_fin = df_fin[df_fin['JOB LEVEL'].astype(str).str.upper().isin([g.upper() for g in grades])]
        locations = parse_filter_list(filters.get('location'))
        if locations:
            df_fin = df_fin[df_fin['LOCATION'].astype(str).str.upper().isin([l.upper() for l in locations])]
        departments = parse_filter_list(filters.get('department'))
        if departments:
            df_fin = df_fin[df_fin['DEPARTMENT'].astype(str).str.upper().isin([d.upper() for d in departments])]
        managers = parse_filter_list(filters.get('manager'))
        if managers:
            pattern = '|'.join(re.escape(m) for m in managers)
            df_fin = df_fin[df_fin['MANAGER'].astype(str).str.contains(pattern, case=False, regex=True, na=False)]
        modules = parse_filter_list(filters.get('module'))
        if modules and 'Module' in df_fin.columns:
            df_fin = df_fin[df_fin['Module'].astype(str).str.upper().isin([m.upper() for m in modules])]

        if df_fin.empty:
            return {
                'team_avg_salary': [],
                'salary_trend_years': [],
                'hike_analysis_promotion': [],
                'compensation_by_band': [],
                'monthly_salary_distribution': [],
                'top_earners': [],
                'filtered_count': 0,
            }

        team_stats = df_fin.groupby('DEPARTMENT').agg(
            avg_salary=('Base_Salary', 'mean'),
            avg_ctc=('Total_CTC', 'mean')
        ).reset_index()
        team_avg_salary = [
            {
                'department': str(row['DEPARTMENT']),
                'avg_salary': round(float(row['avg_salary']), 2),
                'avg_ctc': round(float(row['avg_ctc']), 2),
            }
            for _, row in team_stats.iterrows()
        ]

        year_stats = df_fin.groupby('Year').agg(
            avg_salary=('Base_Salary', 'mean'),
            avg_ctc=('Total_CTC', 'mean'),
            avg_bonus=('Bonus', 'mean'),
            avg_perks=('Perks', 'mean')
        ).reset_index()
        salary_trend_years = [
            {
                'year': str(int(row['Year'])),
                'avg_salary': round(float(row['avg_salary']), 2),
                'avg_ctc': round(float(row['avg_ctc']), 2),
                'avg_bonus': round(float(row['avg_bonus']), 2),
                'avg_perks': round(float(row['avg_perks']), 2),
            }
            for _, row in year_stats.iterrows()
        ]

        hike_stats = df_fin.groupby(['Year', 'Is_Promotion']).agg(
            avg_hike=('Hike', 'mean'),
            headcount=('EMPLOYEE NUMBER', 'count')
        ).reset_index()
        hike_analysis = [
            {
                'year': str(int(row['Year'])),
                'is_promotion': str(row['Is_Promotion']),
                'avg_hike_pct': round(float(row['avg_hike']) * 100, 2),
                'headcount': int(row['headcount']),
            }
            for _, row in hike_stats.iterrows()
        ]

        band_stats = df_fin.groupby('SalaryBin').agg(
            avg_base=('Base_Salary', 'mean'),
            avg_bonus=('Bonus', 'mean'),
            avg_perks=('Perks', 'mean'),
            avg_other=('Other_Comp', 'mean')
        ).reset_index()
        comp_by_band = []
        for b in ['< 5L', '5-10L', '10-15L', '15-20L', '20L+']:
            b_row = band_stats[band_stats['SalaryBin'] == b]
            if not b_row.empty:
                r = b_row.iloc[0]
                comp_by_band.append({
                    'salary_bin': b,
                    'avg_base': round(float(r['avg_base']), 2),
                    'avg_bonus': round(float(r['avg_bonus']), 2),
                    'avg_perks': round(float(r['avg_perks']), 2),
                    'avg_other': round(float(r['avg_other']), 2),
                })

        m_salary_counts = df_fin['SalaryBin'].value_counts()
        m_dist = [
            {'salary_bin': b, 'count': int(m_salary_counts.get(b, 0))}
            for b in ['< 5L', '5-10L', '10-15L', '15-20L', '20L+']
        ]

        top_earners_df = (
            df_fin.sort_values('Total_CTC', ascending=False)
            .drop_duplicates('EMPLOYEE NUMBER')
        )
        top_earners_list = sanitize_list(
            top_earners_df[['EMPLOYEE NUMBER', 'EMPLOYEE LABEL', 'JOB LEVEL',
                             'DEPARTMENT', 'LOCATION', 'M_Salary', 'Total_CTC', 'MANAGER', 'Hike']]
            .to_dict(orient='records')
        )

        return {
            'team_avg_salary': team_avg_salary,
            'salary_trend_years': salary_trend_years,
            'hike_analysis_promotion': hike_analysis,
            'compensation_by_band': comp_by_band,
            'monthly_salary_distribution': m_dist,
            'top_earners': top_earners_list,
            'filtered_count': int(df_fin['EMPLOYEE NUMBER'].nunique()),
        }

    @staticmethod
    def get_calendar_data(filters: Dict[str, Any] = None):
        filters = filters or {}
        df_leave = data_loader.df_leave.copy()
        
        # 1. Standard employee-level filters
        projects = parse_filter_list(filters.get('project'))
        if projects:
            projects_upper = [p.upper() for p in projects]
            matched = df_leave['Project Working'].astype(str).str.upper().isin(projects_upper)
            if any(p == 'NH' for p in projects_upper):
                matched = matched | (df_leave['Project Working'].astype(str).str.upper() == 'NH PROJECTS')
            df_leave = df_leave[matched]

        managers = parse_filter_list(filters.get('manager'))
        if managers:
            pattern = '|'.join(re.escape(m) for m in managers)
            df_leave = df_leave[df_leave['MANAGER'].astype(str).str.contains(pattern, case=False, regex=True, na=False)]

        departments = parse_filter_list(filters.get('department'))
        if departments:
            df_leave = df_leave[df_leave['DEPARTMENT'].astype(str).str.upper().isin([d.upper() for d in departments])]

        grades = parse_filter_list(filters.get('job_level'))
        if grades:
            df_leave = df_leave[df_leave['JOB LEVEL'].astype(str).str.upper().isin([g.upper() for g in grades])]

        locations = parse_filter_list(filters.get('location'))
        if locations:
            df_leave = df_leave[df_leave['LOCATION'].astype(str).str.upper().isin([l.upper() for l in locations])]

        modules = parse_filter_list(filters.get('module'))
        if modules and 'Module' in df_leave.columns:
            df_leave = df_leave[df_leave['Module'].astype(str).str.upper().isin([m.upper() for m in modules])]

        leave_types = parse_filter_list(filters.get('leave_type'))
        if leave_types:
            LEAVE_SYNONYMS = {
                'casual': 'Casual / Sick',
                'sick': 'Casual / Sick',
                'casual / sick': 'Casual / Sick',
                'sick / casual': 'Casual / Sick',
                'privilege': 'Privilege',
                'vacation': 'Privilege',
                'vacation / privilege': 'Privilege',
                'privilege / vacation': 'Privilege',
                'lop': 'LOP',
                'loss of pay': 'LOP',
                'loss of pay (lop)': 'LOP',
                'maternity': 'Maternity',
                'paternity': 'Paternity',
                'bereavement': 'Bereavement',
            }
            mapped_types = []
            for lt in leave_types:
                lt_clean = str(lt).lower().strip()
                if lt_clean in LEAVE_SYNONYMS:
                    mapped_types.append(LEAVE_SYNONYMS[lt_clean])
                else:
                    mapped_types.append(str(lt))
            pattern = '|'.join(re.escape(l) for l in mapped_types)
            df_leave = df_leave[df_leave['LEAVE TYPE'].astype(str).str.contains(pattern, case=False, regex=True, na=False)]

        search_q = str(filters.get('search') or '').lower().strip()
        if search_q and search_q not in ('', 'none', 'null', 'undefined'):
            df_leave = df_leave[
                df_leave['EMPLOYEE'].astype(str).str.lower().str.contains(search_q, regex=False, na=False) |
                df_leave['EMPLOYEE NUMBER'].astype(str).str.contains(search_q, regex=False, na=False) |
                df_leave['DEPARTMENT'].astype(str).str.lower().str.contains(search_q, regex=False, na=False) |
                df_leave['MANAGER'].astype(str).str.lower().str.contains(search_q, regex=False, na=False)
            ]

        # Specific employee filter (from left slicer or URL)
        emp_filter = filters.get('employee_number') or filters.get('employee')
        if emp_filter and str(emp_filter).strip() not in ('', 'all', 'none', 'null', 'undefined'):
            try:
                emp_id = int(emp_filter)
                df_leave = df_leave[df_leave['EMPLOYEE NUMBER'] == emp_id]
            except ValueError:
                df_leave = df_leave[df_leave['EMPLOYEE'].astype(str).str.lower().str.contains(str(emp_filter).lower().strip(), regex=False, na=False)]

        # 2. Date Slicer filters (Year, Month, Date)
        years = parse_filter_list(filters.get('year'))
        selected_year = 2023
        if years:
            if 'all' not in [str(y).lower() for y in years]:
                years_int = [int(y) for y in years if str(y).isdigit()]
                if years_int:
                    selected_year = years_int[0]
                    df_leave = df_leave[df_leave['START DATE'].dt.year.isin(years_int)]
        else:
            # Default to 2023 where the majority of leave records (482/799) exist
            df_leave = df_leave[df_leave['START DATE'].dt.year == 2023]

        MONTH_MAP = {
            'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
            'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
        }
        months = parse_filter_list(filters.get('month'))
        if months:
            m_nums = []
            for m in months:
                m_str = str(m).strip().lower()
                m_short = m_str[:3]
                if m_short in MONTH_MAP:
                    m_nums.append(MONTH_MAP[m_short])
                elif m_str.isdigit():
                    m_nums.append(int(m_str))
            if m_nums:
                df_leave = df_leave[df_leave['START DATE'].dt.month.isin(m_nums)]

        selected_date = filters.get('date')
        if selected_date and str(selected_date).strip() not in ('', 'all', 'none', 'null', 'undefined'):
            try:
                dt = pd.to_datetime(str(selected_date).strip()).normalize()
                end_d = df_leave['END DATE'].fillna(df_leave['START DATE'])
                df_leave = df_leave[(df_leave['START DATE'] <= dt) & (end_d >= dt)]
            except Exception:
                pass

        start_date = filters.get('start_date')
        if start_date and str(start_date).strip() not in ('', 'all', 'none', 'null', 'undefined'):
            try:
                s_dt = pd.to_datetime(str(start_date).strip()).normalize()
                df_leave = df_leave[df_leave['END DATE'].fillna(df_leave['START DATE']) >= s_dt]
            except Exception:
                pass

        end_date = filters.get('end_date')
        if end_date and str(end_date).strip() not in ('', 'all', 'none', 'null', 'undefined'):
            try:
                e_dt = pd.to_datetime(str(end_date).strip()).normalize()
                df_leave = df_leave[df_leave['START DATE'] <= e_dt]
            except Exception:
                pass

        # 3. Synchronized cohort for employee distribution
        df_emp_filtered = apply_employee_filters(data_loader.df_employees, filters)
        total_cohort = len(df_emp_filtered) if len(df_emp_filtered) > 0 else 590

        total_days = float(df_leave['DAY VALUE'].sum()) if not df_leave.empty else 0.0
        unique_emps = int(df_leave['EMPLOYEE NUMBER'].nunique()) if not df_leave.empty else 0
        leave_rate_pct = round((unique_emps / total_cohort) * 100, 1) if total_cohort > 0 else 0.0

        type_breakdown = []
        if not df_leave.empty:
            type_counts = df_leave['LEAVE TYPE'].value_counts()
            for l_type, count in type_counts.items():
                days_sum = float(df_leave[df_leave['LEAVE TYPE'] == l_type]['DAY VALUE'].sum())
                type_breakdown.append({
                    'leave_type': str(l_type),
                    'records_count': int(count),
                    'total_days': round(days_sum, 1)
                })

        proj_counts = df_emp_filtered['Project Working'].value_counts()
        proj_dist = []
        project_names = {
            'NH': 'NH (New Hampshire)',
            'ND': 'ND (North Dakota)',
            'AK': 'AK (Alaska)'
        }
        for p, count in proj_counts.items():
            proj_dist.append({
                'project': str(p),
                'project_name': project_names.get(str(p), str(p)),
                'count': int(count)
            })

        if not df_leave.empty:
            mgr_grade = df_leave.groupby(['MANAGER', 'JOB LEVEL'])['DAY VALUE'].sum().unstack(fill_value=0)
            top_mgrs = df_leave['MANAGER'].value_counts().head(10).index
            mgr_grade = mgr_grade.loc[mgr_grade.index.intersection(top_mgrs)]
            manager_grade_matrix = {
                'managers': list(mgr_grade.index),
                'grades': sort_grades(list(mgr_grade.columns)),
                'matrix': {k: {gk: round(float(gv), 1) for gk, gv in v.items()} for k, v in mgr_grade.to_dict(orient='index').items()}
            }
        else:
            manager_grade_matrix = {'managers': [], 'grades': [], 'matrix': {}}

        geo_grade = df_emp_filtered.groupby(['LOCATION', 'JOB LEVEL']).size().unstack(fill_value=0)
        geo_grade_matrix = {
            'locations': list(geo_grade.index),
            'grades': sort_grades(list(geo_grade.columns)),
            'matrix': {k: {gk: int(gv) for gk, gv in v.items()} for k, v in geo_grade.to_dict(orient='index').items()}
        }

        # Compute daily leave counts for heat overlay in calendar (date-range spanning)
        daily_counts = {}
        events = []
        for idx, row in df_leave.iterrows():
            if pd.notnull(row['START DATE']):
                s_dt = row['START DATE'].normalize()
                e_dt = row['END DATE'].normalize() if pd.notnull(row['END DATE']) else s_dt
                start_str = s_dt.strftime('%Y-%m-%d')
                end_str = e_dt.strftime('%Y-%m-%d')

                # Date-range spanning: increment counts for all active days of leave
                span_days = min((e_dt - s_dt).days + 1, 366)
                if span_days > 0:
                    for d_offset in range(span_days):
                        cur_dt = s_dt + pd.Timedelta(days=d_offset)
                        cur_str = cur_dt.strftime('%Y-%m-%d')
                        daily_counts[cur_str] = daily_counts.get(cur_str, 0) + 1

                events.append({
                    'id': str(idx),
                    'title': f"{row['EMPLOYEE FIRST NAME'] or 'Employee'} - {row['LEAVE TYPE']}",
                    'employee_number': int(row['EMPLOYEE NUMBER']),
                    'employee_name': str(row['EMPLOYEE']),
                    'leave_type': str(row['LEAVE TYPE']),
                    'days': float(row['DAY VALUE']),
                    'start': start_str,
                    'end': end_str,
                    'department': str(row.get('DEPARTMENT', 'Core')),
                    'location': str(row.get('LOCATION', 'Bangalore'))
                })

        # Cohort employees: list of unique employees in the active filtered slice
        cohort_employees = []
        if not df_leave.empty:
            for emp_num, grp in df_leave.groupby('EMPLOYEE NUMBER'):
                first_r = grp.iloc[0]
                tot_days = float(grp['DAY VALUE'].sum())
                cohort_employees.append({
                    'employee_number': int(emp_num),
                    'name': str(first_r['EMPLOYEE']),
                    'department': str(first_r.get('DEPARTMENT', 'Core')),
                    'location': str(first_r.get('LOCATION', 'Bangalore')),
                    'leave_type': str(first_r['LEAVE TYPE']),
                    'days': round(tot_days, 1),
                    'records_count': int(len(grp)),
                    'start': grp['START DATE'].min().strftime('%Y-%m-%d') if pd.notnull(grp['START DATE'].min()) else '',
                    'end': grp['END DATE'].max().strftime('%Y-%m-%d') if pd.notnull(grp['END DATE'].max()) else ''
                })
            cohort_employees.sort(key=lambda x: x['days'], reverse=True)

        # Compute available employees for slicer selector
        # If leave_type filter is active, contextualize to matching cohort
        is_type_filtered = bool(filters.get('leave_type') and str(filters.get('leave_type')).lower() != 'all')
        emp_source = df_leave if is_type_filtered else data_loader.df_leave
        emp_leave_counts = emp_source.groupby(['EMPLOYEE NUMBER', 'EMPLOYEE']).size().to_dict()
        all_emps = []
        seen_emps = set()
        for (emp_num, emp_name), count in sorted(emp_leave_counts.items(), key=lambda x: x[1], reverse=True):
            seen_emps.add(int(emp_num))
            all_emps.append({
                'employee_number': int(emp_num),
                'name': str(emp_name),
                'leave_count': int(count)
            })
        if not is_type_filtered:
            for _, r in data_loader.df_employees.iterrows():
                enum = int(r['EMPLOYEE NUMBER'])
                if enum not in seen_emps:
                    seen_emps.add(enum)
                    emp_name = str(r.get('EMPLOYEE LABEL') or f"{r.get('EMPLOYEE FIRST NAME', '')} {r.get('EMPLOYEE LAST NAME', '')}".strip() or f"Employee #{enum}")
                    all_emps.append({
                        'employee_number': enum,
                        'name': emp_name,
                        'leave_count': 0
                    })

        # Available years sorted with authoritative year 2023 first
        available_years = [2023, 2024, 2022, 2021, 2020]

        return {
            'total_leave_days': round(total_days, 1),
            'unique_employees_on_leave': unique_emps,
            'leave_rate_pct': leave_rate_pct,
            'leave_type_breakdown': type_breakdown,
            'project_distribution': proj_dist,
            'manager_grade_matrix': manager_grade_matrix,
            'geography_grade_matrix': geo_grade_matrix,
            'daily_leave_counts': daily_counts,
            'events': events,
            'available_employees': all_emps,
            'available_years': available_years,
            'selected_year': selected_year,
            'cohort_employees': cohort_employees
        }

    @staticmethod
    def get_work_model_kpis(filters: Dict[str, Any] = None):
        filters = filters or {}
        df = apply_employee_filters(data_loader.df_employees, filters)
        total = len(df)
        models = work_model_series(df)
        mix = work_model_mix(df)
        recorded = int((models != 'Not recorded yet').sum()) if total else 0

        def breakdown(column: str, label: str, skip_blank: bool = False):
            if column not in df.columns or total == 0:
                return []
            values = df[column].map(lambda value: str(value).strip() if pd.notna(value) else '')
            rows = []
            for name in values.unique():
                if not name or name.lower() in ('nan', 'none', 'nat'):
                    if skip_blank:
                        continue
                    name = 'Not recorded'
                mask = values == ('' if name == 'Not recorded' else name)
                if name == 'Not recorded':
                    mask = values.map(lambda item: not item or item.lower() in ('nan', 'none', 'nat'))
                sub = models[mask]
                if len(sub) == 0:
                    continue
                entry = {label: name, 'total': int(len(sub))}
                for model_name in WORK_MODEL_ORDER:
                    entry[model_name] = int((sub == model_name).sum())
                rows.append(entry)
            rows.sort(key=lambda item: item['total'], reverse=True)
            if skip_blank:
                rows = [item for item in rows if item[label] != 'Not recorded']
            return rows

        roster_rows = []
        for _, row in df.iterrows():
            office = row.get('Office')
            office_text = str(office).strip() if pd.notna(office) and str(office).strip() not in ('', 'nan', 'None') else ''
            roster_rows.append({
                'EMPLOYEE NUMBER': int(row['EMPLOYEE NUMBER']),
                'EMPLOYEE LABEL': str(row.get('EMPLOYEE LABEL') or ''),
                'LOCATION': str(row.get('LOCATION') or ''),
                'State': str(row.get('State') or ''),
                'JOB LEVEL': str(row.get('JOB LEVEL') or ''),
                'DEPARTMENT': str(row.get('DEPARTMENT') or ''),
                'JOB TITLE': str(row.get('JOB TITLE') or ''),
                'Work_Model': str(row.get('Work_Model') or 'Not recorded yet'),
                'Office': office_text,
                'Employment_Type': str(row.get('Employment_Type') or '') if pd.notna(row.get('Employment_Type')) else '',
            })

        history = getattr(data_loader, 'df_work_model', None)
        by_grade = breakdown('JOB LEVEL', 'job_level')
        by_grade.sort(key=lambda item: GRADE_ORDER.index(item['job_level']) if item['job_level'] in GRADE_ORDER else 99)
        by_account = breakdown('State', 'account')
        account_order = {'NH': 0, 'ND': 1, 'AK': 2, 'Maven': 3}
        by_account.sort(key=lambda item: account_order.get(item['account'], 9))
        return {
            'headcount': total,
            'recorded_count': recorded,
            'not_recorded_count': total - recorded,
            'mix': mix,
            'by_city': breakdown('LOCATION', 'location'),
            'by_account': by_account,
            'by_grade': by_grade,
            'by_department': breakdown('DEPARTMENT', 'department'),
            'by_office': breakdown('Office', 'office', skip_blank=True),
            'roster': roster_rows,
            'history_rows': int(len(history)) if history is not None else 0,
        }

    @staticmethod
    def get_ai_utilization_kpis(filters: Dict[str, Any] = None):
        filters = filters or {}
        usage = getattr(data_loader, 'df_ai_utilization', None)
        outcomes = getattr(data_loader, 'df_ai_outcomes', None)
        billing = getattr(data_loader, 'df_cursor_billing', None)
        if usage is None:
            usage = pd.DataFrame()
        else:
            usage = usage.copy()
        if outcomes is None:
            outcomes = pd.DataFrame()
        else:
            outcomes = outcomes.copy()
        if billing is None:
            billing = pd.DataFrame()
        else:
            billing = billing.copy()

        def _manager_names(values) -> set:
            """FilterBar managers are often 'Name (emp#)'; AI sheets store plain Manager / Owner names."""
            names = set()
            for raw in parse_filter_list(values):
                text = str(raw).strip()
                if not text:
                    continue
                names.add(text.casefold())
                cleaned = re.sub(r'\s*\(\d+\)\s*$', '', text).strip()
                if cleaned:
                    names.add(cleaned.casefold())
            return names

        def _match_manager_series(series: pd.Series, wanted: set) -> pd.Series:
            raw = series.fillna('').astype(str).str.strip()
            cleaned = raw.str.replace(r'\s*\(\d+\)\s*$', '', regex=True).str.strip()
            return raw.str.casefold().isin(wanted) | cleaned.str.casefold().isin(wanted)

        def _apply_dim(frame: pd.DataFrame) -> pd.DataFrame:
            if frame is None or frame.empty:
                return frame
            out = frame
            pairs = (
                ('project', 'Project'),
                ('Project', 'Project'),
                ('team', 'Team'),
                ('Team', 'Team'),
                ('release', 'Release'),
                ('Release', 'Release'),
                ('domain', 'Domain'),
                ('Domain', 'Domain'),
            )
            seen = set()
            for key, column in pairs:
                if column in seen or column not in out.columns:
                    continue
                value = filters.get(key)
                if not value:
                    continue
                seen.add(column)
                wanted = {str(v).strip().casefold() for v in (value if isinstance(value, list) else [value]) if str(v).strip()}
                if wanted:
                    out = out[out[column].astype(str).str.strip().str.casefold().isin(wanted)]
            return out

        usage = _apply_dim(usage)
        outcomes = _apply_dim(outcomes) if 'Project' in outcomes.columns else outcomes
        billing = _apply_dim(billing) if 'Project' in billing.columns else billing

        # Manager is on AI utilization (Manager) and outcomes (Owner). Dept/Module are People-only — not applied here.
        manager_wanted = _manager_names(filters.get('manager'))
        if manager_wanted:
            if not usage.empty and 'Manager' in usage.columns:
                usage = usage[_match_manager_series(usage['Manager'], manager_wanted)]
            if not outcomes.empty and 'Owner' in outcomes.columns:
                outcomes = outcomes[_match_manager_series(outcomes['Owner'], manager_wanted)]
            if not billing.empty and not usage.empty and 'EMPLOYEE NUMBER' in usage.columns and 'EMPLOYEE NUMBER' in billing.columns:
                scoped = set(pd.to_numeric(usage['EMPLOYEE NUMBER'], errors='coerce').dropna().astype(int).tolist())
                if scoped:
                    billing = billing[pd.to_numeric(billing['EMPLOYEE NUMBER'], errors='coerce').isin(scoped)]
                else:
                    billing = billing.iloc[0:0].copy()

        people = sorted({
            str(name).strip()
            for name in usage.get('Employee_Name', pd.Series(dtype=object)).fillna('').tolist()
            if str(name).strip()
        } | {
            str(name).strip()
            for name in billing.get('Name', pd.Series(dtype=object)).fillna('').tolist()
            if str(name).strip()
        })
        hours = float(pd.to_numeric(usage.get('Hours_Saved'), errors='coerce').fillna(0).sum()) if not usage.empty else 0.0
        if hours <= 0 and not outcomes.empty and 'Hours_Saved' in outcomes.columns:
            hours = float(pd.to_numeric(outcomes['Hours_Saved'], errors='coerce').fillna(0).sum())
        tokens = float(pd.to_numeric(usage.get('Total_Tokens'), errors='coerce').fillna(0).sum()) if not usage.empty else 0.0
        if tokens <= 0 and not outcomes.empty and 'Total_Tokens' in outcomes.columns:
            tokens = float(pd.to_numeric(outcomes['Total_Tokens'], errors='coerce').fillna(0).sum())
        cursor_spend = float(pd.to_numeric(billing.get('Cost_USD'), errors='coerce').fillna(0).sum()) if not billing.empty else 0.0
        if cursor_spend <= 0 and not usage.empty and 'Cost_USD' in usage.columns:
            person_cost = (
                usage.dropna(subset=['Employee_Name'])
                .groupby(usage['Employee_Name'].astype(str).str.strip())['Cost_USD']
                .max()
            )
            cursor_spend = float(pd.to_numeric(person_cost, errors='coerce').fillna(0).sum())

        headcount_scope = int(pd.to_numeric(outcomes.get('Headcount'), errors='coerce').fillna(0).max()) if not outcomes.empty else len(people)
        if headcount_scope <= 0:
            headcount_scope = max(len(people), 1)
        people_using = int(pd.to_numeric(outcomes.get('People_Using'), errors='coerce').fillna(0).max()) if not outcomes.empty else 0
        if people_using <= 0:
            people_using = len(people)
        adoption = round((people_using / headcount_scope) * 100, 1) if headcount_scope else 0.0

        def _count_breakdown(frame: pd.DataFrame, column: str, label: str):
            if frame is None or frame.empty or column not in frame.columns:
                return []
            series = frame[column].fillna('').astype(str).str.strip()
            series = series[series != '']
            rows = []
            for name, count in series.value_counts().items():
                rows.append({label: name, 'count': int(count)})
            return rows

        def _sum_breakdown(frame: pd.DataFrame, column: str, value_col: str, label: str):
            if frame is None or frame.empty or column not in frame.columns or value_col not in frame.columns:
                return []
            tmp = frame.copy()
            tmp[column] = tmp[column].fillna('').astype(str).str.strip()
            tmp = tmp[tmp[column] != '']
            tmp[value_col] = pd.to_numeric(tmp[value_col], errors='coerce').fillna(0)
            grouped = tmp.groupby(column, dropna=False)[value_col].sum().sort_values(ascending=False)
            return [{label: str(name), 'value': float(round(val, 2))} for name, val in grouped.items()]

        # Project x Team hours matrix
        matrix = []
        if not usage.empty and 'Project' in usage.columns and 'Team' in usage.columns:
            tmp = usage.copy()
            tmp['Project'] = tmp['Project'].fillna('').astype(str).str.strip().replace('', 'Unspecified')
            tmp['Team'] = tmp['Team'].fillna('').astype(str).str.strip().replace('', 'Unspecified')
            tmp['Hours_Saved'] = pd.to_numeric(tmp['Hours_Saved'], errors='coerce').fillna(0)
            piv = tmp.pivot_table(index='Team', columns='Project', values='Hours_Saved', aggfunc='sum', fill_value=0)
            projects = list(piv.columns.astype(str))
            for team, row in piv.iterrows():
                entry = {'team': str(team), 'total': float(round(row.sum(), 2))}
                for project in projects:
                    entry[project] = float(round(row.get(project, 0), 2))
                matrix.append(entry)
            matrix.sort(key=lambda item: item['total'], reverse=True)
        else:
            projects = []

        person_rows = []
        if not usage.empty:
            grp = usage.groupby(usage['Employee_Name'].fillna('').astype(str).str.strip(), dropna=False)
            for name, chunk in grp:
                if not name:
                    continue
                emp = pd.to_numeric(chunk.get('EMPLOYEE NUMBER'), errors='coerce').dropna()
                emp_number = int(emp.iloc[0]) if len(emp) else None
                cost = pd.to_numeric(chunk.get('Cost_USD'), errors='coerce').max()
                if pd.isna(cost) and not billing.empty:
                    match = billing[billing['Name'].astype(str).str.strip().str.casefold() == name.casefold()]
                    if len(match):
                        cost = pd.to_numeric(match['Cost_USD'], errors='coerce').max()
                person_rows.append({
                    'employee_number': emp_number,
                    'name': name,
                    'activities': int(len(chunk)),
                    'hours_saved': float(round(pd.to_numeric(chunk.get('Hours_Saved'), errors='coerce').fillna(0).sum(), 2)),
                    'tokens': float(round(pd.to_numeric(chunk.get('Total_Tokens'), errors='coerce').fillna(0).sum(), 2)),
                    'cursor_usd': float(round(cost, 2)) if pd.notna(cost) else 0.0,
                    'tools': sorted({str(t).strip() for t in chunk.get('Tool', pd.Series(dtype=object)).fillna('') if str(t).strip()}),
                    'projects': sorted({str(t).strip() for t in chunk.get('Project', pd.Series(dtype=object)).fillna('') if str(t).strip()}),
                    'teams': sorted({str(t).strip() for t in chunk.get('Team', pd.Series(dtype=object)).fillna('') if str(t).strip()}),
                })
        person_rows.sort(key=lambda item: (item['cursor_usd'], item['hours_saved']), reverse=True)

        activity_rows = []
        for _, row in usage.iterrows():
            emp = row.get('EMPLOYEE NUMBER')
            activity_rows.append({
                'release': str(row.get('Release') or ''),
                'domain': str(row.get('Domain') or ''),
                'team': str(row.get('Team') or ''),
                'project': str(row.get('Project') or ''),
                'manager': str(row.get('Manager') or ''),
                'employee_number': int(emp) if pd.notna(emp) else None,
                'name': str(row.get('Employee_Name') or ''),
                'tool': str(row.get('Tool') or ''),
                'use_case': str(row.get('Use_Case') or ''),
                'activity': str(row.get('Activity') or ''),
                'hours_saved': float(row['Hours_Saved']) if pd.notna(row.get('Hours_Saved')) else 0.0,
                'tokens': float(row['Total_Tokens']) if pd.notna(row.get('Total_Tokens')) else 0.0,
                'source': str(row.get('Source') or ''),
                'benefit': str(row.get('Benefit_Note') or ''),
                'cost_usd': float(row['Cost_USD']) if pd.notna(row.get('Cost_USD')) else None,
            })

        outcome_rows = []
        for _, row in outcomes.iterrows():
            headcount = float(row['Headcount']) if pd.notna(row.get('Headcount')) else 0.0
            using = float(row['People_Using']) if pd.notna(row.get('People_Using')) else 0.0
            adoption_pct = float(row['Adoption_Pct']) if pd.notna(row.get('Adoption_Pct')) else (
                round((using / headcount) * 100, 1) if headcount else 0.0
            )
            if adoption_pct <= 1 and headcount:
                adoption_pct = round(adoption_pct * 100, 1)
            outcome_rows.append({
                'release': str(row.get('Release') or ''),
                'domain': str(row.get('Domain') or ''),
                'team': str(row.get('Team') or ''),
                'owner': str(row.get('Owner') or ''),
                'headcount': int(headcount),
                'people_using': int(using),
                'adoption_pct': adoption_pct,
                'hours_saved': float(row['Hours_Saved']) if pd.notna(row.get('Hours_Saved')) else 0.0,
                'tools_used': str(row.get('Tools_Used') or ''),
                'top_use_cases': str(row.get('Top_Use_Cases') or ''),
                'benefits': str(row.get('Measurable_Benefits') or ''),
                'gaps': str(row.get('Gaps') or ''),
                'challenges': str(row.get('Challenges') or ''),
                'opportunities': str(row.get('Opportunities') or ''),
                'status': str(row.get('Status') or ''),
            })

        billing_rows = []
        for _, row in billing.iterrows():
            billing_rows.append({
                'name': str(row.get('Name') or ''),
                'cost_usd': float(row['Cost_USD']) if pd.notna(row.get('Cost_USD')) else 0.0,
                'month': str(row.get('Month') or ''),
                'team': str(row.get('Team') or ''),
                'project': str(row.get('Project') or ''),
                'employee_number': int(row['EMPLOYEE NUMBER']) if pd.notna(row.get('EMPLOYEE NUMBER')) else None,
            })
        billing_rows.sort(key=lambda item: item['cost_usd'], reverse=True)

        alerts = []
        estimated = int((usage.get('Source', pd.Series(dtype=object)).astype(str).str.casefold() == 'estimated').sum()) if not usage.empty else 0
        if estimated:
            alerts.append({'tone': 'amber', 'text': f'{estimated} activity rows are Estimated - replace with Export when Cursor usage export is available.'})
        if cursor_spend > 0 and hours <= 0:
            alerts.append({'tone': 'rose', 'text': 'Cursor spend is recorded but hours saved are still blank on activity rows.'})
        if adoption < 50:
            alerts.append({'tone': 'amber', 'text': f'Adoption is {adoption}% of headcount in scope - seat rollout or intake gaps remain.'})
        if not alerts:
            alerts.append({'tone': 'emerald', 'text': 'Release evidence and Cursor billing are both present for the current slice.'})

        # Page 1 Executive Command Center (additive): health tiles, attention zone, ranking, project x domain.
        executive = _ai_executive_view(
            usage, outcomes, billing,
            getattr(data_loader, 'ai_targets', None) or {},
            getattr(data_loader, 'ai_release_order', None) or {},
            hours, tokens, cursor_spend,
        )
        summary = {
            'people_using': people_using,
            'people_named': len(people),
            'headcount_scope': headcount_scope,
            'adoption_pct': adoption,
            'activity_rows': int(len(usage)),
            'hours_saved': round(hours, 1),
            'tokens': round(tokens, 0),
            'cursor_spend_usd': round(cursor_spend, 2),
            'outcome_rows': int(len(outcomes)),
            'usd_per_hour': round(cursor_spend / hours, 2) if hours > 0 else None,
        }
        summary.update(executive['summary_ext'])
        page23 = _ai_page23_view(
            usage, outcomes, billing,
            getattr(data_loader, 'ai_targets', None) or {},
            getattr(data_loader, 'ai_release_order', None) or {},
            executive['health'],
        )

        return {
            'summary': summary,
            'by_domain': _count_breakdown(usage, 'Domain', 'domain'),
            'by_tool': _count_breakdown(usage, 'Tool', 'tool'),
            'by_use_case': _count_breakdown(usage, 'Use_Case', 'use_case'),
            'by_project': _sum_breakdown(usage, 'Project', 'Hours_Saved', 'project'),
            'by_team': _sum_breakdown(usage, 'Team', 'Hours_Saved', 'team'),
            'by_release': _sum_breakdown(usage, 'Release', 'Hours_Saved', 'release'),
            'matrix_projects': projects,
            'matrix': matrix,
            'people': person_rows,
            'activities': activity_rows,
            'outcomes': outcome_rows,
            'billing': billing_rows,
            'alerts': alerts,
            'health': executive['health'],
            'attention': executive['attention'],
            'ranking': executive['ranking'],
            'by_project_domain': executive['by_project_domain'],
            'quadrant': executive.get('quadrant') or [],
            'funnel': executive.get('funnel') or [],
            'maturity_trend': executive.get('maturity_trend') or [],
            'league': _ai_manager_league(page23.get('manager_scorecard') or [], executive['health']),
            'use_case_matrix': page23['use_case_matrix'],
            'dev_vs_qa': page23['dev_vs_qa'],
            'release_trend': page23['release_trend'],
            'manager_scorecard': page23['manager_scorecard'],
            'project_recommendations': page23.get('project_recommendations') or [],
            'risks': page23['risks'],
            'release_summary': page23['release_summary'],
            'release_summaries': page23['release_summaries'],
            'dev_contribution': page23['dev_contribution'],
            'qa_contribution': page23['qa_contribution'],
            'benefit_waterfall': page23['benefit_waterfall'],
            'narrative': page23['narrative'],
            'narratives': page23['narratives'],
            'release_flow': page23.get('release_flow') or [],
            'maturity_radar': page23.get('maturity_radar') or [],
        }


analytics_engine = AnalyticsEngine()

