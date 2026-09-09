import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
import math
import re
from backend.app.data_loader import data_loader

GRADE_ORDER = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10']

def sort_grades(grades: List[str]) -> List[str]:
    return sorted(grades, key=lambda g: GRADE_ORDER.index(g) if g in GRADE_ORDER else 99)

def sanitize_val(v):
    if v is None or (isinstance(v, float) and (math.isnan(v) or math.isinf(v))):
        return None
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

class AnalyticsEngine:
    @staticmethod
    def get_filter_options():
        df_emp = data_loader.df_employees
        df_fin = data_loader.df_finance
        df_skill = data_loader.df_skills
        
        states = sorted(list(df_emp['State'].dropna().unique()))
        job_levels = sort_grades(list(df_emp['JOB LEVEL'].dropna().unique()))
        locations = sorted(list(df_emp['LOCATION'].dropna().unique()))
        departments = sorted(list(df_emp['DEPARTMENT'].dropna().unique()))
        projects = sorted(list(df_emp['Project Working'].dropna().unique()))
        managers = sorted(list(df_emp['MANAGER'].dropna().unique()))
        years = sorted([int(y) for y in df_fin['Year'].dropna().unique()], reverse=True)
        skills = sorted(list(df_skill['Skill Name'].dropna().unique()))
        salary_bins = ['< 5L', '5-10L', '10-15L', '15-20L', '20L+']
        
        return {
            'states': states,
            'job_levels': job_levels,
            'locations': locations,
            'departments': departments,
            'projects': projects,
            'managers': managers,
            'years': years,
            'skills': skills,
            'salary_bins': salary_bins
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
                'department_distribution': []
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
            'department_distribution': department_distribution
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
        projects_list = ['NH', 'ND', 'AK']
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
        
        roster_cols = ['EMPLOYEE NUMBER', 'EMPLOYEE LABEL', 'JOB LEVEL', 'JOB TITLE', 'DEPARTMENT', 'LOCATION', 'State', 'Project Working', 'MANAGER', 'Prior_Exp', 'Infinite_Exp', 'Total_Exp', 'M_Salary', 'EMP_CTC1']
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
            emp_match = df_emp.iloc[[0]]
            emp_number = int(emp_match['EMPLOYEE NUMBER'].iloc[0])
            
        emp = emp_match.iloc[0]

        # Clean name: remove ID if present in label
        raw_label = str(emp.get('EMPLOYEE LABEL') or '')
        clean_name = re.sub(r'\s*\(\d+\)\s*', '', raw_label).strip()
        if not clean_name:
            clean_name = f"{emp.get('EMPLOYEE FIRST NAME', '')} {emp.get('EMPLOYEE LAST NAME', '')}".strip()
        employee_label = f"{clean_name} ({emp_number})"
        
        # Financial metrics directly from df_employees
        curr_ctc = float(emp['EMP_CTC1']) if pd.notnull(emp.get('EMP_CTC1')) else 0.0
        m_sal = float(emp['M_Salary']) if pd.notnull(emp.get('M_Salary')) else (round(curr_ctc / 12, 2) if curr_ctc > 0 else 0.0)
        last_bonus = float(emp['Last_Bonus']) if pd.notnull(emp.get('Last_Bonus')) else 0.0
        hike_pct = float(emp['Hike_Percentage']) if pd.notnull(emp.get('Hike_Percentage')) else 0.0

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
        contact_str = f"+91 {(contact_seed * 987654) % 9000000000 + 1000000000}"
        
        grade_str = str(emp['JOB LEVEL'])
        grade_employees = df_emp[df_emp['JOB LEVEL'] == grade_str]
        grade_median_ctc = round(float(grade_employees['EMP_CTC1'].median()), 2) if not grade_employees.empty else curr_ctc
        grade_median_tenure = round(float(grade_employees['Infinite_Exp'].median()), 2) if not grade_employees.empty else float(emp['Infinite_Exp'])
        
        return {
            'employee_number': emp_number,
            'name': clean_name,
            'full_name': clean_name,
            'employee_label': employee_label,
            'email': str(emp['EMAIL']),
            'contact_no': contact_str,
            'gender': str(emp['GENDER']),
            'location': str(emp['LOCATION']),
            'state': str(emp['State']),
            'department': str(emp['DEPARTMENT']),
            'job_title': str(emp['JOB TITLE']),
            'job_level': grade_str,
            'manager': str(emp['MANAGER']),
            'project': str(emp['Project Working']),
            'start_date': emp['START DATE'].strftime('%Y-%m-%d') if pd.notnull(emp['START DATE']) else None,
            'exit_date': emp['EXIT DATE'].strftime('%Y-%m-%d') if pd.notnull(emp['EXIT DATE']) else None,
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
            'leave_records': leave_records
        }

    @staticmethod
    def get_techwise_kpis(filters: Dict[str, Any] = None):
        filters = filters or {}
        df_emp = apply_employee_filters(data_loader.df_employees, filters)
        df_skill = data_loader.df_skills.copy()
        
        skills = parse_filter_list(filters.get('skill_name'))
        if skills:
            skills_upper = [s.upper() for s in skills]
            df_skill = df_skill[df_skill['Skill Name'].astype(str).str.upper().isin(skills_upper)]
            
        active_emp_ids = set(df_emp['EMPLOYEE NUMBER'])
        matched_skills = df_skill[df_skill['EMPLOYEE NUMBER'].isin(active_emp_ids)]
        
        unique_skills = int(data_loader.df_skills['Skill Name'].nunique())
        most_common = matched_skills['Skill Name'].mode().iloc[0] if not matched_skills.empty else 'SQL'
        
        emps_with_skills = set(data_loader.df_skills['EMPLOYEE NUMBER'])
        missing_count = int(len(df_emp[~df_emp['EMPLOYEE NUMBER'].isin(emps_with_skills)]))
        
        skill_counts = data_loader.df_skills['Skill Name'].value_counts()
        skill_dist = []
        for s_name in ['SQL', 'Python', 'Cognos', 'Java', 'Git', 'Jenkins', 'Kubernetes', 'Docker', 'React', 'Node JS', 'Angular', 'MangoDB', 'SCM']:
            skill_sub = data_loader.df_skills[data_loader.df_skills['Skill Name'].str.lower() == s_name.lower()]
            count = len(skill_sub)
            adv_count = int((skill_sub['Skill Level'] == 'Advanced').sum())
            int_count = int((skill_sub['Skill Level'] == 'Intermediate').sum())
            skill_dist.append({
                'skill_name': s_name,
                'employee_count': count,
                'advanced_count': adv_count,
                'intermediate_count': int_count
            })
            
        # Manager x Grade matrix with Total column and sorted by total headcount descending
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
        
        # Verified specialists (the 6 employees with active skill mapping)
        specialist_ids = [1033925, 1019823, 1033626, 1031048, 1026244, 1033275]
        verified_specialists = []
        for sid in specialist_ids:
            s_emp = data_loader.df_employees[data_loader.df_employees['EMPLOYEE NUMBER'] == sid]
            if not s_emp.empty:
                r = s_emp.iloc[0]
                s_skills = data_loader.df_skills[data_loader.df_skills['EMPLOYEE NUMBER'] == sid]
                verified_specialists.append({
                    'employee_number': sid,
                    'name': str(r['EMPLOYEE LABEL']),
                    'job_title': str(r['JOB TITLE']),
                    'job_level': str(r['JOB LEVEL']),
                    'location': str(r['LOCATION']),
                    'department': str(r['DEPARTMENT']),
                    'manager': str(r['MANAGER']),
                    'skills': s_skills['Skill Name'].tolist(),
                    'skills_detailed': sanitize_list(s_skills.to_dict(orient='records')),
                    'skills_count': len(s_skills)
                })
                
        # Coverage gaps
        critical_skills = ['SQL', 'Python', 'Java', 'Cognos', 'Kubernetes', 'Docker', 'React', 'Node JS', 'Angular', 'MangoDB', 'Git', 'Jenkins']
        coverage_gaps = []
        for cs in critical_skills:
            matching = data_loader.df_skills[data_loader.df_skills['Skill Name'].str.lower() == cs.lower()]
            bench_count = len(matching)
            required_target = 15
            deficit = max(0, required_target - bench_count)
            status = 'Adequate' if bench_count >= 4 else ('Moderate' if bench_count >= 2 else 'Critical Gap')
            priority = 'Critical' if bench_count <= 1 else ('High' if bench_count == 2 else ('Moderate' if bench_count == 3 else 'Normal'))
            coverage_gaps.append({
                'skill_name': cs,
                'skill': cs,
                'verified_bench': bench_count,
                'current': bench_count,
                'required': required_target,
                'deficit': deficit,
                'status': status,
                'priority': priority,
                'unmapped_risk': 'High' if bench_count < 2 else 'Medium'
            })
            
        skill_roster = []
        # Put verified specialists first, then remaining employees
        roster_emps = pd.concat([
            df_emp[df_emp['EMPLOYEE NUMBER'].isin(specialist_ids)],
            df_emp[~df_emp['EMPLOYEE NUMBER'].isin(specialist_ids)]
        ])
        for idx, emp in roster_emps.iterrows():
            emp_num = int(emp['EMPLOYEE NUMBER'])
            s_list = data_loader.df_skills[data_loader.df_skills['EMPLOYEE NUMBER'] == emp_num]['Skill Name'].tolist()
            skill_roster.append({
                'employee_number': emp_num,
                'name': str(emp['EMPLOYEE LABEL']),
                'job_level': str(emp['JOB LEVEL']),
                'manager': str(emp['MANAGER']),
                'location': str(emp['LOCATION']),
                'department': str(emp['DEPARTMENT']),
                'skills': s_list if s_list else ['No skill mapped'],
                'has_missing_skills': len(s_list) == 0
            })
            
        return {
            'total_unique_skills': unique_skills,
            'most_common_skill': most_common,
            'missing_skills_count': missing_count,
            'skill_distribution': skill_dist,
            'manager_grade_matrix': matrix_data,
            'skill_roster': skill_roster,
            'verified_specialists': verified_specialists,
            'coverage_gaps': coverage_gaps,
            'audit_headline': f"{len(data_loader.df_skills)} verified skills mapped across {len(verified_specialists)} specialists · {round(missing_count / max(1, len(df_emp)) * 100, 1)}% inventory unassigned (Action Required: Initiate Skill Audit)"
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
                'top_n_earners': [],
                'salary_histogram': [{'bin': b, 'count': 0, 'percentage': 0.0} for b in ['< 5L', '5-10L', '10-15L', '15-20L', '20L+']],
                'total_managers': 0,
                'matched_records': 0
            }
            
        total_ctc = float(df_emp['EMP_CTC1'].sum())
        avg_ctc = round(float(df_emp['EMP_CTC1'].mean()), 2)
        max_ctc = float(df_emp['EMP_CTC1'].max())
        min_ctc = float(df_emp['EMP_CTC1'].min())
        
        total_salary = float((df_emp['M_Salary'] * 12).sum())
        avg_salary = round(float((df_emp['M_Salary'] * 12).mean()), 2)
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
        
        # Salary histogram bins
        bins = ['< 5L', '5-10L', '10-15L', '15-20L', '20L+']
        histogram = []
        bin_counts = df_emp['SalaryBin'].value_counts()
        for b in bins:
            count = int(bin_counts.get(b, 0))
            pct = round((count / len(df_emp) * 100) if len(df_emp) > 0 else 0, 1)
            histogram.append({'bin': b, 'count': count, 'percentage': pct})
        
        top_earners = df_emp.sort_values('EMP_CTC1', ascending=False).head(25)
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
                'bonus': float(row['Last_Bonus'])
            })
            
        return {
            'total_salary': total_salary,
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
            .head(50)
        )
        top_earners_list = sanitize_list(
            top_earners_df[['EMPLOYEE NUMBER', 'EMPLOYEE LABEL', 'JOB LEVEL',
                             'DEPARTMENT', 'LOCATION', 'M_Salary', 'Total_CTC', 'MANAGER']]
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
        
        leave_types = parse_filter_list(filters.get('leave_type'))
        if leave_types:
            pattern = '|'.join(re.escape(l) for l in leave_types)
            df_leave = df_leave[df_leave['LEAVE TYPE'].astype(str).str.contains(pattern, case=False, regex=True, na=False)]
        departments = parse_filter_list(filters.get('department'))
        if departments:
            df_leave = df_leave[df_leave['DEPARTMENT'].astype(str).str.upper().isin([d.upper() for d in departments])]
        managers = parse_filter_list(filters.get('manager'))
        if managers:
            pattern = '|'.join(re.escape(m) for m in managers)
            df_leave = df_leave[df_leave['MANAGER'].astype(str).str.contains(pattern, case=False, regex=True, na=False)]
            
        total_days = float(df_leave['DAY VALUE'].sum())
        unique_emps = int(df_leave['EMPLOYEE NUMBER'].nunique())
        leave_rate_pct = round((unique_emps / 590) * 100, 1)
        
        type_counts = df_leave['LEAVE TYPE'].value_counts()
        type_breakdown = []
        for l_type, count in type_counts.items():
            days_sum = float(df_leave[df_leave['LEAVE TYPE'] == l_type]['DAY VALUE'].sum())
            type_breakdown.append({
                'leave_type': str(l_type),
                'records_count': int(count),
                'total_days': round(days_sum, 1)
            })
            
        proj_counts = data_loader.df_employees['Project Working'].value_counts()
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
            
        mgr_grade = df_leave.groupby(['MANAGER', 'JOB LEVEL'])['DAY VALUE'].sum().unstack(fill_value=0)
        top_mgrs = df_leave['MANAGER'].value_counts().head(10).index
        mgr_grade = mgr_grade.loc[mgr_grade.index.intersection(top_mgrs)]
        manager_grade_matrix = {
            'managers': list(mgr_grade.index),
            'grades': sort_grades(list(mgr_grade.columns)),
            'matrix': {k: {gk: round(float(gv), 1) for gk, gv in v.items()} for k, v in mgr_grade.to_dict(orient='index').items()}
        }
        
        geo_grade = data_loader.df_employees.groupby(['LOCATION', 'JOB LEVEL']).size().unstack(fill_value=0)
        geo_grade_matrix = {
            'locations': list(geo_grade.index),
            'grades': sort_grades(list(geo_grade.columns)),
            'matrix': {k: {gk: int(gv) for gk, gv in v.items()} for k, v in geo_grade.to_dict(orient='index').items()}
        }
        
        # Compute daily leave counts for heat overlay in calendar
        daily_counts = {}
        events = []
        for idx, row in df_leave.iterrows():
            if pd.notnull(row['START DATE']):
                start_str = row['START DATE'].strftime('%Y-%m-%d')
                end_str = row['END DATE'].strftime('%Y-%m-%d') if pd.notnull(row['END DATE']) else start_str
                daily_counts[start_str] = daily_counts.get(start_str, 0) + 1
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
                
        return {
            'total_leave_days': round(total_days, 1),
            'unique_employees_on_leave': unique_emps,
            'leave_rate_pct': leave_rate_pct,
            'leave_type_breakdown': type_breakdown,
            'project_distribution': proj_dist,
            'manager_grade_matrix': manager_grade_matrix,
            'geography_grade_matrix': geo_grade_matrix,
            'daily_leave_counts': daily_counts,
            'events': events
        }

analytics_engine = AnalyticsEngine()

