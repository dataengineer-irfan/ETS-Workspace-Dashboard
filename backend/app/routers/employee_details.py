from fastapi import APIRouter, Request, Path
from typing import Optional, List, Dict, Any
from backend.app.analytics import analytics_engine, extract_request_filters, apply_employee_filters, sanitize_list
from backend.app.data_loader import data_loader
from backend.app.models import EmployeeDetails

router = APIRouter(prefix="/api/employee", tags=["Employee Details"])

@router.get("/list")
def get_employee_search_list(request: Request):
    filters = extract_request_filters(request)
    df_emp = apply_employee_filters(data_loader.df_employees, filters)
    cols = ['EMPLOYEE NUMBER', 'EMPLOYEE LABEL', 'JOB TITLE', 'JOB LEVEL', 'DEPARTMENT', 'LOCATION', 'State', 'Project Working', 'MANAGER', 'EMP_CTC1', 'M_Salary', 'Total_Exp', 'Infinite_Exp', 'GENDER']
    cols_exist = [c for c in cols if c in df_emp.columns]
    res_df = df_emp[cols_exist].copy().fillna('')
    return sanitize_list(res_df.to_dict(orient='records'))

@router.get("/{emp_number}", response_model=EmployeeDetails)
def get_employee_by_id(emp_number: int = Path(...)):
    return analytics_engine.get_employee_details(emp_number)
