import re
from enum import Enum
from typing import Dict, Any, List, Optional, Tuple, Set
from dataclasses import dataclass, field
from backend.app.ai.compositional import (
    CompositionalParser,
    CompositionalQueryPlan,
    DimensionEnum,
    OutputFormatEnum,
    AnalyticalParser,
    RequirementTypeEnum,
    ExecutorEnum,
    MetricEnum
)

class CapabilityEnum(str, Enum):
    HEADCOUNT = "HEADCOUNT"
    ACTIVE_HEADCOUNT = "ACTIVE_HEADCOUNT"
    LEAVER_COUNT = "LEAVER_COUNT"
    ATTRITION = "ATTRITION"
    STATE_BREAKDOWN = "STATE_BREAKDOWN"
    PROJECT_BREAKDOWN = "PROJECT_BREAKDOWN"
    LOCATION_BREAKDOWN = "LOCATION_BREAKDOWN"
    DEPARTMENT_BREAKDOWN = "DEPARTMENT_BREAKDOWN"
    COMPENSATION_AVERAGE = "COMPENSATION_AVERAGE"
    COMPENSATION_MIN = "COMPENSATION_MIN"
    COMPENSATION_MAX = "COMPENSATION_MAX"
    RANKING = "RANKING"
    TENURE = "TENURE"
    EMPLOYEE_LOOKUP = "EMPLOYEE_LOOKUP"
    FOLLOW_UP_CONTEXT = "FOLLOW_UP_CONTEXT"
    FILTER_COMPOSITION = "FILTER_COMPOSITION"
    COMPARISON = "COMPARISON"
    RAG_POLICY_QA = "RAG_POLICY_QA"
    RAG_GROUNDED_SYNTHESIS = "RAG_GROUNDED_SYNTHESIS"
    UNSUPPORTED_QUERY = "UNSUPPORTED_QUERY"
    AGE_BREAKDOWN = "AGE_BREAKDOWN"
    GENDER_BREAKDOWN = "GENDER_BREAKDOWN"
    # Executive Decision Intelligence Capabilities
    SALARY_TOTAL_COST = "SALARY_TOTAL_COST"
    SALARY_COST_BY_GRADE = "SALARY_COST_BY_GRADE"
    SALARY_COST_BY_PROJECT = "SALARY_COST_BY_PROJECT"
    SALARY_CONCENTRATION = "SALARY_CONCENTRATION"
    MAX_CTC_DISTRIBUTION = "MAX_CTC_DISTRIBUTION"
    FINANCE_PROVENANCE_AUDIT = "FINANCE_PROVENANCE_AUDIT"
    SKILL_DISTRIBUTION = "SKILL_DISTRIBUTION"
    SKILLS_TOP_RANKING = "SKILLS_TOP_RANKING"
    SKILLS_RAREST = "SKILLS_RAREST"
    SKILLS_CONCENTRATION_RISK = "SKILLS_CONCENTRATION_RISK"
    PROJECT_TECH_COVERAGE = "PROJECT_TECH_COVERAGE"
    SKILL_HIRING_PRIORITIES = "SKILL_HIRING_PRIORITIES"
    SKILL_REDEPLOYMENT = "SKILL_REDEPLOYMENT"
    PROJECT_ATTRITION_EXPOSURE = "PROJECT_ATTRITION_EXPOSURE"
    MANAGEMENT_SPAN_RISK = "MANAGEMENT_SPAN_RISK"
    TOP_WORKFORCE_RISKS = "TOP_WORKFORCE_RISKS"
    STRATEGIC_INVESTMENTS = "STRATEGIC_INVESTMENTS"
    UNSUPPORTED_COMMERCIAL_FINANCE = "UNSUPPORTED_COMMERCIAL_FINANCE"

# Authoritative Business Dictionaries
PROJECT_STATES = {
    'nd': 'ND', 'north dakota': 'ND',
    'nh': 'NH', 'new hampshire': 'NH',
    'ak': 'AK', 'alaska': 'AK'
}

# Explicitly disallowed US states or unknown states mapped to themselves
KNOWN_OTHER_STATE_NAMES = {
    'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
    'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
    'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
    'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
    'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
    'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
    'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
    'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
    'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
    'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
    'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
    'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
    'wisconsin': 'WI', 'wyoming': 'WY'
}

PHYSICAL_LOCATIONS = {
    'bangalore': 'Bangalore',
    'hyderabad': 'Hyderabad',
    'chennai': 'Chennai',
    'pune': 'Pune'
}

KNOWN_OTHER_LOCATIONS = {
    'delhi': 'Delhi', 'mumbai': 'Mumbai', 'kolkata': 'Kolkata', 'noida': 'Noida',
    'gurgaon': 'Gurgaon', 'gurugram': 'Gurugram', 'london': 'London', 'new york': 'New York',
    'paris': 'Paris', 'berlin': 'Berlin', 'tokyo': 'Tokyo', 'sydney': 'Sydney', 'singapore': 'Singapore'
}

VALID_DEPARTMENTS = {'core', 'support', 'management', 'qa', 'devops', 'finance', 'hr', 'it', 'infra', 'cognos', 'informatica'}

POLICY_KEYWORDS = [
    'policy', 'policies', 'guideline', 'guidelines', 'handbook', 'procedure', 'procedures',
    'rule', 'rules', 'regulation', 'regulations', 'standard', 'standards', 'criteria',
    'ladder', 'code of conduct', 'parental leave', 'bereavement', 'maternity', 'paternity',
    'probation', 'notice period', 'reimbursement', 'incentive plan', 'lterp'
]

COMMERCIAL_FINANCE_KEYWORDS = [
    'revenue', 'gross margin', 'net margin', 'margin', 'margins',
    'profit', 'profits', 'profitability', 'profitable',
    'billable utilization', 'utilization rate', 'billability', 'billing utilization',
    'cash runway', 'runway', 'burn rate', 'dso', 'days sales outstanding',
    'ebitda', 'client profitability', 'roi', 'return on investment',
    'ar aging', 'accounts receivable', 'billing rate', 'billing rates', 'client billing',
    'invoicing', 'invoice', 'invoices', 'client invoicing', 'payment cycle', 'payment cycles',
    'revenue per employee', 'revenue forecast', 'fire client', 'shut down project',
    'client margin', 'project margin', 'lowest margin', 'highest margin'
]

UNSUPPORTED_DOMAINS = [
    'weather', 'sports', 'cricket', 'football', 'movie', 'cinema', 'recipe', 'cooking',
    'president', 'capital of', 'horoscope', 'stock price', 'bitcoin', 'crypto', 'flight'
]

class PopulationEnum(str, Enum):
    ALL = "ALL"
    ACTIVE = "ACTIVE"
    EXITED = "EXITED"

@dataclass
class TypedParameters:
    raw_query: str
    population: PopulationEnum = PopulationEnum.ALL
    project_state: Optional[str] = None
    project_states: List[str] = field(default_factory=list)
    physical_location: Optional[str] = None
    physical_locations: List[str] = field(default_factory=list)
    department: Optional[str] = None
    current_status: Optional[str] = None  # 'Active' or 'Exited'
    job_level: Optional[str] = None
    job_levels: List[str] = field(default_factory=list)
    project: Optional[str] = None
    projects: List[str] = field(default_factory=list)
    manager: Optional[str] = None
    employee_number: Optional[int] = None
    year: Optional[int] = None
    salary_threshold: Optional[float] = None
    salary_operator: Optional[str] = None  # '>', '<', '>='
    exp_threshold: Optional[float] = None
    exp_operator: Optional[str] = None
    limit_n: int = 10
    direction: str = "DESC"
    is_promotion: Optional[str] = None
    antecedent_type: Optional[str] = None
    antecedent_value: Optional[Any] = None
    unrecognized_filter: Optional[str] = None
    skill: Optional[str] = None
    experience_metric: Optional[str] = None
    experience_metrics: List[str] = field(default_factory=list)
    active_dashboard_filters: Dict[str, Any] = field(default_factory=dict)
    filter_context: Optional[Any] = None
    inquiry_type: Optional[str] = None
    matched_employee: Optional[Dict[str, Any]] = None

@dataclass
class CapabilityContract:
    capability: CapabilityEnum
    parameters: TypedParameters
    execution_route: str  # 'DETERMINISTIC_SQL', 'DETERMINISTIC_ANALYTICS', 'RAG', 'UNSUPPORTED'
    meta: Dict[str, Any] = field(default_factory=dict)

class EntityNormalizer:
    @staticmethod
    def extract_project_states(query: str) -> Tuple[List[str], Optional[str]]:
        """
        Extracts Project State codes (ND, NH, AK) or preserves unknown states (e.g. ZZ, Texas).
        Never drops an unknown state!
        """
        q_low = query.lower()
        found_states = []
        unknown_state = None

        # 1. Multi-word and single-word full state names
        if 'north dakota' in q_low:
            found_states.append('ND')
        if 'new hampshire' in q_low:
            found_states.append('NH')
        if 'alaska' in q_low:
            found_states.append('AK')

        for full_name, code in KNOWN_OTHER_STATE_NAMES.items():
            if full_name in ('north dakota', 'new hampshire', 'alaska'):
                continue
            if re.search(rf'\b{full_name}\b', q_low):
                unknown_state = code
                if code not in found_states:
                    found_states.append(code)

        # 2. Check for valid project states (ND, NH, AK)
        for ps in ['ND', 'NH', 'AK']:
            if re.search(rf'\b{ps}\b', query, re.IGNORECASE) and ps not in found_states:
                found_states.append(ps)

        # 3. Check explicit 2-letter uppercase state codes qualified by state keywords:
        # e.g. "state ZZ", "project state ZZ", "in state ZZ"
        explicit_state_matches = re.findall(r'(?:state|project state|province)\s+([A-Z]{2})\b', query, re.IGNORECASE)
        for c in explicit_state_matches:
            c_up = c.upper()
            if c_up in ['ND', 'NH', 'AK']:
                if c_up not in found_states:
                    found_states.append(c_up)
            else:
                unknown_state = c_up
                if c_up not in found_states:
                    found_states.append(c_up)

        # 4. Check for standalone unknown 2-letter state codes following "in" or "for",
        # EXCLUDING common English stop words and department abbreviations
        STOP_TOKENS_2LETTER = {
            'IN', 'OR', 'AT', 'TO', 'ME', 'IT', 'IS', 'AS', 'BY', 'HE', 'WE',
            'MY', 'NO', 'SO', 'UP', 'US', 'DO', 'GO', 'IF', 'AN', 'AM', 'BE',
            'HI', 'OK', 'OH', 'ON', 'QA', 'HR'
        }
        in_codes = re.findall(r'\b(?:in|for)\s+([A-Z]{2})\b', query)
        for c in in_codes:
            if c in ['ND', 'NH', 'AK']:
                if c not in found_states:
                    found_states.append(c)
            elif c not in STOP_TOKENS_2LETTER:
                unknown_state = c
                if c not in found_states:
                    found_states.append(c)

        # 5. Catch arbitrary or injected expressions following 'state' or 'project state'
        if not found_states:
            m_raw = re.search(r'\b(?:in\s+state|state|in\s+project\s+state|project\s+state)\s+(.*?)(?:\?|$)', query, re.IGNORECASE)
            if m_raw:
                cand = m_raw.group(1).strip()
                cand_lower = cand.lower()
                non_entity_words = {
                    'breakdown', 'distribution', 'wise', 'split', 'per', 'has', 'is', 'are', 'was',
                    'were', 'with', 'should', 'can', 'could', 'would', 'does', 'do', 'did',
                    'most', 'largest', 'highest', 'lowest', 'fewest', 'best', 'worst',
                    'more', 'less', 'to', 'for', 'of', 'and', 'the', 'a', 'an'
                }
                first_word = cand_lower.split()[0] if cand_lower.split() else ''
                if cand and cand_lower not in non_entity_words and first_word not in non_entity_words:
                    unknown_state = cand
                    found_states.append(cand)

        return found_states, unknown_state

    @staticmethod
    def extract_locations(query: str) -> Tuple[List[str], Optional[str]]:
        """
        Extracts Physical Locations (Bangalore, Hyderabad, Chennai, Pune) or preserves unknown city.
        """
        q_low = query.lower()
        found_locs = []
        unknown_loc = None

        for kw, loc in PHYSICAL_LOCATIONS.items():
            if re.search(rf'\b{kw}\b', q_low):
                found_locs.append(loc)

        for kw, loc in KNOWN_OTHER_LOCATIONS.items():
            if re.search(rf'\b{kw}\b', q_low):
                unknown_loc = loc
                found_locs.append(loc)

        # Explicit 'in <City>'
        m = re.search(r'\bin\s+([A-Z][a-z]{3,15})\b', query)
        if m:
            cand = m.group(1)
            cand_l = cand.lower()
            if cand_l in PHYSICAL_LOCATIONS:
                if PHYSICAL_LOCATIONS[cand_l] not in found_locs:
                    found_locs.append(PHYSICAL_LOCATIONS[cand_l])
            elif cand_l in KNOWN_OTHER_LOCATIONS:
                if KNOWN_OTHER_LOCATIONS[cand_l] not in found_locs:
                    found_locs.append(KNOWN_OTHER_LOCATIONS[cand_l])
                    unknown_loc = KNOWN_OTHER_LOCATIONS[cand_l]

        # Catch arbitrary or injected expressions following 'location' or 'city'
        if not found_locs:
            m_raw = re.search(r'\b(?:in\s+location|location|in\s+city|city)\s+(.*?)(?:\?|$)', query, re.IGNORECASE)
            if m_raw:
                cand = m_raw.group(1).strip()
                cand_lower = cand.lower()
                non_entity_words = {
                    'breakdown', 'distribution', 'wise', 'split', 'per', 'has', 'is', 'are', 'was',
                    'were', 'with', 'should', 'can', 'could', 'would', 'does', 'do', 'did',
                    'most', 'largest', 'highest', 'lowest', 'fewest', 'best', 'worst',
                    'more', 'less', 'to', 'for', 'of', 'and', 'the', 'a', 'an'
                }
                first_word = cand_lower.split()[0] if cand_lower.split() else ''
                if cand and cand_lower not in non_entity_words and first_word not in non_entity_words:
                    unknown_loc = cand
                    found_locs.append(cand)

        return found_locs, unknown_loc

    @staticmethod
    def extract_department(query: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Extracts known department or preserves unknown department (never dropped!).
        Returns: (dept, unknown_dept)
        """
        q_low = query.lower()
        for d in VALID_DEPARTMENTS:
            if re.search(rf'\b{d}\b', q_low):
                # Ignore false positives for finance and management in meta/strategic contexts
                if d == 'finance' and any(k in q_low for k in ['finance history', 'finance record', 'finance data', 'finance provenance', 'finance dimension', 'finance question']):
                    continue
                if d == 'management' and any(k in q_low for k in ['management prioritize', 'management span', 'management concentration', 'senior management', 'management team size', 'management design']):
                    continue
                # Ignore when the token is qualified as a skill / competency
                if re.search(rf'\b{d}\s+(?:skills?|skilled|certified|competenc(?:y|ies))\b', q_low) or re.search(rf'\b(?:skills?|skilled|certified|competenc(?:y|ies))\s+(?:in|with|for)?\s*{d}\b', q_low):
                    continue
                norm = d.upper() if d.lower() in ('qa', 'hr', 'it') else d.title()
                return norm, None

        dept_stop_words = {
            'breakdown', 'distribution', 'wise', 'split', 'per', 'headcount', 'count', 'size',
            'each', 'every', 'all', 'the', 'this', 'that', 'by', 'and', 'or', 'has', 'have',
            'in', 'a', 'an', 'which', 'what', 'our', 'their', 'one', 'any', 'top', 'to', 'for',
            'of', 'from', 'with', 'most', 'least', 'level', 'highest', 'lowest', 'more', 'fewer',
            'biggest', 'largest', 'smallest', 'greatest',
            'name', 'names', 'is', 'are', 'was', 'were', 'does', 'do', 'list', 'show', 'tell', 'give'
        }

        # Check explicit department pattern: "department <NAME>" or "<NAME> department"
        m = re.search(r'\bdepartment\s+([A-Za-z0-9_-]+)\b', query, re.IGNORECASE)
        if m:
            cand = m.group(1).strip()
            if cand.lower() not in dept_stop_words:
                return cand, cand

        m2 = re.search(r'\b([A-Za-z0-9_-]+)\s+department\b', query, re.IGNORECASE)
        if m2:
            cand = m2.group(1).strip()
            if cand.lower() not in dept_stop_words:
                return cand, cand

        return None, None

    @staticmethod
    def extract_employee_id(query: str) -> Optional[int]:
        m = re.search(r'\b(10\d{5})\b', query)
        if m:
            return int(m.group(1))
        return None

    @classmethod
    def get_employee_index(cls) -> Dict[str, Any]:
        """
        Dynamically indexes all employees from the corporate dataset (zero hardcoding).
        Builds lookup structures for:
        1. by_id: employee_number -> employee_dict
        2. by_full_name: lowercase cleaned name -> employee_dict
        3. by_token: unique name token (>= 3 chars) -> list of employee_dicts
        """
        if not hasattr(cls, "_employee_index") or not cls._employee_index:
            from backend.app.data_loader import data_loader
            by_id: Dict[int, Dict[str, Any]] = {}
            by_full_name: Dict[str, Dict[str, Any]] = {}
            by_token: Dict[str, List[Dict[str, Any]]] = {}

            schema_stop = {
                'what', 'is', 'are', 'was', 'were', 'who', 'whom', 'whose', 'where', 'how', 'many', 'much',
                'the', 'this', 'that', 'these', 'those', 'there', 'our', 'all', 'any', 'each', 'every', 'ets',
                'and', 'or', 'not', 'for', 'from', 'with', 'by', 'at', 'on', 'in', 'to', 'of', 'about',
                'employee', 'employees', 'person', 'people', 'staff', 'workforce', 'headcount', 'count',
                'salary', 'salaries', 'ctc', 'pay', 'compensation', 'package', 'cost', 'payroll',
                'hike', 'bonus', 'promotion', 'promotions', 'tenure', 'experience', 'service',
                'grade', 'level', 'job', 'title', 'role', 'department', 'dept', 'location', 'city', 'state', 'project',
                'manager', 'managers', 'supervisor', 'supervisors', 'lead', 'leads', 'team',
                'report', 'reports', 'reporting', 'direct',
                'skill', 'skills', 'tech', 'technology', 'technologies',
                'active', 'exited', 'left', 'leaver', 'leavers', 'current', 'former',
                'highest', 'lowest', 'most', 'least', 'more', 'less', 'top', 'bottom', 'average', 'avg',
                'tell', 'show', 'give', 'list', 'details', 'detail', 'info', 'information', 'profile', 'lookup',
                'does', 'do', 'did', 'have', 'has', 'had', 'been', 'being', 'can', 'could', 'should', 'would',
                'male', 'males', 'female', 'females', 'men', 'women', 'gender', 'genders',
                'bangalore', 'hyderabad', 'chennai', 'pune', 'karnataka', 'telangana', 'maharashtra',
                'nd', 'nh', 'ak', 'core', 'support', 'management', 'qa', 'devops', 'finance', 'hr', 'it', 'infra', 'cognos', 'informatica'
            }

            try:
                for idx, r in data_loader.df_employees.iterrows():
                    emp_num = int(r['EMPLOYEE NUMBER'])
                    lbl = str(r['EMPLOYEE LABEL'])
                    clean_name = re.sub(r'\s*\(\d+\)', '', lbl).strip()
                    fname = str(r.get('EMPLOYEE FIRST NAME', '')).strip()
                    lname = str(r.get('EMPLOYEE LAST NAME', '')).strip()
                    mgr = str(r.get('MANAGER', '')).strip()
                    dept = str(r.get('DEPARTMENT', '')).strip()
                    title = str(r.get('JOB TITLE', '')).strip()
                    loc = str(r.get('LOCATION', '')).strip()

                    emp_dict = {
                        "employee_number": emp_num,
                        "employee_label": lbl,
                        "clean_name": clean_name,
                        "first_name": fname,
                        "last_name": lname,
                        "manager": mgr,
                        "department": dept,
                        "job_title": title,
                        "location": loc
                    }
                    by_id[emp_num] = emp_dict
                    by_full_name[clean_name.lower()] = emp_dict

                    # Token-level indexing
                    tokens = [w.lower() for w in re.split(r'[\s.-]+', clean_name) if len(w) >= 3 and w.lower() not in schema_stop]
                    for tok in set(tokens):
                        by_token.setdefault(tok, []).append(emp_dict)
            except Exception:
                pass

            cls._employee_index = {
                "by_id": by_id,
                "by_full_name": by_full_name,
                "by_token": by_token
            }
        return cls._employee_index

    @classmethod
    def extract_employee(cls, query: str) -> Tuple[Optional[Dict[str, Any]], Optional[str], List[Dict[str, Any]]]:
        """
        Extracts employee reference from natural language queries (zero hardcoding).
        Normalizes possessive variations ('s, 'ss, ', etc.) and matches against database records.
        Returns: (matched_employee, match_status, candidate_list)
        match_status can be: 'EXACT', 'AMBIGUOUS', 'NOT_FOUND', or None.
        """
        # Normalize possessives ('s, 'ss, ', ’s, ’ss)
        q_clean = re.sub(r"['’]s+\b", "", query, flags=re.IGNORECASE)
        q_low = q_clean.lower()

        # 1. Check ID in query
        m_id = re.search(r'\b(10\d{5})\b', query)
        idx = cls.get_employee_index()
        if m_id:
            num = int(m_id.group(1))
            if num in idx["by_id"]:
                return idx["by_id"][num], "EXACT", [idx["by_id"][num]]

        # 2. Check full name match in query (longest names first)
        for name_low, emp in sorted(idx["by_full_name"].items(), key=lambda x: len(x[0]), reverse=True):
            if len(name_low) >= 4 and re.search(rf'\b{re.escape(name_low)}\b', q_low):
                return emp, "EXACT", [emp]

        # 3. Token-based matching
        schema_stop = {
            'what', 'is', 'are', 'was', 'were', 'who', 'whom', 'whose', 'where', 'how', 'many', 'much',
            'the', 'this', 'that', 'these', 'those', 'there', 'our', 'all', 'any', 'each', 'every', 'ets',
            'and', 'or', 'not', 'for', 'from', 'with', 'by', 'at', 'on', 'in', 'to', 'of', 'about',
            'employee', 'employees', 'person', 'people', 'staff', 'workforce', 'headcount', 'count',
            'salary', 'salaries', 'ctc', 'pay', 'compensation', 'package', 'cost', 'payroll',
            'hike', 'bonus', 'promotion', 'promotions', 'tenure', 'experience', 'service',
            'grade', 'level', 'job', 'title', 'role', 'department', 'dept', 'location', 'city', 'state', 'project',
            'manager', 'managers', 'supervisor', 'supervisors', 'lead', 'leads', 'team',
            'report', 'reports', 'reporting', 'direct',
            'skill', 'skills', 'tech', 'technology', 'technologies',
            'active', 'exited', 'left', 'leaver', 'leavers', 'current', 'former',
            'highest', 'lowest', 'most', 'least', 'more', 'less', 'top', 'bottom', 'average', 'avg',
            'tell', 'show', 'give', 'list', 'details', 'detail', 'info', 'information', 'profile', 'lookup',
            'does', 'do', 'did', 'have', 'has', 'had', 'been', 'being', 'can', 'could', 'should', 'would',
            'male', 'males', 'female', 'females', 'men', 'women', 'gender', 'genders',
            'bangalore', 'hyderabad', 'chennai', 'pune', 'karnataka', 'telangana', 'maharashtra',
            'nd', 'nh', 'ak', 'core', 'support', 'management', 'qa', 'devops', 'finance', 'hr', 'it', 'infra', 'cognos', 'informatica'
        }
        for sk in ['docker', 'sql', 'python', 'java', 'selenium', 'kubernetes', 'k8s', 'react', 'angular']:
            schema_stop.add(sk)

        q_words = re.findall(r'\b[a-zA-Z]{3,}\b', q_low)
        candidate_tokens = [w for w in q_words if w not in schema_stop]

        if not candidate_tokens:
            return None, None, []

        # Find intersecting candidates across all candidate tokens
        candidate_sets = []
        for t in candidate_tokens:
            if t in idx["by_token"]:
                candidate_sets.append({emp["employee_number"]: emp for emp in idx["by_token"][t]})

        if not candidate_sets:
            return None, None, []

        common_ids = set(candidate_sets[0].keys())
        for cset in candidate_sets[1:]:
            common_ids &= set(cset.keys())

        if common_ids:
            matched_list = [candidate_sets[0][eid] for eid in common_ids]
            if len(matched_list) == 1:
                return matched_list[0], "EXACT", matched_list
            else:
                return None, "AMBIGUOUS", matched_list

        if len(candidate_tokens) == 1:
            tok = candidate_tokens[0]
            if tok in idx["by_token"]:
                matches = idx["by_token"][tok]
                if len(matches) == 1:
                    return matches[0], "EXACT", matches
                else:
                    return None, "AMBIGUOUS", matches

        return None, None, []

    @staticmethod
    def extract_year(query: str) -> Optional[int]:
        m = re.search(r'\b(20[12]\d)\b', query)
        if m:
            return int(m.group(1))
        return None

    @classmethod
    def get_known_skills(cls) -> List[str]:
        if not hasattr(cls, "_dynamic_skills") or not cls._dynamic_skills:
            from backend.app.data_loader import data_loader
            base_skills = set()
            schema_dimension_words = {
                'project', 'department', 'location', 'state', 'grade', 'level',
                'manager', 'workforce', 'employee', 'data', 'management', 'technical',
                'support', 'content', 'analysis', 'business', 'operations', 'service',
                'and', 'the', 'for', 'with', 'etc', 'application', 'planning', 'workflows',
                'gathering', 'tuning', 'manuals', 'studio'
            }
            try:
                for s in data_loader.df_skills['Skill Name'].dropna().unique():
                    s_clean = str(s).strip()
                    if s_clean:
                        base_skills.add(s_clean.lower())
                        for word in re.split(r'[\s/&()]+', s_clean):
                            if len(word) >= 3 and word.lower() not in schema_dimension_words:
                                base_skills.add(word.lower())
            except Exception:
                pass
            fallback = {
                'docker', 'sql', 'python', 'java', 'selenium', 'kubernetes', 'k8s',
                'javascript', 'typescript', 'testng', 'postman', 'react', 'angular',
                'cognos', 'informatica', 'oracle', 'linux', 'git', 'html5', 'pandas'
            }
            cls._dynamic_skills = sorted(list(base_skills | fallback), key=len, reverse=True)
        return cls._dynamic_skills

    @classmethod
    def extract_skill(cls, query: str) -> Optional[str]:
        q_low = query.lower()
        # Guard: If query contains relational hierarchy phrasing ('reporting to', 'reports to', 'reporting manager', etc.),
        # do NOT match 'reporting' as a skill
        is_relational_reporting = bool(re.search(r'\b(?:reporting\s+to|reports\s+to|report\s+to|who\s+reports|is\s+reporting|reporting\s+manager|reporting\s+line|reporting\s+structure)\b', q_low))

        # 1. Explicit skill syntax patterns: "<NAME> skills?" or "skills in <NAME>"
        m_explicit = re.search(r'\b([a-zA-Z0-9+#.]+)\s+skills?\b', query, re.IGNORECASE)
        if m_explicit:
            cand = m_explicit.group(1).strip()
            if not cand.isdigit() and cand.lower() not in {'many', 'all', 'any', 'what', 'which', 'our', 'have', 'has', 'with', 'the', 'these', 'those', 'top', 'bottom', 'rare', 'rarest'}:
                return cand.title() if cand.lower() not in ['sql', 'k8s'] else cand.upper()

        m_in = re.search(r'\bskills?\s+(?:in|with|for)?\s*([a-zA-Z0-9+#.]+)\b', query, re.IGNORECASE)
        if m_in:
            cand = m_in.group(1).strip()
            if not cand.isdigit() and cand.lower() not in VALID_DEPARTMENTS and cand.lower() not in {'our', 'the', 'all', 'ets', 'these', 'those', 'top', 'bottom', 'rare', 'rarest'}:
                return cand.title() if cand.lower() not in ['sql', 'k8s'] else cand.upper()

        # 2. Match against dynamic database skill registry
        for sk in cls.get_known_skills():
            if sk.lower() == 'reporting' and is_relational_reporting:
                continue
            if re.search(rf'\b{re.escape(sk)}\b', q_low):
                return sk.title() if sk.lower() not in ['sql', 'k8s'] else sk.upper()

        m = re.search(r'\b([a-zA-Z0-9+#.]+)-(?:skilled|certified)\b', query, re.IGNORECASE)
        if m:
            return m.group(1).title()
        return None

    @staticmethod
    def extract_job_levels(query: str) -> List[str]:
        """
        Generic extraction for job level / grade codes (e.g. E1 to E10).
        """
        matches = re.findall(r'\b(E10|E[1-9])\b', query, re.IGNORECASE)
        levels = []
        for m in matches:
            code = m.upper()
            if code not in levels:
                levels.append(code)
        m_num = re.findall(r'\b(?:grade|job\s*level|level)\s*(E10|E[1-9]|\d+)\b', query, re.IGNORECASE)
        for num in m_num:
            code = num.upper() if num.upper().startswith('E') else f"E{num}"
            if code not in levels:
                levels.append(code)
        return levels

    @staticmethod
    def extract_projects(query: str) -> List[str]:
        """
        Generic extraction for project entities from ETS canonical projects ('NH', 'ND', 'AK', 'NH Projects').
        """
        q_low = query.lower()
        projects = []
        if 'nh projects' in q_low:
            projects.append('NH')
        m = re.findall(r'\b(?:project|on\s+project|in\s+project|for\s+project)\s+(NH|ND|AK)\b', query, re.IGNORECASE)
        for p in m:
            p_up = p.upper()
            if p_up not in projects:
                projects.append(p_up)
        return projects

    @staticmethod
    def extract_experience_metrics(query: str) -> List[str]:
        """
        Generic extraction for experience measure types:
        'infinite_exp', 'prior_exp', 'total_exp'
        """
        q_low = query.lower()
        exp_metrics = []
        if any(term in q_low for term in ['infinite experience', 'infinite exp', 'infinite tenure', 'internal experience', 'at infinite', 'in infinite']) or ('infinite' in q_low and ('exp' in q_low or 'experience' in q_low or 'tenure' in q_low)):
            exp_metrics.append('infinite_exp')
        if any(term in q_low for term in ['prior experience', 'prior exp', 'previous experience', 'external experience', 'past experience', 'pre-hire experience', 'before joining']) or ('prior' in q_low and ('exp' in q_low or 'experience' in q_low)):
            exp_metrics.append('prior_exp')
        if any(term in q_low for term in ['total experience', 'total exp', 'overall experience', 'combined experience']):
            exp_metrics.append('total_exp')
        return exp_metrics

class ScopeModeEnum(str, Enum):
    DASHBOARD_SCOPED = "DASHBOARD_SCOPED"
    GLOBAL = "GLOBAL"

GLOBAL_SCOPE_PATTERNS = [
    r'\bcompany[\s-]wide\b',
    r'\borganization[\s-]wide\b',
    r'\bacross\s+(?:the\s+)?(?:entire|whole|all)\s+(?:organization|company|firm|enterprise)\b',
    r'\bentire\s+(?:organization|company|firm|enterprise)\b',
    r'\bacross\s+all\s+(?:locations|offices|sites|cities|states|projects|departments)\b',
    r'\ball\s+employees\b',
    r'\ball\s+workforce\b',
    r'\boverall\b',
    r'\bglobally\b',
    r'\bignore\s+(?:the\s+)?(?:current\s+)?(?:dashboard\s+)?filters?\b',
    r'\bwithout\s+(?:any\s+)?(?:dashboard\s+)?filters?\b',
    r'\bclear\s+filters?\b',
    r'\bno\s+filters?\b',
    r'\bbreak\s*down\s+workforce\b',
    r'\bworkforce\s+breakdown\b',
    r'\bworkforce\s+distribution\b',
    r'\bcompetency\s+matrix\b',
    r'\bmanager\s+grade\s+(?:competency\s+)?matrix\b',
]

def detect_scope_mode(query: str) -> ScopeModeEnum:
    q_low = query.lower()
    for p in GLOBAL_SCOPE_PATTERNS:
        if re.search(p, q_low):
            return ScopeModeEnum.GLOBAL
    return ScopeModeEnum.DASHBOARD_SCOPED

@dataclass
class FilterConstraint:
    dimension: str
    attribute: str
    values: List[Any]
    source: str  # 'explicit_query', 'dashboard_filter', 'authorization', 'conversational_reference'
    scope: str = "scoped"  # 'scoped', 'global', 'immutable'
    immutable: bool = False

@dataclass
class FilterContext:
    dashboard_filters: List[FilterConstraint] = field(default_factory=list)
    explicit_query_filters: List[FilterConstraint] = field(default_factory=list)
    authorization_filters: List[FilterConstraint] = field(default_factory=list)
    dimension_conflicts: List[Dict[str, Any]] = field(default_factory=list)
    overridden_filters: List[Dict[str, Any]] = field(default_factory=list)
    cleared_filters: List[Dict[str, Any]] = field(default_factory=list)
    resolved_constraints: List[FilterConstraint] = field(default_factory=list)
    effective_filters: Dict[str, Any] = field(default_factory=dict)
    scope_mode: ScopeModeEnum = ScopeModeEnum.DASHBOARD_SCOPED
    resolution_trace: Dict[str, Any] = field(default_factory=dict)

CANONICAL_DIMENSION_NAMES = {
    "state": "state",
    "states": "state",
    "project_state": "state",
    "project_states": "state",
    "location": "location",
    "locations": "location",
    "physical_location": "location",
    "physical_locations": "location",
    "department": "department",
    "departments": "department",
    "job_level": "job_level",
    "job_levels": "job_level",
    "grade": "job_level",
    "grades": "job_level",
    "project": "project",
    "projects": "project",
    "manager": "manager",
    "employee_number": "employee_number",
    "skill": "skill",
    "skills": "skill",
}

# ETS Organizational Domain Model:
# Client delivery accounts/programs in ETS are organized geographically by state ('AK', 'ND', 'NH').
# In database and dashboard operations, 'state' and 'project' represent the exact same client partition hierarchy.
PARTITION_FAMILIES: Dict[str, Set[str]] = {
    "client_partition": {"state", "project"}
}

def resolve_filter_precedence(
    params: TypedParameters,
    active_filters: Optional[Dict[str, Any]],
    security: Optional[Any] = None,
    raw_query: Optional[str] = None,
    db_engine: Optional[Any] = None  # Preserved for API signature backwards compatibility
) -> FilterContext:
    ctx = FilterContext()

    # 0. Detect Semantic Scope Mode
    q_text = raw_query or params.raw_query or ""
    ctx.scope_mode = detect_scope_mode(q_text)

    # 1. Evaluate Immutable Row-Level Authorization Constraints (Precedence: 1)
    auth_dept = getattr(security, "department_scope", None) if security else None
    auth_fc = None
    if auth_dept:
        auth_fc = FilterConstraint(
            dimension="department",
            attribute="department",
            values=[auth_dept],
            source="authorization",
            scope="immutable",
            immutable=True
        )
        ctx.authorization_filters.append(auth_fc)

    # 2. Normalize active dashboard filters into FilterConstraints
    dash_map: Dict[str, FilterConstraint] = {}
    if active_filters:
        for k, v in active_filters.items():
            if v is None or v == "" or v == []:
                continue
            vals = v if isinstance(v, list) else [v]
            dim = CANONICAL_DIMENSION_NAMES.get(k.lower(), k.lower())
            fc = FilterConstraint(dimension=dim, attribute=k, values=vals, source="dashboard_filter", scope="scoped")
            ctx.dashboard_filters.append(fc)
            dash_map[dim] = fc

    # 3. Extract explicit query filters into FilterConstraints
    query_map: Dict[str, FilterConstraint] = {}
    if params.project_state or params.project_states:
        vals = params.project_states or ([params.project_state] if params.project_state else [])
        fc = FilterConstraint(dimension="state", attribute="state", values=vals, source="explicit_query")
        ctx.explicit_query_filters.append(fc)
        query_map["state"] = fc

    if params.physical_location or params.physical_locations:
        vals = params.physical_locations or ([params.physical_location] if params.physical_location else [])
        fc = FilterConstraint(dimension="location", attribute="location", values=vals, source="explicit_query")
        ctx.explicit_query_filters.append(fc)
        query_map["location"] = fc

    if params.department:
        fc = FilterConstraint(dimension="department", attribute="department", values=[params.department], source="explicit_query")
        ctx.explicit_query_filters.append(fc)
        query_map["department"] = fc

    if params.job_level or params.job_levels:
        vals = params.job_levels or ([params.job_level] if params.job_level else [])
        fc = FilterConstraint(dimension="job_level", attribute="job_level", values=vals, source="explicit_query")
        ctx.explicit_query_filters.append(fc)
        query_map["job_level"] = fc

    if params.project or params.projects:
        vals = params.projects or ([params.project] if params.project else [])
        fc = FilterConstraint(dimension="project", attribute="project", values=vals, source="explicit_query")
        ctx.explicit_query_filters.append(fc)
        query_map["project"] = fc

    if params.manager:
        fc = FilterConstraint(dimension="manager", attribute="manager", values=[params.manager], source="explicit_query")
        ctx.explicit_query_filters.append(fc)
        query_map["manager"] = fc

    if params.employee_number:
        fc = FilterConstraint(dimension="employee_number", attribute="employee_number", values=[params.employee_number], source="explicit_query")
        ctx.explicit_query_filters.append(fc)
        query_map["employee_number"] = fc

    # Enforce Authorization Precedence over Explicit Query
    if auth_dept:
        if "department" in query_map and set(str(x).lower() for x in query_map["department"].values) != {auth_dept.lower()}:
            ctx.dimension_conflicts.append({
                "type": "authorization_override_denied",
                "dimension": "department",
                "attempted_query_values": query_map["department"].values,
                "enforced_authorization_values": [auth_dept],
                "reason": f"Authorization constraint on 'department={auth_dept}' is immutable and cannot be overridden by user query."
            })
        params.department = auth_dept

    # 4. Handle Global Scope Escape
    effective: Dict[str, Any] = {}
    if ctx.scope_mode == ScopeModeEnum.GLOBAL:
        for dim, dfc in dash_map.items():
            conflict = {
                "type": "global_scope_cleared",
                "dimension": dim,
                "cleared_dashboard_values": dfc.values,
                "reason": "Dashboard filter cleared due to explicit global query scope intent."
            }
            ctx.cleared_filters.append(conflict)
            ctx.dimension_conflicts.append(conflict)
    else:
        # 5. Apply Generic Precedence Rules (Data-Independent, Zero DB Checks)
        for dim, dfc in dash_map.items():
            # Rule 1: Same dimension override (Explicit Query > Dashboard Filter)
            if dim in query_map:
                conflict = {
                    "type": "same_dimension_override",
                    "dimension": dim,
                    "suppressed_dashboard_values": dfc.values,
                    "query_values": query_map[dim].values,
                    "reason": f"Explicit query constraint on dimension '{dim}' supersedes dashboard filter."
                }
                ctx.overridden_filters.append(conflict)
                ctx.dimension_conflicts.append(conflict)
                continue

            # Rule 2: Domain Partition family conflict (e.g. State vs Project in client_partition)
            family_conflict = False
            for fam_name, fam_dims in PARTITION_FAMILIES.items():
                if dim in fam_dims and any(qd in fam_dims for qd in query_map):
                    q_dim = [qd for qd in fam_dims if qd in query_map][0]
                    q_vals = query_map[q_dim].values
                    if set(str(x).upper() for x in q_vals) != set(str(x).upper() for x in dfc.values):
                        conflict = {
                            "type": "partition_family_conflict",
                            "dimension": dim,
                            "conflicting_query_dimension": q_dim,
                            "partition_family": fam_name,
                            "suppressed_dashboard_values": dfc.values,
                            "query_values": q_vals,
                            "reason": f"Explicit query partition on '{q_dim}' ({q_vals}) in family '{fam_name}' conflicts with dashboard partition '{dim}' ({dfc.values})."
                        }
                        ctx.overridden_filters.append(conflict)
                        ctx.dimension_conflicts.append(conflict)
                        family_conflict = True
                        break
            if family_conflict:
                continue

            # Rule 4: Retain compatible dashboard filter (Zero data dependency)
            attr = dfc.attribute
            val = dfc.values[0] if len(dfc.values) == 1 else dfc.values
            effective[attr] = val
            ctx.resolved_constraints.append(dfc)

    # Always enforce immutable authorization constraint into effective filters
    if auth_dept and auth_fc:
        effective["department"] = auth_dept
        ctx.resolved_constraints.append(auth_fc)

    ctx.effective_filters = effective
    ctx.resolution_trace = {
        "scope_mode": ctx.scope_mode.value,
        "explicit_dimensions": list(query_map.keys()),
        "dashboard_dimensions": list(dash_map.keys()),
        "authorization_dimensions": ["department"] if auth_dept else [],
        "conflicts_detected": len(ctx.dimension_conflicts),
        "retained_filters": list(effective.keys())
    }
    params.filter_context = ctx
    return ctx

def merge_filter_context(
    params: TypedParameters,
    active_filters: Optional[Dict[str, Any]],
    security: Optional[Any] = None,
    raw_query: Optional[str] = None,
    db_engine: Optional[Any] = None
) -> Dict[str, Any]:
    """
    Generic Filter Precedence Model:
    Resolves precedence between ambient dashboard filters and explicit natural language query filters.
    Effective = (Active Dashboard Filters \\ Explicit Overrides \\ Dimension Conflicts) U Explicit Query Filters
    """
    ctx = resolve_filter_precedence(params, active_filters, security=security, raw_query=raw_query, db_engine=db_engine)
    return ctx.effective_filters

class CapabilityRegistry:
    def __init__(self):
        self.normalizer = EntityNormalizer()

    def resolve(
        self,
        query: str,
        history: Optional[List[Dict[str, Any]]] = None,
        context_tab: Optional[str] = None,
        active_filters: Optional[Dict[str, Any]] = None,
        security: Optional[Any] = None
    ) -> CapabilityContract:
        q_raw = query.strip()
        q_low = q_raw.lower()

        # 1. Extract Parameters
        states, unk_state = self.normalizer.extract_project_states(q_raw)
        locs, unk_loc = self.normalizer.extract_locations(q_raw)
        dept, unk_dept = self.normalizer.extract_department(q_raw)
        emp_id = self.normalizer.extract_employee_id(q_raw)
        matched_emp, emp_ambiguity, emp_candidates = self.normalizer.extract_employee(q_raw)
        if not emp_id and matched_emp:
            emp_id = matched_emp.get("employee_number")
        yr = self.normalizer.extract_year(q_raw)
        skill = self.normalizer.extract_skill(q_raw)
        job_levels = self.normalizer.extract_job_levels(q_raw)
        projects = self.normalizer.extract_projects(q_raw)
        exp_metrics = self.normalizer.extract_experience_metrics(q_raw)

        # Detect Manager / Reporting Hierarchy Intent
        is_mgr_lookup = any(re.search(p, q_low) for p in [
            r'\breporting\s+to\s+whom\b',
            r'\breports\s+to\s+whom\b',
            r'\bwho\s+does\s+.*report\s+to\b',
            r'\bto\s+whom\s+does\b',
            r'\bwho\s+is\s+.*manager\b',
            r'\bmanager\s+of\b',
            r'\bmanager\s+for\b',
            r"['’]s+\s+manager\b",
            r'\bwho\s+manages\b',
            r'\breporting\s+manager\b',
            r'\bsupervisor\b'
        ])
        is_direct_reports = any(re.search(p, q_low) for p in [
            r'\bwho\s+reports\s+to\b',
            r'\bwho\s+is\s+reporting\s+to\b',
            r'\bemployees?\s+reporting\s+to\b',
            r'\breport\s+to\b',
            r'\bdirect\s+reports\b',
            r"['’]s+\s+team\b",
            r'\bteam\s+of\b',
            r'\bunder\b'
        ])
        inquiry_type = None
        if is_mgr_lookup:
            inquiry_type = "manager_lookup"
        elif is_direct_reports:
            inquiry_type = "direct_reports_lookup"

        # Detect Leaver / Separation intent
        leaver_words = ['left', 'leave ets', 'leaving', 'exited', 'departed', 'resigned', 'former', 'separated', 'leavers']
        has_leaver_intent = any(re.search(rf'\b{w}\b', q_low) for w in leaver_words)

        # Explicit active employment status words only.
        active_status_patterns = [
            r'\bactive\b',
            r'\bcurrent\s+(?:employees?|staff|personnel|workforce|headcount)\b',
            r'\bcurrently\s+(?:active|employed|working)\b',
            r'\bstill\s+(?:working|employed)\b',
            r'\boperational\s+(?:staff|personnel|workforce)\b'
        ]
        has_active_intent = any(re.search(p, q_low) for p in active_status_patterns)

        current_status = None
        population = PopulationEnum.ALL
        if has_leaver_intent:
            current_status = 'Exited'
            population = PopulationEnum.EXITED
        elif has_active_intent:
            current_status = 'Active'
            population = PopulationEnum.ACTIVE

        # For direct reports query, the identified person is the manager filter, not the subject employee
        assigned_emp_id = None if is_direct_reports else emp_id
        assigned_mgr = (matched_emp.get("employee_label") if matched_emp else str(emp_id)) if is_direct_reports else None

        params = TypedParameters(
            raw_query=q_raw,
            population=population,
            project_states=states,
            project_state=states[0] if len(states) == 1 else None,
            physical_locations=locs,
            physical_location=locs[0] if len(locs) == 1 else None,
            department=dept,
            employee_number=assigned_emp_id,
            manager=assigned_mgr,
            year=yr,
            skill=skill,
            job_level=job_levels[0] if len(job_levels) == 1 else None,
            job_levels=job_levels,
            project=projects[0] if len(projects) == 1 else None,
            projects=projects,
            experience_metrics=exp_metrics,
            current_status=current_status,
            unrecognized_filter=unk_state or unk_loc or unk_dept,
            active_dashboard_filters=active_filters or {},
            inquiry_type=inquiry_type,
            matched_employee=matched_emp
        )

        # Apply generic filter precedence: merge active dashboard filters
        effective_active = merge_filter_context(params, active_filters, security=security, raw_query=q_raw)
        if effective_active:
            if not params.project_state and not params.project_states and effective_active.get("state"):
                params.project_state = effective_active["state"]
            elif not params.project_states and effective_active.get("states"):
                params.project_states = effective_active["states"]
            if not params.physical_location and not params.physical_locations and effective_active.get("location"):
                params.physical_location = effective_active["location"]
            elif not params.physical_locations and effective_active.get("locations"):
                params.physical_locations = effective_active["locations"]
            if effective_active.get("department"):
                params.department = effective_active["department"]
            if not params.job_level and not params.job_levels and effective_active.get("job_level"):
                params.job_level = effective_active["job_level"]
            if not params.project and not params.projects and effective_active.get("project"):
                params.project = effective_active["project"]
            if not params.manager and effective_active.get("manager"):
                params.manager = effective_active["manager"]

        # Enforce immutable security department scope unconditionally if present
        if security and getattr(security, "department_scope", None):
            params.department = security.department_scope

        # Check for unresolvable entity following "in <CapitalizedWord>"
        # e.g. "headcount in Delivery by gender"
        m_in = re.search(r'\bin\s+([A-Z][A-Za-z0-9_-]+)\b', q_raw)
        if m_in:
            cand_word = m_in.group(1)
            cand_word_low = cand_word.lower()
            common_words = {
                'the', 'our', 'all', 'any', 'each', 'every', 'total', 'active', 'exited',
                'project', 'state', 'department', 'city', 'location', 'ets', 'q1', 'q2', 'q3', 'q4',
                'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
                'september', 'october', 'november', 'december', 'year', 'years', 'terms', 'accordance',
                'that', 'this', 'those', 'these', 'infinite', 'prior', 'experience', 'grade', 'level'
            }
            is_valid_entity = (
                bool(states) or bool(unk_state) or
                bool(locs) or bool(unk_loc) or
                bool(dept) or bool(unk_dept) or
                bool(skill) or
                bool(job_levels) or
                bool(projects) or
                bool(exp_metrics) or
                cand_word_low in common_words or
                cand_word_low in VALID_DEPARTMENTS or
                cand_word_low in PHYSICAL_LOCATIONS or
                cand_word_low in KNOWN_OTHER_LOCATIONS
            )
            if not is_valid_entity:
                return CapabilityContract(
                    capability=CapabilityEnum.UNSUPPORTED_QUERY,
                    parameters=params,
                    execution_route="NO_MATCH",
                    meta={
                        "unresolved_entity": cand_word,
                        "reason": f"'{cand_word}' is not recognized as a valid department, physical location, or project state in ETS records."
                    }
                )

        # Structured Anaphora Context Resolution
        is_existential_there = bool(re.search(r'\b(?:are|is|were|was)\s+there\b', q_low) or re.search(r'\bthere\s+(?:are|is|were|was)\b', q_low))
        has_anaphoric_there = bool(re.search(r'\bthere\b', q_low)) and not is_existential_there

        anaphora_patterns = [
            r'\bthat\s+department\b',
            r'\bthat\s+dept\b',
            r'\bthat\s+location\b',
            r'\bthat\s+city\b',
            r'\bthat\s+state\b',
            r'\bthose\s+employees\b',
            r'\bof\s+them\b',
            r'\bfor\s+them\b',
            r'\bthem\b',
            r'\bits\b',
            r'\btheir\b',
        ]
        has_anaphora = has_anaphoric_there or any(re.search(p, q_low) for p in anaphora_patterns)
        is_elliptical_followup = (has_active_intent or has_leaver_intent) and len(states) == 0 and not unk_state and len(locs) == 0 and not unk_loc and not dept and not unk_dept and not skill and bool(history)

        if has_anaphora or is_elliptical_followup:
            if not history or len(history) == 0:
                return CapabilityContract(
                    capability=CapabilityEnum.UNSUPPORTED_QUERY,
                    parameters=params,
                    execution_route="AMBIGUOUS",
                    meta={"reason": f"Cannot resolve anaphoric reference in '{q_raw}'. No previous conversation context."}
                )

            # Locate last turn
            prev_turn = history[-1] if isinstance(history[-1], dict) else {}
            prev_q = prev_turn.get("question") or prev_turn.get("content") or ""
            prev_a = prev_turn.get("answer") or ""
            prev_filters = prev_turn.get("filters") or {}
            if not prev_q and len(history) >= 2 and isinstance(history[-2], dict):
                prev_q = history[-2].get("question") or history[-2].get("content") or ""

            cand_depts = []
            cand_locs = []
            cand_states = []
            cand_emp = None

            # 1. From previous filters
            if prev_filters.get("department"):
                cand_depts.append(prev_filters["department"])
            if prev_filters.get("location") or prev_filters.get("physical_location"):
                loc_val = prev_filters.get("location") or prev_filters.get("physical_location")
                if isinstance(loc_val, list):
                    cand_locs.extend(loc_val)
                elif loc_val:
                    cand_locs.append(loc_val)
            if prev_filters.get("state") or prev_filters.get("project_state"):
                st_val = prev_filters.get("state") or prev_filters.get("project_state")
                if isinstance(st_val, list):
                    cand_states.extend(st_val)
                elif st_val:
                    cand_states.append(st_val)
            if prev_filters.get("employee_number"):
                cand_emp = prev_filters["employee_number"]

            # 2. From previous question
            if prev_q:
                q_d, _ = self.normalizer.extract_department(prev_q)
                if q_d and q_d not in cand_depts:
                    cand_depts.append(q_d)
                q_l, _ = self.normalizer.extract_locations(prev_q)
                for l in q_l:
                    if l not in cand_locs:
                        cand_locs.append(l)
                q_s, _ = self.normalizer.extract_project_states(prev_q)
                for s in q_s:
                    if s not in cand_states:
                        cand_states.append(s)
                if not cand_emp:
                    cand_emp = self.normalizer.extract_employee_id(prev_q)

            # 3. From previous answer (e.g. for ranking questions like "Which department has highest headcount?")
            if prev_a and not cand_depts and not cand_locs and not cand_states:
                if 'department' in prev_q.lower() or 'dept' in prev_q.lower():
                    a_d, _ = self.normalizer.extract_department(prev_a)
                    if a_d and a_d not in cand_depts:
                        cand_depts.append(a_d)
                if any(w in prev_q.lower() for w in ['location', 'city']):
                    a_l, _ = self.normalizer.extract_locations(prev_a)
                    for l in a_l:
                        if l not in cand_locs:
                            cand_locs.append(l)
                if 'state' in prev_q.lower():
                    a_s, _ = self.normalizer.extract_project_states(prev_a)
                    for s in a_s:
                        if s not in cand_states:
                            cand_states.append(s)
                if not cand_emp:
                    cand_emp = self.normalizer.extract_employee_id(prev_a)

            # Explicit dimension references:
            is_explicit_dept = bool(re.search(r'\b(?:in\s+)?that\s+(?:department|dept)\b', q_low))
            is_explicit_loc = bool(re.search(r'\b(?:in\s+)?that\s+(?:location|city)\b', q_low))
            is_explicit_state = bool(re.search(r'\b(?:in\s+)?that\s+(?:state|project\s+state)\b', q_low))

            if is_explicit_dept:
                if len(cand_depts) == 1:
                    params.department = cand_depts[0]
                    params.antecedent_type = "department"
                    params.antecedent_value = cand_depts[0]
                else:
                    return CapabilityContract(
                        capability=CapabilityEnum.UNSUPPORTED_QUERY,
                        parameters=params,
                        execution_route="AMBIGUOUS",
                        meta={"reason": f"Cannot resolve 'that department' in '{q_raw}'. No unambiguous department in previous turn."}
                    )
            elif is_explicit_loc:
                if len(cand_locs) == 1:
                    params.physical_location = cand_locs[0]
                    params.physical_locations = [cand_locs[0]]
                    params.antecedent_type = "location"
                    params.antecedent_value = cand_locs[0]
                else:
                    return CapabilityContract(
                        capability=CapabilityEnum.UNSUPPORTED_QUERY,
                        parameters=params,
                        execution_route="AMBIGUOUS",
                        meta={"reason": f"Cannot resolve 'that location' in '{q_raw}'. No unambiguous location in previous turn."}
                    )
            elif is_explicit_state:
                if len(cand_states) == 1:
                    params.project_state = cand_states[0]
                    params.project_states = [cand_states[0]]
                    params.antecedent_type = "state"
                    params.antecedent_value = cand_states[0]
                else:
                    return CapabilityContract(
                        capability=CapabilityEnum.UNSUPPORTED_QUERY,
                        parameters=params,
                        execution_route="AMBIGUOUS",
                        meta={"reason": f"Cannot resolve 'that state' in '{q_raw}'. No unambiguous state in previous turn."}
                    )
            else:
                # General anaphora: 'there', 'those employees', 'them', 'its', 'their'
                is_emp_query = cand_emp and any(k in q_low for k in ["salary", "ctc", "manager", "project", "skills", "tenure", "title"]) and not any(k in q_low for k in ["average", "avg", "total", "headcount", "how many"])
                if is_emp_query:
                    params.employee_number = cand_emp
                    params.antecedent_type = "employee_number"
                    params.antecedent_value = cand_emp
                elif len(cand_depts) == 1 and not cand_locs and not cand_states:
                    params.department = cand_depts[0]
                    params.antecedent_type = "department"
                    params.antecedent_value = cand_depts[0]
                elif len(cand_locs) == 1 and not cand_depts and not cand_states:
                    params.physical_location = cand_locs[0]
                    params.physical_locations = [cand_locs[0]]
                    params.antecedent_type = "location"
                    params.antecedent_value = cand_locs[0]
                elif len(cand_states) == 1 and not cand_depts and not cand_locs:
                    params.project_state = cand_states[0]
                    params.project_states = [cand_states[0]]
                    params.antecedent_type = "state"
                    params.antecedent_value = cand_states[0]
                else:
                    return CapabilityContract(
                        capability=CapabilityEnum.UNSUPPORTED_QUERY,
                        parameters=params,
                        execution_route="AMBIGUOUS",
                        meta={"reason": f"Cannot resolve ambiguous reference in '{q_raw}'. Context contains multiple or no entity referents."}
                    )

        # 2. General Multi-Requirement Analytical Decomposition
        reasoning_patterns = [
            r'\bwhy\b', r'\bwhy did\b', r'\bwhy is\b', r'\bwhy are\b',
            r'\bshould leadership\b', r'\bwhat should\b', r'\bhow should\b',
            r'\brecommend\b', r'\brecommendation\b', r'\bwhat if\b',
            r'\bhypothetical\b', r'\bskill risk\b', r'\bskills risk\b',
            r'\bvulnerable skill\b', r'\bvulnerable skills\b',
            r'\bspan of control risk\b', r'\bmanagement span risk\b',
            r'\bexposure\b', r'\bi think\b', r'\bi believe\b',
            r'\bis that correct\b', r'\bis that true\b', r'\bassume\b',
            r'\brisk\b', r'\brisks\b'
        ]
        is_exec_reasoning = any(re.search(p, q_low) for p in reasoning_patterns)

        # 3. Check for Unsupported Commercial Finance Queries (Single-intent)
        for fin_kw in COMMERCIAL_FINANCE_KEYWORDS:
            if re.search(rf'\b{fin_kw}\b', q_low):
                return CapabilityContract(
                    capability=CapabilityEnum.UNSUPPORTED_COMMERCIAL_FINANCE,
                    parameters=params,
                    execution_route="UNSUPPORTED_COMMERCIAL_FINANCE",
                    meta={"reason": f"Commercial finance topic '{fin_kw}' is not present in ETS records"}
                )

        # 3.5 Check for General Unsupported Domain Queries (Single-intent)
        for bad_kw in UNSUPPORTED_DOMAINS:
            if re.search(rf'\b{bad_kw}\b', q_low):
                return CapabilityContract(
                    capability=CapabilityEnum.UNSUPPORTED_QUERY,
                    parameters=params,
                    execution_route="UNSUPPORTED",
                    meta={"reason": f"Query topic '{bad_kw}' is out of organizational boundary"}
                )

        # 4. Check for Policy / Handbook / RAG Queries (Single-intent)
        is_policy = any(re.search(rf'\b{kw}\b', q_low) for kw in POLICY_KEYWORDS)
        if is_policy and not any(k in q_low for k in ['how many', 'count', 'list active', 'total salary']):
            return CapabilityContract(
                capability=CapabilityEnum.RAG_POLICY_QA,
                parameters=params,
                execution_route="RAG",
                meta={"policy_inquiry": True}
            )

        # 4.2 Multi-Entity Comparison Handling (Self-Contained Priority & Multi-Turn Follow-up)
        is_comp = any(k in q_low for k in [
            "which one has more", "who has more", "which is higher", "which one is higher",
            "which has more", "compare", "comparison", "vs", "versus", "more than",
            "more employees", "higher", "difference", "compared to",
            "what is the difference", "difference between", "by how much", "by how many",
            "how many more"
        ])
        if is_comp:
            is_diff = any(k in q_low for k in ["difference", "how many more", "by how much", "by how many", "diff"])
            sub_mode = "difference" if is_diff else "which_more"

            # 4.2.1 Self-Contained Current-Turn Comparison (Zero History Leakage)
            # If current query contains 2+ entities on any dimension, execute immediately.
            if len(states) >= 2:
                params.project_states = states[:2]
                plan = AnalyticalParser.create_comparison_plan(
                    dimension=DimensionEnum.STATE,
                    entities=states[:2],
                    sub_mode=sub_mode,
                    raw_q=q_raw,
                    base_params=params
                )
                return CapabilityContract(
                    capability=CapabilityEnum.COMPARISON,
                    parameters=params,
                    execution_route="MULTI_REQUIREMENT",
                    meta={"dimension": "state", "entities": states[:2], "sub_mode": sub_mode, "analytical_plan": plan}
                )
            if len(locs) >= 2:
                params.physical_locations = locs[:2]
                plan = AnalyticalParser.create_comparison_plan(
                    dimension=DimensionEnum.LOCATION,
                    entities=locs[:2],
                    sub_mode=sub_mode,
                    raw_q=q_raw,
                    base_params=params
                )
                return CapabilityContract(
                    capability=CapabilityEnum.COMPARISON,
                    parameters=params,
                    execution_route="MULTI_REQUIREMENT",
                    meta={"dimension": "location", "entities": locs[:2], "sub_mode": sub_mode, "analytical_plan": plan}
                )
            if len(job_levels) >= 2:
                params.job_levels = job_levels[:2]
                plan = AnalyticalParser.create_comparison_plan(
                    dimension=DimensionEnum.JOB_LEVEL,
                    entities=job_levels[:2],
                    sub_mode=sub_mode,
                    raw_q=q_raw,
                    base_params=params
                )
                return CapabilityContract(
                    capability=CapabilityEnum.COMPARISON,
                    parameters=params,
                    execution_route="MULTI_REQUIREMENT",
                    meta={"dimension": "job_level", "entities": job_levels[:2], "sub_mode": sub_mode, "analytical_plan": plan}
                )
            if len(projects) >= 2:
                params.projects = projects[:2]
                plan = AnalyticalParser.create_comparison_plan(
                    dimension=DimensionEnum.PROJECT,
                    entities=projects[:2],
                    sub_mode=sub_mode,
                    raw_q=q_raw,
                    base_params=params
                )
                return CapabilityContract(
                    capability=CapabilityEnum.COMPARISON,
                    parameters=params,
                    execution_route="MULTI_REQUIREMENT",
                    meta={"dimension": "project", "entities": projects[:2], "sub_mode": sub_mode, "analytical_plan": plan}
                )

            # 4.2.2 Elliptical / Anaphoric Follow-up (Only when current turn lacks 2+ entities)
            if history and len(history) > 0:
                prev_comp_dim = None
                prev_comp_entities = []
                for prev_item in reversed(history):
                    if not isinstance(prev_item, dict):
                        continue
                    meta_p = prev_item.get("meta") or {}
                    if meta_p.get("dimension") and meta_p.get("entities") and len(meta_p["entities"]) >= 2:
                        prev_comp_dim = meta_p["dimension"]
                        prev_comp_entities = list(meta_p["entities"][:2])
                        break
                    p_q = prev_item.get("question") or prev_item.get("user") or prev_item.get("content") or ""
                    p_states, _ = self.normalizer.extract_project_states(p_q)
                    p_locs, _ = self.normalizer.extract_locations(p_q)
                    if p_states:
                        if not prev_comp_dim or prev_comp_dim == "state":
                            prev_comp_dim = "state"
                            for s in p_states:
                                if s not in prev_comp_entities:
                                    prev_comp_entities.append(s)
                    if p_locs:
                        if not prev_comp_dim or prev_comp_dim == "location":
                            prev_comp_dim = "location"
                            for l in p_locs:
                                if l not in prev_comp_entities:
                                    prev_comp_entities.append(l)

                    if len(prev_comp_entities) >= 2:
                        break

                # Sub-case A: 0 entities in current query (e.g. "which one has more?", "what is the difference?")
                if len(states) == 0 and len(locs) == 0 and len(job_levels) == 0 and len(projects) == 0 and not dept:
                    if prev_comp_entities and len(prev_comp_entities) >= 2:
                        target_dim = DimensionEnum.STATE if prev_comp_dim == "state" else DimensionEnum.LOCATION
                        if prev_comp_dim == "state":
                            params.project_states = prev_comp_entities[:2]
                        else:
                            params.physical_locations = prev_comp_entities[:2]
                        plan = AnalyticalParser.create_comparison_plan(
                            dimension=target_dim,
                            entities=prev_comp_entities[:2],
                            sub_mode=sub_mode,
                            raw_q=q_raw,
                            base_params=params
                        )
                        return CapabilityContract(
                            capability=CapabilityEnum.COMPARISON,
                            parameters=params,
                            execution_route="MULTI_REQUIREMENT",
                            meta={"dimension": prev_comp_dim, "entities": prev_comp_entities[:2], "sub_mode": sub_mode, "analytical_plan": plan}
                        )

                # Sub-case B: 1 entity in current query (e.g. "What about Chennai?", "Now compare it with ND")
                if len(states) == 1 and prev_comp_dim == "state" and prev_comp_entities:
                    new_entities = [prev_comp_entities[0], states[0]]
                    params.project_states = new_entities
                    plan = AnalyticalParser.create_comparison_plan(
                        dimension=DimensionEnum.STATE,
                        entities=new_entities,
                        sub_mode=sub_mode,
                        raw_q=q_raw,
                        base_params=params
                    )
                    return CapabilityContract(
                        capability=CapabilityEnum.COMPARISON,
                        parameters=params,
                        execution_route="MULTI_REQUIREMENT",
                        meta={"dimension": "state", "entities": new_entities, "sub_mode": sub_mode, "analytical_plan": plan}
                    )
                elif len(locs) == 1 and prev_comp_dim == "location" and prev_comp_entities:
                    new_entities = [prev_comp_entities[0], locs[0]]
                    params.physical_locations = new_entities
                    plan = AnalyticalParser.create_comparison_plan(
                        dimension=DimensionEnum.LOCATION,
                        entities=new_entities,
                        sub_mode=sub_mode,
                        raw_q=q_raw,
                        base_params=params
                    )
                    return CapabilityContract(
                        capability=CapabilityEnum.COMPARISON,
                        parameters=params,
                        execution_route="MULTI_REQUIREMENT",
                        meta={"dimension": "location", "entities": new_entities, "sub_mode": sub_mode, "analytical_plan": plan}
                    )

        # 4.3 Analytical Decomposition
        is_yoy_trend = any(k in q_low for k in ['yoy', 'year over year', 'year-over-year', 'annual trend', 'annual attrition', 'yearly', 'trend', 'history', 'historical'])
        if is_yoy_trend and any(k in q_low for k in ['attrition', 'turnover', 'churn', 'exit', 'leavers']):
            return CapabilityContract(
                capability=CapabilityEnum.ATTRITION,
                parameters=params,
                execution_route="DYNAMIC_LLM_SQL",
                meta={"temporal_scope": "yoy", "requires_llm": True}
            )

        if not is_exec_reasoning:
            analytical_plan = AnalyticalParser.parse(q_raw, params)
            if analytical_plan and analytical_plan.requirements:
                has_sql = any(r.executor == ExecutorEnum.SQL for r in analytical_plan.requirements)
                has_emp = any(r.target_capability == CapabilityEnum.EMPLOYEE_LOOKUP for r in analytical_plan.requirements)
                if has_sql or has_emp:
                    primary_cap = analytical_plan.requirements[0].target_capability or CapabilityEnum.FILTER_COMPOSITION
                    has_multi_dim = (
                        (bool(params.project_state or params.project_states) and bool(params.physical_location or params.physical_locations)) or
                        (bool(params.project_state or params.project_states) and bool(params.department)) or
                        (bool(params.physical_location or params.physical_locations) and bool(params.department)) or
                        (len(analytical_plan.requirements) > 1)
                    )
                    cap = CapabilityEnum.FILTER_COMPOSITION if has_multi_dim else primary_cap
                    return CapabilityContract(
                        capability=cap,
                        parameters=params,
                        execution_route="MULTI_REQUIREMENT",
                        meta={"analytical_plan": analytical_plan, "population": population.value}
                    )

        # 4.5 Executive Reasoning Inquiries (Genuinely LLM-dependent)
        if is_exec_reasoning:
            if skill:
                return CapabilityContract(
                    capability=CapabilityEnum.SKILLS_CONCENTRATION_RISK,
                    parameters=params,
                    execution_route="EXECUTIVE_REASONING",
                    meta={"skill": skill, "report_type": "SKILL_CONCENTRATION_REASONING"}
                )
            else:
                return CapabilityContract(
                    capability=CapabilityEnum.TOP_WORKFORCE_RISKS,
                    parameters=params,
                    execution_route="EXECUTIVE_REASONING",
                    meta={"report_type": "EXECUTIVE_RISK_BRIEF"}
                )

        # 4. Context Follow-Up Resolution
        if history and len(history) > 0:
            q_prev = ""
            a_prev = ""
            for item in reversed(history):
                if isinstance(item, dict):
                    if item.get("role") == "user" and not q_prev:
                        q_prev = item.get("content") or ""
                    elif item.get("role") == "assistant" and not a_prev:
                        a_prev = item.get("content") or ""
                    elif item.get("question") and not q_prev:
                        q_prev = item.get("question") or ""
                        a_prev = item.get("answer") or ""
            if not q_prev and len(history) > 0:
                last_turn = history[-1] if isinstance(history[-1], dict) else {}
                q_prev = last_turn.get("question") or last_turn.get("content") or ""
                a_prev = last_turn.get("answer") or ""

            # Headcount follow-up: "how many of them are active?", "how many are active?", "how many have left?"
            # If the current question asks for active/leavers without repeating the entity, inherit entity from previous turn
            if len(states) == 0 and not unk_state and len(locs) == 0 and not unk_loc:
                if has_active_intent or has_leaver_intent:
                    prev_states, prev_unk_st = self.normalizer.extract_project_states(q_prev)
                    prev_locs, prev_unk_loc = self.normalizer.extract_locations(q_prev)
                    if prev_states or prev_unk_st:
                        params.project_states = prev_states
                        params.project_state = prev_states[0] if len(prev_states) == 1 else None
                        params.unrecognized_filter = prev_unk_st
                        cap = CapabilityEnum.ACTIVE_HEADCOUNT if has_active_intent else CapabilityEnum.LEAVER_COUNT
                        return CapabilityContract(
                            capability=cap,
                            parameters=params,
                            execution_route="MULTI_REQUIREMENT",
                            meta={"inherited_dimension": "state", "status": current_status, "population": population.value}
                        )
                    elif prev_locs or prev_unk_loc:
                        params.physical_locations = prev_locs
                        params.physical_location = prev_locs[0] if len(prev_locs) == 1 else None
                        params.unrecognized_filter = prev_unk_loc
                        cap = CapabilityEnum.ACTIVE_HEADCOUNT if has_active_intent else CapabilityEnum.LEAVER_COUNT
                        return CapabilityContract(
                            capability=cap,
                            parameters=params,
                            execution_route="MULTI_REQUIREMENT",
                            meta={"inherited_dimension": "location", "status": current_status, "population": population.value}
                        )

            # Employee follow-up: "their salary", "their manager", "what is their tenure"
            if any(k in q_low for k in ["their salary", "their ctc", "his salary", "her salary", "their compensation", "their manager", "their project", "their skills"]):
                prev_emp = self.normalizer.extract_employee_id(q_prev)
                if not prev_emp and a_prev:
                    prev_emp = self.normalizer.extract_employee_id(a_prev)
                if prev_emp:
                    params.employee_number = prev_emp
                    params.antecedent_type = "employee_number"
                    params.antecedent_value = prev_emp
                    return CapabilityContract(
                        capability=CapabilityEnum.FOLLOW_UP_CONTEXT,
                        parameters=params,
                        execution_route="MULTI_REQUIREMENT",
                        meta={"follow_up_target": "employee_attribute", "employee_number": prev_emp}
                    )

        # 5. Direct Employee ID Lookup
        if emp_id is not None:
            return CapabilityContract(
                capability=CapabilityEnum.EMPLOYEE_LOOKUP,
                parameters=params,
                execution_route="MULTI_REQUIREMENT",
                meta={"employee_number": emp_id}
            )

        # 6. Attrition Capability
        is_attr_query = any(k in q_low for k in ['attrition', 'turnover rate', 'churn rate', 'exit rate'])
        is_exec_exposure = any(k in q_low for k in [
            'exposure', 'most exposed', 'highest attrition exposure', 'grades are most exposed',
            'project has the highest attrition', 'capabilities are most exposed', 'if attrition continues',
            'assume', 'what if', 'hypothetical', 'scenario'
        ])
        if is_attr_query and not is_exec_exposure:
            is_yoy = any(k in q_low for k in ['yoy', 'year over year', 'year-over-year', 'annual trend', 'annual attrition', 'yearly', 'trend', 'history', 'historical'])
            if is_yoy:
                return CapabilityContract(
                    capability=CapabilityEnum.ATTRITION,
                    parameters=params,
                    execution_route="DYNAMIC_LLM_SQL",
                    meta={"temporal_scope": "yoy", "requires_llm": True}
                )
            return CapabilityContract(
                capability=CapabilityEnum.ATTRITION,
                parameters=params,
                execution_route="MULTI_REQUIREMENT",
                meta={"temporal_scope": "annual" if yr else "cumulative"}
            )

        # --- EXECUTIVE DECISION CAPABILITIES (CEO / CFO / CTO QUESTION SET) ---

        # 7.1 Finance Data Provenance Audit
        if any(k in q_low for k in [
            'authoritative versus derived', 'authoritative vs derived', 'authoritative or derived',
            'how much of our finance history is authoritative', 'finance history provenance',
            'authoritative finance data', 'synthetic versus authoritative',
            'promotion events are included', 'historical period does the promotion',
            'difference between authoritative and derived', 'authoritative promotion history',
            'derived/synthetic finance history', 'derived finance history', 'synthetic finance history',
            'show me the authoritative promotion history', 'show me the derived'
        ]):
            return CapabilityContract(
                capability=CapabilityEnum.FINANCE_PROVENANCE_AUDIT,
                parameters=params,
                execution_route="MULTI_REQUIREMENT",
                meta={"metric": "finance_history_provenance"}
            )

        # 7.2 Maximum CTC Ceiling & Headcount
        if any(k in q_low for k in [
            'maximum ctc', 'max ctc', 'at the maximum ctc', 'highest ctc ceiling', 'at maximum salary', 'at the max ctc'
        ]):
            return CapabilityContract(
                capability=CapabilityEnum.MAX_CTC_DISTRIBUTION,
                parameters=params,
                execution_route="MULTI_REQUIREMENT",
                meta={"metric": "annual_ctc", "filter": "maximum"}
            )

        # 7.3 Salary / Compensation Concentration (Top 10 earners share, distribution concentration)
        if any(k in q_low for k in [
            'compensation most concentrated', 'compensation concentrated', 'salary cost concentrated',
            'salary concentrated', 'top 10 highest-paid employees', 'top 10 highest paid employees',
            'top 10 paid employees', 'percentage of salary cost sits with our top 10', 'top 10 highest-paid',
            'top 10 earners share', 'top 10 compensation', 'where is compensation concentrated',
            'where is our compensation cost concentrated', 'paying disproportionately high compensation',
            'where are we financially concentrated', 'financially concentrated', 'financial concentration'
        ]):
            return CapabilityContract(
                capability=CapabilityEnum.SALARY_CONCENTRATION,
                parameters=params,
                execution_route="MULTI_REQUIREMENT",
                meta={"metric": "annual_ctc_concentration", "limit": 10}
            )

        # 7.4 Salary Cost Consumed By Grade / Grade Distribution
        if any(k in q_low for k in [
            'grade consumes the most salary cost', 'grades consume the most salary cost', 'grade consumes most',
            'salary cost by grade', 'salary by grade', 'average salary by grade', 'compensation by grade',
            'highest average compensation', 'which grade has the highest average', 'salary distribution across e1',
            'salary distribution across e1-e10', 'grades have the largest promotion', 'largest promotion-driven compensation',
            'salary distribution across grades', 'salary distribution by grade', 'salary distribution across all grades'
        ]):
            return CapabilityContract(
                capability=CapabilityEnum.SALARY_COST_BY_GRADE,
                parameters=params,
                execution_route="MULTI_REQUIREMENT",
                meta={"group_by": "job_level", "metric": "annual_ctc"}
            )

        # 7.5 Salary Cost By Project / Location / State
        if any(k in q_low for k in [
            'project has the highest salary cost', 'state has the highest salary cost', 'highest salary cost',
            'highest total salary', 'salary cost by project', 'salary cost by state',
            'which project/state has the highest salary cost', 'which project has the highest salary',
            'which location has the highest payroll cost', 'which city has the highest payroll cost',
            'highest payroll cost', 'salary cost by location', 'payroll by location', 'payroll cost by location'
        ]):
            group_dim = "location" if any(l in q_low for l in ['location', 'city']) else ("state" if 'state' in q_low else "project")
            return CapabilityContract(
                capability=CapabilityEnum.SALARY_COST_BY_PROJECT,
                parameters=params,
                execution_route="MULTI_REQUIREMENT",
                meta={"group_by": group_dim, "metric": "annual_ctc"}
            )

        # 7.6 Total Annual Salary / Payroll Cost
        if any(k in q_low for k in [
            'total annual salary cost', 'total salary cost', 'annual salary cost', 'total payroll cost',
            'total compensation cost', 'annual compensation cost', 'total annual salary', 'what is our total annual salary',
            'total annual ctc', 'total ctc', 'annual ctc', 'overall ctc', 'total salary', 'sum of salary', 'sum of ctc',
            'total active salary cost', 'active salary cost', 'active payroll cost', 'total active ctc'
        ]) and not any(r in q_low for r in ['highest', 'lowest', 'min', 'max', 'least', 'most', 'who earns', 'top salary', 'bottom']):
            if 'active' in q_low:
                params.population = PopulationEnum.ACTIVE
                params.current_status = 'Active'
            return CapabilityContract(
                capability=CapabilityEnum.SALARY_TOTAL_COST,
                parameters=params,
                execution_route="MULTI_REQUIREMENT",
                meta={"metric": "annual_ctc", "population": params.population.value}
            )

        # 7.7 Technology Skills Top Ranking & Multi-Skill Personnel
        if any(k in q_low for k in [
            'top 10 technology skills', 'top technology skills', 'top 10 skills', 'top skills',
            'deepest talent pool', 'technologies have the deepest talent pool', 'what are our top technology skills',
            'multiple critical technology skills', 'multiple critical skills', 'multiple skills'
        ]):
            is_multi = any(k in q_low for k in ['multiple critical', 'multiple skills', 'which employees have multiple'])
            return CapabilityContract(
                capability=CapabilityEnum.SKILLS_TOP_RANKING,
                parameters=params,
                execution_route="MULTI_REQUIREMENT",
                meta={"limit": 10, "metric": "emp_count", "direction": "DESC", "mode": "employees_with_multiple_skills" if is_multi else "top_skills"}
            )

        # 7.8 Rarest Technology Skills
        if any(k in q_low for k in [
            'skills are rarest', 'rarest technology skills', 'rarest skills', 'fewest employees',
            'weakest talent coverage', 'technologies have the weakest talent coverage', 'what are our rarest technology skills'
        ]):
            return CapabilityContract(
                capability=CapabilityEnum.SKILLS_RAREST,
                parameters=params,
                execution_route="MULTI_REQUIREMENT",
                meta={"threshold": 2, "direction": "ASC"}
            )

        # 7.9 Technology Concentration Risk & Single-Person Dependencies
        if any(k in q_low for k in [
            'critical skills depend on very few', 'critical skills depend on few', 'technology concentration risk',
            'single-person dependency', 'single person dependency', 'single-point-of-failure', 'spof',
            'capabilities are at highest concentration risk', 'insufficient skill redundancy',
            'skills represent a single-person dependency', 'which technology skills are our biggest risk',
            'technology skills are our biggest risk', 'depend on only one employee', 'depends on only one employee',
            'skills depend on only one', 'single-person capability dependencies', 'no redundancy',
            'skills have no redundancy', 'three biggest technology capability risks', 'biggest technology capability risks',
            'technology dependency risk', 'technology capabilities depend on', 'critical technology skills concentrated',
            'technology capability gaps', 'capability gaps', 'single-person capability risks', 'single-person dependencies',
            'which skills depend on only one employee', 'which technology capabilities depend on a small number of employees',
            'which projects have the greatest technology dependency risk', 'which projects have the greatest skill concentration risk',
            'which skills have no redundancy', 'where do we have technology capability gaps',
            'where are our critical technology skills concentrated', 'which employees represent single-person capability dependencies'
        ]):
            return CapabilityContract(
                capability=CapabilityEnum.SKILLS_CONCENTRATION_RISK,
                parameters=params,
                execution_route="MULTI_REQUIREMENT",
                meta={"risk_type": "SINGLE_POINT_OF_FAILURE", "threshold": 2}
            )

        # 7.10 Project Technology Coverage
        if any(k in q_low for k in [
            'strongest technology coverage', 'strongest tech coverage', 'projects have the strongest technology',
            'tech coverage by project', 'technology coverage', 'which projects have the strongest technology'
        ]):
            return CapabilityContract(
                capability=CapabilityEnum.PROJECT_TECH_COVERAGE,
                parameters=params,
                execution_route="MULTI_REQUIREMENT",
                meta={"metric": "distinct_skills", "group_by": "project"}
            )

        # 7.11 Skill Hiring Priorities & External Hiring Reasoning
        if any(k in q_low for k in [
            'prioritize for hiring', 'should we hire for', 'technologies should we hire for',
            'hiring priorities', 'which skills should we hire for', 'which skills should we prioritize for hiring',
            'what hiring priorities', 'hiring priorities would you recommend',
            'hire externally', 'hire externally for', 'skills should we hire externally',
            'hire for versus develop', 'hire vs develop', 'hire versus develop'
        ]):
            return CapabilityContract(
                capability=CapabilityEnum.SKILL_HIRING_PRIORITIES,
                parameters=params,
                execution_route="EXECUTIVE_REASONING",
                meta={"mode": "HIRE_PRIORITIES"}
            )

        # 7.12 Internal Skill Redeployment vs External Hiring
        if any(k in q_low for k in [
            'internal redeployment', 'redeploy internally', 'excess skill capacity',
            'build internally versus hire externally', 'internal mobility',
            'which skills could we satisfy through internal redeployment',
            'skills could we satisfy through internal redeployment',
            'build internally', 'skills should we build internally',
            'redeploy existing talent', 'instead of hiring', 'redeploy existing talent instead of hiring',
            'which skills should we develop internally', 'skills should we develop internally',
            'prioritize redeployment', 'where should we prioritize redeployment'
        ]):
            return CapabilityContract(
                capability=CapabilityEnum.SKILL_REDEPLOYMENT,
                parameters=params,
                execution_route="EXECUTIVE_REASONING",
                meta={"mode": "INTERNAL_REDEPLOYMENT"}
            )

        # 7.13 Project / Grade Attrition Exposure & Retention Priorities
        if any(k in q_low for k in [
            'exposed to employee exits', 'exposed to exits', 'highest employee-exit exposure',
            'exit exposure', 'where are exits concentrated', 'exits concentrated',
            'prioritize retention', 'where should management prioritize retention',
            'which projects are most exposed to employee exits', 'project has the highest exit exposure',
            'highest attrition exposure', 'highest attrition', 'where are our employee exits concentrated',
            'which grades are most exposed to attrition', 'grades are most exposed to attrition',
            'grades are most exposed to employee exits', 'attrition exposure', 'prioritize retention efforts',
            'which parts of the organization should management investigate for retention',
            'which projects require succession or backup coverage'
        ]):
            group_dim = "job_level" if any(g in q_low for g in ['grade', 'grades', 'job level', 'level']) else "project"
            return CapabilityContract(
                capability=CapabilityEnum.PROJECT_ATTRITION_EXPOSURE,
                parameters=params,
                execution_route="MULTI_REQUIREMENT",
                meta={"metric": "exited_count", "group_by": group_dim}
            )

        # 7.14 Management Spans & Key Person Dependency
        if any(k in q_low for k in [
            'overly dependent on a small number of employees', 'overly dependent on a few',
            'management concentration', 'management spans', 'largest teams',
            'which managers have the largest teams', 'top-heavy', 'unusually large or small management spans',
            'where do we have management concentration', 'largest management span', 'unusually large management spans',
            'concentrated is management responsibility', 'how concentrated is management responsibility',
            'percentage of employees report to the top five', 'percentage of employees report to the top 5',
            'what percentage of employees report to the top five managers', 'management capacity be constrained',
            'where might management capacity be constrained', 'who has the largest management span',
            'parts of the organization have the greatest management concentration',
            'most dependent on a small number of employees', 'dependent on a small number of employees',
            'where are we most dependent', 'dependent on a small number'
        ]):
            is_interpretive = any(k in q_low for k in ['where might management capacity', 'management capacity be constrained', 'where do we have management capacity risk', 'management capacity risk'])
            return CapabilityContract(
                capability=CapabilityEnum.MANAGEMENT_SPAN_RISK,
                parameters=params,
                execution_route="EXECUTIVE_REASONING" if is_interpretive else "MULTI_REQUIREMENT",
                meta={"metric": "team_size", "group_by": "manager"}
            )

        # 7.15 Top 3 Workforce Risks & Strategic Investigation (and Mixed / False-Premise / Hypothetical Queries)
        if any(k in q_low for k in [
            'three biggest workforce risks', 'biggest workforce risks', 'top workforce risks',
            'workforce risks visible', 'key workforce risks', 'three biggest risks',
            'what are our three biggest workforce risks', 'biggest workforce risks visible in the current data',
            'what should management investigate first', 'where are we most vulnerable to losing key capabilities',
            'what capabilities are most exposed if attrition continues', 'if attrition continues',
            'why might nh represent a workforce risk', 'what does our attrition pattern suggest',
            'if you were the ceo', 'compare our technology capability and identify vulnerabilities',
            'what strategic workforce actions should we consider', 'what strategic workforce actions should leadership consider',
            'what strategic workforce actions', 'what does our compensation concentration tell us',
            'assume nh has', 'assume', 'is that correct', 'is that true', 'is that right', 'is that accurate',
            'which workforce risks deserve the most attention', 'workforce risks deserve',
            'why should leadership care', 'what risks does that create'
        ]):
            return CapabilityContract(
                capability=CapabilityEnum.TOP_WORKFORCE_RISKS,
                parameters=params,
                execution_route="EXECUTIVE_REASONING",
                meta={"report_type": "EXECUTIVE_RISK_BRIEF"}
            )

        # 7.16 Top 3 Workforce Investments & Strategic Prioritization
        if any(k in q_low for k in [
            'three workforce investments', 'workforce investments', 'make only three workforce investments',
            'strategic workforce investments', 'strategic investments', 'where should we hire next',
            'where should we prioritize workforce investment', 'prioritize workforce investment',
            'where should leadership focus workforce investment', 'where should leadership focus',
            'focus workforce investment', 'focus its workforce investment',
            'what workforce areas should we prioritize', 'workforce areas should we prioritize',
            'what workforce areas deserve attention', 'workforce areas deserve attention', 'workforce areas deserve',
            'if we could make only three workforce investments', 'biggest workforce decisions suggested'
        ]):
            return CapabilityContract(
                capability=CapabilityEnum.STRATEGIC_INVESTMENTS,
                parameters=params,
                execution_route="EXECUTIVE_REASONING",
                meta={"report_type": "STRATEGIC_INVESTMENT_PLAN"}
            )

        # 8. Rankings / Extremes (Highest / Lowest Salary / Compensation)
        is_comp_query = any(c in q_low for c in ['salary', 'ctc', 'compensation', 'pay', 'earner', 'earns', 'paid'])
        has_high_extreme = any(k in q_low for k in ['highest', 'top', 'max', 'maximum', 'peak', 'most']) or 'who earns the most' in q_low or 'earns the most' in q_low
        has_low_extreme = any(k in q_low for k in ['lowest', 'bottom', 'min', 'minimum', 'least']) or 'who earns the least' in q_low or 'earns the least' in q_low

        if is_comp_query and has_high_extreme:
            params.direction = "DESC"
            return CapabilityContract(
                capability=CapabilityEnum.RANKING,
                parameters=params,
                execution_route="MULTI_REQUIREMENT",
                meta={"metric": "annual_ctc", "direction": "DESC"}
            )
        if is_comp_query and has_low_extreme:
            params.direction = "ASC"
            return CapabilityContract(
                capability=CapabilityEnum.RANKING,
                parameters=params,
                execution_route="MULTI_REQUIREMENT",
                meta={"metric": "annual_ctc", "direction": "ASC"}
            )

        # 8.5 Longest / Maximum Tenure
        if any(k in q_low for k in ['longest tenure', 'greatest tenure', 'highest tenure', 'most experience', 'longest experience', 'who has been with ets the longest', 'been with ets the longest', 'longest time with ets', 'senior most']):
            params.direction = "DESC"
            return CapabilityContract(
                capability=CapabilityEnum.TENURE,
                parameters=params,
                execution_route="MULTI_REQUIREMENT",
                meta={"metric": "infinite_exp", "direction": "DESC", "mode": "longest"}
            )

        # 8.6 Compositional Query Understanding Layer
        # Handles dimension breakdowns, rankings, and compound metric+dimension queries.
        is_skill_spec = any(d in q_low for d in ['skill', 'skills', 'tech', 'technology', 'technologies'])
        is_exec_reasoning = any(re.search(p, q_low) for p in reasoning_patterns)

        if not is_exec_reasoning:
            if is_skill_spec and any(k in q_low for k in ['top', 'most', 'deepest talent pool', 'which technology', 'which skill']):
                return CapabilityContract(
                    capability=CapabilityEnum.SKILLS_TOP_RANKING,
                    parameters=params,
                    execution_route="MULTI_REQUIREMENT",
                    meta={"limit": 1, "metric": "emp_count", "direction": "DESC"}
                )

            comp_plan = CompositionalParser.parse(q_raw, params)
            if comp_plan and comp_plan.dimensions:
                dim = comp_plan.dimensions[0]
                cap = comp_plan.to_capability_enum()
                has_most = comp_plan.ranking and comp_plan.ranking.direction == "DESC"
                mode = comp_plan.ranking.mode if comp_plan.ranking else "distribution"
                return CapabilityContract(
                    capability=cap,
                    parameters=params,
                    execution_route="MULTI_REQUIREMENT",
                    meta={
                        "compositional_plan": comp_plan,
                        "ranking": comp_plan.ranking is not None,
                        "mode": mode,
                        "group_by": dim.value,
                        "population": params.population.value
                    }
                )

        # 9. Promotion Hike Averages
        if any(k in q_low for k in ['average promotion hike', 'avg promotion hike', 'promotion hike percentage', 'promotion hike percent', 'mean promotion hike']):
            params.is_promotion = "Yes"
            return CapabilityContract(
                capability=CapabilityEnum.COMPENSATION_AVERAGE,
                parameters=params,
                execution_route="MULTI_REQUIREMENT",
                meta={"metric": "hike_percent", "is_promotion": "Yes"}
            )

        # 9.5 Multi-Entity Comparison in standalone query
        is_query_comp = any(k in q_low for k in ["compare", "comparison", "vs", "versus", "more than", "more employees", "higher", "difference", "compared to", "which has more"])
        if is_query_comp:
            is_diff = any(k in q_low for k in ["difference", "how many more", "by how much", "by how many", "diff"])
            sub_mode = "difference" if is_diff else "which_more"
            if len(states) >= 2:
                params.project_states = states[:2]
                plan = AnalyticalParser.create_comparison_plan(
                    dimension=DimensionEnum.STATE,
                    entities=states[:2],
                    sub_mode=sub_mode,
                    raw_q=q_raw,
                    base_params=params
                )
                return CapabilityContract(
                    capability=CapabilityEnum.COMPARISON,
                    parameters=params,
                    execution_route="MULTI_REQUIREMENT",
                    meta={"dimension": "state", "entities": states[:2], "sub_mode": sub_mode, "analytical_plan": plan}
                )
            if len(locs) >= 2:
                params.physical_locations = locs[:2]
                plan = AnalyticalParser.create_comparison_plan(
                    dimension=DimensionEnum.LOCATION,
                    entities=locs[:2],
                    sub_mode=sub_mode,
                    raw_q=q_raw,
                    base_params=params
                )
                return CapabilityContract(
                    capability=CapabilityEnum.COMPARISON,
                    parameters=params,
                    execution_route="MULTI_REQUIREMENT",
                    meta={"dimension": "location", "entities": locs[:2], "sub_mode": sub_mode, "analytical_plan": plan}
                )

        # 10. Filter Composition / Combinatorial Queries
        dim_count = (1 if (len(states) > 0 or unk_state) else 0) + \
                    (1 if (len(locs) > 0 or unk_loc) else 0) + \
                    (1 if dept else 0)

        if dim_count >= 2:
            return CapabilityContract(
                capability=CapabilityEnum.FILTER_COMPOSITION,
                parameters=params,
                execution_route="MULTI_REQUIREMENT",
                meta={"filters": ["state", "location", "department", "status"], "population": population.value}
            )

        # Single Department queries: "How many employees in Core department?"
        if dept:
            if any(k in q_low for k in ['breakdown', 'distribution', 'by department', 'per department', 'split']):
                cap = CapabilityEnum.DEPARTMENT_BREAKDOWN
            elif has_leaver_intent:
                cap = CapabilityEnum.LEAVER_COUNT
            elif has_active_intent:
                cap = CapabilityEnum.ACTIVE_HEADCOUNT
            else:
                cap = CapabilityEnum.HEADCOUNT
            return CapabilityContract(
                capability=cap,
                parameters=params,
                execution_route="MULTI_REQUIREMENT",
                meta={"filter_dimension": "department", "department": dept, "population": population.value}
            )

        # Single State queries: "How many employees in Project State ND?" / "employees in ZZ"
        if len(states) > 0 or unk_state:
            if any(k in q_low for k in ['breakdown', 'distribution', 'by state', 'per state', 'split']):
                cap = CapabilityEnum.STATE_BREAKDOWN
            elif has_leaver_intent:
                cap = CapabilityEnum.LEAVER_COUNT
            elif has_active_intent:
                cap = CapabilityEnum.ACTIVE_HEADCOUNT
            else:
                cap = CapabilityEnum.HEADCOUNT
            return CapabilityContract(
                capability=cap,
                parameters=params,
                execution_route="MULTI_REQUIREMENT",
                meta={"filter_dimension": "state", "population": population.value}
            )

        # Single Location queries: "How many employees in Bangalore?" / "in Delhi"
        if len(locs) > 0 or unk_loc:
            if any(k in q_low for k in ['breakdown', 'distribution', 'by location', 'per location', 'split']):
                cap = CapabilityEnum.LOCATION_BREAKDOWN
            elif has_leaver_intent:
                cap = CapabilityEnum.LEAVER_COUNT
            elif has_active_intent:
                cap = CapabilityEnum.ACTIVE_HEADCOUNT
            else:
                cap = CapabilityEnum.HEADCOUNT
            return CapabilityContract(
                capability=cap,
                parameters=params,
                execution_route="MULTI_REQUIREMENT",
                meta={"filter_dimension": "location", "population": population.value}
            )

        # General Breakdown queries
        if any(k in q_low for k in ['by state', 'state breakdown', 'state distribution', 'state-wise', 'split by state', 'per state', 'across states', 'distribution across states']):
            return CapabilityContract(
                capability=CapabilityEnum.STATE_BREAKDOWN,
                parameters=params,
                execution_route="MULTI_REQUIREMENT",
                meta={"group_by": "state"}
            )

        if any(k in q_low for k in ['by location', 'location breakdown', 'location distribution', 'by city', 'split by location', 'per location', 'across locations', 'workforce by location', 'distribution by location', 'headcount per location']):
            return CapabilityContract(
                capability=CapabilityEnum.LOCATION_BREAKDOWN,
                parameters=params,
                execution_route="MULTI_REQUIREMENT",
                meta={"group_by": "location"}
            )

        if any(k in q_low for k in ['by department', 'department breakdown', 'department distribution', 'split by department', 'per department', 'across departments', 'workforce by department', 'headcount per department']):
            return CapabilityContract(
                capability=CapabilityEnum.DEPARTMENT_BREAKDOWN,
                parameters=params,
                execution_route="MULTI_REQUIREMENT",
                meta={"group_by": "department"}
            )

        # General Leaver Count
        if has_leaver_intent:
            return CapabilityContract(
                capability=CapabilityEnum.LEAVER_COUNT,
                parameters=params,
                execution_route="MULTI_REQUIREMENT",
                meta={"year": yr, "status": "Exited", "population": "EXITED"}
            )

        # General Active Headcount
        if has_active_intent or any(k in q_low for k in ['active employees', 'active headcount', 'working employees', 'operational staff']):
            return CapabilityContract(
                capability=CapabilityEnum.ACTIVE_HEADCOUNT,
                parameters=params,
                execution_route="MULTI_REQUIREMENT",
                meta={"status": "Active", "population": "ACTIVE"}
            )

        # General Total Headcount & Workforce Size
        workforce_terms = ['employee', 'employees', 'headcount', 'workforce', 'staff', 'personnel', 'people']
        count_terms = ['how many', 'count', 'number', 'size', 'total', 'overall', 'how large', 'how big', 'volume', 'all']
        has_wf = any(re.search(rf'\b{w}\b', q_low) for w in workforce_terms)
        has_ct = any(re.search(rf'\b{c}\b', q_low) for c in count_terms) or 'how many' in q_low

        if (has_wf and has_ct) or any(k in q_low for k in ['total headcount', 'overall headcount', 'total workforce', 'headcount', 'workforce in', 'employees in ets']):
            return CapabilityContract(
                capability=CapabilityEnum.HEADCOUNT,
                parameters=params,
                execution_route="MULTI_REQUIREMENT",
                meta={"status": "All", "population": "ALL"}
            )

        # Average CTC / Compensation
        is_avg = any(k in q_low for k in ['average', 'avg', 'mean'])
        is_comp = any(k in q_low for k in ['salary', 'ctc', 'compensation', 'pay'])
        if is_avg and is_comp:
            return CapabilityContract(
                capability=CapabilityEnum.COMPENSATION_AVERAGE,
                parameters=params,
                execution_route="MULTI_REQUIREMENT",
                meta={"metric": "annual_ctc"}
            )

        # Tenure / Experience
        if any(k in q_low for k in ['average tenure', 'avg tenure', 'mean tenure', 'average experience', 'avg experience']):
            return CapabilityContract(
                capability=CapabilityEnum.TENURE,
                parameters=params,
                execution_route="MULTI_REQUIREMENT",
                meta={"metric": "infinite_exp"}
            )

        # Fallback to general RAG if query looks like a general knowledge or policy question
        return CapabilityContract(
            capability=CapabilityEnum.RAG_POLICY_QA,
            parameters=params,
            execution_route="RAG",
            meta={"default_route": True}
        )

capability_registry = CapabilityRegistry()
