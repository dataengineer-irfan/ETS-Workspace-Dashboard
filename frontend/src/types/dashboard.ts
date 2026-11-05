export interface FilterParams {
  state?: string | string[];
  job_level?: string | string[];
  location?: string | string[];
  department?: string | string[];
  project?: string | string[];
  manager?: string | string[];
  module?: string | string[];
  year?: number | number[];
  month?: string | string[];
  date?: string;
  start_date?: string;
  end_date?: string;
  skill_name?: string | string[];
  salary_bin?: string | string[];
  tenure_band?: string | string[];
  emp_type?: string | string[];
  search?: string;
  leave_type?: string | string[];
  employee_number?: string | number;
  release?: string | string[];
}

export interface FilterOptions {
  states: string[];
  job_levels: string[];
  locations: string[];
  departments: string[];
  projects: string[];
  managers: string[];
  manager_options?: {
    value: string;
    label: string;
    name: string;
    count: number;
    projects: string[];
  }[];
  modules?: string[];
  years: number[];
  calendar_years?: number[];
  months?: string[];
  skills: string[];
  salary_bins: string[];
  releases?: string[];
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
  project_manager_hierarchy?: {
    project: string;
    headcount: number;
    percentage: number;
    manager_count: number;
    managers: {
      manager: string;
      name: string;
      count: number;
      percentage: number;
    }[];
  }[];
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
  module_distribution?: {
    module_name: string;
    employee_count: number;
    percentage: number;
    java_count?: number;
  }[];
  work_model_mix?: { model: string; count: number; percentage: number }[];
  training_summary?: {
    total: number;
    planned: number;
    in_progress: number;
    completed: number;
    cancelled: number;
    not_recorded: boolean;
  };
}

export interface TrainingRecord {
  name: string;
  provider: string;
  status: string;
  start_date?: string | null;
  end_date?: string | null;
  hours?: number;
  mandatory?: string;
  skill?: string;
}

export interface WorkModelSlice {
  total: number;
  Office: number;
  Hybrid: number;
  Remote: number;
  'Client site': number;
  'Not recorded yet': number;
}

export interface WorkModelKPIs {
  headcount: number;
  recorded_count: number;
  not_recorded_count: number;
  mix: { model: string; count: number; percentage: number }[];
  by_city: ({ location: string } & WorkModelSlice)[];
  by_account: ({ account: string } & WorkModelSlice)[];
  by_grade: ({ job_level: string } & WorkModelSlice)[];
  by_department: ({ department: string } & WorkModelSlice)[];
  by_office: ({ office: string } & WorkModelSlice)[];
  roster: {
    'EMPLOYEE NUMBER': number;
    'EMPLOYEE LABEL': string;
    'LOCATION': string;
    'State': string;
    'JOB LEVEL': string;
    'DEPARTMENT': string;
    'JOB TITLE': string;
    'Work_Model': string;
    'Office': string;
    'Employment_Type': string;
  }[];
  history_rows: number;
}

export type AIHealthBand = 'green' | 'amber' | 'red' | 'neutral';

export interface AIHealthComponent {
  key: string;
  label: string;
  actual: number | null;
  target: number | null;
  score: number | null;
  weight: number;
  na: boolean;
}

export interface AIReleasePoint {
  release: string;
  sequence: number;
  adoption_pct: number | null;
  hours_saved: number;
  tokens: number;
  active_users: number;
  headcount: number | null;
  has_evidence: boolean;
  is_current: boolean;
}

export interface AIHealthRow {
  project: string;
  health_score: number | null;
  band: AIHealthBand;
  band_label?: string | null;
  components: AIHealthComponent[];
  hours_saved: number;
  release_hours_saved: number;
  tokens: number;
  spend_usd: number;
  est_cost_savings_usd: number;
  ai_value_usd: number;
  value_usd?: number;
  potential_hours?: number | null;
  potential_value_usd?: number | null;
  unrealized_value_usd?: number | null;
  token_efficiency_usd_per_1k?: number | null;
  docs_hours?: number;
  roi_index: number | null;
  active_users: number;
  headcount_scope: number | null;
  denominator_inferred: boolean;
  people_tagged: number;
  adoption_pct: number | null;
  dev_adoption_pct: number | null;
  qa_adoption_pct: number | null;
  qa_headcount: number | null;
  trend_pts: number | null;
  current_release: string;
  previous_release: string | null;
  releases_in_scope: number;
  releases_covered: number;
  coverage_pct: number | null;
  evidence_confidence_pct: number | null;
  confidence_band: string;
  release_series: AIReleasePoint[];
  rows: number;
  unquantified_rows: number;
  maturity_level?: number | null;
  teams?: string[];
  manager?: string | null;
  badges?: string[];
  quadrant?: string;
  risk_count?: number;
  recommendation?: string | null;
}

export interface AIAttentionCard {
  id: string;
  rule: string;
  severity: 'red' | 'amber' | string;
  project: string;
  title: string;
  detail: string;
  metric: string;
  value: number | null;
  threshold: number | null;
  drill: { project: string; release?: string | null; domain?: string | null };
  est_value_lost_usd?: number | null;
  priority?: string | null;
  recommended_action?: string | null;
  business_impact?: string | null;
  owner?: string | null;
}

export interface AIRankingRow {
  rank: number;
  project: string;
  ai_value_usd: number;
  est_cost_savings_usd: number;
  hours_saved: number;
  spend_usd: number;
  health_score: number | null;
  band: AIHealthBand;
}

export interface AIProjectDomainRow {
  project: string;
  domain: string;
  headcount: number | null;
  active_users: number;
  adoption_pct: number | null;
  hours_saved: number;
  tokens: number;
  rows: number;
}

export interface AIUtilizationKPIs {
  summary: {
    people_using: number;
    people_named: number;
    headcount_scope: number;
    adoption_pct: number;
    activity_rows: number;
    hours_saved: number;
    tokens: number;
    cursor_spend_usd: number;
    outcome_rows: number;
    usd_per_hour: number | null;
    projects_count: number;
    releases_count: number;
    releases_covered_count: number;
    current_release: string | null;
    active_users: number;
    headcount_in_scope: number | null;
    adoption_evidence_pct: number | null;
    hours_target: number | null;
    est_cost_savings_usd: number;
    savings_target_usd: number | null;
    roi_index: number | null;
    loaded_rate_usd: number;
    loaded_rate_inr: number;
    targets: Record<string, number | null>;
    evidence_confidence_pct: number | null;
    confidence_band: string;
    kpi_bands: Record<string, AIHealthBand | string>;
    tokens_export_coverage: {
      export_users: number;
      active_users: number;
      pct: number | null;
    };
    health_score: number | null;
    health_band: AIHealthBand | string;
    health_label?: string | null;
    attention_count: number;
    business_value_usd?: number;
    potential_hours?: number | null;
    potential_value_usd?: number | null;
    unrealized_value_usd?: number | null;
    unrealized_hours?: number | null;
    projects_requiring_attention?: number;
    critical_projects?: number;
    critical_risks?: number;
    value_at_risk_usd?: number | null;
    attention_kpi?: {
      mode?: string;
      label?: string;
      value?: number | null;
    };
    token_efficiency_usd_per_1k?: number | null;
    missed_pct?: number | null;
    recovery_potential_usd?: number | null;
    recovery_opportunity_pct?: number | null;
    portfolio_narrative?: string[];
    forecast?: {
      adoption_pct?: number | null;
      hours_saved?: number | null;
      business_value_usd?: number | null;
      opportunity_loss_usd?: number | null;
    };
    trend?: {
      adoption_pts?: number | null;
      hours_delta?: number | null;
      value_delta?: number | null;
    };
  };
  by_domain: { domain: string; count: number }[];
  by_tool: { tool: string; count: number }[];
  by_use_case: { use_case: string; count: number }[];
  by_project: { project: string; value: number }[];
  by_team: { team: string; value: number }[];
  by_release: { release: string; value: number }[];
  matrix_projects: string[];
  matrix: ({ team: string; total: number } & Record<string, string | number>)[];
  people: {
    employee_number: number | null;
    name: string;
    activities: number;
    hours_saved: number;
    tokens: number;
    cursor_usd: number;
    tools: string[];
    projects: string[];
    teams: string[];
  }[];
  activities: {
    release: string;
    domain: string;
    team: string;
    project: string;
    manager: string;
    employee_number: number | null;
    name: string;
    tool: string;
    use_case: string;
    activity: string;
    hours_saved: number;
    tokens: number;
    source: string;
    benefit: string;
    cost_usd: number | null;
  }[];
  outcomes: {
    release: string;
    domain: string;
    team: string;
    owner: string;
    headcount: number;
    people_using: number;
    adoption_pct: number;
    hours_saved: number;
    tools_used: string;
    top_use_cases: string;
    benefits: string;
    gaps: string;
    challenges: string;
    opportunities: string;
    status: string;
  }[];
  billing: {
    name: string;
    cost_usd: number;
    month: string;
    team: string;
    project: string;
    employee_number: number | null;
  }[];
  alerts: { tone: string; text: string }[];
  health: AIHealthRow[];
  attention: AIAttentionCard[];
  ranking: AIRankingRow[];
  by_project_domain: AIProjectDomainRow[];
  quadrant?: AIQuadrantRow[];
  funnel?: AIFunnelStage[];
  league?: AILeagueRow[];
  maturity_trend?: AIMaturityTrendRow[];
  use_case_matrix?: AIUseCaseMatrixRow[];
  dev_vs_qa?: AIDevQaRow[];
  release_trend?: AIReleaseTrendRow[];
  manager_scorecard?: AIManagerScorecard[];
  risks?: AIRiskCard[];
  release_summary?: AIReleaseSummary | null;
  release_summaries?: AIReleaseSummary[];
  dev_contribution?: AIPersonContrib[];
  qa_contribution?: AIPersonContrib[];
  benefit_waterfall?: AIBenefitWaterfall[];
  narrative?: AINarrative;
  narratives?: AINarrativeBlock[];
  release_flow?: AIReleaseFlow[];
  maturity_radar?: AIMaturityRadar[];
  project_recommendations?: AIProjectRecommendation[];
}

export interface AIProjectRecommendation {
  project: string;
  recommendation: string;
  bullets: string[];
  next_maturity_level?: number;
}

export interface AIQuadrantRow {
  project: string;
  adoption_pct: number | null;
  value_usd: number | null;
  quadrant: string;
  health_score?: number | null;
  band?: AIHealthBand | string;
  trend_pts?: number | null;
}

export interface AIFunnelStage {
  stage: string;
  hours: number | null;
  value: number | null;
}

export interface AILeagueRow {
  rank: number;
  manager: string;
  score: number | null;
  grade: string;
  value_usd: number;
  hours_saved: number;
  projects: string[];
}

export interface AIMaturityTrendRow {
  release: string;
  sequence: number;
  adoption_pct: number | null;
  hours_saved: number;
  value_usd: number;
}

export interface AIReleaseFlow {
  project: string;
  release: string;
  stages: { stage: string; hours: number; value: number; touchpoints: number }[];
}

export interface AIMaturityRadar {
  project: string;
  axes: { axis: string; score: number }[];
}

export interface AIUseCaseMatrixRow {
  project: string;
  use_case_canonical: string;
  use_case_label: string;
  count: number;
  hours_saved: number;
  adoption_pct: number | null;
  productivity_gain_pct?: number | null;
  business_impact: string;
  value_usd?: number;
  roi_index?: number | null;
  band: string;
}

export interface AIDevQaRow {
  project: string;
  domain: string;
  users_enabled: number | null;
  users_active: number;
  hours_saved: number;
  tokens: number;
  artifacts: number | null;
}

export interface AIReleaseTrendRow {
  project: string;
  release: string;
  sequence: number;
  adoption_pct: number | null;
  hours_saved: number;
  roi_index: number | null;
  tokens: number;
  has_evidence: boolean;
}

export interface AIManagerScorecard {
  manager: string;
  project: string;
  adoption_pct: number | null;
  hours_saved: number;
  hours_target: number | null;
  efficiency_gain_pct: number | null;
  release_quality_pct: number | null;
  score: number | null;
  grade: string;
  gap_sentence: string;
  components?: {
    key: string;
    label: string;
    weight: number;
    score: number | null;
    actual?: number | null;
    target?: number | null;
  }[];
}

export interface AIRiskCard {
  type: string;
  severity: string;
  project: string;
  person?: string | null;
  employee_number?: number | null;
  values?: Record<string, string | number | null>;
  text: string;
  detail?: string;
}

export interface AIReleaseSummary {
  project: string;
  release: string;
  stories_delivered: number | null;
  stories_using_ai: number | null;
  qa_assets: number | null;
  hours_saved: number;
  defects_reduced: number | null;
  tokens: number;
  est_savings: number;
  roi_index: number | null;
  owner?: string | null;
  manager?: string | null;
  health_score?: number | null;
  health_band?: string | null;
  certification?: string | null;
  release_date?: string | null;
  captured?: Record<string, boolean>;
}

export interface AIPersonContrib {
  project: string;
  release: string;
  domain: string;
  name: string;
  employee_number: number | null;
  rows: number;
  usage_pct: number | null;
  hours_saved: number;
  tokens: number;
  stories: number | null;
  code_generated: boolean;
  reviews_supported: boolean;
  test_cases: number;
  automation_assets: number;
  defect_rows: number;
  activity_type?: string | null;
  impact_usd?: number;
}

export interface AIBenefitWaterfall {
  project: string;
  release: string;
  steps: { step: string; value: number | null; captured: boolean }[];
  net_value: number;
  est_savings: number;
  productivity_pct: number | null;
}

export interface AINarrative {
  key_wins: string[];
  missed_opportunities: string[];
  high_performers: string[];
  low_adoption: string[];
  actions: string[];
}

export interface AINarrativeBlock extends AINarrative {
  project: string;
  release: string;
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
    'Module'?: string;
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
  'Module'?: string;
  'EMP_CTC1'?: number;
  'M_Salary'?: number;
  'Total_Exp'?: number;
  'Infinite_Exp'?: number;
  'GENDER'?: string;
  'EXIT DATE'?: string;
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
  module?: string;
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
  date_of_birth?: string;
  age?: number;
  join_date?: string;
  is_lateral_rehire?: boolean;
  rehire_details?: {
    is_rehire: boolean;
    previous_exit_date?: string;
    rejoin_date?: string;
    previous_tenure_years?: number;
    notes?: string;
  };
  contact_number?: string;
  blood_group?: string;
  personal_email?: string;
  emergency_contact?: string;
  emergency_contact_name?: string;
  emergency_contact_relation?: string;
  mediclaim_insurance_no?: string;
  last_promotion_date?: string;
  work_model?: string;
  office?: string;
  trainings?: TrainingRecord[];
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
  module_distribution?: {
    module_name: string;
    employee_count: number;
    percentage: number;
    java_count: number;
    qa_count: number;
    frontend_count: number;
    cloud_count: number;
    db_count: number;
    fullstack_count: number;
    python_count: number;
    avg_exp: number;
    senior_count: number;
    lead_manager: string;
  }[];
  java_module_breakdown?: {
    module_name: string;
    java_devs: number;
    total_module_hc: number;
    java_share_pct: number;
    avg_java_exp: number;
    senior_java_devs: number;
    lead_manager: string;
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
    module?: string;
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
  monthly_payroll?: number;
  avg_monthly_salary?: number;
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
    job_title?: string;
    department?: string;
    location?: string;
    manager: string;
    m_salary: number;
    total_ctc: number;
    base_salary: number;
    bonus: number;
    salary_bin?: string;
  }[];
  salary_histogram?: { 
    band: string; 
    count: number; 
    percentage: number; 
    color?: string;
    total_outlay?: number;
    avg_ctc?: number;
  }[];
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
    'Hike'?: number;
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

export interface CalendarCohortEmployee {
  employee_number: number;
  name: string;
  department: string;
  location: string;
  leave_type: string;
  days: number;
  records_count: number;
  start: string;
  end: string;
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
  available_employees?: {
    employee_number: number;
    name: string;
    leave_count: number;
  }[];
  available_years?: number[];
  selected_year?: number;
  cohort_employees?: CalendarCohortEmployee[];
}

export interface ResultItem {
  requirement_id: string;
  title: string;
  status: string;
  presentation_mode: 'METRIC_CARD' | 'CHART' | 'TABLE' | 'TEXT_NOTICE';
  chart_spec?: {
    type?: 'bar' | 'pie' | 'line';
    title?: string;
    xAxis?: string;
    yAxis?: string;
    data?: { name: string; value: number }[];
  };
  table_spec?: {
    columns: string[];
    rows: Record<string, any>[];
  };
  metric_card_spec?: {
    label: string;
    value: string | number;
    subtext?: string;
  };
  error_details?: string;
}

export interface CopilotResponse {
  answer: string;
  insights: string[];
  intent?: string;
  status?: string;
  overall_status?: string;
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
  result_items?: ResultItem[];
  related_metrics?: { [key: string]: any };
  visual_target?: 'home' | 'statewise' | 'employee_details' | 'techwise' | 'salarywise';
  visual_filters?: Record<string, any>;
  selected_entity?: {
    employee_number?: string | number;
    [key: string]: any;
  };
}

