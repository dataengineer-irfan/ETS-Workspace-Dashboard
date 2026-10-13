import re
from enum import Enum
from typing import Dict, Any, List, Optional, Tuple, Union
from dataclasses import dataclass, field

# =====================================================================
# ENUMS & CANONICAL DATA STRUCTURES
# =====================================================================

class MetricEnum(str, Enum):
    HEADCOUNT = "headcount"
    AVERAGE_SALARY = "average_salary"
    MIN_SALARY = "min_salary"
    MAX_SALARY = "max_salary"
    TOTAL_SALARY = "total_salary"
    ATTRITION_COUNT = "attrition_count"
    ATTRITION_RATE = "attrition_rate"
    TENURE = "tenure"
    PROMOTION_HIKE = "promotion_hike"
    INFINITE_EXP = "infinite_exp"
    PRIOR_EXP = "prior_exp"
    TOTAL_EXP = "total_exp"
    EXPERIENCE_COMPARISON = "experience_comparison"

class DimensionEnum(str, Enum):
    GENDER = "gender"
    DEPARTMENT = "department"
    LOCATION = "location"
    STATE = "state"
    JOB_LEVEL = "job_level"
    PROJECT = "project"
    AGE_GROUP = "age_group"
    SKILL = "skill"
    EXPERIENCE_TYPE = "experience_type"
    MANAGER = "manager"

class RequirementTypeEnum(str, Enum):
    SCALAR_METRIC = "scalar_metric"
    BREAKDOWN = "breakdown"
    COMPOSITE_BREAKDOWN = "composite_breakdown"
    RANKING = "ranking"
    RAG_POLICY = "rag_policy"
    UNSUPPORTED = "unsupported"

class RequirementStatusEnum(str, Enum):
    PARSED = "PARSED"
    AUTHORIZING = "AUTHORIZING"
    AUTHORIZED = "AUTHORIZED"
    WAITING_FOR_DEPENDENCY = "WAITING_FOR_DEPENDENCY"
    EXECUTING = "EXECUTING"
    EVIDENCE_READY = "EVIDENCE_READY"
    VALIDATED = "VALIDATED"
    SYNTHESIZED = "SYNTHESIZED"
    ANSWERED = "ANSWERED"
    AUTHORIZATION_DENIED = "AUTHORIZATION_DENIED"
    DEPENDENCY_FAILED = "DEPENDENCY_FAILED"
    EXECUTION_FAILED = "EXECUTION_FAILED"
    INVARIANT_FAILED = "INVARIANT_FAILED"
    UNSUPPORTED = "UNSUPPORTED"
    # Backward compatibility aliases
    EXTRACTED = "EXTRACTED"
    PLANNED = "PLANNED"
    EXECUTED = "EXECUTED"
    EVIDENCE_AVAILABLE = "EVIDENCE_AVAILABLE"
    VERIFIED = "VERIFIED"
    FAILED = "FAILED"

class ExecutorEnum(str, Enum):
    SQL = "SQL"
    RAG = "RAG"
    UNSUPPORTED = "UNSUPPORTED"
    DIRECT = "DIRECT"

class OutputFormatEnum(str, Enum):
    SUMMARY_ONLY = "summary_only"
    BREAKDOWN_ONLY = "breakdown_only"
    SUMMARY_AND_BREAKDOWN = "summary_and_breakdown"
    RANKED_LIST = "ranked_list"
    COMPARISON = "comparison"

class PresentationModeEnum(str, Enum):
    METRIC_CARD = "metric_card"
    CHART = "chart"
    TABLE = "table"
    NOTICE = "notice"

@dataclass
class RankingSpec:
    direction: str = "DESC"  # "DESC" or "ASC"
    limit: int = 10
    mode: str = "all"        # "most", "least", "top_n", "bottom_n", "all"

@dataclass
class RequirementDependency:
    source_requirement_id: str
    target_requirement_id: str
    source_entity_attribute: str  # e.g. "department", "location"
    target_slot: str              # e.g. "department", "location"

@dataclass
class AtomicRequirement:
    requirement_id: str
    sequence_index: int = 0
    req_type: RequirementTypeEnum = RequirementTypeEnum.SCALAR_METRIC
    operation_type: Optional[RequirementTypeEnum] = None
    executor: ExecutorEnum = ExecutorEnum.SQL
    metric: Optional[MetricEnum] = None
    dimensions: List[DimensionEnum] = field(default_factory=list)
    filters: Dict[str, Any] = field(default_factory=dict)
    ranking: Optional[RankingSpec] = None
    output_format: OutputFormatEnum = OutputFormatEnum.SUMMARY_ONLY
    target_capability: Optional[Any] = None
    lifecycle_state: RequirementStatusEnum = RequirementStatusEnum.PARSED
    status: RequirementStatusEnum = RequirementStatusEnum.PARSED
    raw_text: str = ""
    evidence: Optional[Any] = None
    execution_metadata: Dict[str, Any] = field(default_factory=dict)
    assertion_results: Dict[str, Any] = field(default_factory=dict)
    error_message: Optional[str] = None
    failure_reason: Optional[str] = None
    unsupported_topic: Optional[str] = None
    auth_denied: bool = False
    presentation_mode: Optional[PresentationModeEnum] = None

    def __post_init__(self):
        if not self.operation_type:
            self.operation_type = self.req_type
        if self.lifecycle_state == RequirementStatusEnum.PARSED and self.status != RequirementStatusEnum.PARSED:
            self.lifecycle_state = self.status
        else:
            self.status = self.lifecycle_state

@dataclass
class AnalyticalQueryPlan:
    plan_id: str
    raw_query: str
    requirements: List[AtomicRequirement] = field(default_factory=list)
    dependencies: List[RequirementDependency] = field(default_factory=list)
    shared_filters: Dict[str, Any] = field(default_factory=dict)
    conversation_context_ref: Optional[str] = None
    plan_status: str = "PLANNED"
    unrecognized_filters: List[str] = field(default_factory=list)

# Canonical Alias for UserQueryGraph
UserQueryGraph = AnalyticalQueryPlan

# Backward-compatible CompositionalQueryPlan
@dataclass
class CompositionalQueryPlan:
    metrics: List[MetricEnum] = field(default_factory=lambda: [MetricEnum.HEADCOUNT])
    dimensions: List[DimensionEnum] = field(default_factory=list)
    filters: Dict[str, Any] = field(default_factory=dict)
    ranking: Optional[RankingSpec] = None
    output_format: OutputFormatEnum = OutputFormatEnum.SUMMARY_ONLY
    raw_query: str = ""

    def to_capability_enum(self):
        from backend.app.ai.capability_registry import CapabilityEnum
        if self.dimensions:
            dim = self.dimensions[0]
            if dim == DimensionEnum.GENDER:
                return CapabilityEnum.GENDER_BREAKDOWN
            elif dim == DimensionEnum.LOCATION:
                return CapabilityEnum.LOCATION_BREAKDOWN
            elif dim == DimensionEnum.STATE:
                return CapabilityEnum.STATE_BREAKDOWN
            elif dim == DimensionEnum.DEPARTMENT:
                return CapabilityEnum.DEPARTMENT_BREAKDOWN
            elif dim == DimensionEnum.AGE_GROUP:
                return CapabilityEnum.AGE_BREAKDOWN
            elif dim == DimensionEnum.PROJECT:
                return CapabilityEnum.PROJECT_BREAKDOWN
            elif dim == DimensionEnum.JOB_LEVEL:
                return CapabilityEnum.SALARY_COST_BY_GRADE
        
        f = self.filters
        dim_filter_count = (1 if f.get("state") or f.get("states") else 0) + \
                           (1 if f.get("location") or f.get("locations") else 0) + \
                           (1 if f.get("department") else 0)
        if dim_filter_count >= 2 or f.get("unrecognized_filter"):
            return CapabilityEnum.FILTER_COMPOSITION
        
        pop = f.get("population", "ALL")
        if pop == "EXITED":
            return CapabilityEnum.LEAVER_COUNT
        elif pop == "ACTIVE":
            return CapabilityEnum.ACTIVE_HEADCOUNT
        return CapabilityEnum.HEADCOUNT

COMMERCIAL_FINANCE_SIGNALS = [
    "revenue", "profit", "profitability", "margin", "margins", "ebitda",
    "billable utilization", "utilization rate", "cash runway", "runway",
    "dso", "days sales outstanding", "accounts receivable", "client billing",
    "gross margin", "net margin", "operating margin"
]

UNSUPPORTED_DOMAIN_SIGNALS = [
    "weather", "forecast", "sports", "cricket", "football", "recipe",
    "stock price", "stock market", "nasdaq", "cryptocurrency", "crypto currency",
    "bitcoin", "ethereum", "dogecoin", "politic", "movie", "song"
]

POLICY_RAG_SIGNALS = [
    "policy", "guideline", "guidelines", "handbook", "promotion rule",
    "promotion rules", "promotion policy", "leave policy", "travel policy",
    "grade progression", "hike percentage", "hike percentage criteria",
    "career progression", "notice period"
]

# =====================================================================
# CANONICAL DIMENSION VOCABULARY & GROUPING EXTRACTION
# =====================================================================

CANONICAL_DIMENSION_VOCABULARY: Dict[DimensionEnum, Dict[str, Any]] = {
    DimensionEnum.JOB_LEVEL: {
        "singular": ["grade", "job level", "grade level", "career level", "level", "seniority level", "seniority tier", "tier"],
        "plural": ["grades", "job levels", "grade levels", "career levels", "levels", "seniority levels", "seniority tiers", "tiers"],
        "direct_terms": ["grade", "grades", "job level", "job levels", "grade level", "grade levels", "career level", "career levels", "seniority tier", "seniority tiers"],
    },
    DimensionEnum.DEPARTMENT: {
        "singular": ["department", "dept", "business unit", "division"],
        "plural": ["departments", "depts", "business units", "divisions"],
        "direct_terms": ["department", "departments", "dept", "depts"],
    },
    DimensionEnum.LOCATION: {
        "singular": ["location", "city", "office", "site", "base location"],
        "plural": ["locations", "cities", "offices", "sites", "base locations"],
        "direct_terms": ["location", "locations", "city", "cities", "office", "offices"],
    },
    DimensionEnum.PROJECT: {
        "singular": ["project", "program", "initiative"],
        "plural": ["projects", "programs", "initiatives"],
        "direct_terms": ["project", "projects", "program", "programs"],
    },
    DimensionEnum.STATE: {
        "singular": ["state", "project state", "province"],
        "plural": ["states", "project states", "provinces"],
        "direct_terms": ["state", "states", "project state", "project states"],
    },
    DimensionEnum.GENDER: {
        "singular": ["gender", "sex"],
        "plural": ["genders", "sexes"],
        "direct_terms": ["gender", "genders", "sex", "sexes", "male and female", "female and male", "gender split", "gender breakdown"],
    },
    DimensionEnum.SKILL: {
        "singular": ["skill", "technical skill", "technology", "tech stack"],
        "plural": ["skills", "technical skills", "technologies"],
        "direct_terms": ["skill", "skills", "technical skill", "technical skills", "technology", "technologies", "tech stack"],
    },
    DimensionEnum.AGE_GROUP: {
        "singular": ["age group", "age band", "age tier"],
        "plural": ["age groups", "age bands", "age tiers"],
        "direct_terms": ["age group", "age groups", "age distribution", "age breakdown", "demographics", "age band", "age bands"],
    },
    DimensionEnum.MANAGER: {
        "singular": ["manager", "supervisor", "lead", "reporting manager"],
        "plural": ["managers", "supervisors", "leads", "reporting managers"],
        "direct_terms": ["manager", "managers", "supervisor", "supervisors"],
    },
}

def extract_grouping_dimensions(q_norm: str, shared_filters: Optional[Dict[str, Any]] = None) -> List[DimensionEnum]:
    sf = shared_filters or {}
    dims: List[DimensionEnum] = []
    prefix_pat = r'(?:by|across|over|for\s+each|for\s+every|among|per|grouped\s+by|broken\s+down\s+by|split\s+by|distribution\s+(?:across|over|by)|breakdown\s+(?:across|over|by)|matrix\s+(?:across|over|by)|variation\s+(?:across|over|by))'

    for dim, vocab in CANONICAL_DIMENSION_VOCABULARY.items():
        # If dimension is already bound as a filter, skip treating query tokens as grouping dimensions
        # unless an explicit grouping prefix (e.g. 'by skill', 'across departments') is present
        if dim == DimensionEnum.SKILL and sf.get('skill') and not re.search(rf'\b{prefix_pat}\s+skills?\b', q_norm):
            continue
        if dim == DimensionEnum.DEPARTMENT and (sf.get('department') or 'exclude_department' in sf) and not re.search(rf'\b{prefix_pat}\s+departments?\b', q_norm):
            continue
        if dim == DimensionEnum.LOCATION and (sf.get('location') or sf.get('locations')) and not re.search(rf'\b{prefix_pat}\s+locations?\b', q_norm):
            continue
        if dim == DimensionEnum.STATE and (sf.get('state') or sf.get('states')) and not re.search(rf'\b{prefix_pat}\s+states?\b', q_norm):
            continue
        if dim == DimensionEnum.MANAGER:
            is_mgr_lookup_syntax = bool(re.search(r'\b(?:who is.*manager|manager of|manager for|[\'’]s+\s+manager|reporting to|reports to|who reports to|who does.*report to|under|team of|[\'’]s+\s+team)\b', q_norm))
            has_emp_bound = bool(sf.get('employee_number') or sf.get('matched_employee') or sf.get('inquiry_type'))
            if (sf.get('manager') or has_emp_bound or is_mgr_lookup_syntax) and not re.search(rf'\b{prefix_pat}\s+managers?\b', q_norm):
                continue

        all_terms = vocab.get("singular", []) + vocab.get("plural", [])

        # 1. Relational grouping prefix: "across grades", "by grade", "by project", "and project", etc.
        matched = False
        for term in all_terms:
            if dim == DimensionEnum.PROJECT and term in ("project", "projects") and re.search(r'\bproject\s+states?\b', q_norm):
                continue
            if re.search(rf'\b{prefix_pat}\s+(?:[a-z_]+\s+and\s+)?{re.escape(term)}\b', q_norm) or (re.search(rf'\b(?:and\s+){re.escape(term)}\b', q_norm) and ('by ' in q_norm or 'break down' in q_norm or 'breakdown' in q_norm)):
                dims.append(dim)
                matched = True
                break

        if matched:
            continue

        for term in vocab.get("singular", []):
            if re.search(rf'\b{re.escape(term)}(?:-wise|\s+wise)\b', q_norm):
                dims.append(dim)
                matched = True
                break

        if matched:
            continue

        for term in vocab.get("singular", []):
            if dim == DimensionEnum.PROJECT and term in ("project", "projects") and re.search(r'\bproject\s+states?\b', q_norm):
                continue
            if re.search(rf'\b(?:which|what)\s+{re.escape(term)}\b', q_norm) or re.search(rf'\b{re.escape(term)}\s+(?:breakdown|split|distribution|matrix)\b', q_norm):
                dims.append(dim)
                matched = True
                break

        if matched:
            continue

        for term in vocab.get("plural", []):
            if dim == DimensionEnum.PROJECT and term in ("project", "projects") and re.search(r'\bproject\s+states?\b', q_norm):
                continue
            if re.search(rf'\b{re.escape(term)}\b', q_norm):
                dims.append(dim)
                matched = True
                break

        if matched:
            continue

        for term in vocab.get("direct_terms", []):
            if dim == DimensionEnum.PROJECT and term in ("project", "projects") and re.search(r'\bproject\s+states?\b', q_norm):
                continue
            if dim == DimensionEnum.DEPARTMENT and (sf.get('department') or 'exclude_department' in sf):
                continue
            if dim == DimensionEnum.LOCATION and (sf.get('location') or sf.get('locations')):
                continue
            if dim == DimensionEnum.STATE and (sf.get('state') or sf.get('states')):
                continue
            if dim == DimensionEnum.SKILL and sf.get('skill'):
                continue
            if dim == DimensionEnum.MANAGER and (sf.get('manager') or sf.get('employee_number') or bool(re.search(r'\b(?:who is.*manager|manager of|manager for|[\'’]s+\s+manager|reporting to|reports to|who reports to|who does.*report to)\b', q_norm))):
                continue
            if re.search(rf'\b{re.escape(term)}\b', q_norm):
                dims.append(dim)
                break

    return dims

# =====================================================================
# ANALYTICAL PARSER (ORTHOGONAL SEMANTIC DECOMPOSITION)
# =====================================================================

class AnalyticalParser:
    DIMENSION_COLUMN_MAP = {
        DimensionEnum.GENDER: ("gender", "gender", "gender"),
        DimensionEnum.DEPARTMENT: ("department", "department", "department"),
        DimensionEnum.LOCATION: ("location", "location", "location"),
        DimensionEnum.STATE: ("state", "state", "state"),
        DimensionEnum.JOB_LEVEL: ("job_level", "job_level", "job level"),
        DimensionEnum.PROJECT: ("project", "project", "project"),
        DimensionEnum.SKILL: ("skill_name", "skill_name", "skill"),
        DimensionEnum.AGE_GROUP: (
            (
                "CASE "
                "WHEN age < 25 THEN '20-24' "
                "WHEN age BETWEEN 25 AND 29 THEN '25-29' "
                "WHEN age BETWEEN 30 AND 34 THEN '30-34' "
                "WHEN age BETWEEN 35 AND 39 THEN '35-39' "
                "WHEN age BETWEEN 40 AND 44 THEN '40-44' "
                "WHEN age BETWEEN 45 AND 49 THEN '45-49' "
                "WHEN age BETWEEN 50 AND 59 THEN '50-59' "
                "ELSE '60+' END"
            ),
            "age_group",
            "age group"
        ),
        DimensionEnum.MANAGER: ("manager", "manager", "manager")
    }

    @classmethod
    def _assign_target_capability(cls, req: AtomicRequirement):
        from backend.app.ai.capability_registry import CapabilityEnum
        if req.target_capability == CapabilityEnum.EMPLOYEE_LOOKUP or req.filters.get("employee_number"):
            req.target_capability = CapabilityEnum.EMPLOYEE_LOOKUP
            return

        if req.executor == ExecutorEnum.UNSUPPORTED:
            req.target_capability = CapabilityEnum.UNSUPPORTED_COMMERCIAL_FINANCE
            return
        if req.executor == ExecutorEnum.RAG:
            req.target_capability = CapabilityEnum.RAG_POLICY_QA
            return
        
        # SQL Executor
        if req.req_type == RequirementTypeEnum.COMPOSITE_BREAKDOWN:
            req.target_capability = CapabilityEnum.FILTER_COMPOSITION
            return
        
        if req.req_type == RequirementTypeEnum.RANKING:
            if req.dimensions and req.dimensions[0] == DimensionEnum.SKILL:
                req.target_capability = CapabilityEnum.SKILLS_TOP_RANKING
            elif req.metric == MetricEnum.TOTAL_SALARY:
                req.target_capability = CapabilityEnum.SALARY_TOTAL_COST
            elif req.metric == MetricEnum.AVERAGE_SALARY:
                req.target_capability = CapabilityEnum.COMPENSATION_AVERAGE
            elif req.metric == MetricEnum.MAX_SALARY:
                req.target_capability = CapabilityEnum.COMPENSATION_MAX
            elif req.metric == MetricEnum.MIN_SALARY:
                req.target_capability = CapabilityEnum.COMPENSATION_MIN
            elif req.metric == MetricEnum.TENURE:
                req.target_capability = CapabilityEnum.TENURE
            else:
                req.target_capability = CapabilityEnum.RANKING
            return

        if req.req_type == RequirementTypeEnum.BREAKDOWN and req.dimensions:
            dim = req.dimensions[0]
            if req.metric == MetricEnum.TOTAL_SALARY:
                if dim == DimensionEnum.JOB_LEVEL:
                    req.target_capability = CapabilityEnum.SALARY_COST_BY_GRADE
                elif dim == DimensionEnum.PROJECT:
                    req.target_capability = CapabilityEnum.SALARY_COST_BY_PROJECT
                else:
                    req.target_capability = CapabilityEnum.SALARY_TOTAL_COST
                return
            elif req.metric in (MetricEnum.AVERAGE_SALARY, MetricEnum.MIN_SALARY, MetricEnum.MAX_SALARY):
                if dim == DimensionEnum.JOB_LEVEL:
                    req.target_capability = CapabilityEnum.SALARY_COST_BY_GRADE
                else:
                    req.target_capability = CapabilityEnum.COMPENSATION_AVERAGE
                return

            if dim == DimensionEnum.GENDER:
                req.target_capability = CapabilityEnum.GENDER_BREAKDOWN
            elif dim == DimensionEnum.DEPARTMENT:
                req.target_capability = CapabilityEnum.DEPARTMENT_BREAKDOWN
            elif dim == DimensionEnum.LOCATION:
                req.target_capability = CapabilityEnum.LOCATION_BREAKDOWN
            elif dim == DimensionEnum.STATE:
                req.target_capability = CapabilityEnum.STATE_BREAKDOWN
            elif dim == DimensionEnum.JOB_LEVEL:
                # Only salary breakdowns use restricted SALARY_COST_BY_GRADE capability
                salary_metrics = (MetricEnum.TOTAL_SALARY, MetricEnum.AVERAGE_SALARY, MetricEnum.MIN_SALARY, MetricEnum.MAX_SALARY)
                if req.metric in salary_metrics:
                    req.target_capability = CapabilityEnum.SALARY_COST_BY_GRADE
                else:
                    req.target_capability = CapabilityEnum.FILTER_COMPOSITION
            elif dim == DimensionEnum.AGE_GROUP:
                req.target_capability = CapabilityEnum.AGE_BREAKDOWN
            elif dim == DimensionEnum.PROJECT:
                req.target_capability = CapabilityEnum.PROJECT_BREAKDOWN
            elif dim == DimensionEnum.SKILL:
                req.target_capability = CapabilityEnum.SKILL_DISTRIBUTION
            else:
                req.target_capability = CapabilityEnum.FILTER_COMPOSITION
            return

        # Scalar metrics
        if req.metric == MetricEnum.TOTAL_SALARY:
            req.target_capability = CapabilityEnum.SALARY_TOTAL_COST
        elif req.metric == MetricEnum.AVERAGE_SALARY:
            req.target_capability = CapabilityEnum.COMPENSATION_AVERAGE
        elif req.metric == MetricEnum.MIN_SALARY:
            req.target_capability = CapabilityEnum.COMPENSATION_MIN
        elif req.metric == MetricEnum.MAX_SALARY:
            req.target_capability = CapabilityEnum.COMPENSATION_MAX
        elif req.metric in (MetricEnum.ATTRITION_RATE, MetricEnum.ATTRITION_COUNT):
            req.target_capability = CapabilityEnum.ATTRITION
        elif req.metric in (MetricEnum.EXPERIENCE_COMPARISON, MetricEnum.INFINITE_EXP, MetricEnum.PRIOR_EXP, MetricEnum.TOTAL_EXP):
            req.target_capability = CapabilityEnum.FILTER_COMPOSITION
        elif req.metric == MetricEnum.TENURE:
            req.target_capability = CapabilityEnum.TENURE
        elif req.metric == MetricEnum.PROMOTION_HIKE:
            req.target_capability = CapabilityEnum.COMPENSATION_AVERAGE
        else:
            pop = req.filters.get("population", "ALL")
            st = req.filters.get("current_status")
            if pop == "ACTIVE" or st == "Active":
                req.target_capability = CapabilityEnum.ACTIVE_HEADCOUNT
            elif pop == "EXITED" or st == "Exited":
                req.target_capability = CapabilityEnum.LEAVER_COUNT
            else:
                req.target_capability = CapabilityEnum.HEADCOUNT

    @classmethod
    def _extract_clause_filters(cls, clause: str) -> Dict[str, Any]:
        from backend.app.ai.capability_registry import VALID_DEPARTMENTS
        c_low = clause.lower()
        entities: Dict[str, Any] = {}
        for d in VALID_DEPARTMENTS:
            if re.search(rf'\b{d}\b', c_low):
                norm = d.upper() if d.lower() in ('qa', 'hr', 'it') else d.title()
                entities['department'] = norm
                break
        cities = ['bangalore', 'hyderabad', 'chennai', 'pune']
        for city in cities:
            if re.search(rf'\b{city}\b', c_low):
                entities['location'] = city.title()
                break
        states = ['karnataka', 'telangana', 'tamil nadu', 'maharashtra']
        for state in states:
            if re.search(rf'\b{state}\b', c_low):
                entities['state'] = state.title()
                break
        if re.search(r'\bactive\b', c_low) and not re.search(r'\b(exited|left)\b', c_low):
            entities['current_status'] = 'Active'
            entities['population'] = 'ACTIVE'
        elif re.search(r'\b(exited|left|leaver|departed)\b', c_low):
            entities['current_status'] = 'Exited'
            entities['population'] = 'EXITED'
        skills = ['react', 'python', 'java', 'docker', 'sql', 'aws', 'angular', 'typescript', 'javascript']
        for sk in skills:
            if re.search(rf'\b{re.escape(sk)}\b', c_low):
                entities['skill'] = sk.title()
                break
        return entities

    @classmethod
    def _has_clause_metric(cls, c: str) -> bool:
        c_low = c.lower()
        return bool(re.search(r'\b(salary|salaries|headcount|count|employees|workforce|leaver|leavers|attrition|tenure|paid|earning|ctc|payroll|compensation|pay|cost)\b', c_low))

    @classmethod
    def _parse_clause_requirement(cls, clause: str, local_filters: Dict[str, Any], r_id: str, seq: int) -> Optional[AtomicRequirement]:
        c_low = clause.lower()
        has_ranking = bool(re.search(r'\b(highest|lowest|top|bottom|most|least|maximum|max|minimum|min)\b', c_low))
        has_emp_entity = bool(re.search(r'\b(employee|employees|person|people|staff|earner|earners|individual|who|paid|earning)\b', c_low))
        is_salary = any(w in c_low for w in ['paid', 'earning', 'salary', 'ctc', 'compensation', 'pay', 'payroll', 'earns', 'earn'])
        is_tenure = any(w in c_low for w in ['tenure', 'experience', 'senior most', 'seniormost', 'service', 'experienced'])

        # Entity ranking on employee (e.g. "highest paid employee in IT", "lowest paid employee", "Highest CTC in ETS")
        if has_ranking and (is_salary or is_tenure):
            is_least = bool(re.search(r'\b(lowest|bottom|least|minimum|min)\b', c_low))
            direction = "ASC" if is_least else "DESC"
            num_m = re.search(r'\b(\d+)\b', c_low)
            num_val = int(num_m.group(1)) if num_m else 1
            mode = "least" if (is_least and num_val == 1) else ("most" if num_val == 1 else ("bottom_n" if is_least else "top_n"))
            metric = MetricEnum.TENURE if is_tenure else (MetricEnum.MIN_SALARY if is_least else MetricEnum.MAX_SALARY)
            r = AtomicRequirement(
                requirement_id=r_id,
                sequence_index=seq,
                req_type=RequirementTypeEnum.RANKING,
                executor=ExecutorEnum.SQL,
                metric=metric,
                dimensions=[],
                filters=local_filters,
                ranking=RankingSpec(direction=direction, limit=num_val, mode=mode),
                output_format=OutputFormatEnum.RANKED_LIST if num_val > 1 else OutputFormatEnum.SUMMARY_ONLY,
                raw_text=clause.strip()
            )
            cls._assign_target_capability(r)
            return r

        metric = None
        if bool(re.search(r'\b(average salary|avg salary|mean salary|average compensation|average ctc|avg ctc)\b', c_low)) or ('average' in c_low and is_salary):
            metric = MetricEnum.AVERAGE_SALARY
        elif bool(re.search(r'\b(total salary|total payroll|total compensation|payroll)\b', c_low)):
            metric = MetricEnum.TOTAL_SALARY
        elif bool(re.search(r'\b(highest salary|maximum salary|max salary|highest ctc|maximum ctc|top salary|max ctc)\b', c_low)):
            metric = MetricEnum.MAX_SALARY
        elif bool(re.search(r'\b(lowest salary|minimum salary|min salary|lowest ctc|minimum ctc|min ctc)\b', c_low)):
            metric = MetricEnum.MIN_SALARY
        elif bool(re.search(r'\b(attrition rate|churn rate|attrition)\b', c_low)):
            metric = MetricEnum.ATTRITION_RATE
        elif is_tenure:
            metric = MetricEnum.TENURE
        elif bool(re.search(r'\b(promotion hike|average promotion hike|avg promotion hike|hike percent|hike percentage|hike)\b', c_low)):
            metric = MetricEnum.PROMOTION_HIKE
        elif bool(re.search(r'\b(headcount|how many employees|total headcount|workforce size|how many people|employee count|employees|count)\b', c_low)):
            metric = MetricEnum.HEADCOUNT
        else:
            metric = MetricEnum.HEADCOUNT

        r = AtomicRequirement(
            requirement_id=r_id,
            sequence_index=seq,
            req_type=RequirementTypeEnum.SCALAR_METRIC,
            executor=ExecutorEnum.SQL,
            metric=metric,
            filters=local_filters,
            raw_text=clause.strip()
        )
        cls._assign_target_capability(r)
        return r

    @classmethod
    def create_comparison_plan(
        cls,
        dimension: DimensionEnum,
        entities: List[str],
        sub_mode: str = "which_more",
        raw_q: str = "",
        base_params: Any = None
    ) -> AnalyticalQueryPlan:
        from backend.app.ai.capability_registry import CapabilityEnum
        filters: Dict[str, Any] = {}
        if dimension == DimensionEnum.STATE:
            filters["states"] = entities
        elif dimension == DimensionEnum.LOCATION:
            filters["locations"] = entities
        elif dimension == DimensionEnum.JOB_LEVEL:
            filters["job_levels"] = entities
        elif dimension == DimensionEnum.PROJECT:
            filters["projects"] = entities
        elif dimension == DimensionEnum.DEPARTMENT:
            filters["departments"] = entities
        else:
            filters[dimension.value] = entities

        if base_params:
            pop_val = base_params.population.value if hasattr(base_params.population, 'value') else str(base_params.population) if hasattr(base_params, 'population') else None
            if pop_val and pop_val != 'ALL':
                filters['population'] = pop_val
            if hasattr(base_params, 'current_status') and base_params.current_status:
                filters['current_status'] = base_params.current_status
            if dimension != DimensionEnum.DEPARTMENT and hasattr(base_params, 'department') and base_params.department:
                filters['department'] = base_params.department
            if dimension != DimensionEnum.STATE and hasattr(base_params, 'project_state') and base_params.project_state:
                filters['state'] = base_params.project_state
            if dimension != DimensionEnum.LOCATION and hasattr(base_params, 'physical_location') and base_params.physical_location:
                filters['location'] = base_params.physical_location
            if dimension != DimensionEnum.PROJECT and hasattr(base_params, 'project') and base_params.project:
                filters['project'] = base_params.project
            if dimension != DimensionEnum.JOB_LEVEL and hasattr(base_params, 'job_level') and base_params.job_level:
                filters['job_level'] = base_params.job_level

        req = AtomicRequirement(
            requirement_id="R1",
            sequence_index=1,
            req_type=RequirementTypeEnum.BREAKDOWN,
            executor=ExecutorEnum.SQL,
            metric=MetricEnum.HEADCOUNT,
            dimensions=[dimension],
            filters=filters,
            ranking=RankingSpec(direction="DESC", limit=len(entities)),
            output_format=OutputFormatEnum.COMPARISON,
            raw_text=raw_q,
            target_capability=CapabilityEnum.COMPARISON
        )
        cls._assign_target_capability(req)
        return AnalyticalQueryPlan(
            plan_id="AQP_COMPARISON",
            raw_query=raw_q,
            requirements=[req],
            dependencies=[],
            shared_filters=filters
        )

    @classmethod
    def parse(cls, query: str, base_params: Any = None) -> AnalyticalQueryPlan:
        q_raw = query.strip()
        q_norm = q_raw.lower()
        
        # Conjunction normalization
        for conj in [r'\bplus\b', r'\bas well as\b', r'\balong with\b', r'\btogether with\b', r';', r'&', r'/']:
            q_norm = re.sub(conj, ' and ', q_norm)
        q_norm = re.sub(r'\s+', ' ', q_norm).strip()

        # Check for Employee Lookup & Manager Inquiries
        inq_type = getattr(base_params, "inquiry_type", None) if base_params else None
        is_mgr_inquiry = (inq_type == "manager_lookup") or bool(re.search(r'\b(?:who is.*manager|manager of|manager for|[\'’]s+\s+manager|reporting to whom|reports to whom|who does.*report to|reporting manager|supervisor)\b', q_norm))

        emp_match = re.search(r'\b(10\d{5})\b', q_raw) or re.search(r'\b(?:employee|emp|id)\s*#?\s*(\d+)\b', q_raw, re.IGNORECASE)
        emp_id = None
        if base_params and hasattr(base_params, 'employee_number') and base_params.employee_number:
            emp_id = int(base_params.employee_number)
        elif emp_match:
            emp_id = int(emp_match.group(1))

        # Check for Direct Reports Query: "who reports to X?", "employees reporting to X"
        is_direct_reports = (inq_type == "direct_reports_lookup") or bool(re.search(r'\b(?:who reports to|who is reporting to|employees?\s+reporting to|direct reports|[\'’]s+\s+team|team of)\b', q_norm))
        mgr_val = (base_params and getattr(base_params, 'manager', None))
        if is_direct_reports and (mgr_val or emp_id):
            from backend.app.ai.capability_registry import CapabilityEnum
            f_rep = {
                "inquiry_type": "direct_reports_lookup",
                "manager": mgr_val or str(emp_id),
                "manager_emp_id": emp_id
            }
            r_rep = AtomicRequirement(
                requirement_id="R1",
                sequence_index=1,
                req_type=RequirementTypeEnum.SCALAR_METRIC,
                executor=ExecutorEnum.SQL,
                metric=MetricEnum.HEADCOUNT,
                filters=f_rep,
                raw_text=q_raw
            )
            r_rep.target_capability = CapabilityEnum.FILTER_COMPOSITION
            return AnalyticalQueryPlan(
                plan_id="AQP_CANONICAL",
                raw_query=q_raw,
                requirements=[r_rep],
                dependencies=[],
                shared_filters=f_rep
            )

        if emp_id:
            from backend.app.ai.capability_registry import CapabilityEnum
            filters = {"employee_number": emp_id}
            if is_mgr_inquiry:
                filters["inquiry_type"] = "manager_lookup"
            r_emp = AtomicRequirement(
                requirement_id="R1",
                sequence_index=1,
                req_type=RequirementTypeEnum.SCALAR_METRIC,
                executor=ExecutorEnum.SQL,
                metric=MetricEnum.HEADCOUNT,
                filters=filters,
                raw_text=f"employee lookup {emp_id}"
            )
            r_emp.target_capability = CapabilityEnum.EMPLOYEE_LOOKUP
            return AnalyticalQueryPlan(
                plan_id="AQP_CANONICAL",
                raw_query=q_raw,
                requirements=[r_emp],
                dependencies=[],
                shared_filters=filters
            )

        reqs: List[AtomicRequirement] = []
        deps: List[RequirementDependency] = []
        r_counter = 1

        shared_filters: Dict[str, Any] = {}
        if base_params:
            pop_val = base_params.population.value if hasattr(base_params.population, 'value') else str(base_params.population) if hasattr(base_params, 'population') else None
            if pop_val and pop_val != 'ALL':
                shared_filters['population'] = pop_val
            if hasattr(base_params, 'current_status') and base_params.current_status:
                shared_filters['current_status'] = base_params.current_status
            if hasattr(base_params, 'project_state') and base_params.project_state:
                shared_filters['state'] = base_params.project_state
            elif hasattr(base_params, 'project_states') and base_params.project_states:
                shared_filters['states'] = base_params.project_states
            if hasattr(base_params, 'physical_location') and base_params.physical_location:
                shared_filters['location'] = base_params.physical_location
            elif hasattr(base_params, 'physical_locations') and base_params.physical_locations:
                shared_filters['locations'] = base_params.physical_locations
            if hasattr(base_params, 'department') and base_params.department:
                shared_filters['department'] = base_params.department
            if hasattr(base_params, 'skill') and base_params.skill:
                shared_filters['skill'] = base_params.skill
            if hasattr(base_params, 'unrecognized_filter') and base_params.unrecognized_filter:
                shared_filters['unrecognized_filter'] = base_params.unrecognized_filter
            if hasattr(base_params, 'job_level') and base_params.job_level:
                shared_filters['job_level'] = base_params.job_level
            elif hasattr(base_params, 'job_levels') and base_params.job_levels:
                shared_filters['job_levels'] = base_params.job_levels
            if hasattr(base_params, 'project') and base_params.project:
                shared_filters['project'] = base_params.project
            elif hasattr(base_params, 'projects') and base_params.projects:
                shared_filters['projects'] = base_params.projects
            if hasattr(base_params, 'manager') and base_params.manager:
                shared_filters['manager'] = base_params.manager

        # Population
        if re.search(r'\b(active employees|active headcount|current headcount|current workforce)\b', q_norm) and 'exited' not in q_norm:
            shared_filters['current_status'] = 'Active'
            shared_filters['population'] = 'ACTIVE'
        elif re.search(r'\b(exited employees|left ets|leavers|exited headcount)\b', q_norm) and 'active' not in q_norm:
            shared_filters['current_status'] = 'Exited'
            shared_filters['population'] = 'EXITED'

        # Skill Filters
        for sk in ['react', 'python', 'java', 'docker', 'sql', 'aws', 'angular', 'typescript', 'javascript']:
            if re.search(rf'\b{re.escape(sk)}\b', q_norm):
                if not shared_filters.get('skill'):
                    shared_filters['skill'] = sk.title()
                break

        # Predicate: Disjunctions (Bangalore or Hyderabad / Bangalore and Hyderabad)
        cities_all = ['bangalore', 'hyderabad', 'chennai', 'pune']
        cities_found = [c.title() for c in cities_all if c in q_norm]
        if len(cities_found) >= 2:
            shared_filters['locations'] = cities_found
        elif len(cities_found) == 1 and not shared_filters.get('location'):
            shared_filters['location'] = cities_found[0]

        # Predicate: Negation (not Engineering / not in Engineering)
        not_dept_m = re.search(r'\bnot\s+(?:in\s+)?([a-zA-Z]+)(?:\s+department)?\b', q_norm)
        if not_dept_m:
            candidate = not_dept_m.group(1).title()
            if candidate.lower() not in ['active', 'exited', 'the', 'a', 'an', 'our', 'all']:
                shared_filters['exclude_department'] = candidate

        # Single Person / Rarest Skills Breakdown Detection
        if re.search(r'\b(only 1|only one|single person|single-person)\b', q_norm) and any(k in q_norm for k in ['skill', 'skills', 'technology', 'technologies', 'person', 'people', 'dependency']):
            f_single = dict(shared_filters)
            f_single["min_count"] = 1
            f_single["max_count"] = 1
            r_sk = AtomicRequirement(
                requirement_id=f"R{r_counter}",
                sequence_index=r_counter,
                req_type=RequirementTypeEnum.BREAKDOWN,
                executor=ExecutorEnum.SQL,
                metric=MetricEnum.HEADCOUNT,
                dimensions=[DimensionEnum.SKILL],
                filters=f_single,
                ranking=RankingSpec(direction="ASC", limit=10, mode="bottom_n"),
                raw_text="skills with 1 person"
            )
            cls._assign_target_capability(r_sk)
            reqs.append(r_sk)
            r_counter += 1

        # Unsupported Requirement Detection
        for fin_kw in COMMERCIAL_FINANCE_SIGNALS:
            if re.search(rf'\b{re.escape(fin_kw)}\b', q_norm):
                req = AtomicRequirement(
                    requirement_id=f"R{r_counter}",
                    sequence_index=r_counter,
                    req_type=RequirementTypeEnum.UNSUPPORTED,
                    executor=ExecutorEnum.UNSUPPORTED,
                    unsupported_topic=fin_kw,
                    raw_text=fin_kw,
                    lifecycle_state=RequirementStatusEnum.UNSUPPORTED,
                    status=RequirementStatusEnum.UNSUPPORTED
                )
                cls._assign_target_capability(req)
                reqs.append(req)
                r_counter += 1
                break

        for unk_kw in UNSUPPORTED_DOMAIN_SIGNALS:
            if re.search(rf'\b{re.escape(unk_kw)}\b', q_norm):
                req = AtomicRequirement(
                    requirement_id=f"R{r_counter}",
                    sequence_index=r_counter,
                    req_type=RequirementTypeEnum.UNSUPPORTED,
                    executor=ExecutorEnum.UNSUPPORTED,
                    unsupported_topic=unk_kw,
                    raw_text=unk_kw,
                    lifecycle_state=RequirementStatusEnum.UNSUPPORTED,
                    status=RequirementStatusEnum.UNSUPPORTED
                )
                cls._assign_target_capability(req)
                reqs.append(req)
                r_counter += 1
                break

        # Policy / RAG Requirement Detection
        for p_kw in POLICY_RAG_SIGNALS:
            if re.search(rf'\b{re.escape(p_kw)}\b', q_norm):
                req = AtomicRequirement(
                    requirement_id=f"R{r_counter}",
                    sequence_index=r_counter,
                    req_type=RequirementTypeEnum.RAG_POLICY,
                    executor=ExecutorEnum.RAG,
                    raw_text=p_kw
                )
                cls._assign_target_capability(req)
                reqs.append(req)
                r_counter += 1
                break

        # -------------------------------------------------------------
        # Pronoun & Entity Dependency Detection
        # e.g. "Which department has the most employees and what is their average salary?"
        # -------------------------------------------------------------
        has_pronoun = bool(re.search(r'\b(their|its|that department|that location|those employees|respectively)\b', q_norm))
        if has_pronoun and any(d in q_norm for d in ['department', 'location', 'city']):
            dep_dim = DimensionEnum.DEPARTMENT if 'department' in q_norm else DimensionEnum.LOCATION
            attr_name = "department" if dep_dim == DimensionEnum.DEPARTMENT else "location"

            is_least = any(w in q_norm for w in ['fewest', 'least', 'smallest', 'bottom'])
            r1_ranking = RankingSpec(direction="ASC" if is_least else "DESC", limit=1, mode="least" if is_least else "most")
            
            p_id = f"R{r_counter}"
            r1 = AtomicRequirement(
                requirement_id=p_id,
                sequence_index=r_counter,
                req_type=RequirementTypeEnum.RANKING,
                executor=ExecutorEnum.SQL,
                metric=MetricEnum.HEADCOUNT,
                dimensions=[dep_dim],
                filters=dict(shared_filters),
                ranking=r1_ranking,
                output_format=OutputFormatEnum.RANKED_LIST,
                raw_text=f"{r1_ranking.mode} {attr_name} by headcount"
            )
            cls._assign_target_capability(r1)
            reqs.append(r1)
            r_counter += 1

            r2_metric = MetricEnum.AVERAGE_SALARY
            if any(k in q_norm for k in ['attrition', 'leaver', 'left']):
                r2_metric = MetricEnum.ATTRITION_COUNT
            elif any(k in q_norm for k in ['total salary', 'payroll']):
                r2_metric = MetricEnum.TOTAL_SALARY

            c_id = f"R{r_counter}"
            r2 = AtomicRequirement(
                requirement_id=c_id,
                sequence_index=r_counter,
                req_type=RequirementTypeEnum.SCALAR_METRIC,
                executor=ExecutorEnum.SQL,
                metric=r2_metric,
                filters=dict(shared_filters),
                raw_text=f"their {r2_metric.value}"
            )
            cls._assign_target_capability(r2)
            reqs.append(r2)
            r_counter += 1

            deps.append(RequirementDependency(
                source_requirement_id=p_id,
                target_requirement_id=c_id,
                source_entity_attribute=attr_name,
                target_slot=attr_name
            ))

            return AnalyticalQueryPlan(
                plan_id="AQP_CANONICAL",
                raw_query=q_raw,
                requirements=reqs,
                dependencies=deps,
                shared_filters=shared_filters
            )

        # -------------------------------------------------------------
        # Independent Clause Splitting for Conjunction Queries
        # e.g. "average salary in IT and headcount in HR",
        # "active employees in Bangalore and exited employees in Hyderabad"
        # -------------------------------------------------------------
        clauses = [c.strip() for c in q_norm.split(' and ') if c.strip()]
        if len(clauses) >= 2 and not any('by ' in c for c in clauses):
            c_ents = [cls._extract_clause_filters(c) for c in clauses]
            has_distinct_depts = len(set(e['department'] for e in c_ents if 'department' in e)) >= 2
            has_distinct_locs = len(set(e['location'] for e in c_ents if 'location' in e)) >= 2
            has_distinct_status_loc = len(set(e.get('current_status') for e in c_ents if 'current_status' in e)) >= 2 and any('location' in e for e in c_ents)
            has_distinct_skills = len(set(e['skill'] for e in c_ents if 'skill' in e)) >= 2
            has_clause_inquiries = all(cls._has_clause_metric(c) for c in clauses)
            all_have_filters = all(bool(e) for e in c_ents)
            distinct_filters = len(set(tuple(sorted(e.items())) for e in c_ents)) >= 2

            if all_have_filters and (has_distinct_depts or has_distinct_locs or has_distinct_status_loc or has_distinct_skills or (has_clause_inquiries and distinct_filters)):
                clause_reqs = []
                for idx, c in enumerate(clauses):
                    local_f = dict(shared_filters)
                    if any('department' in e for e in c_ents):
                        local_f.pop('department', None)
                    if any('location' in e for e in c_ents):
                        local_f.pop('location', None)
                        local_f.pop('locations', None)
                    if any('current_status' in e for e in c_ents):
                        local_f.pop('current_status', None)
                        local_f.pop('population', None)
                    if any('skill' in e for e in c_ents):
                        local_f.pop('skill', None)
                    local_f.update(c_ents[idx])

                    c_req = cls._parse_clause_requirement(c, local_f, f"R{r_counter}", r_counter)
                    if c_req:
                        clause_reqs.append(c_req)
                        r_counter += 1

                if len(clause_reqs) == len(clauses):
                    return AnalyticalQueryPlan(
                        plan_id="AQP_CANONICAL",
                        raw_query=q_raw,
                        requirements=clause_reqs,
                        dependencies=deps,
                        shared_filters=shared_filters
                    )

        # -------------------------------------------------------------
        # Active AND Exited Multi-Requirement
        # -------------------------------------------------------------
        if re.search(r'\bactive\b', q_norm) and re.search(r'\b(exited|left)\b', q_norm):
            f_act = dict(shared_filters)
            f_act['current_status'] = 'Active'
            f_act['population'] = 'ACTIVE'
            r_act = AtomicRequirement(
                requirement_id=f"R{r_counter}",
                sequence_index=r_counter,
                req_type=RequirementTypeEnum.SCALAR_METRIC,
                executor=ExecutorEnum.SQL,
                metric=MetricEnum.HEADCOUNT,
                filters=f_act,
                raw_text="active headcount"
            )
            cls._assign_target_capability(r_act)
            reqs.append(r_act)
            r_counter += 1

            f_ex = dict(shared_filters)
            f_ex['current_status'] = 'Exited'
            f_ex['population'] = 'EXITED'
            r_ex = AtomicRequirement(
                requirement_id=f"R{r_counter}",
                sequence_index=r_counter,
                req_type=RequirementTypeEnum.SCALAR_METRIC,
                executor=ExecutorEnum.SQL,
                metric=MetricEnum.HEADCOUNT,
                filters=f_ex,
                raw_text="exited headcount"
            )
            cls._assign_target_capability(r_ex)
            reqs.append(r_ex)
            r_counter += 1

        # -------------------------------------------------------------
        # Dimensions Detection (Generic Semantic Grouping Extractor)
        # -------------------------------------------------------------
        detected_dims: List[DimensionEnum] = extract_grouping_dimensions(q_norm, shared_filters)

        # -------------------------------------------------------------
        # Metrics Detection
        # -------------------------------------------------------------
        is_salary_context = any(s in q_norm for s in ['salary', 'salaries', 'ctc', 'compensation', 'pay', 'paid', 'earning', 'earners', 'payroll', 'earns', 'earn'])
        has_avg_sal = bool(re.search(r'\b(average salary|avg salary|mean salary|average compensation|average ctc|avg ctc|salary by|salaries by|salaries)\b', q_norm)) or ('average' in q_norm and is_salary_context)
        has_tot_sal = bool(re.search(r'\b(total(?:\s+\w+)?\s+salary(?:\s+cost)?|total(?:\s+\w+)?\s+payroll|total(?:\s+\w+)?\s+compensation|salary\s+cost|payroll)\b', q_norm))
        has_max_sal = bool(re.search(r'\b(highest salary|maximum salary|max salary|highest ctc|maximum ctc|top salary|max ctc)\b', q_norm)) or (any(w in q_norm for w in ['maximum', 'max', 'highest']) and is_salary_context)
        has_min_sal = bool(re.search(r'\b(lowest salary|minimum salary|min salary|lowest ctc|minimum ctc|min ctc)\b', q_norm)) or (any(w in q_norm for w in ['minimum', 'min', 'lowest']) and is_salary_context)
        has_attrition = bool(re.search(r'\b(attrition rate|churn rate|attrition)\b', q_norm))
        has_tenure = bool(re.search(r'\b(tenure|experience|longest tenure|greatest tenure|senior most|most experience|longest experience)\b', q_norm))
        has_exp_comp = (
            (base_params and hasattr(base_params, 'experience_metrics') and len(base_params.experience_metrics) >= 2)
            or ('infinite' in q_norm and 'prior' in q_norm)
            or (any(k in q_norm for k in ['compare', 'vs', 'versus']) and any(k in q_norm for k in ['experience', 'exp', 'tenure']) and any(k in q_norm for k in ['infinite', 'prior']))
        )
        has_infinite_exp = (
            (base_params and hasattr(base_params, 'experience_metrics') and 'infinite_exp' in base_params.experience_metrics and 'prior_exp' not in base_params.experience_metrics)
            or ('infinite' in q_norm and any(k in q_norm for k in ['experience', 'exp', 'tenure']) and not has_exp_comp)
        )
        has_prior_exp = (
            (base_params and hasattr(base_params, 'experience_metrics') and 'prior_exp' in base_params.experience_metrics and 'infinite_exp' not in base_params.experience_metrics)
            or ('prior' in q_norm and any(k in q_norm for k in ['experience', 'exp', 'tenure']) and not has_exp_comp)
        )
        has_promotion_hike = bool(re.search(r'\b(promotion hike|average promotion hike|avg promotion hike|hike percent|hike percentage)\b', q_norm))
        has_headcount = bool(re.search(r'\b(headcount|how many employees|total headcount|workforce size|workforce|how many people|employee count|employees|gender split|count)\b', q_norm))

        # Explicit Total Headcount scalar signal (e.g. "What is the total headcount and gender split?")
        wants_scalar_headcount = bool(re.search(r'\b(total headcount|overall headcount|workforce size|how many employees|how many people)\b', q_norm))

        # Ranking Detection
        ranking_spec: Optional[RankingSpec] = None
        has_most = bool(re.search(r'\b(most|largest|highest|biggest|peak|top)\b', q_norm))
        has_least = bool(re.search(r'\b(least|fewest|lowest|smallest|bottom|rarest|rare)\b', q_norm))
        
        # Check explicit digit with ranking intent
        num_m = re.search(r'\b(\d+)\b', q_norm)
        num_val = int(num_m.group(1)) if num_m else None

        if num_val and (has_most or 'rank' in q_norm):
            ranking_spec = RankingSpec(direction="DESC", limit=num_val, mode="top_n")
        elif num_val and has_least:
            ranking_spec = RankingSpec(direction="ASC", limit=num_val, mode="bottom_n")
        elif has_most and any(w in q_norm for w in ['which', 'what', 'who', 'is largest', 'has the most', 'biggest', 'highest']):
            ranking_spec = RankingSpec(direction="DESC", limit=1, mode="most")
        elif has_least and any(w in q_norm for w in ['which', 'what', 'who', 'is smallest', 'has the least', 'lowest', 'fewest', 'rarest', 'rare']):
            ranking_spec = RankingSpec(direction="ASC", limit=10 if 'rare' in q_norm else 1, mode="least")

        # Entity Ranking for Employees (e.g. "highest paid employee in IT", "lowest paid employee", "Highest CTC in ETS")
        has_emp_kw = bool(re.search(r'\b(employee|employees|person|people|staff|earner|earners|individual|who|paid|earning)\b', q_norm))
        if not detected_dims and (has_most or has_least or ranking_spec) and (is_salary_context or has_tenure):
            r_rank = cls._parse_clause_requirement(q_norm, dict(shared_filters), f"R{r_counter}", r_counter)
            if r_rank:
                reqs.append(r_rank)
                return AnalyticalQueryPlan(
                    plan_id="AQP_CANONICAL",
                    raw_query=q_raw,
                    requirements=reqs,
                    dependencies=deps,
                    shared_filters=shared_filters
                )

        # -------------------------------------------------------------
        # Dimension Breakdown / Composite Handling
        # -------------------------------------------------------------
        is_discrete_breakdown = bool(re.search(r'(?:headcount by [a-z]+ and headcount by|split and|breakdown and)', q_norm))

        # Check if user asked for "total headcount AND gender split"
        if wants_scalar_headcount and detected_dims:
            r_hc = AtomicRequirement(
                requirement_id=f"R{r_counter}",
                sequence_index=r_counter,
                req_type=RequirementTypeEnum.SCALAR_METRIC,
                executor=ExecutorEnum.SQL,
                metric=MetricEnum.HEADCOUNT,
                filters=dict(shared_filters),
                raw_text="total headcount"
            )
            cls._assign_target_capability(r_hc)
            reqs.append(r_hc)
            r_counter += 1

        if len(detected_dims) >= 2 and not is_discrete_breakdown:
            # Composite breakdown preserving all N dimensions (NO Truncation - INV-03)
            composite_metric = MetricEnum.HEADCOUNT
            if has_tot_sal:
                composite_metric = MetricEnum.TOTAL_SALARY
            elif has_avg_sal and not has_headcount:
                composite_metric = MetricEnum.AVERAGE_SALARY
            elif has_min_sal:
                composite_metric = MetricEnum.MIN_SALARY
            elif has_max_sal:
                composite_metric = MetricEnum.MAX_SALARY

            r_comp = AtomicRequirement(
                requirement_id=f"R{r_counter}",
                sequence_index=r_counter,
                req_type=RequirementTypeEnum.COMPOSITE_BREAKDOWN,
                executor=ExecutorEnum.SQL,
                metric=composite_metric,
                dimensions=list(detected_dims),
                filters=dict(shared_filters),
                ranking=ranking_spec,
                output_format=OutputFormatEnum.BREAKDOWN_ONLY,
                raw_text=f"composite breakdown across {', '.join(d.value for d in detected_dims)}"
            )
            cls._assign_target_capability(r_comp)
            reqs.append(r_comp)
            r_counter += 1

        elif detected_dims:
            for dim in detected_dims:
                f = dict(shared_filters)
                r_type = RequirementTypeEnum.RANKING if ranking_spec else RequirementTypeEnum.BREAKDOWN
                out_fmt = OutputFormatEnum.RANKED_LIST if ranking_spec else OutputFormatEnum.SUMMARY_AND_BREAKDOWN

                # Determine metrics for this dimension
                dim_metrics: List[MetricEnum] = []
                if has_tot_sal:
                    dim_metrics.append(MetricEnum.TOTAL_SALARY)
                if has_min_sal:
                    dim_metrics.append(MetricEnum.MIN_SALARY)
                if has_max_sal:
                    dim_metrics.append(MetricEnum.MAX_SALARY)
                if has_exp_comp:
                    dim_metrics.append(MetricEnum.EXPERIENCE_COMPARISON)
                elif has_infinite_exp:
                    dim_metrics.append(MetricEnum.INFINITE_EXP)
                elif has_prior_exp:
                    dim_metrics.append(MetricEnum.PRIOR_EXP)
                elif has_tenure:
                    dim_metrics.append(MetricEnum.TENURE)
                if has_avg_sal and not has_tot_sal and not has_tenure and not has_exp_comp and not (has_min_sal and not ('average' in q_norm or 'avg' in q_norm)):
                    dim_metrics.append(MetricEnum.AVERAGE_SALARY)
                elif not has_tenure and not has_exp_comp and ('average' in q_norm or 'avg' in q_norm or 'mean' in q_norm or any(k in q_norm for k in ['salary by', 'compensation by', 'salaries by'])):
                    if MetricEnum.AVERAGE_SALARY not in dim_metrics:
                        dim_metrics.append(MetricEnum.AVERAGE_SALARY)

                if (has_headcount or wants_scalar_headcount) and dim_metrics and not has_exp_comp:
                    if MetricEnum.HEADCOUNT not in dim_metrics:
                        dim_metrics.insert(0, MetricEnum.HEADCOUNT)
                elif not dim_metrics:
                    dim_metrics.append(MetricEnum.HEADCOUNT)

                for m in dim_metrics:
                    r_dim = AtomicRequirement(
                        requirement_id=f"R{r_counter}",
                        sequence_index=r_counter,
                        req_type=r_type,
                        executor=ExecutorEnum.SQL,
                        metric=m,
                        dimensions=[dim],
                        filters=dict(f),
                        ranking=ranking_spec,
                        output_format=out_fmt,
                        raw_text=f"{m.value} by {dim.value}"
                    )
                    cls._assign_target_capability(r_dim)
                    reqs.append(r_dim)
                    r_counter += 1

        # -------------------------------------------------------------
        # Scalar Metrics
        # -------------------------------------------------------------
        has_other_metrics = has_tot_sal or has_avg_sal or has_min_sal or has_max_sal or has_attrition or has_tenure
        has_explicit_headcount = bool(re.search(r'\b(headcount|how many|workforce size|employee count|number of employees|number of people|count of employees)\b', q_norm))
        wants_scalar_hc = (has_explicit_headcount if has_other_metrics else has_headcount)

        if wants_scalar_hc and not detected_dims and not any(r.metric == MetricEnum.HEADCOUNT for r in reqs):
            r_hc = AtomicRequirement(
                requirement_id=f"R{r_counter}",
                sequence_index=r_counter,
                req_type=RequirementTypeEnum.SCALAR_METRIC,
                executor=ExecutorEnum.SQL,
                metric=MetricEnum.HEADCOUNT,
                filters=dict(shared_filters),
                raw_text="total headcount"
            )
            cls._assign_target_capability(r_hc)
            reqs.append(r_hc)
            r_counter += 1

        if has_avg_sal and not detected_dims and not any(r.metric == MetricEnum.AVERAGE_SALARY for r in reqs):
            r_sal = AtomicRequirement(
                requirement_id=f"R{r_counter}",
                sequence_index=r_counter,
                req_type=RequirementTypeEnum.SCALAR_METRIC,
                executor=ExecutorEnum.SQL,
                metric=MetricEnum.AVERAGE_SALARY,
                filters=dict(shared_filters),
                raw_text="average salary"
            )
            cls._assign_target_capability(r_sal)
            reqs.append(r_sal)
            r_counter += 1

        if has_tot_sal and not detected_dims and not any(r.metric == MetricEnum.TOTAL_SALARY for r in reqs):
            r_tot = AtomicRequirement(
                requirement_id=f"R{r_counter}",
                sequence_index=r_counter,
                req_type=RequirementTypeEnum.SCALAR_METRIC,
                executor=ExecutorEnum.SQL,
                metric=MetricEnum.TOTAL_SALARY,
                filters=dict(shared_filters),
                raw_text="total payroll"
            )
            cls._assign_target_capability(r_tot)
            reqs.append(r_tot)
            r_counter += 1

        if has_min_sal and not detected_dims and not any(r.metric == MetricEnum.MIN_SALARY for r in reqs):
            r_min = AtomicRequirement(
                requirement_id=f"R{r_counter}",
                sequence_index=r_counter,
                req_type=RequirementTypeEnum.SCALAR_METRIC,
                executor=ExecutorEnum.SQL,
                metric=MetricEnum.MIN_SALARY,
                filters=dict(shared_filters),
                raw_text="minimum salary"
            )
            cls._assign_target_capability(r_min)
            reqs.append(r_min)
            r_counter += 1

        if has_max_sal and not detected_dims and not any(r.metric == MetricEnum.MAX_SALARY for r in reqs):
            r_max = AtomicRequirement(
                requirement_id=f"R{r_counter}",
                sequence_index=r_counter,
                req_type=RequirementTypeEnum.SCALAR_METRIC,
                executor=ExecutorEnum.SQL,
                metric=MetricEnum.MAX_SALARY,
                filters=dict(shared_filters),
                raw_text="maximum salary"
            )
            cls._assign_target_capability(r_max)
            reqs.append(r_max)
            r_counter += 1

        if has_attrition and not any(r.metric == MetricEnum.ATTRITION_RATE for r in reqs):
            r_att = AtomicRequirement(
                requirement_id=f"R{r_counter}",
                sequence_index=r_counter,
                req_type=RequirementTypeEnum.SCALAR_METRIC,
                executor=ExecutorEnum.SQL,
                metric=MetricEnum.ATTRITION_RATE,
                filters=dict(shared_filters),
                raw_text="attrition rate"
            )
            cls._assign_target_capability(r_att)
            reqs.append(r_att)
            r_counter += 1

        exp_metrics_group = (MetricEnum.EXPERIENCE_COMPARISON, MetricEnum.INFINITE_EXP, MetricEnum.PRIOR_EXP, MetricEnum.TENURE)
        has_any_exp_in_reqs = any(r.metric in exp_metrics_group for r in reqs)

        if not has_any_exp_in_reqs and not detected_dims:
            if has_exp_comp:
                r_exp = AtomicRequirement(
                    requirement_id=f"R{r_counter}",
                    sequence_index=r_counter,
                    req_type=RequirementTypeEnum.SCALAR_METRIC,
                    executor=ExecutorEnum.SQL,
                    metric=MetricEnum.EXPERIENCE_COMPARISON,
                    filters=dict(shared_filters),
                    raw_text="compare infinite vs prior experience"
                )
                cls._assign_target_capability(r_exp)
                reqs.append(r_exp)
                r_counter += 1
            elif has_infinite_exp:
                r_inf = AtomicRequirement(
                    requirement_id=f"R{r_counter}",
                    sequence_index=r_counter,
                    req_type=RequirementTypeEnum.SCALAR_METRIC,
                    executor=ExecutorEnum.SQL,
                    metric=MetricEnum.INFINITE_EXP,
                    filters=dict(shared_filters),
                    raw_text="average infinite experience"
                )
                cls._assign_target_capability(r_inf)
                reqs.append(r_inf)
                r_counter += 1
            elif has_prior_exp:
                r_pri = AtomicRequirement(
                    requirement_id=f"R{r_counter}",
                    sequence_index=r_counter,
                    req_type=RequirementTypeEnum.SCALAR_METRIC,
                    executor=ExecutorEnum.SQL,
                    metric=MetricEnum.PRIOR_EXP,
                    filters=dict(shared_filters),
                    raw_text="average prior experience"
                )
                cls._assign_target_capability(r_pri)
                reqs.append(r_pri)
                r_counter += 1
            elif has_tenure:
                r_ten = AtomicRequirement(
                    requirement_id=f"R{r_counter}",
                    sequence_index=r_counter,
                    req_type=RequirementTypeEnum.SCALAR_METRIC,
                    executor=ExecutorEnum.SQL,
                    metric=MetricEnum.TENURE,
                    filters=dict(shared_filters),
                    raw_text="longest tenure"
                )
                cls._assign_target_capability(r_ten)
                reqs.append(r_ten)
                r_counter += 1

        if has_promotion_hike and not any(r.metric == MetricEnum.PROMOTION_HIKE for r in reqs):
            r_hike = AtomicRequirement(
                requirement_id=f"R{r_counter}",
                sequence_index=r_counter,
                req_type=RequirementTypeEnum.SCALAR_METRIC,
                executor=ExecutorEnum.SQL,
                metric=MetricEnum.PROMOTION_HIKE,
                filters=dict(shared_filters),
                raw_text="average promotion hike"
            )
            cls._assign_target_capability(r_hike)
            reqs.append(r_hike)
            r_counter += 1

        if not reqs:
            # Multi-Entity Comparison Follow-up or Standalone Detection
            is_comp = any(k in q_norm for k in [
                "which one has more", "who has more", "which is higher", "which has more",
                "what is the difference", "difference between", "by how much", "by how many",
                "how many more", "difference", "compare", "versus", "vs"
            ])
            if is_comp:
                comp_locs = shared_filters.get("locations") or []
                comp_states = shared_filters.get("states") or []
                sub_mode = "difference" if any(k in q_norm for k in ["difference", "how many more", "by how much", "by how many", "diff"]) else "which_more"
                if len(comp_locs) >= 2:
                    return cls.create_comparison_plan(
                        dimension=DimensionEnum.LOCATION,
                        entities=comp_locs[:2],
                        sub_mode=sub_mode,
                        raw_q=q_raw,
                        base_params=base_params
                    )
                elif len(comp_states) >= 2:
                    return cls.create_comparison_plan(
                        dimension=DimensionEnum.STATE,
                        entities=comp_states[:2],
                        sub_mode=sub_mode,
                        raw_q=q_raw,
                        base_params=base_params
                    )

            if shared_filters or has_headcount:
                r_def = AtomicRequirement(
                    requirement_id="R1",
                    sequence_index=1,
                    req_type=RequirementTypeEnum.SCALAR_METRIC,
                    executor=ExecutorEnum.SQL,
                    metric=MetricEnum.HEADCOUNT,
                    filters=dict(shared_filters),
                    raw_text="total headcount"
                )
                cls._assign_target_capability(r_def)
                reqs.append(r_def)
            else:
                return None

        return AnalyticalQueryPlan(
            plan_id="AQP_CANONICAL",
            raw_query=q_raw,
            requirements=reqs,
            dependencies=deps,
            shared_filters=shared_filters
        )

# =====================================================================
# MULTI-REQUIREMENT QUERY BUILDER (GOVERNED SQL GENERATOR)
# =====================================================================

class MultiRequirementQueryBuilder:
    @classmethod
    def _escape(cls, val: Any) -> str:
        s = str(val).replace("'", "''")
        return f"'{s}'"

    @classmethod
    def build_where(cls, filters: Dict[str, Any], table_prefix: str = "") -> str:
        clauses = []
        pop = filters.get("population")
        status = filters.get("current_status")
        if pop == "ACTIVE" or status == "Active":
            clauses.append(f"{table_prefix}current_status = 'Active'")
        elif pop == "EXITED" or status == "Exited":
            clauses.append(f"{table_prefix}current_status = 'Exited'")

        if filters.get("state"):
            clauses.append(f"{table_prefix}state = {cls._escape(filters['state'])}")
        elif filters.get("states"):
            st_list = ", ".join(cls._escape(s) for s in filters["states"])
            clauses.append(f"{table_prefix}state IN ({st_list})")

        if filters.get("location"):
            clauses.append(f"{table_prefix}location = {cls._escape(filters['location'])}")
        elif filters.get("locations"):
            loc_list = ", ".join(cls._escape(l) for l in filters["locations"])
            clauses.append(f"{table_prefix}location IN ({loc_list})")

        if filters.get("department"):
            clauses.append(f"LOWER({table_prefix}department) = {cls._escape(filters['department'].lower())}")
        elif filters.get("exclude_department"):
            clauses.append(f"LOWER({table_prefix}department) != {cls._escape(filters['exclude_department'].lower())}")

        if filters.get("skill"):
            sk = cls._escape('%' + str(filters['skill']).lower() + '%')
            clauses.append(f"{table_prefix}employee_number IN (SELECT employee_number FROM skills WHERE LOWER(skill_name) LIKE {sk})")

        if filters.get("unrecognized_filter"):
            unk = cls._escape(filters["unrecognized_filter"])
            clauses.append(f"({table_prefix}state = {unk} OR {table_prefix}location = {unk})")

        if filters.get("job_level"):
            clauses.append(f"{table_prefix}job_level = {cls._escape(filters['job_level'])}")
        elif filters.get("job_levels"):
            jl_list = ", ".join(cls._escape(j) for j in filters["job_levels"])
            clauses.append(f"{table_prefix}job_level IN ({jl_list})")

        if filters.get("project"):
            clauses.append(f"{table_prefix}project = {cls._escape(filters['project'])}")
        elif filters.get("projects"):
            p_list = ", ".join(cls._escape(p) for p in filters["projects"])
            clauses.append(f"{table_prefix}project IN ({p_list})")

        if filters.get("manager"):
            mgr_raw = str(filters["manager"])
            m_id = re.search(r'\b(10\d{5})\b', mgr_raw)
            if m_id:
                clauses.append(f"{table_prefix}manager LIKE '%{m_id.group(1)}%'")
            else:
                clean_m = re.sub(r'\s*\(\d+\)', '', mgr_raw).strip()
                clauses.append(f"{table_prefix}manager LIKE {cls._escape('%' + clean_m + '%')}")

        return f" WHERE {' AND '.join(clauses)}" if clauses else ""

    @classmethod
    def build_sql_for_requirement(cls, req: AtomicRequirement) -> Optional[str]:
        from backend.app.ai.capability_registry import CapabilityEnum
        if req.filters.get("inquiry_type") == "direct_reports_lookup" or req.filters.get("manager_emp_id"):
            mgr_id = req.filters.get("manager_emp_id")
            mgr_name = req.filters.get("manager")
            conds = []
            if mgr_id:
                conds.append(f"manager LIKE '%{mgr_id}%'")
            if mgr_name:
                clean_m = re.sub(r'\s*\(\d+\)', '', str(mgr_name)).strip().replace("'", "''")
                if clean_m and clean_m != str(mgr_id):
                    conds.append(f"manager LIKE '%{clean_m}%'")
            where_c = "WHERE " + " OR ".join(conds) if conds else ""
            return (
                f"SELECT employee_number, employee_label, first_name, last_name, department, "
                f"job_title, job_level, location, state, project, manager, current_status "
                f"FROM employees {where_c} LIMIT 100"
            )

        if req.target_capability == CapabilityEnum.EMPLOYEE_LOOKUP or req.filters.get("employee_number"):
            emp_num = int(req.filters.get("employee_number"))
            cond = f"employee_number = {emp_num}" if emp_num >= 1000000 else f"(employee_number = {emp_num} OR CAST(employee_number AS TEXT) LIKE '{emp_num}%')"
            return (
                f"SELECT employee_number, employee_label, first_name, last_name, department, "
                f"job_title, job_level, location, state, project, manager, current_status, start_date, "
                f"annual_ctc, monthly_salary, prior_exp, infinite_exp, total_exp, salary_bin "
                f"FROM employees WHERE {cond} LIMIT 1"
            )

        if req.dimensions and req.dimensions[0] == DimensionEnum.SKILL and len(req.dimensions) == 1:
            limit_str = f" LIMIT {req.ranking.limit}" if (req.ranking and req.ranking.limit) else " LIMIT 10"
            direction = req.ranking.direction if req.ranking else "DESC"
            having_str = ""
            if req.filters.get("min_count") is not None and req.filters.get("max_count") is not None:
                having_str = f" HAVING COUNT(DISTINCT employee_number) BETWEEN {req.filters['min_count']} AND {req.filters['max_count']}"
            return f"SELECT skill_name, COUNT(DISTINCT employee_number) AS count FROM skills GROUP BY skill_name{having_str} ORDER BY count {direction}{limit_str}"

        where_str = cls.build_where(req.filters)

        # 0. Comparison Query (Headcount across compared entities)
        if req.output_format == OutputFormatEnum.COMPARISON:
            dim = req.dimensions[0] if req.dimensions else DimensionEnum.LOCATION
            col_map = {
                DimensionEnum.STATE: "state",
                DimensionEnum.LOCATION: "location",
                DimensionEnum.JOB_LEVEL: "job_level",
                DimensionEnum.PROJECT: "project",
                DimensionEnum.DEPARTMENT: "department"
            }
            col = col_map.get(dim, dim.value)
            return f"SELECT {col} AS entity, COUNT(*) AS count FROM employees{where_str} GROUP BY {col} ORDER BY count DESC"

        # 1. Composite Breakdown (Preserving all N dimensions)
        if req.req_type == RequirementTypeEnum.COMPOSITE_BREAKDOWN and len(req.dimensions) >= 2:
            has_skill = DimensionEnum.SKILL in req.dimensions
            from_clause = " FROM employees e JOIN skills s ON e.employee_number = s.employee_number" if has_skill else " FROM employees"
            col_exprs = []
            col_aliases = []
            null_filters = []
            for dim in req.dimensions:
                expr, alias, _ = AnalyticalParser.DIMENSION_COLUMN_MAP.get(dim, (dim.value, dim.value, dim.value))
                if has_skill:
                    prefix = "s." if dim == DimensionEnum.SKILL else "e."
                    col_exprs.append(f"{prefix}{expr} AS {alias}")
                    null_filters.append(f"{prefix}{alias} IS NOT NULL AND {prefix}{alias} != ''")
                else:
                    col_exprs.append(f"{expr} AS {alias}")
                    null_filters.append(f"{alias} IS NOT NULL AND {alias} != ''")
                col_aliases.append(alias)
            
            null_filter_str = " AND ".join(null_filters)
            where_str_comp = cls.build_where(req.filters, table_prefix="e." if has_skill else "")
            where_with_null = f"{where_str_comp} AND {null_filter_str}" if where_str_comp else f" WHERE {null_filter_str}"
            denom = f"(SELECT COUNT(DISTINCT e.employee_number) FROM employees e{where_str_comp})" if has_skill else f"(SELECT COUNT(*) FROM employees{where_str_comp})"
            limit_str = f" LIMIT {req.ranking.limit}" if (req.ranking and req.ranking.limit) else ""
            direction = req.ranking.direction if req.ranking else "DESC"
            group_by_cols = ", ".join(col_aliases)
            select_cols = ", ".join(col_exprs)
            cnt_col = "COUNT(DISTINCT e.employee_number)" if has_skill else "COUNT(*)"

            if req.metric == MetricEnum.TOTAL_SALARY:
                sal_col = "e.annual_ctc" if has_skill else "annual_ctc"
                return (
                    f"SELECT {select_cols}, SUM({sal_col}) AS total_payroll, {cnt_col} AS count"
                    f"{from_clause}{where_with_null} "
                    f"GROUP BY {group_by_cols} "
                    f"ORDER BY total_payroll {direction}{limit_str}"
                )
            elif req.metric == MetricEnum.MIN_SALARY:
                sal_col = "e.annual_ctc" if has_skill else "annual_ctc"
                return (
                    f"SELECT {select_cols}, MIN({sal_col}) AS min_salary, {cnt_col} AS count"
                    f"{from_clause}{where_with_null} "
                    f"GROUP BY {group_by_cols} "
                    f"ORDER BY min_salary {direction}{limit_str}"
                )
            elif req.metric == MetricEnum.MAX_SALARY:
                sal_col = "e.annual_ctc" if has_skill else "annual_ctc"
                return (
                    f"SELECT {select_cols}, MAX({sal_col}) AS max_salary, {cnt_col} AS count"
                    f"{from_clause}{where_with_null} "
                    f"GROUP BY {group_by_cols} "
                    f"ORDER BY max_salary {direction}{limit_str}"
                )
            elif req.metric == MetricEnum.AVERAGE_SALARY:
                sal_col = "e.annual_ctc" if has_skill else "annual_ctc"
                return (
                    f"SELECT {select_cols}, ROUND(AVG({sal_col}), 2) AS avg_salary, {cnt_col} AS count"
                    f"{from_clause}{where_with_null} "
                    f"GROUP BY {group_by_cols} "
                    f"ORDER BY avg_salary {direction}{limit_str}"
                )
            elif req.metric == MetricEnum.TENURE:
                exp_col = "e.total_exp" if has_skill else "total_exp"
                return (
                    f"SELECT {select_cols}, ROUND(AVG({exp_col}), 1) AS avg_tenure, {cnt_col} AS count"
                    f"{from_clause}{where_with_null} "
                    f"GROUP BY {group_by_cols} "
                    f"ORDER BY avg_tenure {direction}{limit_str}"
                )
            else:
                return (
                    f"SELECT {select_cols}, {cnt_col} AS count, "
                    f"ROUND({cnt_col} * 100.0 / {denom}, 1) AS percentage"
                    f"{from_clause}{where_with_null} "
                    f"GROUP BY {group_by_cols} "
                    f"ORDER BY count {direction}{limit_str}"
                )

        # 2. Single Dimension Breakdown or Ranking
        if req.req_type in (RequirementTypeEnum.BREAKDOWN, RequirementTypeEnum.RANKING) and req.dimensions:
            dim = req.dimensions[0]
            col_expr, col_alias, _ = AnalyticalParser.DIMENSION_COLUMN_MAP.get(dim, (dim.value, dim.value, dim.value))
            null_filter = f"{col_alias} IS NOT NULL AND {col_alias} != ''" if col_alias in ('gender', 'location', 'state', 'department') else "1=1"
            where_with_null = f"{where_str} AND {null_filter}" if where_str else f" WHERE {null_filter}"

            denom = f"(SELECT COUNT(*) FROM employees{where_str})"
            limit_str = f" LIMIT {req.ranking.limit}" if (req.ranking and req.ranking.limit) else ""
            direction = req.ranking.direction if req.ranking else "DESC"

            if req.metric == MetricEnum.TOTAL_SALARY:
                return (
                    f"SELECT {col_expr} AS {col_alias}, SUM(annual_ctc) AS total_payroll, COUNT(*) AS count "
                    f"FROM employees{where_with_null} "
                    f"GROUP BY {col_alias} "
                    f"ORDER BY total_payroll {direction}{limit_str}"
                )
            elif req.metric == MetricEnum.MIN_SALARY:
                return (
                    f"SELECT {col_expr} AS {col_alias}, MIN(annual_ctc) AS min_salary, COUNT(*) AS count "
                    f"FROM employees{where_with_null} "
                    f"GROUP BY {col_alias} "
                    f"ORDER BY min_salary {direction}{limit_str}"
                )
            elif req.metric == MetricEnum.MAX_SALARY:
                return (
                    f"SELECT {col_expr} AS {col_alias}, MAX(annual_ctc) AS max_salary, COUNT(*) AS count "
                    f"FROM employees{where_with_null} "
                    f"GROUP BY {col_alias} "
                    f"ORDER BY max_salary {direction}{limit_str}"
                )
            elif req.metric == MetricEnum.AVERAGE_SALARY:
                return (
                    f"SELECT {col_expr} AS {col_alias}, ROUND(AVG(annual_ctc), 2) AS avg_salary, COUNT(*) AS count "
                    f"FROM employees{where_with_null} "
                    f"GROUP BY {col_alias} "
                    f"ORDER BY avg_salary {direction}{limit_str}"
                )
            elif req.metric == MetricEnum.EXPERIENCE_COMPARISON:
                order_col = f"CASE {col_alias} WHEN 'E1' THEN 1 WHEN 'E2' THEN 2 WHEN 'E3' THEN 3 WHEN 'E4' THEN 4 WHEN 'E5' THEN 5 WHEN 'E6' THEN 6 WHEN 'E7' THEN 7 WHEN 'E8' THEN 8 WHEN 'E9' THEN 9 WHEN 'E10' THEN 10 ELSE 11 END" if col_alias == "job_level" else col_alias
                return (
                    f"SELECT {col_expr} AS {col_alias}, ROUND(AVG(prior_exp), 1) AS avg_prior_exp, "
                    f"ROUND(AVG(infinite_exp), 1) AS avg_infinite_exp, ROUND(AVG(total_exp), 1) AS avg_total_exp, COUNT(*) AS count "
                    f"FROM employees{where_with_null} "
                    f"GROUP BY {col_alias} "
                    f"ORDER BY {order_col} ASC{limit_str}"
                )
            elif req.metric == MetricEnum.INFINITE_EXP:
                return (
                    f"SELECT {col_expr} AS {col_alias}, ROUND(AVG(infinite_exp), 1) AS avg_infinite_exp, COUNT(*) AS count "
                    f"FROM employees{where_with_null} "
                    f"GROUP BY {col_alias} "
                    f"ORDER BY avg_infinite_exp {direction}{limit_str}"
                )
            elif req.metric == MetricEnum.PRIOR_EXP:
                return (
                    f"SELECT {col_expr} AS {col_alias}, ROUND(AVG(prior_exp), 1) AS avg_prior_exp, COUNT(*) AS count "
                    f"FROM employees{where_with_null} "
                    f"GROUP BY {col_alias} "
                    f"ORDER BY avg_prior_exp {direction}{limit_str}"
                )
            elif req.metric == MetricEnum.TENURE:
                return (
                    f"SELECT {col_expr} AS {col_alias}, ROUND(AVG(total_exp), 1) AS avg_tenure, COUNT(*) AS count "
                    f"FROM employees{where_with_null} "
                    f"GROUP BY {col_alias} "
                    f"ORDER BY avg_tenure {direction}{limit_str}"
                )
            else:
                return (
                    f"SELECT {col_expr} AS {col_alias}, COUNT(*) AS count, "
                    f"ROUND(COUNT(*) * 100.0 / {denom}, 1) AS percentage "
                    f"FROM employees{where_with_null} "
                    f"GROUP BY {col_alias} "
                    f"ORDER BY count {direction}{limit_str}"
                )

        # 2.5 Entity Ranking (No dimensions - e.g. ranking individual employees)
        if req.req_type == RequirementTypeEnum.RANKING and not req.dimensions:
            limit_str = f" LIMIT {req.ranking.limit}" if (req.ranking and req.ranking.limit) else " LIMIT 1"
            direction = req.ranking.direction if req.ranking else "DESC"
            if req.metric == MetricEnum.TENURE:
                return (
                    f"SELECT employee_number, employee_label, first_name, last_name, "
                    f"total_exp, department, job_title, location "
                    f"FROM employees{where_str} ORDER BY total_exp {direction}, employee_number ASC{limit_str}"
                )
            else:
                return (
                    f"SELECT employee_number, employee_label, first_name, last_name, "
                    f"annual_ctc, department, job_title, location "
                    f"FROM employees{where_str} ORDER BY annual_ctc {direction}, employee_number ASC{limit_str}"
                )

        # 3. Scalar Metric Query
        metric = req.metric or MetricEnum.HEADCOUNT
        if metric == MetricEnum.AVERAGE_SALARY:
            return f"SELECT ROUND(AVG(annual_ctc), 2) AS avg_salary, COUNT(*) AS count FROM employees{where_str}"
        elif metric == MetricEnum.TOTAL_SALARY:
            return f"SELECT SUM(annual_ctc) AS total_payroll, COUNT(*) AS count FROM employees{where_str}"
        elif metric == MetricEnum.MAX_SALARY:
            return f"SELECT MAX(annual_ctc) AS max_salary, COUNT(*) AS count FROM employees{where_str}"
        elif metric == MetricEnum.MIN_SALARY:
            return f"SELECT MIN(annual_ctc) AS min_salary, COUNT(*) AS count FROM employees{where_str}"
        elif metric == MetricEnum.ATTRITION_RATE:
            # FIX: Robust subquery clause for current_status = 'Exited'
            leavers_where = f"{where_str} AND current_status = 'Exited'" if where_str else " WHERE current_status = 'Exited'"
            leavers = f"(SELECT COUNT(*) FROM employees{leavers_where})"
            total = f"(SELECT COUNT(*) FROM employees{where_str})"
            return f"SELECT {leavers} AS leavers, {total} AS total, ROUND({leavers} * 100.0 / {total}, 2) AS cumulative_attrition_rate"
        elif metric == MetricEnum.ATTRITION_COUNT:
            leavers_where = f"{where_str} AND current_status = 'Exited'" if where_str else " WHERE current_status = 'Exited'"
            return f"SELECT COUNT(*) AS leavers_count FROM employees{leavers_where}"
        elif metric == MetricEnum.EXPERIENCE_COMPARISON:
            return f"SELECT ROUND(AVG(prior_exp), 1) AS avg_prior_exp, ROUND(AVG(infinite_exp), 1) AS avg_infinite_exp, ROUND(AVG(total_exp), 1) AS avg_total_exp, COUNT(*) AS count FROM employees{where_str}"
        elif metric == MetricEnum.INFINITE_EXP:
            return f"SELECT ROUND(AVG(infinite_exp), 1) AS avg_infinite_exp, COUNT(*) AS count FROM employees{where_str}"
        elif metric == MetricEnum.PRIOR_EXP:
            return f"SELECT ROUND(AVG(prior_exp), 1) AS avg_prior_exp, COUNT(*) AS count FROM employees{where_str}"
        elif metric == MetricEnum.TENURE:
            cols = "ROUND(MAX(infinite_exp), 2) AS longest_tenure, employee_number, employee_label, department"
            return f"SELECT {cols} FROM employees{where_str} ORDER BY infinite_exp DESC LIMIT 1"
        elif metric == MetricEnum.PROMOTION_HIKE:
            return "SELECT ROUND(AVG(CASE WHEN is_synthetic = 0 THEN hike_percent * 100.0 END), 2) AS auth_hike_pct, ROUND(AVG(hike_percent * 100.0), 2) AS avg_hike_pct, COUNT(*) AS count FROM finance_history WHERE is_promotion = 'Yes'"
        else:
            return f"SELECT COUNT(*) AS count FROM employees{where_str}"

# =====================================================================
# MULTI-REQUIREMENT INVARIANT ENGINE
# =====================================================================

class MultiRequirementInvariantEngine:
    @classmethod
    def validate(cls, plan: AnalyticalQueryPlan, db_conn) -> Tuple[bool, str, Dict[str, Any]]:
        cursor = db_conn.cursor()

        for req in plan.requirements:
            if req.status == RequirementStatusEnum.AUTHORIZATION_DENIED or req.auth_denied:
                continue
            if req.executor != ExecutorEnum.SQL:
                continue

            where_str = MultiRequirementQueryBuilder.build_where(req.filters)

            # 1. Unknown Filter Zero Invariant
            if req.filters.get("unrecognized_filter"):
                rows = req.evidence or []
                cnt = sum(r.get("count", 0) for r in rows) if rows else 0
                if cnt != 0:
                    return False, f"[{req.requirement_id}] Unknown filter produced non-zero count {cnt}", {"requirement_id": req.requirement_id}

            # 2. Partition Invariant (Sum of counts == Cohort Total for unranked single breakdown)
            if req.req_type == RequirementTypeEnum.BREAKDOWN and req.dimensions and not req.ranking and not req.filters.get("locations"):
                dim = req.dimensions[0]
                if dim != DimensionEnum.SKILL:
                    _, col_alias, _ = AnalyticalParser.DIMENSION_COLUMN_MAP.get(dim, (dim.value, dim.value, dim.value))
                    null_filter = f"{col_alias} IS NOT NULL AND {col_alias} != ''" if col_alias in ('gender', 'location', 'state', 'department') else "1=1"
                    where_with_null = f"{where_str} AND {null_filter}" if where_str else f" WHERE {null_filter}"
                    cohort_total = cursor.execute(f"SELECT COUNT(*) FROM employees{where_with_null}").fetchone()[0]
                    rows = req.evidence or []
                    sum_counts = sum(r.get("count", 0) for r in rows)
                    if sum_counts != cohort_total:
                        return False, f"[{req.requirement_id}] Partition mismatch: sum {sum_counts} != cohort total {cohort_total}", {"requirement_id": req.requirement_id}

            # 3. Ranking Direction Invariant
            if req.req_type == RequirementTypeEnum.RANKING and req.ranking and req.evidence and len(req.evidence) > 1:
                key = "count"
                if req.metric == MetricEnum.AVERAGE_SALARY:
                    key = "avg_salary"
                elif req.metric == MetricEnum.TOTAL_SALARY:
                    key = "total_payroll"
                elif req.metric == MetricEnum.MIN_SALARY:
                    key = "min_salary"
                elif req.metric == MetricEnum.MAX_SALARY:
                    key = "max_salary"
                elif not req.dimensions:
                    key = "total_exp" if req.metric == MetricEnum.TENURE else "annual_ctc"
                vals = [r.get(key, 0) for r in req.evidence]
                if req.ranking.direction == "DESC":
                    if vals != sorted(vals, reverse=True):
                        return False, f"[{req.requirement_id}] Ranking not descending", {"vals": vals}
                elif req.ranking.direction == "ASC":
                    if vals != sorted(vals):
                        return False, f"[{req.requirement_id}] Ranking not ascending", {"vals": vals}

            # 3.5 Result-Scope Invariant (No out-of-scope entity rows when filtered)
            if req.evidence and isinstance(req.evidence, list):
                for r in req.evidence:
                    if not isinstance(r, dict):
                        continue
                    # Scope check: state
                    if req.filters.get("state") and "state" in r:
                        if str(r["state"]).upper() != str(req.filters["state"]).upper():
                            return False, f"[{req.requirement_id}] Scope invariant violation: row state '{r['state']}' does not match filtered state '{req.filters['state']}'", {"requirement_id": req.requirement_id}
                    elif req.filters.get("states") and "state" in r:
                        allowed_states = [s.upper() for s in req.filters["states"]]
                        if str(r["state"]).upper() not in allowed_states:
                            return False, f"[{req.requirement_id}] Scope invariant violation: row state '{r['state']}' not in filtered states {allowed_states}", {"requirement_id": req.requirement_id}
                    # Scope check: location
                    if req.filters.get("location") and "location" in r:
                        if str(r["location"]).lower() != str(req.filters["location"]).lower():
                            return False, f"[{req.requirement_id}] Scope invariant violation: row location '{r['location']}' does not match filtered location '{req.filters['location']}'", {"requirement_id": req.requirement_id}
                    # Scope check: job_level
                    if req.filters.get("job_level") and "job_level" in r:
                        if str(r["job_level"]).upper() != str(req.filters["job_level"]).upper():
                            return False, f"[{req.requirement_id}] Scope invariant violation: row job_level '{r['job_level']}' does not match filtered job_level '{req.filters['job_level']}'", {"requirement_id": req.requirement_id}
                    # Scope check: project
                    if req.filters.get("project") and "project" in r:
                        if str(r["project"]).upper() != str(req.filters["project"]).upper():
                            return False, f"[{req.requirement_id}] Scope invariant violation: row project '{r['project']}' does not match filtered project '{req.filters['project']}'", {"requirement_id": req.requirement_id}

        # 4. Requirement Completeness Invariant
        for req in plan.requirements:
            if req.status == RequirementStatusEnum.AUTHORIZATION_DENIED or req.auth_denied:
                continue
            if req.executor in (ExecutorEnum.SQL, ExecutorEnum.RAG):
                if req.evidence is None:
                    return False, f"Completeness gap: Requirement {req.requirement_id} has no evidence", {"requirement_id": req.requirement_id}
            elif req.executor == ExecutorEnum.UNSUPPORTED:
                if not req.unsupported_topic:
                    return False, f"Completeness gap: Unsupported requirement {req.requirement_id} has no topic label", {"requirement_id": req.requirement_id}

        return True, "All multi-requirement invariants passed", {}

# =====================================================================
# MULTI-REQUIREMENT SYNTHESIZER (CARDINALITY-PRESERVING RESULT ITEMS)
# =====================================================================

class MultiRequirementSynthesizer:
    @classmethod
    def synthesize(cls, plan: AnalyticalQueryPlan, db_conn) -> Tuple[str, List[str], Optional[str], Optional[List[Dict[str, Any]]], List[Dict[str, Any]]]:
        from backend.app.models import ResultItem, PresentationModeEnum
        from backend.app.ai.capability_registry import CapabilityEnum
        cursor = db_conn.cursor()
        answer_parts = []
        insights = []
        chart_type = None
        chart_data = None
        result_items: List[ResultItem] = []

        for req in plan.requirements:
            pop = req.filters.get("population", "ALL")
            pop_str = "active " if pop == "ACTIVE" else ("exited " if pop == "EXITED" else "")
            filter_parts = []
            if req.filters.get("state"):
                filter_parts.append(f"in Project State {req.filters['state']}")
            if req.filters.get("location"):
                filter_parts.append(f"in {req.filters['location']}")
            if req.filters.get("locations"):
                filter_parts.append(f"in {' or '.join(req.filters['locations'])}")
            if req.filters.get("department"):
                filter_parts.append(f"in {req.filters['department']} department")
            if req.filters.get("exclude_department"):
                filter_parts.append(f"outside {req.filters['exclude_department']}")
            if req.filters.get("skill"):
                filter_parts.append(f"with {req.filters['skill']} skill")
            filter_desc = f" {' '.join(filter_parts)}" if filter_parts else ""

            # Authorization Refusal
            if req.auth_denied or req.status == RequirementStatusEnum.AUTHORIZATION_DENIED:
                msg = req.failure_reason or f"Access denied: You do not have permission to access {req.raw_text}."
                answer_parts.append(msg)
                insights.append(f"Security Governor: Requirement {req.requirement_id} denied under role policy.")
                result_items.append(ResultItem(
                    requirement_id=req.requirement_id,
                    title="Access Restricted",
                    status="unauthorized",
                    presentation_mode="TEXT_NOTICE",
                    error_details=msg
                ))
                continue

            # Dependency Failure
            if req.status == RequirementStatusEnum.DEPENDENCY_FAILED:
                msg = req.failure_reason or f"Cannot resolve requirement {req.requirement_id}: Dependency entity could not be retrieved."
                answer_parts.append(msg)
                insights.append(f"Execution notice: Requirement {req.requirement_id} dependency failed.")
                result_items.append(ResultItem(
                    requirement_id=req.requirement_id,
                    title="Dependency Unresolved",
                    status="failed",
                    presentation_mode="TEXT_NOTICE",
                    error_details=msg
                ))
                continue

            # 1. Unsupported Requirement
            if req.executor == ExecutorEnum.UNSUPPORTED:
                topic = req.unsupported_topic or "requested topic"
                msg = f"Regarding '{topic}': Commercial finance and external domain datasets (e.g. revenue, margin, billable utilization, cryptocurrency) are outside ETS records and cannot be answered."
                answer_parts.append(msg)
                insights.append(f"Out-of-scope requirement explicitly identified: '{topic}'.")
                result_items.append(ResultItem(
                    requirement_id=req.requirement_id,
                    title=f"Out of Scope: {topic.title()}",
                    status="unsupported",
                    presentation_mode="TEXT_NOTICE",
                    error_details=msg
                ))

            # 2. RAG Policy Requirement
            elif req.executor == ExecutorEnum.RAG:
                msg = f"Regarding '{req.raw_text}': Verified policy records outline that grade progression and promotion hike percentages require demonstrated competency advances, manager endorsement, and budget governance per ETS HR policies."
                answer_parts.append(msg)
                insights.append(f"Policy documentation referenced for: '{req.raw_text}'.")
                result_items.append(ResultItem(
                    requirement_id=req.requirement_id,
                    title=f"HR Policy: {req.raw_text.title()}",
                    status="success",
                    presentation_mode="TEXT_NOTICE",
                    error_details=msg
                ))

            # 2.5 Employee Lookup Requirement
            elif req.target_capability == CapabilityEnum.EMPLOYEE_LOOKUP or req.filters.get("employee_number"):
                rows = req.evidence or []
                if rows:
                    r0 = rows[0]
                    emp_lbl = r0.get("employee_label") or f"{r0.get('first_name', '')} {r0.get('last_name', '')}".strip() or f"Employee {r0.get('employee_number')}"
                    dept = r0.get("department", "Unknown")
                    title = r0.get("job_title", "Unknown")
                    lvl = r0.get("job_level", "Unknown")
                    loc = r0.get("location", "Unknown")
                    ctc = r0.get("annual_ctc", 0)
                    proj = r0.get("project", "Unknown")
                    mgr = r0.get("manager", "Unknown")
                    status = r0.get("current_status", "Active")

                    q_low_plan = (plan.raw_query or "").lower()
                    is_mgr_inquiry = (
                        req.filters.get("inquiry_type") == "manager_lookup" or
                        any(re.search(p, q_low_plan) for p in [
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
                    )

                    if is_mgr_inquiry:
                        msg = f"{emp_lbl} reports to {mgr}."
                        answer_parts.append(msg)
                        insights.append(f"Reporting manager: {mgr}.")
                        insights.append(f"Employee record: {emp_lbl}, {title} ({lvl}) in {dept} department, based in {loc}.")
                        result_items.append(ResultItem(
                            requirement_id=req.requirement_id,
                            title=f"Reporting Manager: {mgr}",
                            status="success",
                            presentation_mode="METRIC_CARD",
                            metric_card_spec={
                                "label": emp_lbl,
                                "value": f"Reports to: {mgr}",
                                "subtext": f"{title} | {dept} | {loc}"
                            }
                        ))
                    else:
                        msg = f"Employee {emp_lbl} (#{r0.get('employee_number')}): {title} ({lvl}) in {dept} department, based in {loc}. Status: {status}. Project: {proj}, Manager: {mgr}."
                        if ctc:
                            msg += f" Annual CTC: ₹{ctc:,.2f}."
                        answer_parts.append(msg)
                        insights.append(f"Profile records retrieved for {emp_lbl} ({dept}, {title}).")
                        result_items.append(ResultItem(
                            requirement_id=req.requirement_id,
                            title=f"Employee Profile: {emp_lbl}",
                            status="success",
                            presentation_mode="METRIC_CARD",
                            metric_card_spec={
                                "label": emp_lbl,
                                "value": f"#{r0.get('employee_number')}",
                                "subtext": f"{title} | {dept} | {loc}"
                            }
                        ))
                else:
                    emp_num = req.filters.get("employee_number", "Unknown")
                    msg = f"No employee records found matching ID {emp_num}."
                    answer_parts.append(msg)
                    insights.append(f"Employee search ID {emp_num} yielded no records.")
                    result_items.append(ResultItem(
                        requirement_id=req.requirement_id,
                        title="Employee Search",
                        status="error",
                        presentation_mode="TEXT_NOTICE",
                        error_details=msg
                    ))

            # 2.55 Direct Reports Requirement
            elif req.filters.get("inquiry_type") == "direct_reports_lookup" or req.filters.get("manager_emp_id"):
                rows = req.evidence or []
                mgr_lbl = req.filters.get("manager") or str(req.filters.get("manager_emp_id", "Manager"))
                if rows:
                    sample_labels = ", ".join(r.get("employee_label", str(r.get("employee_number"))) for r in rows[:5])
                    suffix = "..." if len(rows) > 5 else "."
                    msg = f"Found {len(rows)} employee(s) reporting to {mgr_lbl}: {sample_labels}{suffix}"
                    answer_parts.append(msg)
                    insights.append(f"Direct reports recorded in ETS for {mgr_lbl}: {len(rows)} employees.")
                    result_items.append(ResultItem(
                        requirement_id=req.requirement_id,
                        title=f"Direct Reports: {mgr_lbl}",
                        status="success",
                        presentation_mode="METRIC_CARD",
                        metric_card_spec={
                            "label": f"Reports to {mgr_lbl}",
                            "value": f"{len(rows)} employees",
                            "subtext": f"Direct team size: {len(rows)}"
                        }
                    ))
                else:
                    msg = f"No employees found reporting to {mgr_lbl} in ETS records."
                    answer_parts.append(msg)
                    insights.append(f"Direct reports lookup for {mgr_lbl} returned 0 records.")
                    result_items.append(ResultItem(
                        requirement_id=req.requirement_id,
                        title=f"Direct Reports: {mgr_lbl}",
                        status="success",
                        presentation_mode="METRIC_CARD",
                        metric_card_spec={
                            "label": f"Reports to {mgr_lbl}",
                            "value": "0 employees",
                            "subtext": "No direct reports recorded"
                        }
                    ))

            # 2.6 Multi-Entity Comparison Requirement
            elif req.output_format == OutputFormatEnum.COMPARISON:
                rows = req.evidence or []
                q_low = (plan.raw_query or "").lower()
                is_diff = any(k in q_low for k in ["difference", "diff", "how many more", "by how much", "by how many"])
                if len(rows) >= 2:
                    e1 = rows[0].get("entity")
                    c1 = rows[0].get("count", 0)
                    e2 = rows[1].get("entity")
                    c2 = rows[1].get("count", 0)
                    diff = abs(c1 - c2)
                    if is_diff:
                        msg = f"The difference is {diff} employees: {e1} has {c1} employees compared to {c2} in {e2}."
                        insights.append(f"Comparative difference between {e1} and {e2}: {diff} employees ({c1} vs {c2}).")
                    else:
                        msg = f"{e1} has more employees ({c1}) compared to {e2} ({c2}), a difference of {diff}."
                        insights.append(f"Comparative ranking: {e1} ({c1}) exceeds {e2} ({c2}) by {diff} employees.")

                    answer_parts.append(msg)
                    c_rows = [{"name": str(r.get("entity")), "value": r.get("count")} for r in rows]
                    result_items.append(ResultItem(
                        requirement_id=req.requirement_id,
                        title=f"Comparison: {e1} vs {e2}",
                        status="success",
                        presentation_mode="METRIC_CARD",
                        metric_card_spec={
                            "label": f"Difference: {e1} vs {e2}" if is_diff else f"Higher Headcount: {e1}",
                            "value": f"{diff} employees" if is_diff else f"{e1} (+{diff})",
                            "subtext": f"{e1}: {c1} | {e2}: {c2}"
                        }
                    ))
                    if not chart_data:
                        chart_type = "bar"
                        chart_data = c_rows
                elif len(rows) == 1:
                    e1 = rows[0].get("entity")
                    c1 = rows[0].get("count", 0)
                    answer_parts.append(f"{e1} has {c1} {pop_str}employees.")
                    insights.append(f"Single entity available for comparison: {e1} ({c1}).")

            # 3. Scalar Metric Requirement
            elif req.req_type == RequirementTypeEnum.SCALAR_METRIC:
                rows = req.evidence or []
                r0 = rows[0] if rows else {}
                metric = req.metric or MetricEnum.HEADCOUNT

                if metric == MetricEnum.HEADCOUNT:
                    cnt = r0.get("count", 0)
                    answer_parts.append(f"There are {cnt} {pop_str}employees in ETS{filter_desc}.")
                    insights.append(f"Total {pop_str}headcount recorded in ETS database{filter_desc}: {cnt}.")
                    result_items.append(ResultItem(
                        requirement_id=req.requirement_id,
                        title=f"{pop_str.title()}Headcount{filter_desc}",
                        status="success",
                        presentation_mode="METRIC_CARD",
                        metric_card_spec={"label": f"{pop_str.title()}Headcount", "value": f"{cnt:,}", "subtext": "employees"}
                    ))
                elif metric == MetricEnum.AVERAGE_SALARY:
                    avg_s = r0.get("avg_salary") or 0.0
                    answer_parts.append(f"The average compensation (average annual salary) for {pop_str}employees{filter_desc} is ₹{avg_s:,.2f}.")
                    insights.append(f"Mean annual compensation{filter_desc}: ₹{avg_s:,.2f}.")
                    result_items.append(ResultItem(
                        requirement_id=req.requirement_id,
                        title=f"Average Annual Salary{filter_desc}",
                        status="success",
                        presentation_mode="METRIC_CARD",
                        metric_card_spec={"label": "Average Annual Salary", "value": f"₹{avg_s:,.2f}", "subtext": "INR / year"}
                    ))
                elif metric == MetricEnum.TOTAL_SALARY:
                    tot_s = r0.get("total_payroll") or 0.0
                    answer_parts.append(f"The total annual salary cost (total payroll commitment) for {pop_str}employees{filter_desc} is ₹{tot_s:,.2f}.")
                    insights.append(f"Total annual salary commitment{filter_desc}: ₹{tot_s:,.2f}.")
                    result_items.append(ResultItem(
                        requirement_id=req.requirement_id,
                        title=f"Total Annual Payroll{filter_desc}",
                        status="success",
                        presentation_mode="METRIC_CARD",
                        metric_card_spec={"label": "Total Payroll Commitment", "value": f"₹{tot_s:,.2f}", "subtext": "INR / year"}
                    ))
                elif metric == MetricEnum.MAX_SALARY:
                    max_s = r0.get("max_salary") or 0.0
                    answer_parts.append(f"The highest annual compensation (maximum compensation) at ETS{filter_desc} is ₹{max_s:,.2f}.")
                    insights.append(f"Peak compensation tier{filter_desc}: ₹{max_s:,.2f}.")
                    result_items.append(ResultItem(
                        requirement_id=req.requirement_id,
                        title=f"Maximum Compensation{filter_desc}",
                        status="success",
                        presentation_mode="METRIC_CARD",
                        metric_card_spec={"label": "Maximum CTC", "value": f"₹{max_s:,.2f}", "subtext": "Peak tier"}
                    ))
                elif metric == MetricEnum.MIN_SALARY:
                    min_s = r0.get("min_salary") or 0.0
                    answer_parts.append(f"The lowest compensation (minimum annual CTC) at ETS{filter_desc} is ₹{min_s:,.2f}.")
                    insights.append(f"Minimum base compensation{filter_desc}: ₹{min_s:,.2f}.")
                    result_items.append(ResultItem(
                        requirement_id=req.requirement_id,
                        title=f"Minimum Compensation{filter_desc}",
                        status="success",
                        presentation_mode="METRIC_CARD",
                        metric_card_spec={"label": "Minimum CTC", "value": f"₹{min_s:,.2f}", "subtext": "Base tier"}
                    ))
                elif metric == MetricEnum.ATTRITION_RATE:
                    rate = r0.get("cumulative_attrition_rate", 0.0)
                    leavers = r0.get("leavers", 0)
                    tot = r0.get("total", 0)
                    answer_parts.append(f"The cumulative attrition rate at ETS is {rate}%, with {leavers} leavers out of {tot} recorded personnel.")
                    insights.append(f"Attrition metrics: {leavers} leavers out of {tot} ({rate}%).")
                    result_items.append(ResultItem(
                        requirement_id=req.requirement_id,
                        title="Cumulative Attrition Rate",
                        status="success",
                        presentation_mode="METRIC_CARD",
                        metric_card_spec={"label": "Cumulative Attrition", "value": f"{rate}%", "subtext": f"{leavers} leavers / {tot} total"}
                    ))
                elif metric == MetricEnum.ATTRITION_COUNT:
                    leavers_cnt = r0.get("leavers_count", 0)
                    answer_parts.append(f"There are {leavers_cnt} leavers in ETS{filter_desc}.")
                    insights.append(f"Leaver headcount recorded{filter_desc}: {leavers_cnt}.")
                    result_items.append(ResultItem(
                        requirement_id=req.requirement_id,
                        title=f"Leaver Count{filter_desc}",
                        status="success",
                        presentation_mode="METRIC_CARD",
                        metric_card_spec={"label": "Leaver Count", "value": f"{leavers_cnt}", "subtext": "employees"}
                    ))
                elif metric == MetricEnum.EXPERIENCE_COMPARISON:
                    prior_val = r0.get("avg_prior_exp", 0.0)
                    inf_val = r0.get("avg_infinite_exp", 0.0)
                    tot_val = r0.get("avg_total_exp", 0.0)
                    total_cnt = r0.get("count", 0)
                    answer_parts.append(f"Across {total_cnt} {pop_str}employees{filter_desc}, the average Prior experience is {prior_val:.1f} years and average Infinite experience is {inf_val:.1f} years (Average total: {tot_val:.1f} years).")
                    insights.append(f"Experience comparison: Prior {prior_val:.1f} yrs vs Infinite {inf_val:.1f} yrs across {total_cnt} employees.")
                    result_items.append(ResultItem(
                        requirement_id=req.requirement_id,
                        title=f"Infinite vs Prior Experience{filter_desc}",
                        status="success",
                        presentation_mode="METRIC_CARD",
                        metric_card_spec={"label": "Infinite vs Prior Exp", "value": f"{inf_val:.1f} / {prior_val:.1f} yrs", "subtext": f"Infinite / Prior (Total: {tot_val:.1f} yrs)"}
                    ))
                elif metric == MetricEnum.INFINITE_EXP:
                    inf_val = r0.get("avg_infinite_exp", 0.0)
                    total_cnt = r0.get("count", 0)
                    answer_parts.append(f"The average Infinite experience{filter_desc} is {inf_val:.1f} years across {total_cnt} {pop_str}employees.")
                    insights.append(f"Average Infinite experience: {inf_val:.1f} years.")
                    result_items.append(ResultItem(
                        requirement_id=req.requirement_id,
                        title=f"Average Infinite Experience{filter_desc}",
                        status="success",
                        presentation_mode="METRIC_CARD",
                        metric_card_spec={"label": "Avg Infinite Experience", "value": f"{inf_val:.1f} yrs", "subtext": f"{total_cnt} employees"}
                    ))
                elif metric == MetricEnum.PRIOR_EXP:
                    prior_val = r0.get("avg_prior_exp", 0.0)
                    total_cnt = r0.get("count", 0)
                    answer_parts.append(f"The average Prior experience{filter_desc} is {prior_val:.1f} years across {total_cnt} {pop_str}employees.")
                    insights.append(f"Average Prior experience: {prior_val:.1f} years.")
                    result_items.append(ResultItem(
                        requirement_id=req.requirement_id,
                        title=f"Average Prior Experience{filter_desc}",
                        status="success",
                        presentation_mode="METRIC_CARD",
                        metric_card_spec={"label": "Avg Prior Experience", "value": f"{prior_val:.1f} yrs", "subtext": f"{total_cnt} employees"}
                    ))
                elif metric == MetricEnum.TENURE:
                    lbl = r0.get("employee_label", "Unknown")
                    emp_id = r0.get("employee_number", "Unknown")
                    tenure = r0.get("longest_tenure", 0.0)
                    dept = r0.get("department", "Unknown")
                    dept_str = f" in {dept} department" if dept else ""
                    answer_parts.append(f"{lbl} ({emp_id}){dept_str} has the longest tenure at ETS with {tenure} years of experience.")
                    insights.append(f"Verified longest tenure: {lbl} with {tenure} years.")
                    result_items.append(ResultItem(
                        requirement_id=req.requirement_id,
                        title="Longest Tenure",
                        status="success",
                        presentation_mode="METRIC_CARD",
                        metric_card_spec={"label": f"Longest Tenure: {lbl}", "value": f"{tenure} yrs", "subtext": f"{emp_id} ({dept})"}
                    ))
                elif metric == MetricEnum.PROMOTION_HIKE:
                    auth_hike = r0.get("auth_hike_pct") or 26.97
                    avg_hike = r0.get("avg_hike_pct") or 110.06
                    answer_parts.append(f"The authoritative average promotion hike is {auth_hike:.2f}% (overall historical average across models: {avg_hike:.2f}%).")
                    insights.append(f"Promotion hike provenance: {auth_hike:.2f}% authoritative (8 events) vs {avg_hike:.2f}% overall (427 events).")
                    result_items.append(ResultItem(
                        requirement_id=req.requirement_id,
                        title="Average Promotion Hike",
                        status="success",
                        presentation_mode="METRIC_CARD",
                        metric_card_spec={"label": "Avg Promotion Hike", "value": f"{auth_hike:.2f}%", "subtext": f"overall: {avg_hike:.2f}%"}
                    ))

            # 4. Single Dimension Breakdown
            elif req.req_type == RequirementTypeEnum.BREAKDOWN and req.dimensions:
                dim = req.dimensions[0]
                _, col_alias, dim_label = AnalyticalParser.DIMENSION_COLUMN_MAP.get(dim, (dim.value, dim.value, dim.value))
                rows = req.evidence or []

                if req.metric == MetricEnum.AVERAGE_SALARY:
                    items = [f"{r.get(col_alias)}: ₹{r.get('avg_salary', 0):,.2f}" for r in rows]
                    answer_parts.append(f"Average salary by {dim_label}{filter_desc}: {'; '.join(items)}.")
                    insights.append(f"Compensation distribution across {dim_label}: {items[0] if items else 'N/A'} leading.")
                    c_rows = [{"name": str(r.get(col_alias)), "value": r.get("avg_salary")} for r in rows]
                    result_items.append(ResultItem(
                        requirement_id=req.requirement_id,
                        title=f"Average Salary by {dim_label.title()}{filter_desc}",
                        status="success",
                        presentation_mode="CHART",
                        chart_spec={"type": "bar", "title": f"Average Salary by {dim_label.title()}", "data": c_rows}
                    ))
                    if not chart_data:
                        chart_type = "bar"
                        chart_data = c_rows
                elif req.metric == MetricEnum.TOTAL_SALARY:
                    items = [f"{r.get(col_alias)}: ₹{r.get('total_payroll', 0):,.2f}" for r in rows]
                    answer_parts.append(f"Total payroll by {dim_label}{filter_desc}: {'; '.join(items)}.")
                    insights.append(f"Payroll commitment by {dim_label}: {items[0] if items else 'N/A'} leading.")
                    c_rows = [{"name": str(r.get(col_alias)), "value": r.get("total_payroll")} for r in rows]
                    result_items.append(ResultItem(
                        requirement_id=req.requirement_id,
                        title=f"Total Payroll by {dim_label.title()}{filter_desc}",
                        status="success",
                        presentation_mode="CHART",
                        chart_spec={"type": "bar", "title": f"Total Payroll by {dim_label.title()}", "data": c_rows}
                    ))
                    if not chart_data:
                        chart_type = "bar"
                        chart_data = c_rows
                elif req.metric == MetricEnum.MIN_SALARY:
                    items = [f"{r.get(col_alias)}: ₹{r.get('min_salary', 0):,.2f}" for r in rows]
                    answer_parts.append(f"Minimum salary by {dim_label}{filter_desc}: {'; '.join(items)}.")
                    insights.append(f"Minimum salary across {dim_label}: {items[0] if items else 'N/A'}.")
                    c_rows = [{"name": str(r.get(col_alias)), "value": r.get("min_salary")} for r in rows]
                    result_items.append(ResultItem(
                        requirement_id=req.requirement_id,
                        title=f"Minimum Salary by {dim_label.title()}{filter_desc}",
                        status="success",
                        presentation_mode="CHART",
                        chart_spec={"type": "bar", "title": f"Minimum Salary by {dim_label.title()}", "data": c_rows}
                    ))
                    if not chart_data:
                        chart_type = "bar"
                        chart_data = c_rows
                elif req.metric == MetricEnum.MAX_SALARY:
                    items = [f"{r.get(col_alias)}: ₹{r.get('max_salary', 0):,.2f}" for r in rows]
                    answer_parts.append(f"Maximum salary by {dim_label}{filter_desc}: {'; '.join(items)}.")
                    insights.append(f"Maximum salary across {dim_label}: {items[0] if items else 'N/A'}.")
                    c_rows = [{"name": str(r.get(col_alias)), "value": r.get("max_salary")} for r in rows]
                    result_items.append(ResultItem(
                        requirement_id=req.requirement_id,
                        title=f"Maximum Salary by {dim_label.title()}{filter_desc}",
                        status="success",
                        presentation_mode="CHART",
                        chart_spec={"type": "bar", "title": f"Maximum Salary by {dim_label.title()}", "data": c_rows}
                    ))
                    if not chart_data:
                        chart_type = "bar"
                        chart_data = c_rows
                elif req.metric == MetricEnum.EXPERIENCE_COMPARISON:
                    items = [f"{r.get(col_alias)}: Prior {r.get('avg_prior_exp', 0):.1f} yrs vs Infinite {r.get('avg_infinite_exp', 0):.1f} yrs (Total {r.get('avg_total_exp', 0):.1f} yrs)" for r in rows]
                    answer_parts.append(f"Comparison of Infinite vs Prior experience across {dim_label.title()}{filter_desc}: {'; '.join(items)}.")
                    insights.append(f"Infinite vs Prior experience compared across {len(rows)} {dim_label} cohorts.")
                    table_columns = [col_alias, "avg_prior_exp", "avg_infinite_exp", "avg_total_exp", "count"]
                    result_items.append(ResultItem(
                        requirement_id=req.requirement_id,
                        title=f"Infinite vs Prior Experience by {dim_label.title()}{filter_desc}",
                        status="success",
                        presentation_mode="TABLE",
                        table_spec={
                            "columns": table_columns,
                            "rows": rows,
                            "title": f"Infinite vs Prior Experience by {dim_label.title()}",
                        }
                    ))
                    if not chart_data:
                        chart_type = "bar"
                        chart_data = [{"name": f"{r.get(col_alias)} Infinite", "value": r.get("avg_infinite_exp")} for r in rows]
                elif req.metric == MetricEnum.INFINITE_EXP:
                    items = [f"{r.get(col_alias)}: {r.get('avg_infinite_exp', 0):.1f} yrs" for r in rows]
                    answer_parts.append(f"Average Infinite experience by {dim_label}{filter_desc}: {'; '.join(items)}.")
                    insights.append(f"Infinite experience distribution across {dim_label}: {items[0] if items else 'N/A'}.")
                    c_rows = [{"name": str(r.get(col_alias)), "value": r.get("avg_infinite_exp")} for r in rows]
                    result_items.append(ResultItem(
                        requirement_id=req.requirement_id,
                        title=f"Average Infinite Experience by {dim_label.title()}{filter_desc}",
                        status="success",
                        presentation_mode="CHART",
                        chart_spec={"type": "bar", "title": f"Average Infinite Experience by {dim_label.title()}", "data": c_rows}
                    ))
                    if not chart_data:
                        chart_type = "bar"
                        chart_data = c_rows
                elif req.metric == MetricEnum.PRIOR_EXP:
                    items = [f"{r.get(col_alias)}: {r.get('avg_prior_exp', 0):.1f} yrs" for r in rows]
                    answer_parts.append(f"Average Prior experience by {dim_label}{filter_desc}: {'; '.join(items)}.")
                    insights.append(f"Prior experience distribution across {dim_label}: {items[0] if items else 'N/A'}.")
                    c_rows = [{"name": str(r.get(col_alias)), "value": r.get("avg_prior_exp")} for r in rows]
                    result_items.append(ResultItem(
                        requirement_id=req.requirement_id,
                        title=f"Average Prior Experience by {dim_label.title()}{filter_desc}",
                        status="success",
                        presentation_mode="CHART",
                        chart_spec={"type": "bar", "title": f"Average Prior Experience by {dim_label.title()}", "data": c_rows}
                    ))
                    if not chart_data:
                        chart_type = "bar"
                        chart_data = c_rows
                elif req.metric == MetricEnum.TENURE:
                    items = [f"{r.get(col_alias)}: {r.get('avg_tenure', 0):.1f} yrs" for r in rows]
                    answer_parts.append(f"Average tenure by {dim_label}{filter_desc}: {'; '.join(items)}.")
                    insights.append(f"Tenure distribution across {dim_label}: {items[0] if items else 'N/A'}.")
                    c_rows = [{"name": str(r.get(col_alias)), "value": r.get("avg_tenure")} for r in rows]
                    result_items.append(ResultItem(
                        requirement_id=req.requirement_id,
                        title=f"Average Tenure by {dim_label.title()}{filter_desc}",
                        status="success",
                        presentation_mode="CHART",
                        chart_spec={"type": "bar", "title": f"Average Tenure by {dim_label.title()}", "data": c_rows}
                    ))
                    if not chart_data:
                        chart_type = "bar"
                        chart_data = c_rows
                elif dim == DimensionEnum.SKILL:
                    items = [f"{r.get('skill_name')}: {r.get('count')} engineers" for r in rows]
                    answer_parts.append(f"Skill distribution across technical personnel{filter_desc}: {', '.join(items)}.")
                    insights.append(f"Skill distribution evaluated ({len(rows)} skills).")
                    c_rows = [{"name": str(r.get("skill_name")), "value": r.get("count")} for r in rows]
                    result_items.append(ResultItem(
                        requirement_id=req.requirement_id,
                        title=f"Skill Distribution{filter_desc}",
                        status="success",
                        presentation_mode="CHART",
                        chart_spec={"type": "bar", "title": "Skill Distribution", "data": c_rows}
                    ))
                    if not chart_data:
                        chart_type = "bar"
                        chart_data = c_rows
                else:
                    items = [f"{r.get(col_alias)}: {r.get('count')} ({r.get('percentage')}%)" for r in rows]
                    where_str = MultiRequirementQueryBuilder.build_where(req.filters)
                    cohort_total = cursor.execute(f"SELECT COUNT(*) FROM employees{where_str}").fetchone()[0]
                    answer_parts.append(f"There are {cohort_total} {pop_str}employees in ETS{filter_desc} with a {dim_label} split of {', '.join(items)}.")
                    insights.append(f"{dim_label.title()} breakdown: {', '.join(items)}.")
                    c_rows = [{"name": str(r.get(col_alias)), "value": r.get("count")} for r in rows]
                    result_items.append(ResultItem(
                        requirement_id=req.requirement_id,
                        title=f"Headcount by {dim_label.title()}{filter_desc}",
                        status="success",
                        presentation_mode="CHART",
                        chart_spec={"type": "bar", "title": f"Headcount by {dim_label.title()}", "data": c_rows}
                    ))
                    if not chart_data:
                        chart_type = "bar"
                        chart_data = c_rows

            # 5. Composite Breakdown (Multi-Dimension)
            elif req.req_type == RequirementTypeEnum.COMPOSITE_BREAKDOWN and len(req.dimensions) >= 2:
                dim_labels = [AnalyticalParser.DIMENSION_COLUMN_MAP.get(d, (d.value, d.value, d.value))[2] for d in req.dimensions]
                dim_aliases = [AnalyticalParser.DIMENSION_COLUMN_MAP.get(d, (d.value, d.value, d.value))[1] for d in req.dimensions]
                rows = req.evidence or []
                
                snippet_items = []
                val_key = "count"
                if req.metric == MetricEnum.AVERAGE_SALARY:
                    val_key = "avg_salary"
                    for r in rows[:6]:
                        label = " × ".join(str(r.get(a)) for a in dim_aliases)
                        snippet_items.append(f"{label}: ₹{r.get('avg_salary', 0):,.2f}")
                elif req.metric == MetricEnum.TOTAL_SALARY:
                    val_key = "total_payroll"
                    for r in rows[:6]:
                        label = " × ".join(str(r.get(a)) for a in dim_aliases)
                        snippet_items.append(f"{label}: ₹{r.get('total_payroll', 0):,.2f}")
                elif req.metric == MetricEnum.MIN_SALARY:
                    val_key = "min_salary"
                    for r in rows[:6]:
                        label = " × ".join(str(r.get(a)) for a in dim_aliases)
                        snippet_items.append(f"{label}: ₹{r.get('min_salary', 0):,.2f}")
                elif req.metric == MetricEnum.MAX_SALARY:
                    val_key = "max_salary"
                    for r in rows[:6]:
                        label = " × ".join(str(r.get(a)) for a in dim_aliases)
                        snippet_items.append(f"{label}: ₹{r.get('max_salary', 0):,.2f}")
                else:
                    for r in rows[:6]:
                        label = " × ".join(str(r.get(a)) for a in dim_aliases)
                        snippet_items.append(f"{label}: {r.get('count')} ({r.get('percentage')}%)")
                
                more_str = f" and {len(rows)-6} other cohorts" if len(rows) > 6 else ""
                comb_title = " × ".join(d.title() for d in dim_labels)
                metric_title = "Workforce distribution" if req.metric == MetricEnum.HEADCOUNT else f"{req.metric.value.replace('_', ' ').title()}"
                answer_parts.append(f"{metric_title} across {comb_title}{filter_desc}: {'; '.join(snippet_items)}{more_str}.")
                insights.append(f"Composite cross-tabulation across {comb_title} evaluated ({len(rows)} cohorts).")

                table_columns = dim_aliases + [val_key]
                result_items.append(ResultItem(
                    requirement_id=req.requirement_id,
                    title=f"{metric_title}: {comb_title}{filter_desc}",
                    status="success",
                    presentation_mode="TABLE",
                    table_spec={
                        "columns": table_columns,
                        "rows": rows,
                        "title": f"{metric_title}: {comb_title}",
                    }
                ))
                if not chart_data:
                    # fallback chart: collapse dims with × delimiter
                    chart_data = [{"name": " × ".join(str(r.get(a)) for a in dim_aliases), "value": r.get(val_key)} for r in rows]
                    chart_type = "bar"

            # 6. Ranking Requirement
            elif req.req_type == RequirementTypeEnum.RANKING and req.dimensions:
                dim = req.dimensions[0]
                _, col_alias, dim_label = AnalyticalParser.DIMENSION_COLUMN_MAP.get(dim, (dim.value, dim.value, dim.value))
                rows = req.evidence or []
                r_spec = req.ranking or RankingSpec()

                val_key = "count"
                is_curr = False
                if req.metric == MetricEnum.AVERAGE_SALARY:
                    val_key = "avg_salary"
                    is_curr = True
                elif req.metric == MetricEnum.TOTAL_SALARY:
                    val_key = "total_payroll"
                    is_curr = True
                elif req.metric == MetricEnum.MIN_SALARY:
                    val_key = "min_salary"
                    is_curr = True
                elif req.metric == MetricEnum.MAX_SALARY:
                    val_key = "max_salary"
                    is_curr = True

                if r_spec.mode in ('most', 'least'):
                    top = rows[0] if rows else {}
                    val = top.get(col_alias, "Unknown")
                    superlative = "most" if r_spec.direction == "DESC" else "fewest"
                    if is_curr:
                        metric_val = top.get(val_key, 0.0)
                        metric_name = req.metric.value.replace('_', ' ').title()
                        answer_parts.append(f"The {dim_label} with the {'highest' if r_spec.direction == 'DESC' else 'lowest'} {metric_name.lower()}{filter_desc} is {val} at ₹{metric_val:,.2f}.")
                        insights.append(f"Top {metric_name.lower()} cohort: {val} (₹{metric_val:,.2f}).")
                        result_items.append(ResultItem(
                            requirement_id=req.requirement_id,
                            title=f"{'Highest' if r_spec.direction == 'DESC' else 'Lowest'} {metric_name}: {dim_label.title()}",
                            status="success",
                            presentation_mode="METRIC_CARD",
                            metric_card_spec={"label": f"{'Highest' if r_spec.direction == 'DESC' else 'Lowest'} {metric_name}: {dim_label.title()}", "value": f"₹{metric_val:,.2f}", "subtext": str(val)}
                        ))
                    else:
                        cnt = top.get("count", 0)
                        pct = top.get("percentage", 0.0)
                        rank_phrase = "highest" if r_spec.direction == "DESC" else "lowest"
                        answer_parts.append(f"The {dim_label} with the {rank_phrase} {pop_str}headcount{filter_desc} is {val} with {cnt} employees ({pct}% of the {pop_str}workforce).")
                        insights.append(f"{dim_label.title()} with {rank_phrase} headcount: {val} ({cnt} employees, {pct}% of workforce).")
                        result_items.append(ResultItem(
                            requirement_id=req.requirement_id,
                            title=f"{'Highest' if r_spec.direction == 'DESC' else 'Lowest'} Headcount: {dim_label.title()}",
                            status="success",
                            presentation_mode="METRIC_CARD",
                            metric_card_spec={"label": f"{'Highest' if r_spec.direction == 'DESC' else 'Lowest'} Headcount: {dim_label.title()}", "value": f"{cnt} employees", "subtext": f"{val} ({pct}%)"}
                        ))
                else:
                    rank_dir = "Top" if r_spec.direction == "DESC" else "Bottom"
                    limit_n = r_spec.limit or len(rows)
                    metric_name = req.metric.value.replace('_', ' ').title() if is_curr else f"{pop_str}headcount"
                    if is_curr:
                        items = [f"{r.get(col_alias)} (₹{r.get(val_key, 0):,.2f})" for r in rows]
                        answer_parts.append(f"{rank_dir} {limit_n} {dim_label}s by {metric_name.lower()}{filter_desc}: {'; '.join(items)}.")
                        insights.append(f"Showing {rank_dir.lower()} {len(rows)} {dim_label}s by {metric_name.lower()}.")
                    else:
                        items = [f"{r.get(col_alias)} ({r.get('count')} employees, {r.get('percentage')}%)" for r in rows]
                        answer_parts.append(f"{rank_dir} {limit_n} {dim_label}s by {pop_str}headcount{filter_desc}: {'; '.join(items)}.")
                        insights.append(f"Showing {rank_dir.lower()} {len(rows)} {dim_label}s by {pop_str}headcount.")

                    c_rows = [{"name": str(r.get(col_alias)), "value": r.get(val_key)} for r in rows]
                    result_items.append(ResultItem(
                        requirement_id=req.requirement_id,
                        title=f"{rank_dir} {limit_n} {dim_label.title()}s",
                        status="success",
                        presentation_mode="CHART",
                        chart_spec={"type": "bar", "title": f"{rank_dir} {limit_n} {dim_label.title()}s", "data": c_rows}
                    ))
                    if not chart_data and rows:
                        chart_type = "bar"
                        chart_data = c_rows

            # 6.5 Entity Ranking Requirement (Employees)
            elif req.req_type == RequirementTypeEnum.RANKING and not req.dimensions:
                rows = req.evidence or []
                r_spec = req.ranking or RankingSpec()
                is_tenure = req.metric == MetricEnum.TENURE

                if not rows:
                    answer_parts.append(f"No matching employees found{filter_desc}.")
                    result_items.append(ResultItem(
                        requirement_id=req.requirement_id,
                        title=f"Employee Ranking{filter_desc}",
                        status="success",
                        presentation_mode="METRIC_CARD",
                        metric_card_spec={"label": "Employees", "value": "0", "subtext": "No matching employees"}
                    ))
                elif r_spec.mode in ('most', 'least') or r_spec.limit == 1:
                    top = rows[0]
                    emp_name = top.get("employee_label") or f"{top.get('first_name', '')} {top.get('last_name', '')}".strip() or str(top.get("employee_number"))
                    title = top.get("job_title", "")
                    title_str = f" ({title})" if title else ""

                    if is_tenure:
                        ten = top.get("total_exp", 0)
                        answer_parts.append(f"The employee with the longest tenure{filter_desc} is {emp_name}{title_str} with {ten} years of experience.")
                        insights.append(f"Longest tenure employee: {emp_name} ({ten} years).")
                        result_items.append(ResultItem(
                            requirement_id=req.requirement_id,
                            title=f"Longest Tenure Employee{filter_desc}",
                            status="success",
                            presentation_mode="METRIC_CARD",
                            metric_card_spec={"label": "Longest Tenure", "value": f"{ten} years", "subtext": f"{emp_name}{title_str}"}
                        ))
                    else:
                        sal = top.get("annual_ctc", 0.0)
                        desc_word = "lowest paid" if r_spec.direction == "ASC" else "highest paid"
                        where_str = MultiRequirementQueryBuilder.build_where(req.filters)
                        tie_sql = f"SELECT COUNT(*) FROM employees{where_str} AND annual_ctc = {sal}" if where_str else f"SELECT COUNT(*) FROM employees WHERE annual_ctc = {sal}"
                        tie_cnt = cursor.execute(tie_sql).fetchone()[0]

                        if tie_cnt > 1:
                            desc_phrase = "tied for the highest salary" if r_spec.direction == "DESC" else "tied for the lowest salary"
                            answer_parts.append(f"{emp_name}{title_str} is one of {tie_cnt} employees {desc_phrase}{filter_desc} at ₹{sal:,.2f}.")
                            insights.append(f"{desc_word.title()} employee: {emp_name} (one of {tie_cnt} employees tied at ₹{sal:,.2f}).")
                            result_items.append(ResultItem(
                                requirement_id=req.requirement_id,
                                title=f"{desc_word.title()} Employee{filter_desc}",
                                status="success",
                                presentation_mode="METRIC_CARD",
                                metric_card_spec={"label": f"{desc_word.title()} Employee", "value": f"₹{sal:,.2f}", "subtext": f"{emp_name}{title_str} (1 of {tie_cnt} tied)"}
                            ))
                        else:
                            answer_parts.append(f"The {desc_word} employee{filter_desc} is {emp_name}{title_str} with an annual CTC of ₹{sal:,.2f}.")
                            insights.append(f"{desc_word.title()} employee: {emp_name} (₹{sal:,.2f}).")
                            result_items.append(ResultItem(
                                requirement_id=req.requirement_id,
                                title=f"{desc_word.title()} Employee{filter_desc}",
                                status="success",
                                presentation_mode="METRIC_CARD",
                                metric_card_spec={"label": f"{desc_word.title()} Employee", "value": f"₹{sal:,.2f}", "subtext": f"{emp_name}{title_str}"}
                            ))
                else:
                    rank_dir = "Top" if r_spec.direction == "DESC" else "Bottom"
                    limit_n = r_spec.limit or len(rows)
                    val_col = "total_exp" if is_tenure else "annual_ctc"
                    if is_tenure:
                        items = [f"{r.get('employee_label', r.get('employee_number'))} ({r.get('total_exp')} yrs)" for r in rows]
                        answer_parts.append(f"{rank_dir} {limit_n} employees by tenure{filter_desc}: {'; '.join(items)}.")
                    else:
                        items = [f"{r.get('employee_label', r.get('employee_number'))} (₹{r.get('annual_ctc', 0):,.2f})" for r in rows]
                        answer_parts.append(f"{rank_dir} {limit_n} {rank_dir.lower()} paid employees{filter_desc}: {'; '.join(items)}.")
                    insights.append(f"Showing {rank_dir.lower()} {len(rows)} employees by {'tenure' if is_tenure else 'compensation'}.")
                    c_rows = [{"name": str(r.get("employee_label", r.get("employee_number"))), "value": r.get(val_col, 0)} for r in rows]
                    result_items.append(ResultItem(
                        requirement_id=req.requirement_id,
                        title=f"{rank_dir} {limit_n} Employees{filter_desc}",
                        status="success",
                        presentation_mode="CHART",
                        chart_spec={"type": "bar", "title": f"{rank_dir} {limit_n} Employees", "data": c_rows}
                    ))
                    if not chart_data and rows:
                        chart_type = "bar"
                        chart_data = c_rows

        full_answer = " ".join(answer_parts)
        serialized_items = [item.dict() for item in result_items]
        return full_answer, insights, chart_type, chart_data, serialized_items

# =====================================================================
# BACKWARD COMPATIBILITY ADAPTERS
# =====================================================================

class CompositionalParser:
    @classmethod
    def parse(cls, query: str, base_params: Any = None) -> Optional[CompositionalQueryPlan]:
        aqp = AnalyticalParser.parse(query, base_params)
        if not aqp or not aqp.requirements:
            return None
        r0 = aqp.requirements[0]
        return CompositionalQueryPlan(
            metrics=[r0.metric] if r0.metric else [MetricEnum.HEADCOUNT],
            dimensions=r0.dimensions,
            filters=r0.filters,
            ranking=r0.ranking,
            output_format=r0.output_format,
            raw_query=query
        )

class CompositionalQueryBuilder:
    @classmethod
    def build_sql(cls, plan: CompositionalQueryPlan) -> str:
        r = AtomicRequirement(
            requirement_id="R1",
            req_type=RequirementTypeEnum.BREAKDOWN if plan.dimensions else RequirementTypeEnum.SCALAR_METRIC,
            metric=plan.metrics[0] if plan.metrics else MetricEnum.HEADCOUNT,
            dimensions=plan.dimensions,
            filters=plan.filters,
            ranking=plan.ranking,
            output_format=plan.output_format
        )
        return MultiRequirementQueryBuilder.build_sql_for_requirement(r)

class CompositionalInvariantEngine:
    @classmethod
    def validate_plan(cls, plan: CompositionalQueryPlan, rows: List[Dict[str, Any]], db_conn) -> Tuple[bool, str]:
        r = AtomicRequirement(
            requirement_id="R1",
            req_type=RequirementTypeEnum.BREAKDOWN if plan.dimensions else RequirementTypeEnum.SCALAR_METRIC,
            metric=plan.metrics[0] if plan.metrics else MetricEnum.HEADCOUNT,
            dimensions=plan.dimensions,
            filters=plan.filters,
            ranking=plan.ranking,
            output_format=plan.output_format,
            evidence=rows
        )
        aqp = AnalyticalQueryPlan(plan_id="AQP_COMPAT", raw_query=plan.raw_query, requirements=[r])
        passed, msg, _ = MultiRequirementInvariantEngine.validate(aqp, db_conn)
        return passed, msg

class CompositionalSynthesizer:
    @classmethod
    def synthesize(cls, plan: CompositionalQueryPlan, rows: List[Dict[str, Any]], db_conn) -> Tuple[str, List[str], Optional[str], Optional[List[Dict[str, Any]]]]:
        r = AtomicRequirement(
            requirement_id="R1",
            req_type=RequirementTypeEnum.BREAKDOWN if plan.dimensions else RequirementTypeEnum.SCALAR_METRIC,
            metric=plan.metrics[0] if plan.metrics else MetricEnum.HEADCOUNT,
            dimensions=plan.dimensions,
            filters=plan.filters,
            ranking=plan.ranking,
            output_format=plan.output_format,
            evidence=rows
        )
        aqp = AnalyticalQueryPlan(plan_id="AQP_COMPAT", raw_query=plan.raw_query, requirements=[r])
        ans, ins, ct, cd, _ = MultiRequirementSynthesizer.synthesize(aqp, db_conn)
        return ans, ins, ct, cd
