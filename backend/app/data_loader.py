import os
import sys
import pandas as pd
import numpy as np
from datetime import datetime

# Reference date for tenure calculation (matches Power BI dataset max date ~ Oct 2024 / current)
REF_DATE = pd.to_datetime('2024-10-10')

WORKFORCE_FILENAME = 'Infinite_ETS_India_Workforce.xlsx'
COMPENSATION_FILENAME = 'Infinite_ETS_India_Compensation.xlsx'
LEGACY_FILENAME = 'ETS_Dasboard_DS.xlsx'
FRIENDLY_SHEETS = ('People', 'Skills', 'Leave')
LEGACY_SHEETS = ('EMPLOYEES', 'SKILL', 'Finance_History', 'LEAVE')
COMPENSATION_SHEETS = ('Current pay', 'Pay history')

WORK_MODEL_COLUMNS = [
    'EMPLOYEE NUMBER', 'Effective_Date', 'Work_Model', 'Office_Days', 'City', 'Notes',
]
TRAINING_COLUMNS = [
    'EMPLOYEE NUMBER', 'Training', 'Provider', 'Start_Date', 'End_Date', 'Status', 'Hours', 'Mandatory', 'Skill',
]
AI_UTILIZATION_COLUMNS = [
    'Release', 'Domain', 'Team', 'Manager', 'EMPLOYEE NUMBER', 'Employee_Name',
    'Period_Start', 'Period_End', 'Tool', 'Provider', 'Use_Case', 'Activity',
    'Request_Count', 'Input_Tokens', 'Output_Tokens', 'Total_Tokens',
    'Hours_Saved', 'Baseline_Hours', 'Benefit_Note', 'Source', 'Challenges', 'Notes',
    'Sprint', 'Project', 'Account', 'Cached_Input_Tokens', 'Cost_USD',
    'Accepted_Lines', 'Generated_Lines', 'Policy_Flag', 'External_Id',
    'Test_Cases_Generated', 'Automation_Assets', 'Artifacts_Generated', 'Story_Ids',
]
AI_OUTCOME_COLUMNS = [
    'Release', 'Domain', 'Team', 'Owner', 'Headcount', 'People_Using',
    'Adoption_Pct', 'Total_Tokens', 'Hours_Saved', 'Tools_Used', 'Top_Use_Cases',
    'Measurable_Benefits', 'Gaps', 'Challenges', 'Opportunities', 'Status',
    'Submitted_On', 'Reviewed_By', 'Project',
    'Stories_Delivered', 'Stories_Using_AI', 'Defects_Baseline', 'Defects_Actual',
    'Cycle_Time_Days_Saved', 'Release_Sequence', 'Release_Date',
]
CURSOR_BILLING_COLUMNS = [
    'Name', 'Cost_USD', 'Month', 'Billing_Start', 'Billing_End', 'EMPLOYEE NUMBER', 'Team', 'Project',
]
# `AI targets` sheet (docs/AI_UTILIZATION_DASHBOARD_DESIGN.md Section 3 / 10). Used when the sheet is
# missing so an older workbook still produces the Executive Command Center payload.
AI_TARGET_DEFAULTS = {
    'Adoption_Pct': {'target': 80.0, 'tolerance': 0.10, 'lower_is_better': False, 'unit': '%'},
    'Dev_Adoption_Pct': {'target': 80.0, 'tolerance': 0.10, 'lower_is_better': False, 'unit': '%'},
    'QA_Adoption_Pct': {'target': 50.0, 'tolerance': 0.10, 'lower_is_better': False, 'unit': '%'},
    'Hours_per_User': {'target': 8.0, 'tolerance': 0.10, 'lower_is_better': False, 'unit': 'h / release'},
    'Hours_per_100USD': {'target': 30.0, 'tolerance': 0.10, 'lower_is_better': False, 'unit': 'h / $100'},
    'Hours_per_100kTokens': {'target': 20.0, 'tolerance': 0.10, 'lower_is_better': False, 'unit': 'h / 100k tokens'},
    'Release_Coverage_Pct': {'target': 100.0, 'tolerance': 0.10, 'lower_is_better': False, 'unit': '%'},
    'ROI_Index': {'target': 5.0, 'tolerance': 0.10, 'lower_is_better': False, 'unit': 'x'},
    'Loaded_Rate_USD': {'target': 40.0, 'tolerance': 0.10, 'lower_is_better': False, 'unit': 'USD / h'},
    'Loaded_Rate_INR': {'target': 3000.0, 'tolerance': 0.10, 'lower_is_better': False, 'unit': 'INR / h'},
    'Attention_Adoption_Pct': {'target': 60.0, 'tolerance': 0.10, 'lower_is_better': False, 'unit': '%'},
    'Trend_Decline_Pts': {'target': 5.0, 'tolerance': 0.10, 'lower_is_better': False, 'unit': 'pts'},
    'Efficiency_Gain_Pct': {'target': 30.0, 'tolerance': 0.10, 'lower_is_better': False, 'unit': '%'},
    'Release_Quality_Pct': {'target': 80.0, 'tolerance': 0.10, 'lower_is_better': False, 'unit': '%'},
    'Defects_Reduced': {'target': 10.0, 'tolerance': 0.10, 'lower_is_better': False, 'unit': 'count'},
    'QA_TestCases_per_User': {'target': 20.0, 'tolerance': 0.10, 'lower_is_better': False, 'unit': 'count'},
    'Team_Day_Cost': {'target': 3200.0, 'tolerance': 0.10, 'lower_is_better': False, 'unit': 'USD / day'},
}


def repo_root():
    return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _plain(value):
    """Cell text, treating Excel formulas and blanks as empty. pandas does not evaluate formulas."""
    if value is None:
        return ''
    try:
        if pd.isna(value):
            return ''
    except TypeError:
        pass
    text = str(value).strip()
    if not text or text.startswith('=') or text.lower() in ('nan', 'none', 'nat'):
        return ''
    return text


def _city_geo():
    root = repo_root()
    if root not in sys.path:
        sys.path.insert(0, root)
    from templates._build_india_template import LOCATIONS
    return {str(city).casefold(): (region, country) for city, region, country in LOCATIONS}


def _empty_work_model():
    return pd.DataFrame(columns=WORK_MODEL_COLUMNS)


def _empty_training():
    return pd.DataFrame(columns=TRAINING_COLUMNS)


def _empty_ai_utilization():
    return pd.DataFrame(columns=AI_UTILIZATION_COLUMNS)


def _empty_ai_outcomes():
    return pd.DataFrame(columns=AI_OUTCOME_COLUMNS)


def _empty_cursor_billing():
    return pd.DataFrame(columns=CURSOR_BILLING_COLUMNS)


def _default_ai_targets():
    return {key: dict(value) for key, value in AI_TARGET_DEFAULTS.items()}


def _drop_example_text_rows(frame):
    """Drop EXAMPLE instruction rows while keeping blank employee-number team rollups.

    Match the whole token EXAMPLE only — a plain substring also deleted real rows whose
    Challenges text said \"examples are anonymised\", which collapsed headcount and
    inflated Portfolio health adoption past 100%.
    """
    if frame is None or frame.empty:
        return frame.iloc[0:0].copy() if frame is not None else frame
    example = pd.Series(False, index=frame.index)
    for column in frame.columns:
        example = example | frame[column].astype(str).str.contains(r'\bEXAMPLE\b', case=False, na=False, regex=True)
    return frame.loc[~example].copy()


def _positive_ids(series):
    return pd.to_numeric(series, errors='coerce')


def _drop_example_rows(frame, id_column):
    """Drop italic amber EXAMPLE rows, blank rows, and the instruction note under the table."""
    if frame is None or frame.empty:
        return frame.iloc[0:0].copy() if frame is not None else frame
    example = pd.Series(False, index=frame.index)
    for column in frame.columns:
        example = example | frame[column].astype(str).str.contains(r'\bEXAMPLE\b', case=False, na=False, regex=True)
    ids = _positive_ids(frame[id_column]) if id_column in frame.columns else pd.Series(np.nan, index=frame.index)
    keep = (~example) & ids.notna() & (ids > 0)
    return frame.loc[keep].copy()


class DataLoader:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(DataLoader, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self, file_path: str = None):
        if getattr(self, '_initialized', False):
            return

        root = repo_root()
        self.compensation_path = os.path.join(root, 'templates', COMPENSATION_FILENAME)
        if file_path is None:
            friendly = os.path.join(root, 'templates', WORKFORCE_FILENAME)
            legacy = os.path.join(root, LEGACY_FILENAME)
            if os.path.exists(friendly):
                file_path = friendly
            elif os.path.exists(legacy):
                file_path = legacy
            elif os.path.exists(LEGACY_FILENAME):
                file_path = LEGACY_FILENAME
            else:
                file_path = friendly

        self.file_path = file_path
        self.workbook_kind = None
        self.df_work_model = _empty_work_model()
        self.df_training = _empty_training()
        self.df_ai_utilization = _empty_ai_utilization()
        self.df_ai_outcomes = _empty_ai_outcomes()
        self.df_cursor_billing = _empty_cursor_billing()
        self.ai_targets = _default_ai_targets()
        self.ai_release_order = {}
        self.ai_target_rows = 0
        self.load_data()
        self._initialized = True

    def _read_sources(self):
        book = pd.ExcelFile(self.file_path)
        names = set(book.sheet_names)
        if set(FRIENDLY_SHEETS).issubset(names):
            self.workbook_kind = 'friendly'
            return self._read_friendly(book)
        if set(LEGACY_SHEETS).issubset(names):
            self.workbook_kind = 'legacy'
            self.df_work_model = _empty_work_model()
            self.df_training = _empty_training()
            self.df_ai_utilization = _empty_ai_utilization()
            self.df_ai_outcomes = _empty_ai_outcomes()
            self.df_cursor_billing = _empty_cursor_billing()
            self.ai_targets = _default_ai_targets()
            self.ai_release_order = {}
            self.ai_target_rows = 0
            df_emp = pd.read_excel(book, sheet_name='EMPLOYEES', skiprows=2)
            df_skill = pd.read_excel(book, sheet_name='SKILL')
            df_fin = pd.read_excel(book, sheet_name='Finance_History')
            df_leave = pd.read_excel(book, sheet_name='LEAVE', skiprows=2)
            return df_emp, df_skill, df_fin, df_leave
        raise ValueError(
            f'Workbook {self.file_path} is not the India workforce file or the legacy four-sheet workbook. '
            f'Sheets: {", ".join(book.sheet_names)}'
        )

    def _read_friendly(self, book):
        people = pd.read_excel(book, sheet_name='People')
        skills = pd.read_excel(book, sheet_name='Skills')
        leave = pd.read_excel(book, sheet_name='Leave')
        self.df_work_model = self._read_work_model(book)
        self.df_training = self._read_training(book)
        self.df_ai_utilization = self._read_ai_utilization(book)
        self.df_ai_outcomes = self._read_ai_outcomes(book)
        self.df_cursor_billing = self._read_cursor_billing(book)
        self.ai_targets, self.ai_release_order, self.ai_target_rows = self._read_ai_targets(book)
        df_emp = self._people_to_employees(people)
        df_emp = self._attach_current_pay(df_emp)
        df_skill = self._skills_to_frame(skills)
        df_fin = self._read_pay_history()
        df_leave = self._leave_to_frame(leave, df_emp)
        return df_emp, df_skill, df_fin, df_leave

    def _people_to_employees(self, people):
        geo = _city_geo()
        numbers = _positive_ids(people['Employee number'])
        people = people.loc[numbers.notna() & (numbers > 0)].copy()
        people['Employee number'] = _positive_ids(people['Employee number']).astype(int)
        names = {
            int(row['Employee number']): f"{_plain(row['First name'])} {_plain(row['Last name'])}".strip()
            for row in people.to_dict('records')
        }
        rows = []
        for record in people.to_dict('records'):
            number = int(record['Employee number'])
            city = _plain(record.get('City'))
            region, country = geo.get(city.casefold(), ('', ''))
            country_cell = _plain(record.get('Country')) or country
            region_cell = _plain(record.get('Geographic state')) or region
            account = _plain(record.get('Account'))
            manager_number = _positive_ids(pd.Series([record.get('Manager employee number')])).iloc[0]
            manager_number = int(manager_number) if pd.notna(manager_number) and manager_number > 0 else None
            manager_written = _plain(record.get('Manager name'))
            if manager_written and manager_number:
                manager = f'{manager_written} ({manager_number})'
            elif manager_written:
                manager = manager_written
            elif manager_number and manager_number in names:
                manager = f'{names[manager_number]} ({manager_number})'
            elif manager_number:
                manager = f'Manager ({manager_number})'
            else:
                manager = None
            first = _plain(record.get('First name'))
            last = _plain(record.get('Last name'))
            work_model = _plain(record.get('Work model')) or 'Not recorded yet'
            rows.append({
                'EMPLOYEE NUMBER': number,
                'EMPLOYEE FIRST NAME': first or None,
                'EMPLOYEE LAST NAME': last or None,
                'EMAIL': _plain(record.get('Email')) or None,
                'DATE OF BIRTH': record.get('Date of birth'),
                'START DATE': record.get('Start date'),
                'EXIT DATE': record.get('Exit date'),
                'GENDER': _plain(record.get('Gender')) or None,
                'Country': country_cell or None,
                'Geographic_State': region_cell or None,
                'LOCATION': city or None,
                'State': account or None,
                'Project Working': account or None,
                'DEPARTMENT': _plain(record.get('Department')) or None,
                'JOB LEVEL': _plain(record.get('Grade')) or None,
                'JOB TITLE': _plain(record.get('Job title')) or None,
                'MANAGER': manager,
                'Module': _plain(record.get('Module')) or None,
                'Prior EXPERIENCE1': record.get('Prior experience (years)'),
                'Work_Model': work_model,
                'Employment_Type': _plain(record.get('Employment type')) or None,
                'Office': _plain(record.get('Office')) or None,
                'EMPLOYEE LABEL': f'{first} {last} ({number})'.strip(),
                'EMP_CTC1': np.nan,
                'M_Salary': np.nan,
                'Prev_CTC2': np.nan,
                'Last_Bonus': np.nan,
                'Hike_Percentage': np.nan,
            })
        return pd.DataFrame(rows)

    def _attach_current_pay(self, df_emp):
        path = self.compensation_path
        if not path or not os.path.exists(path):
            print(f'Compensation file not found at {path}. Current pay stays empty and finance synthesis still runs.')
            return df_emp
        pay_book = pd.ExcelFile(path)
        if 'Current pay' not in pay_book.sheet_names:
            print(f'Compensation file has no Current pay sheet: {path}')
            return df_emp
        pay = pd.read_excel(pay_book, sheet_name='Current pay')
        pay['EMPLOYEE NUMBER'] = _positive_ids(pay['Employee number']).fillna(0).astype(int)
        pay = pay[pay['EMPLOYEE NUMBER'] > 0].drop_duplicates('EMPLOYEE NUMBER').set_index('EMPLOYEE NUMBER')
        df_emp['EMP_CTC1'] = df_emp['EMPLOYEE NUMBER'].map(pay['Annual CTC (INR)'])
        df_emp['Prev_CTC2'] = df_emp['EMPLOYEE NUMBER'].map(pay['Previous CTC (INR)'])
        df_emp['Last_Bonus'] = df_emp['EMPLOYEE NUMBER'].map(pay['Last bonus (INR)'])
        df_emp['Hike_Percentage'] = df_emp['EMPLOYEE NUMBER'].map(pay['Last hike percent'])
        df_emp['M_Salary'] = pd.to_numeric(df_emp['EMP_CTC1'], errors='coerce') / 12.0
        return df_emp

    def _read_pay_history(self):
        columns = ['EMPLOYEE NUMBER', 'Year', 'Base_Salary', 'Bonus', 'Perks', 'Other_Comp', 'Is_Promotion', 'Hike', 'Prom_Eve_Date']
        path = self.compensation_path
        if not path or not os.path.exists(path):
            return pd.DataFrame(columns=columns)
        pay_book = pd.ExcelFile(path)
        if 'Pay history' not in pay_book.sheet_names:
            return pd.DataFrame(columns=columns)
        history = pd.read_excel(pay_book, sheet_name='Pay history')
        history = _drop_example_rows(history, 'Employee number')
        if history.empty:
            return pd.DataFrame(columns=columns)
        return pd.DataFrame({
            'EMPLOYEE NUMBER': _positive_ids(history['Employee number']).astype(int),
            'Year': pd.to_numeric(history['Year'], errors='coerce'),
            'Base_Salary': pd.to_numeric(history['Base salary (INR)'], errors='coerce'),
            'Bonus': pd.to_numeric(history['Bonus (INR)'], errors='coerce'),
            'Perks': pd.to_numeric(history['Perks (INR)'], errors='coerce'),
            'Other_Comp': pd.to_numeric(history['Other pay (INR)'], errors='coerce'),
            'Is_Promotion': history['Promotion'].map(_plain).replace('', 'No'),
            'Hike': pd.to_numeric(history['Hike percent'], errors='coerce'),
            'Prom_Eve_Date': history['Promotion date'],
        })

    def _skills_to_frame(self, skills):
        skills = _drop_example_rows(skills, 'Employee number')
        if skills.empty:
            return pd.DataFrame(columns=['EMPLOYEE NUMBER', 'Skill Name', 'Skill Level', 'Skill Type', 'Skill_Exp', 'Skill Category', 'IsActive'])
        return pd.DataFrame({
            'EMPLOYEE NUMBER': _positive_ids(skills['Employee number']).astype(int),
            'Skill Name': skills['Skill'].map(_plain),
            'Skill Level': skills['Level'].map(_plain),
            'Skill Type': skills['Primary or secondary'].map(_plain),
            'Skill_Exp': pd.to_numeric(skills['Years'], errors='coerce'),
            'Skill Category': skills['Category'].map(_plain),
            'IsActive': skills['Active'].map(_plain),
        })

    def _leave_to_frame(self, leave, df_emp):
        leave = _drop_example_rows(leave, 'Employee number')
        labels = df_emp.set_index('EMPLOYEE NUMBER')['EMPLOYEE LABEL'].to_dict() if not df_emp.empty else {}
        if leave.empty:
            return pd.DataFrame(columns=['EMPLOYEE', 'START DATE', 'END DATE', 'LEAVE TYPE', 'DAY VALUE', 'LEAVE TYPE SYMBOL'])
        numbers = _positive_ids(leave['Employee number']).astype(int)
        return pd.DataFrame({
            'EMPLOYEE': [labels.get(int(number), f'Employee ({int(number)})') for number in numbers],
            'START DATE': leave['Start date'].values,
            'END DATE': leave['End date'].values,
            'LEAVE TYPE': leave['Leave type'].map(_plain),
            'DAY VALUE': pd.to_numeric(leave['Days'], errors='coerce'),
            'LEAVE TYPE SYMBOL': None,
        })

    def _read_work_model(self, book):
        if 'Work model' not in book.sheet_names:
            return _empty_work_model()
        frame = _drop_example_rows(pd.read_excel(book, sheet_name='Work model'), 'Employee number')
        if frame.empty:
            return _empty_work_model()
        return pd.DataFrame({
            'EMPLOYEE NUMBER': _positive_ids(frame['Employee number']).astype(int),
            'Effective_Date': frame['Effective date'].values,
            'Work_Model': frame['Work model'].map(_plain),
            'Office_Days': pd.to_numeric(frame['Office days per week'], errors='coerce'),
            'City': frame['City'].map(_plain),
            'Notes': frame['Notes'].map(_plain),
        })

    def _read_training(self, book):
        if 'Training' not in book.sheet_names:
            return _empty_training()
        frame = _drop_example_rows(pd.read_excel(book, sheet_name='Training'), 'Employee number')
        if frame.empty:
            return _empty_training()
        return pd.DataFrame({
            'EMPLOYEE NUMBER': _positive_ids(frame['Employee number']).astype(int),
            'Training': frame['Training'].map(_plain),
            'Provider': frame['Provider'].map(_plain),
            'Start_Date': frame['Start date'].values,
            'End_Date': frame['End date'].values,
            'Status': frame['Status'].map(_plain),
            'Hours': pd.to_numeric(frame['Hours'], errors='coerce'),
            'Mandatory': frame['Mandatory'].map(_plain),
            'Skill': frame['Skill it supports'].map(_plain),
        })

    def _read_ai_utilization(self, book):
        if 'AI utilization' not in book.sheet_names:
            return _empty_ai_utilization()
        frame = _drop_example_text_rows(pd.read_excel(book, sheet_name='AI utilization'))
        if frame.empty:
            return _empty_ai_utilization()
        ids = _positive_ids(frame.get('Employee number'))
        input_tokens = pd.to_numeric(frame.get('Input tokens'), errors='coerce')
        output_tokens = pd.to_numeric(frame.get('Output tokens'), errors='coerce')
        total_tokens = pd.to_numeric(frame.get('Total tokens'), errors='coerce')
        total_tokens = total_tokens.fillna(input_tokens.fillna(0) + output_tokens.fillna(0))
        return pd.DataFrame({
            'Release': frame.get('Release', pd.Series(dtype=object)).map(_plain),
            'Domain': frame.get('Domain', pd.Series(dtype=object)).map(_plain),
            'Team': frame.get('Team', pd.Series(dtype=object)).map(_plain),
            'Manager': frame.get('Manager', pd.Series(dtype=object)).map(_plain),
            'EMPLOYEE NUMBER': ids,
            'Employee_Name': frame.get('Employee name', pd.Series(dtype=object)).map(_plain),
            'Period_Start': pd.to_datetime(frame.get('Period start'), errors='coerce'),
            'Period_End': pd.to_datetime(frame.get('Period end'), errors='coerce'),
            'Tool': frame.get('Tool', pd.Series(dtype=object)).map(_plain),
            'Provider': frame.get('Provider', pd.Series(dtype=object)).map(_plain),
            'Use_Case': frame.get('Use case', pd.Series(dtype=object)).map(_plain),
            'Activity': frame.get('Activity', pd.Series(dtype=object)).map(_plain),
            'Request_Count': pd.to_numeric(frame.get('Request count'), errors='coerce'),
            'Input_Tokens': input_tokens,
            'Output_Tokens': output_tokens,
            'Total_Tokens': total_tokens,
            'Hours_Saved': pd.to_numeric(frame.get('Hours saved'), errors='coerce'),
            'Baseline_Hours': pd.to_numeric(frame.get('Baseline hours without AI'), errors='coerce'),
            'Benefit_Note': frame.get('Benefit note', pd.Series(dtype=object)).map(_plain),
            'Source': frame.get('Source', pd.Series(dtype=object)).map(_plain),
            'Challenges': frame.get('Challenges', pd.Series(dtype=object)).map(_plain),
            'Notes': frame.get('Notes', pd.Series(dtype=object)).map(_plain),
            'Sprint': frame.get('Sprint', pd.Series(dtype=object)).map(_plain),
            'Project': frame.get('Project', pd.Series(dtype=object)).map(_plain),
            'Account': frame.get('Account', pd.Series(dtype=object)).map(_plain),
            'Cached_Input_Tokens': pd.to_numeric(frame.get('Cached input tokens'), errors='coerce'),
            'Cost_USD': pd.to_numeric(frame.get('Cost (USD)'), errors='coerce'),
            'Accepted_Lines': pd.to_numeric(frame.get('Accepted lines'), errors='coerce'),
            'Generated_Lines': pd.to_numeric(frame.get('Generated lines'), errors='coerce'),
            'Policy_Flag': frame.get('Policy flag', pd.Series(dtype=object)).map(_plain),
            'External_Id': frame.get('External id', pd.Series(dtype=object)).map(_plain),
            'Test_Cases_Generated': pd.to_numeric(frame.get('Test cases generated'), errors='coerce'),
            'Automation_Assets': pd.to_numeric(frame.get('Automation assets'), errors='coerce'),
            'Artifacts_Generated': pd.to_numeric(frame.get('Artifacts generated'), errors='coerce'),
            'Story_Ids': frame.get('Story ids', pd.Series(dtype=object)).map(_plain) if 'Story ids' in frame.columns else pd.Series(dtype=object),
        })

    def _read_ai_outcomes(self, book):
        if 'AI release outcomes' not in book.sheet_names:
            return _empty_ai_outcomes()
        frame = _drop_example_text_rows(pd.read_excel(book, sheet_name='AI release outcomes'))
        if frame.empty:
            return _empty_ai_outcomes()
        return pd.DataFrame({
            'Release': frame.get('Release', pd.Series(dtype=object)).map(_plain),
            'Domain': frame.get('Domain', pd.Series(dtype=object)).map(_plain),
            'Team': frame.get('Team', pd.Series(dtype=object)).map(_plain),
            'Owner': frame.get('Owner', pd.Series(dtype=object)).map(_plain),
            'Headcount': pd.to_numeric(frame.get('Headcount in scope'), errors='coerce'),
            'People_Using': pd.to_numeric(frame.get('People using AI'), errors='coerce'),
            'Adoption_Pct': pd.to_numeric(frame.get('Adoption %'), errors='coerce'),
            'Total_Tokens': pd.to_numeric(frame.get('Total tokens'), errors='coerce'),
            'Hours_Saved': pd.to_numeric(frame.get('Total hours saved'), errors='coerce'),
            'Tools_Used': frame.get('Tools used', pd.Series(dtype=object)).map(_plain),
            'Top_Use_Cases': frame.get('Top use cases', pd.Series(dtype=object)).map(_plain),
            'Measurable_Benefits': frame.get('Measurable benefits', pd.Series(dtype=object)).map(_plain),
            'Gaps': frame.get('Gaps', pd.Series(dtype=object)).map(_plain),
            'Challenges': frame.get('Challenges', pd.Series(dtype=object)).map(_plain),
            'Opportunities': frame.get('Opportunities next release', pd.Series(dtype=object)).map(_plain),
            'Status': frame.get('Status', pd.Series(dtype=object)).map(_plain),
            'Submitted_On': pd.to_datetime(frame.get('Submitted on'), errors='coerce'),
            'Reviewed_By': frame.get('Reviewed by', pd.Series(dtype=object)).map(_plain),
            'Project': frame.get('Project', pd.Series(dtype=object)).map(_plain) if 'Project' in frame.columns else pd.Series(dtype=object),
            'Stories_Delivered': pd.to_numeric(frame.get('Stories delivered'), errors='coerce') if 'Stories delivered' in frame.columns else pd.Series(dtype=float),
            'Stories_Using_AI': pd.to_numeric(frame.get('Stories using AI'), errors='coerce') if 'Stories using AI' in frame.columns else pd.Series(dtype=float),
            'Defects_Baseline': pd.to_numeric(frame.get('Defects baseline'), errors='coerce') if 'Defects baseline' in frame.columns else pd.Series(dtype=float),
            'Defects_Actual': pd.to_numeric(frame.get('Defects actual'), errors='coerce') if 'Defects actual' in frame.columns else pd.Series(dtype=float),
            'Cycle_Time_Days_Saved': pd.to_numeric(frame.get('Cycle time days saved'), errors='coerce') if 'Cycle time days saved' in frame.columns else pd.Series(dtype=float),
            'Release_Sequence': pd.to_numeric(frame.get('Release sequence'), errors='coerce') if 'Release sequence' in frame.columns else pd.Series(dtype=float),
            'Release_Date': pd.to_datetime(frame.get('Release date'), errors='coerce') if 'Release date' in frame.columns else pd.Series(dtype='datetime64[ns]'),
        })

    def _read_cursor_billing(self, book):
        if 'Cursor billing' not in book.sheet_names:
            return _empty_cursor_billing()
        frame = _drop_example_text_rows(pd.read_excel(book, sheet_name='Cursor billing'))
        if frame.empty:
            return _empty_cursor_billing()
        return pd.DataFrame({
            'Name': frame.get('Name', pd.Series(dtype=object)).map(_plain),
            'Cost_USD': pd.to_numeric(frame.get('Total Usage (USD)'), errors='coerce'),
            'Month': frame.get('Month', pd.Series(dtype=object)).map(_plain),
            'Billing_Start': pd.to_datetime(frame.get('Billing Start Date'), errors='coerce'),
            'Billing_End': pd.to_datetime(frame.get('Billing End Date'), errors='coerce'),
            'EMPLOYEE NUMBER': _positive_ids(frame.get('Employee number')),
            'Team': frame.get('Team', pd.Series(dtype=object)).map(_plain),
            'Project': frame.get('Project', pd.Series(dtype=object)).map(_plain),
        })

    def _read_ai_targets(self, book):
        """`AI targets` sheet -> (targets dict, release order dict, sheet row count). Defaults fill any missing metric."""
        targets = _default_ai_targets()
        release_order = {}
        if 'AI targets' not in book.sheet_names:
            return targets, release_order, 0
        frame = pd.read_excel(book, sheet_name='AI targets')
        rows = 0
        for record in frame.to_dict('records'):
            metric = _plain(record.get('Metric'))
            if metric and not metric.upper().startswith('EXAMPLE'):
                target = pd.to_numeric(pd.Series([record.get('Target')]), errors='coerce').iloc[0]
                if pd.notna(target):
                    entry = targets.get(metric, {'target': None, 'tolerance': 0.10, 'lower_is_better': False, 'unit': ''})
                    entry['target'] = float(target)
                    tolerance = pd.to_numeric(pd.Series([record.get('Tolerance')]), errors='coerce').iloc[0]
                    if pd.notna(tolerance):
                        tolerance = float(tolerance)
                        entry['tolerance'] = tolerance / 100.0 if tolerance > 1 else tolerance
                    lower = _plain(record.get('Lower_Is_Better')).casefold()
                    if lower:
                        entry['lower_is_better'] = lower in ('yes', 'y', 'true', '1')
                    unit = _plain(record.get('Unit'))
                    if unit:
                        entry['unit'] = unit
                    targets[metric] = entry
                    rows += 1
            release = _plain(record.get('Release'))
            sequence = pd.to_numeric(pd.Series([record.get('Sequence')]), errors='coerce').iloc[0]
            if release and pd.notna(sequence):
                release_order[release] = int(sequence)
        return targets, release_order, rows

    def load_data(self):
        print(f'Loading data from: {self.file_path}')
        df_emp, df_skill, df_fin, df_leave = self._read_sources()
        # Drop unnamed empty columns
        cols_to_keep = [c for c in df_emp.columns if not str(c).startswith('Unnamed:')]
        df_emp = df_emp[cols_to_keep].copy()
        
        # Clean columns
        df_emp['EMPLOYEE NUMBER'] = pd.to_numeric(df_emp['EMPLOYEE NUMBER'], errors='coerce').fillna(0).astype(int)
        df_emp = df_emp[df_emp['EMPLOYEE NUMBER'] > 0].copy()
        
        # Parse Dates
        df_emp['START DATE'] = pd.to_datetime(df_emp['START DATE'], errors='coerce')
        df_emp['EXIT DATE'] = pd.to_datetime(df_emp['EXIT DATE'], errors='coerce')
        df_emp['DATE OF BIRTH'] = pd.to_datetime(df_emp['DATE OF BIRTH'], errors='coerce')
        
        # Experiences
        df_emp['Prior_Exp'] = pd.to_numeric(df_emp['Prior EXPERIENCE1'], errors='coerce').fillna(0.0)
        
        # Infinite / ETS experience (years from START DATE to EXIT DATE or REF_DATE)
        end_dates = df_emp['EXIT DATE'].fillna(REF_DATE)
        df_emp['Infinite_Exp'] = np.maximum(0.0, (end_dates - df_emp['START DATE']).dt.days / 365.25).round(2)
        df_emp['Total_Exp'] = (df_emp['Prior_Exp'] + df_emp['Infinite_Exp']).round(2)
        
        # CTC & Monthly Salary
        df_emp['EMP_CTC1'] = pd.to_numeric(df_emp['EMP_CTC1'], errors='coerce').fillna(0.0)
        df_emp['M_Salary'] = pd.to_numeric(df_emp['M_Salary'], errors='coerce').fillna(df_emp['EMP_CTC1'] / 12).round(2)
        df_emp['Prev_CTC2'] = pd.to_numeric(df_emp['Prev_CTC2'], errors='coerce').fillna(0.0)
        df_emp['Last_Bonus'] = pd.to_numeric(df_emp['Last_Bonus'], errors='coerce').fillna(0.0)
        df_emp['Hike_Percentage'] = pd.to_numeric(df_emp['Hike_Percentage'], errors='coerce').fillna(0.0)
        
        # Categorical fallbacks
        df_emp['GENDER'] = df_emp['GENDER'].fillna('Unknown').astype(str).str.strip()
        df_emp['LOCATION'] = df_emp['LOCATION'].fillna('Unknown').astype(str).str.strip()
        df_emp['State'] = df_emp['State'].fillna('Unknown').astype(str).str.strip()
        df_emp['Project Working'] = df_emp['Project Working'].fillna(df_emp['State']).astype(str).str.strip().replace({'NH Projects': 'NH'})
        df_emp['JOB LEVEL'] = df_emp['JOB LEVEL'].fillna('Unknown').astype(str).str.strip()
        df_emp['JOB TITLE'] = df_emp['JOB TITLE'].fillna('Unknown').astype(str).str.strip()
        df_emp['DEPARTMENT'] = df_emp['DEPARTMENT'].fillna('Core').astype(str).str.strip()
        df_emp['MANAGER'] = df_emp['MANAGER'].fillna('Unassigned').astype(str).str.strip()
        df_emp['EMPLOYEE LABEL'] = df_emp['EMPLOYEE LABEL'].fillna(
            df_emp['EMPLOYEE FIRST NAME'].astype(str) + ' ' + df_emp['EMPLOYEE LAST NAME'].astype(str) + ' (' + df_emp['EMPLOYEE NUMBER'].astype(str) + ')'
        ).astype(str).str.strip()
        if 'Module' in df_emp.columns:
            df_emp['Module'] = df_emp['Module'].apply(lambda x: str(x).strip() if pd.notna(x) and str(x).strip() not in ('', 'nan', 'None') else None)
        else:
            df_emp['Module'] = None
        
        # Salary Bin categorization
        def get_salary_bin(ctc):
            if ctc < 500000:
                return '< 5L'
            elif ctc < 1000000:
                return '5-10L'
            elif ctc < 1500000:
                return '10-15L'
            elif ctc < 2000000:
                return '15-20L'
            else:
                return '20L+'
        df_emp['SalaryBin'] = df_emp['EMP_CTC1'].apply(get_salary_bin)
        
        # 2. Skills (legacy SKILL sheet, or People-file Skills already mapped)
        df_skill['EMPLOYEE NUMBER'] = pd.to_numeric(df_skill['EMPLOYEE NUMBER'], errors='coerce').fillna(0).astype(int)
        df_skill['Skill Name'] = df_skill['Skill Name'].fillna('').astype(str).str.strip()
        df_skill['Skill Level'] = df_skill['Skill Level'].fillna('Intermediate').astype(str).str.strip()
        df_skill['Skill Type'] = df_skill['Skill Type'].fillna('Primary').astype(str).str.strip()
        df_skill['Skill_Exp'] = pd.to_numeric(df_skill.get('Skill_Exp', 0), errors='coerce').fillna(0.0)
        df_skill['IsActive'] = df_skill['IsActive'].fillna('Yes').astype(str).str.strip()
        df_skill = df_skill[df_skill['Skill Name'] != ''].copy()
        self.df_skills = df_skill

        # Index primary and secondary skills directly onto df_employees
        primary_skills = df_skill[df_skill['Skill Type'] == 'Primary'].sort_values('Skill_Exp', ascending=False).drop_duplicates(subset=['EMPLOYEE NUMBER']).set_index('EMPLOYEE NUMBER')
        all_emp_skills = df_skill.sort_values('Skill_Exp', ascending=False).drop_duplicates(subset=['EMPLOYEE NUMBER']).set_index('EMPLOYEE NUMBER')

        secondary_map = {}
        all_skills_map = {}
        for emp_id, group in df_skill.groupby('EMPLOYEE NUMBER'):
            prim_name = primary_skills.loc[emp_id, 'Skill Name'] if emp_id in primary_skills.index else None
            sec_skills = group[group['Skill Name'] != prim_name]['Skill Name'].tolist()
            secondary_map[emp_id] = sec_skills
            all_skills_map[emp_id] = group['Skill Name'].tolist()

        df_emp['Primary_Skill'] = df_emp['EMPLOYEE NUMBER'].map(primary_skills['Skill Name']).fillna(
            df_emp['EMPLOYEE NUMBER'].map(all_emp_skills['Skill Name'])
        ).fillna('General Engineering')
        df_emp['Primary_Skill_Exp'] = df_emp['EMPLOYEE NUMBER'].map(primary_skills['Skill_Exp']).fillna(
            df_emp['EMPLOYEE NUMBER'].map(all_emp_skills['Skill_Exp'])
        ).fillna(0.0)
        df_emp['Primary_Skill_Level'] = df_emp['EMPLOYEE NUMBER'].map(primary_skills['Skill Level']).fillna(
            df_emp['EMPLOYEE NUMBER'].map(all_emp_skills['Skill Level'])
        ).fillna('Intermediate')
        df_emp['Secondary_Skills'] = df_emp['EMPLOYEE NUMBER'].map(secondary_map).apply(lambda x: x if isinstance(x, list) else [])
        df_emp['All_Skills'] = df_emp['EMPLOYEE NUMBER'].map(all_skills_map).apply(lambda x: x if isinstance(x, list) else [])
        
        self.df_employees = df_emp
        
        # 3. Finance history (legacy sheet, or Pay history from the compensation file) and enrich across full workforce
        df_fin['EMPLOYEE NUMBER'] = pd.to_numeric(df_fin['EMPLOYEE NUMBER'], errors='coerce').fillna(0).astype(int)
        df_fin = df_fin[df_fin['EMPLOYEE NUMBER'] > 0].copy()
        df_fin['Year'] = pd.to_numeric(df_fin['Year'], errors='coerce').fillna(2024).astype(int)
        df_fin['Base_Salary'] = pd.to_numeric(df_fin['Base_Salary'], errors='coerce').fillna(0.0)
        df_fin['Bonus'] = pd.to_numeric(df_fin['Bonus'], errors='coerce').fillna(0.0)
        df_fin['Perks'] = pd.to_numeric(df_fin['Perks'], errors='coerce').fillna(0.0)
        df_fin['Other_Comp'] = pd.to_numeric(df_fin['Other_Comp'], errors='coerce').fillna(0.0)
        
        # Calculate Total CTC for existing rows
        df_fin['Total_CTC'] = df_fin['Base_Salary'] + df_fin['Bonus'] + df_fin['Perks'] + df_fin['Other_Comp']
        df_fin['M_Salary'] = df_fin['Total_CTC'] / 12.0
        df_fin['Is_Promotion'] = df_fin['Is_Promotion'].fillna('No').astype(str).str.strip()
        df_fin['record_origin'] = 'EXCEL_SOURCE'
        df_fin['is_synthetic'] = False
        df_fin['derivation_rule'] = 'EXCEL_FINANCE_HISTORY_SHEET'

        # Multi-year progression synthesis for workforce employees not in sample Finance_History
        existing_fin_ids = set(df_fin['EMPLOYEE NUMBER'].unique())
        synth_history = []

        for _, emp in self.df_employees.iterrows():
            emp_id = int(emp['EMPLOYEE NUMBER'])
            if emp_id in existing_fin_ids:
                continue

            c24 = float(emp['EMP_CTC1']) if pd.notnull(emp['EMP_CTC1']) and emp['EMP_CTC1'] > 0 else 300000.0
            c23 = float(emp['Prev_CTC2']) if pd.notnull(emp['Prev_CTC2']) and emp['Prev_CTC2'] > 0 else c24 * 0.88

            join_year = 2022
            if pd.notnull(emp.get('START DATE')):
                try:
                    join_year = pd.to_datetime(emp['START DATE']).year
                except:
                    join_year = 2022

            # 2024 (Current annualized compensation)
            hike_24 = (c24 - c23) / c23 if c23 > 0 else 0.12
            synth_history.append({
                'EMPLOYEE NUMBER': emp_id,
                'Year': 2024,
                'Base_Salary': round(c24 * 0.85, 2),
                'Bonus': round(c24 * 0.10, 2),
                'Perks': round(c24 * 0.03, 2),
                'Other_Comp': round(c24 * 0.02, 2),
                'Total_CTC': round(c24, 2),
                'M_Salary': round(c24 / 12.0, 2),
                'Hike': round(hike_24, 4),
                'Is_Promotion': 'Yes' if hike_24 > 0.25 else 'No',
                'record_origin': 'SYNTHETIC_DERIVED',
                'is_synthetic': True,
                'derivation_rule': 'HEURISTIC_WORKFORCE_PROGRESSION_V1'
            })

            # 2023 (Previous baseline compensation)
            if join_year <= 2023:
                c22 = c23 * 0.88
                hike_23 = (c23 - c22) / c22 if c22 > 0 else 0.10
                synth_history.append({
                    'EMPLOYEE NUMBER': emp_id,
                    'Year': 2023,
                    'Base_Salary': round(c23 * 0.85, 2),
                    'Bonus': round(c23 * 0.10, 2),
                    'Perks': round(c23 * 0.03, 2),
                    'Other_Comp': round(c23 * 0.02, 2),
                    'Total_CTC': round(c23, 2),
                    'M_Salary': round(c23 / 12.0, 2),
                    'Hike': round(hike_23, 4),
                    'Is_Promotion': 'Yes' if hike_23 > 0.20 else 'No',
                    'record_origin': 'SYNTHETIC_DERIVED',
                    'is_synthetic': True,
                    'derivation_rule': 'HEURISTIC_WORKFORCE_PROGRESSION_V1'
                })

            # 2022
            if join_year <= 2022:
                c22 = c23 * 0.88
                synth_history.append({
                    'EMPLOYEE NUMBER': emp_id,
                    'Year': 2022,
                    'Base_Salary': round(c22 * 0.85, 2),
                    'Bonus': round(c22 * 0.10, 2),
                    'Perks': round(c22 * 0.03, 2),
                    'Other_Comp': round(c22 * 0.02, 2),
                    'Total_CTC': round(c22, 2),
                    'M_Salary': round(c22 / 12.0, 2),
                    'Hike': 0.10,
                    'Is_Promotion': 'No',
                    'record_origin': 'SYNTHETIC_DERIVED',
                    'is_synthetic': True,
                    'derivation_rule': 'HEURISTIC_WORKFORCE_PROGRESSION_V1'
                })

            # 2021
            if join_year <= 2021:
                c21 = c23 * 0.88 * 0.90
                synth_history.append({
                    'EMPLOYEE NUMBER': emp_id,
                    'Year': 2021,
                    'Base_Salary': round(c21 * 0.85, 2),
                    'Bonus': round(c21 * 0.10, 2),
                    'Perks': round(c21 * 0.03, 2),
                    'Other_Comp': round(c21 * 0.02, 2),
                    'Total_CTC': round(c21, 2),
                    'M_Salary': round(c21 / 12.0, 2),
                    'Hike': 0.10,
                    'Is_Promotion': 'No',
                    'record_origin': 'SYNTHETIC_DERIVED',
                    'is_synthetic': True,
                    'derivation_rule': 'HEURISTIC_WORKFORCE_PROGRESSION_V1'
                })

            # 2020
            if join_year <= 2020:
                c20 = c23 * 0.88 * 0.90 * 0.90
                synth_history.append({
                    'EMPLOYEE NUMBER': emp_id,
                    'Year': 2020,
                    'Base_Salary': round(c20 * 0.85, 2),
                    'Bonus': round(c20 * 0.10, 2),
                    'Perks': round(c20 * 0.03, 2),
                    'Other_Comp': round(c20 * 0.02, 2),
                    'Total_CTC': round(c20, 2),
                    'M_Salary': round(c20 / 12.0, 2),
                    'Hike': 0.10,
                    'Is_Promotion': 'No',
                    'record_origin': 'SYNTHETIC_DERIVED',
                    'is_synthetic': True,
                    'derivation_rule': 'HEURISTIC_WORKFORCE_PROGRESSION_V1'
                })

        if synth_history:
            df_fin = pd.concat([df_fin, pd.DataFrame(synth_history)], ignore_index=True)

        # Ensure YoY hike for existing records
        df_fin = df_fin.sort_values(['EMPLOYEE NUMBER', 'Year'])
        if 'Hike' not in df_fin.columns:
            df_fin['Hike'] = np.nan
        df_fin['Hike'] = df_fin.groupby('EMPLOYEE NUMBER')['Total_CTC'].pct_change().fillna(df_fin['Hike']).fillna(0.10)
        df_fin['SalaryBin'] = df_fin['Total_CTC'].apply(get_salary_bin)

        # Merge with employee metadata for fast slicing
        df_fin = df_fin.merge(
            self.df_employees[['EMPLOYEE NUMBER', 'EMPLOYEE LABEL', 'JOB LEVEL', 'DEPARTMENT', 'LOCATION', 'State', 'MANAGER', 'Project Working', 'Module']],
            on='EMPLOYEE NUMBER',
            how='left'
        )
        self.df_finance = df_fin
        
        # 4. Leave (legacy LEAVE sheet skips two note rows; the friendly Leave sheet is already mapped)
        cols_leave = [c for c in df_leave.columns if not str(c).startswith('Unnamed:')]
        df_leave = df_leave[cols_leave].copy()
        
        # Extract Employee ID
        def extract_emp_num(text):
            if not isinstance(text, str):
                return 0
            if '(' in text and ')' in text:
                try:
                    return int(text.split('(')[-1].split(')')[0].strip())
                except:
                    return 0
            return 0
            
        df_leave['EMPLOYEE NUMBER'] = df_leave['EMPLOYEE'].apply(extract_emp_num)
        df_leave['START DATE'] = pd.to_datetime(df_leave['START DATE'], errors='coerce')
        df_leave['END DATE'] = pd.to_datetime(df_leave['END DATE'], errors='coerce')
        df_leave['LEAVE TYPE'] = df_leave['LEAVE TYPE'].fillna('Casual / Sick').astype(str).str.strip()
        df_leave['DAY VALUE'] = pd.to_numeric(df_leave['DAY VALUE'], errors='coerce').fillna(1.0)
        df_leave['LEAVE TYPE SYMBOL'] = df_leave['LEAVE TYPE SYMBOL'].fillna('C').astype(str).str.strip()
        
        # Merge with employee metadata
        df_leave = df_leave.merge(
            self.df_employees[['EMPLOYEE NUMBER', 'EMPLOYEE FIRST NAME', 'EMPLOYEE LAST NAME', 'JOB LEVEL', 'DEPARTMENT', 'LOCATION', 'State', 'MANAGER', 'Project Working', 'Module']],
            on='EMPLOYEE NUMBER',
            how='left'
        )
        self.df_leave = df_leave
        
        print(f'Data Loaded Successfully ({self.workbook_kind}):')
        print(f' - Employees: {len(self.df_employees)}')
        print(f' - Skills: {len(self.df_skills)}')
        print(f' - Finance History: {len(self.df_finance)}')
        print(f' - Leave Records: {len(self.df_leave)}')
        print(f' - Work model history: {len(self.df_work_model)}')
        print(f' - Training: {len(self.df_training)}')
        print(f' - AI utilization: {len(self.df_ai_utilization)}')
        print(f' - AI outcomes: {len(self.df_ai_outcomes)}')
        print(f' - Cursor billing: {len(self.df_cursor_billing)}')
        print(f' - AI targets: {self.ai_target_rows} sheet rows ({len(self.ai_targets)} metrics resolved)')

data_loader = DataLoader()


def reload_all():
    """
    Unified thread-safe reload hook.
    1. Reloads Pandas DataFrames from self.file_path.
    2. Repopulates SQLite in-memory tables in sqlite_engine.
    3. Clears cached entity indexes in EntityNormalizer.
    """
    data_loader.load_data()
    try:
        from backend.app.ai.db import sqlite_engine
        sqlite_engine._populate_tables()
    except Exception as e:
        print(f"Warning: sqlite_engine._populate_tables() failed during reload: {e}")
    try:
        from backend.app.ai.capability_registry import EntityNormalizer
        EntityNormalizer._employee_index = None
        EntityNormalizer._skill_names = None
    except Exception:
        pass
    return {
        "status": "reloaded",
        "total_employees": len(data_loader.df_employees),
        "total_skills": len(data_loader.df_skills),
        "total_leaves": len(data_loader.df_leave),
        "total_finance_records": len(data_loader.df_finance),
        "workbook_kind": data_loader.workbook_kind,
        "workforce_file": os.path.basename(data_loader.file_path),
        "compensation_file": os.path.basename(data_loader.compensation_path) if data_loader.workbook_kind == 'friendly' else None,
        "work_model_rows": len(data_loader.df_work_model),
        "training_rows": len(data_loader.df_training),
        "ai_utilization_rows": len(data_loader.df_ai_utilization),
        "ai_outcome_rows": len(data_loader.df_ai_outcomes),
        "cursor_billing_rows": len(data_loader.df_cursor_billing),
        "ai_target_rows": int(getattr(data_loader, 'ai_target_rows', 0)),
    }
