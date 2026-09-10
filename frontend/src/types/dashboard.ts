export interface FilterParams {
  state?: string | string[];
  job_level?: string | string[];
  location?: string | string[];
  department?: string | string[];
  project?: string | string[];
  manager?: string | string[];
  year?: number | number[];
  month?: string | string[];
  date?: string;
  start_date?: string;
  end_date?: string;
  skill_name?: string | string[];
  salary_bin?: string | string[];
  search?: string;
}

export interface FilterOptions {
  states: string[];
  job_levels: string[];
  locations: string[];
  departments: string[];
  projects: string[];
  managers: string[];
  years: number[];
  calendar_years?: number[];
  months?: string[];
  skills: string[];
  salary_bins: string[];
}

export interface HomeKPIs {
  total_employees: number;
  male_count: number;
  female_count: number;
  pct_male: number;
  pct_female: number;
  avg_infinite_exp: number;
  avg_prior_exp: number;
  avg_total_exp: number;
  recent_hirings: { [key: string]: number };
  attrition_by_year: { year: string; exits: number; rate: number; leavers?: any[] }[];
  location_distribution: { location: string; count: number; percentage: number }[];
  attrition_rate_current?: number;
  attrition_trend_dir?: string;
  grade_hierarchy?: {
    tier: string;
    grades: string[];
    description: string;
    count: number;
    percentage: number;
  }[];
  tenure_stability_bands?: {
    band: string;
    label: string;
    count: number;
    percentage: number;
  }[];
  headcount_growth_history?: {
    year: string;
    joiners: number;
    exits: number;
    headcount: number;
  }[];
  department_distribution?: {
    department: string;
    count: number;
    percentage: number;
  }[];
  age_distribution?: {
    stats: { median: number; mean: number; min: number; max: number; total: number };
    bins_3: { bin: string; label: string; start: number; end: number; count: number; percentage: number }[];
    bins_2: { bin: string; label: string; start: number; end: number; count: number; percentage: number }[];
    bins_5: { bin: string; label: string; start: number; end: number; count: number; percentage: number }[];
  };
  project_headcount_trends?: {
    project: string;
    beginning: number;
    end: number;
    net_change: number;
    growth_pct: number;
    current_active: number;
  }[];
  emp_type_distribution?: {
    total: number;
    types: {
      type: string;
      label: string;
      count: number;
      percentage: number;
      color: string;
      description?: string;
    }[];
  };
}

export interface StatewiseKPIs {
  selected_sdm: string;
  filtered_employees: number;
  avg_prior_exp: number;
  avg_infinite_exp: number;
  experience_by_grade: {
    job_level: string;
    prior_exp: number;
    infinite_exp: number;
    total_exp: number;
    count: number;
  }[];
  project_grade_distribution: {
    job_level: string;
    project: string;
    count: number;
  }[];
  project_grade_grouped?: { job_level: string; total: number; [key: string]: any }[];
  geography_grade_breakdown: {
    job_level: string;
    location: string;
    count: number;
  }[];
  geography_grade_grouped?: { job_level: string; total: number; [key: string]: any }[];
  available_sdms?: { name: string; headcount: number }[];
  employee_roster: {
    'EMPLOYEE NUMBER': number;
    'EMPLOYEE LABEL': string;
    'JOB LEVEL': string;
    'JOB TITLE': string;
    'DEPARTMENT': string;
    'LOCATION': string;
    'State': string;
    'Project Working': string;
    'MANAGER': string;
    'Prior_Exp': number;
    'Infinite_Exp': number;
    'Total_Exp': number;
    'M_Salary': number;
    'EMP_CTC1': number;
  }[];
}

export interface EmployeeListItem {
  'EMPLOYEE NUMBER': number;
  'EMPLOYEE LABEL': string;
  'JOB TITLE': string;
  'JOB LEVEL': string;
  'DEPARTMENT': string;
  'LOCATION': string;
  'State'?: string;
  'Project Working'?: string;
  'MANAGER'?: string;
  'EMP_CTC1'?: number;
  'M_Salary'?: number;
  'Total_Exp'?: number;
  'Infinite_Exp'?: number;
  'GENDER'?: string;
}

export interface EmployeeDetails {
  employee_number: number;
  name: string;
  full_name?: string;
  employee_label?: string;
  email: string;
  contact_no?: string;
  gender: string;
  location: string;
  state: string;
  department: string;
  job_title: string;
  job_level: string;
  manager: string;
  project: string;
  start_date?: string;
  exit_date?: string;
  prior_exp: number;
  infinite_exp: number;
  total_exp: number;
  grade_median_ctc?: number;
  grade_median_tenure?: number;
  current_ctc?: number;
  monthly_salary?: number;
  last_bonus?: number;
  hike_percentage?: number;
  skills: {
    'Skill Name': string;
    'Skill Type': string;
    'Skill Level': string;
    'Skill Category'?: string;
    'IsActive'?: string;
    'Assigned Date'?: string;
  }[];
  fresh_skills: string[];
  finance_history: {
    Year: number;
    Base_Salary: number;
    Bonus: number;
    Perks: number;
    Other_Comp: number;
    M_Salary?: number;
    Total_CTC: number;
    Hike: number;
    Is_Promotion?: string;
  }[];
  leave_records?: {
    leave_type: string;
    day_value: number;
    start_date?: string;
    end_date?: string;
    manager?: string;
  }[];
}

export interface TechwiseKPIs {
  total_headcount?: number;
  total_unique_skills: number;
  most_common_skill: string;
  avg_skill_experience?: number;
  cross_skilled_count?: number;
  cross_skilled_pct?: number;
  missing_skills_count: number;
  skill_distribution: {
    skill_name: string;
    employee_count: number;
    percentage?: number;
    advanced_count: number;
    intermediate_count: number;
    beginner_count?: number;
    avg_exp?: number;
    min_exp?: number;
    max_exp?: number;
  }[];
  skill_depth_distribution?: {
    band: string;
    count: number;
    percentage: number;
  }[];
  manager_grade_matrix: {
    managers: string[];
    grades: string[];
    matrix: { [manager: string]: { [grade: string]: number } };
  };
  manager_skill_matrix?: {
    managers: string[];
    manager_totals: { [manager: string]: number };
    skills: string[];
    matrix: { [manager: string]: { [skill: string]: number } };
  };
  skill_roster: {
    employee_number: number;
    name: string;
    job_title?: string;
    job_level: string;
    manager: string;
    location: string;
    department?: string;
    project?: string;
    primary_skill?: string;
    primary_skill_exp?: number;
    primary_skill_level?: string;
    secondary_skills?: string[];
    skills: string[];
    has_missing_skills: boolean;
    total_exp?: number;
    infinite_exp?: number;
  }[];
  verified_specialists?: any[];
  coverage_gaps?: any[];
  audit_headline?: string;
}

export interface SalarywiseKPIs {
  total_salary: number;
  avg_salary: number;
  max_salary: number;
  min_salary: number;
  total_ctc: number;
  avg_ctc: number;
  max_ctc: number;
  min_ctc: number;
  total_perks: number;
  total_bonus: number;
  avg_bonus: number;
  manager_grade_ctc_matrix: {
    managers: string[];
    grades: string[];
    matrix: { [manager: string]: { [grade: string]: number } };
  };
  top_n_earners: {
    employee_number: number;
    name: string;
    job_level: string;
    manager: string;
    m_salary: number;
    total_ctc: number;
    base_salary: number;
    bonus: number;
  }[];
  salary_histogram?: { band: string; count: number; percentage: number; color?: string }[];
  total_managers?: number;
  matched_records?: number;
}

export interface Salarywise2KPIs {
  team_avg_salary: {
    department: string;
    avg_salary: number;
    avg_ctc: number;
  }[];
  salary_trend_years: {
    year: string;
    avg_salary: number;
    avg_ctc: number;
    avg_bonus: number;
    avg_perks: number;
  }[];
  hike_analysis_promotion: {
    year: string;
    is_promotion: string;
    avg_hike_pct: number;
    headcount: number;
  }[];
  compensation_by_band: {
    salary_bin: string;
    avg_base: number;
    avg_bonus: number;
    avg_perks: number;
    avg_other: number;
  }[];
  monthly_salary_distribution: {
    salary_bin: string;
    count: number;
  }[];
  top_earners: {
    'EMPLOYEE NUMBER': number;
    'EMPLOYEE LABEL': string;
    'JOB LEVEL': string;
    'DEPARTMENT': string;
    'LOCATION': string;
    'M_Salary': number;
    'Total_CTC': number;
    'MANAGER': string;
  }[];
  filtered_count: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  employee_number: number;
  employee_name: string;
  leave_type: string;
  days: number;
  start: string;
  end: string;
  department: string;
  location: string;
}

export interface CalendarData {
  total_leave_days: number;
  unique_employees_on_leave: number;
  leave_rate_pct?: number;
  daily_leave_counts?: { [dateStr: string]: number };
  leave_type_breakdown: {
    leave_type: string;
    records_count: number;
    total_days: number;
  }[];
  project_distribution: {
    project: string;
    count: number;
  }[];
  manager_grade_matrix: {
    managers: string[];
    grades: string[];
    matrix: { [manager: string]: { [grade: string]: number } };
  };
  geography_grade_matrix: {
    locations: string[];
    grades: string[];
    matrix: { [location: string]: { [grade: string]: number } };
  };
  events: CalendarEvent[];
}

export interface CopilotResponse {
  answer: string;
  insights: string[];
  intent?: string;
  source?: string;
  confidence?: number;
  data?: Record<string, any>;
  filters?: Record<string, any>;
  chart_data?: { name: string; value: number }[];
  chart_type?: 'bar' | 'pie' | 'line';
  chart?: {
    type?: string;
    title?: string;
    xAxis?: string;
    yAxis?: string;
    data?: any[];
  };
  related_metrics?: { [key: string]: any };
}
