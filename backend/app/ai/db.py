import sqlite3
import pandas as pd
import numpy as np
import threading
from typing import Dict, Any, List, Optional
from backend.app.data_loader import data_loader

_local = threading.local()
_global_db_conn = None
_lock = threading.Lock()

def _sanitize_series(series: pd.Series, dtype: str = "text") -> pd.Series:
    if dtype == "text":
        return series.fillna("").astype(str).str.strip()
    elif dtype == "numeric":
        return pd.to_numeric(series, errors="coerce").fillna(0.0)
    elif dtype == "int":
        return pd.to_numeric(series, errors="coerce").fillna(0).astype(int)
    elif dtype == "date":
        return pd.to_datetime(series, errors="coerce").dt.strftime("%Y-%m-%d").fillna("")
    return series

class SQLiteEngine:
    def __init__(self):
        self._init_database()

    def _init_database(self):
        # Create an in-memory database shared across threads using URI or global connection
        self.conn = sqlite3.connect("file:ets_memdb?mode=memory&cache=shared", uri=True, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self._populate_tables()

    def _populate_tables(self):
        cursor = self.conn.cursor()

        # 1. Employees Table
        df_emp = data_loader.df_employees.copy()
        clean_emp = pd.DataFrame()
        clean_emp['employee_number'] = _sanitize_series(df_emp['EMPLOYEE NUMBER'], "int")
        clean_emp['first_name'] = _sanitize_series(df_emp['EMPLOYEE FIRST NAME'], "text")
        clean_emp['last_name'] = _sanitize_series(df_emp['EMPLOYEE LAST NAME'], "text")
        clean_emp['employee_label'] = _sanitize_series(df_emp['EMPLOYEE LABEL'], "text")
        clean_emp['email'] = _sanitize_series(df_emp['EMAIL'], "text")
        clean_emp['gender'] = _sanitize_series(df_emp['GENDER'], "text")
        clean_emp['location'] = _sanitize_series(df_emp['LOCATION'], "text")
        clean_emp['state'] = _sanitize_series(df_emp['State'], "text")
        clean_emp['department'] = _sanitize_series(df_emp['DEPARTMENT'], "text")
        clean_emp['job_level'] = _sanitize_series(df_emp['JOB LEVEL'], "text")
        clean_emp['job_title'] = _sanitize_series(df_emp['JOB TITLE'], "text")
        clean_emp['manager'] = _sanitize_series(df_emp['MANAGER'], "text")
        clean_emp['project'] = _sanitize_series(df_emp['Project Working'], "text")
        clean_emp['current_status'] = np.where(df_emp['EXIT DATE'].notna(), 'Exited', 'Active')
        clean_emp['start_date'] = _sanitize_series(df_emp['START DATE'], "date")
        clean_emp['exit_date'] = _sanitize_series(df_emp['EXIT DATE'], "date")
        clean_emp['annual_ctc'] = _sanitize_series(df_emp['EMP_CTC1'], "numeric")
        clean_emp['monthly_salary'] = _sanitize_series(df_emp['M_Salary'], "numeric")
        clean_emp['prior_exp'] = _sanitize_series(df_emp['Prior_Exp'], "numeric")
        clean_emp['infinite_exp'] = _sanitize_series(df_emp['Infinite_Exp'], "numeric")
        clean_emp['total_exp'] = _sanitize_series(df_emp['Total_Exp'], "numeric")
        clean_emp['salary_bin'] = _sanitize_series(df_emp['SalaryBin'], "text")
        clean_emp['primary_skill'] = _sanitize_series(df_emp['Primary_Skill'], "text")
        clean_emp['primary_skill_exp'] = _sanitize_series(df_emp['Primary_Skill_Exp'], "numeric")
        clean_emp['primary_skill_level'] = _sanitize_series(df_emp['Primary_Skill_Level'], "text")
        clean_emp['date_of_birth'] = _sanitize_series(df_emp['DATE OF BIRTH'], "date")
        dob_series = pd.to_datetime(df_emp['DATE OF BIRTH'], errors='coerce')
        now = pd.Timestamp.now()
        clean_emp['age'] = ((now - dob_series).dt.days // 365.25).fillna(0).astype(int)

        clean_emp.to_sql("employees", self.conn, if_exists="replace", index=False)

        # 2. Skills Table
        df_sk = data_loader.df_skills.copy()
        clean_sk = pd.DataFrame()
        clean_sk['employee_number'] = _sanitize_series(df_sk['EMPLOYEE NUMBER'], "int")
        clean_sk['skill_name'] = _sanitize_series(df_sk['Skill Name'], "text")
        clean_sk['skill_type'] = _sanitize_series(df_sk['Skill Type'], "text")
        clean_sk['skill_level'] = _sanitize_series(df_sk['Skill Level'], "text")
        clean_sk['skill_exp'] = _sanitize_series(df_sk['Skill_Exp'], "numeric")
        clean_sk['skill_category'] = _sanitize_series(df_sk['Skill Category'], "text")
        clean_sk['is_active'] = _sanitize_series(df_sk['IsActive'], "text")

        clean_sk.to_sql("skills", self.conn, if_exists="replace", index=False)

        # 3. Leaves Table
        df_lv = data_loader.df_leave.copy()
        clean_lv = pd.DataFrame()
        clean_lv['employee_number'] = _sanitize_series(df_lv['EMPLOYEE NUMBER'], "int")
        clean_lv['start_date'] = _sanitize_series(df_lv['START DATE'], "date")
        clean_lv['end_date'] = _sanitize_series(df_lv['END DATE'], "date")
        clean_lv['leave_type'] = _sanitize_series(df_lv['LEAVE TYPE'], "text")
        clean_lv['day_value'] = _sanitize_series(df_lv['DAY VALUE'], "numeric")
        clean_lv['job_level'] = _sanitize_series(df_lv['JOB LEVEL'], "text")
        clean_lv['department'] = _sanitize_series(df_lv['DEPARTMENT'], "text")
        clean_lv['location'] = _sanitize_series(df_lv['LOCATION'], "text")
        clean_lv['state'] = _sanitize_series(df_lv['State'], "text")
        clean_lv['manager'] = _sanitize_series(df_lv['MANAGER'], "text")
        clean_lv['project'] = _sanitize_series(df_lv['Project Working'], "text")

        clean_lv.to_sql("leaves", self.conn, if_exists="replace", index=False)

        # 4. Finance History Table
        df_fn = data_loader.df_finance.copy()
        clean_fn = pd.DataFrame()
        clean_fn['employee_number'] = _sanitize_series(df_fn['EMPLOYEE NUMBER'], "int")
        clean_fn['year'] = _sanitize_series(df_fn['Year'], "int")
        clean_fn['base_salary'] = _sanitize_series(df_fn['Base_Salary'], "numeric")
        clean_fn['bonus'] = _sanitize_series(df_fn['Bonus'], "numeric")
        clean_fn['perks'] = _sanitize_series(df_fn['Perks'], "numeric")
        clean_fn['other_comp'] = _sanitize_series(df_fn['Other_Comp'], "numeric")
        clean_fn['is_promotion'] = _sanitize_series(df_fn['Is_Promotion'], "text")
        clean_fn['monthly_salary'] = _sanitize_series(df_fn['M_Salary'], "numeric")
        clean_fn['total_ctc'] = _sanitize_series(df_fn['Total_CTC'], "numeric")
        clean_fn['hike_percent'] = _sanitize_series(df_fn['Hike'], "numeric")
        clean_fn['salary_bin'] = _sanitize_series(df_fn['SalaryBin'], "text")
        clean_fn['job_level'] = _sanitize_series(df_fn['JOB LEVEL'], "text")
        clean_fn['department'] = _sanitize_series(df_fn['DEPARTMENT'], "text")
        clean_fn['location'] = _sanitize_series(df_fn['LOCATION'], "text")
        clean_fn['state'] = _sanitize_series(df_fn['State'], "text")
        clean_fn['manager'] = _sanitize_series(df_fn['MANAGER'], "text")
        clean_fn['project'] = _sanitize_series(df_fn['Project Working'], "text")
        clean_fn['record_origin'] = _sanitize_series(df_fn.get('record_origin', 'EXCEL_SOURCE'), "text")
        clean_fn['is_synthetic'] = df_fn.get('is_synthetic', False).astype(int)
        clean_fn['derivation_rule'] = _sanitize_series(df_fn.get('derivation_rule', ''), "text")

        clean_fn.to_sql("finance_history", self.conn, if_exists="replace", index=False)

        # Build Indexes
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_emp_num ON employees(employee_number);",
            "CREATE INDEX IF NOT EXISTS idx_emp_status ON employees(current_status);",
            "CREATE INDEX IF NOT EXISTS idx_emp_level ON employees(job_level);",
            "CREATE INDEX IF NOT EXISTS idx_emp_state ON employees(state);",
            "CREATE INDEX IF NOT EXISTS idx_emp_mgr ON employees(manager);",
            "CREATE INDEX IF NOT EXISTS idx_emp_proj ON employees(project);",
            "CREATE INDEX IF NOT EXISTS idx_sk_emp ON skills(employee_number);",
            "CREATE INDEX IF NOT EXISTS idx_sk_name ON skills(skill_name);",
            "CREATE INDEX IF NOT EXISTS idx_lv_emp ON leaves(employee_number);",
            "CREATE INDEX IF NOT EXISTS idx_lv_type ON leaves(leave_type);",
            "CREATE INDEX IF NOT EXISTS idx_fn_emp_yr ON finance_history(employee_number, year);",
            "CREATE INDEX IF NOT EXISTS idx_emp_age ON employees(age);"
        ]
        for idx_sql in indexes:
            cursor.execute(idx_sql)
        self.conn.commit()

    def execute_query(self, sql_str: str, params: Optional[Any] = None) -> List[Dict[str, Any]]:
        cursor = self.conn.cursor()
        if params is not None:
            cursor.execute(sql_str, params)
        else:
            cursor.execute(sql_str)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

    def get_schema_summary(self) -> str:
        return """
TABLE: employees (590 rows)
Columns:
 - employee_number (INT, PK): Unique 7-digit ID (e.g. 1000177)
 - first_name (TEXT), last_name (TEXT), employee_label (TEXT): Full name + ID
 - gender (TEXT): 'Male', 'Female'
 - location (TEXT): City (e.g. 'Bangalore', 'Hyderabad', 'Chennai', 'Pune')
 - state (TEXT): 2-letter state code (e.g. 'NH', 'ND', 'AK', 'TX', 'CA', 'NY')
 - department (TEXT): 'IT', 'Informatica', 'Core', 'Infra', 'Support', etc.
 - job_level (TEXT): Grade progression 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10'
 - job_title (TEXT): e.g. 'Senior Project Manager', 'Technical Lead'
 - manager (TEXT): Delivery Manager label + ID (e.g. 'Talluri  Mangarao (1004641)')
 - project (TEXT): Project code/name (e.g. 'NH', 'ETS Internal', etc.)
 - current_status (TEXT): 'Active' (557 employees) or 'Exited' (33 employees)
 - start_date (TEXT, YYYY-MM-DD), exit_date (TEXT, YYYY-MM-DD)
 - annual_ctc (REAL): Annual salary in INR (e.g. 1639440.0)
 - prior_exp (REAL), infinite_exp (REAL), total_exp (REAL): Experience in years
 - salary_bin (TEXT): '<5L', '5-10L', '10-15L', '15-20L', '20-30L', '>30L'
 - primary_skill (TEXT), primary_skill_exp (REAL), primary_skill_level (TEXT)
 - date_of_birth (TEXT, YYYY-MM-DD), age (INT): Employee current age in years

TABLE: skills (2177 rows)
Columns:
 - employee_number (INT, FK)
 - skill_name (TEXT): e.g. 'Python', 'SQL', 'React', 'Java', 'Docker', 'Cognos'
 - skill_type (TEXT): 'Primary', 'Secondary'
 - skill_level (TEXT): 'Beginner', 'Intermediate', 'Expert'
 - skill_exp (REAL): Experience with skill in years

TABLE: leaves (799 rows)
Columns:
 - employee_number (INT, FK)
 - start_date (TEXT, YYYY-MM-DD), end_date (TEXT, YYYY-MM-DD)
 - leave_type (TEXT): 'CL' (Casual Leave), 'SL' (Sick Leave), 'EL' (Earned Leave), 'CO' (Comp Off)
 - day_value (REAL): Duration in days (e.g. 1.0, 0.5)
 - job_level (TEXT), department (TEXT), location (TEXT), state (TEXT), manager (TEXT)

TABLE: finance_history (1934 rows)
Columns:
 - employee_number (INT, FK)
 - year (INT): 2020, 2021, 2022, 2023, 2024
 - base_salary (REAL), bonus (REAL), perks (REAL), other_comp (REAL)
 - total_ctc (REAL), hike_percent (REAL)
 - is_promotion (TEXT): 'Yes', 'No'
 - job_level (TEXT), department (TEXT), location (TEXT), state (TEXT)
"""

sqlite_engine = SQLiteEngine()
