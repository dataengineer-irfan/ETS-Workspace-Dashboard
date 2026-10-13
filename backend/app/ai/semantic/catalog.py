"""
ETS Genie — Semantic Catalog.

The catalog is the *only* place where the semantic engine learns what exists in ETS.

* Fields, dimensions and measures map semantic keys to physical SQL expressions.
* Categorical values are loaded LIVE from the authoritative SQLite tables
  (never hard-coded), so the parser can only bind values that really exist.
* Concept lexicons (aggregations, ranking, comparison, structure nouns, unsupported
  concepts, evaluative terms ...) are declarative data consumed by the tagger.
  No control flow lives here.
"""
from __future__ import annotations

import re
import threading
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Physical model
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class FieldDef:
    key: str
    label: str
    sql: str                       # expression over alias e (employees) unless table says otherwise
    ftype: str                     # "categorical" | "numeric" | "date" | "text"
    table: str = "employees"       # "employees" | "skills" | "leaves" | "finance"
    groupable: bool = True
    filterable: bool = True
    plural: str = ""
    unit: Optional[str] = None


AGE_GROUP_SQL = (
    "CASE WHEN e.age < 25 THEN 'Under 25' "
    "WHEN e.age BETWEEN 25 AND 29 THEN '25-29' "
    "WHEN e.age BETWEEN 30 AND 34 THEN '30-34' "
    "WHEN e.age BETWEEN 35 AND 39 THEN '35-39' "
    "WHEN e.age BETWEEN 40 AND 44 THEN '40-44' "
    "WHEN e.age BETWEEN 45 AND 49 THEN '45-49' "
    "ELSE '50+' END"
)

FIELDS: Dict[str, FieldDef] = {
    "department": FieldDef("department", "Department", "e.department", "categorical", plural="departments"),
    "location": FieldDef("location", "Location", "e.location", "categorical", plural="locations"),
    "state": FieldDef("state", "Project State", "e.state", "categorical", plural="states"),
    "project": FieldDef("project", "Project", "e.project", "categorical", plural="projects"),
    "gender": FieldDef("gender", "Gender", "e.gender", "categorical", plural="genders"),
    "job_level": FieldDef("job_level", "Grade", "e.job_level", "categorical", plural="grades"),
    "job_title": FieldDef("job_title", "Job Title", "e.job_title", "categorical", plural="job titles"),
    "salary_band": FieldDef("salary_band", "Salary Band", "e.salary_bin", "categorical", plural="salary bands"),
    "status": FieldDef("status", "Employment Status", "e.current_status", "categorical", plural="statuses"),
    "manager": FieldDef("manager", "Manager", "e.manager", "categorical", plural="managers"),
    "age_group": FieldDef("age_group", "Age Group", AGE_GROUP_SQL, "categorical", plural="age groups"),
    "primary_skill": FieldDef("primary_skill", "Primary Skill", "e.primary_skill", "categorical", plural="primary skills"),
    "skill": FieldDef("skill", "Skill", "s.skill_name", "categorical", table="skills", plural="skills"),
    "leave_type": FieldDef("leave_type", "Leave Type", "l.leave_type", "categorical", table="leaves", plural="leave types"),
    "year": FieldDef("year", "Year", "f.year", "categorical", table="finance", plural="years"),
    "is_promotion": FieldDef("is_promotion", "Is Promotion", "f.is_promotion", "categorical", table="finance", plural="promotions"),
    # numeric row-level fields (row thresholds / listings)
    "ctc": FieldDef("ctc", "Annual CTC", "e.annual_ctc", "numeric", groupable=False, unit="INR"),
    "monthly_salary": FieldDef("monthly_salary", "Monthly Salary", "e.monthly_salary", "numeric", groupable=False, unit="INR"),
    "tenure": FieldDef("tenure", "Tenure at ETS", "e.infinite_exp", "numeric", groupable=False, unit="years"),
    "experience": FieldDef("experience", "Total Experience", "e.total_exp", "numeric", groupable=False, unit="years"),
    "prior_experience": FieldDef("prior_experience", "Prior Experience", "e.prior_exp", "numeric", groupable=False, unit="years"),
    "age": FieldDef("age", "Age", "e.age", "numeric", groupable=False, unit="years"),
    "skill_count": FieldDef("skill_count", "Recorded Skills", "COALESCE(sk.skill_cnt, 0)", "numeric", groupable=False, unit="skills"),
    "leave_days": FieldDef("leave_days", "Leave Days", "COALESCE(lv.leave_days, 0)", "numeric", groupable=False, unit="days"),
    "employee_number": FieldDef("employee_number", "Employee Number", "e.employee_number", "numeric", groupable=False, filterable=True),
}


@dataclass(frozen=True)
class MeasureDef:
    key: str
    label: str
    row_field: Optional[str]           # numeric FieldDef key aggregated by AVG/SUM/MIN/MAX/MEDIAN
    allowed_aggs: Tuple[str, ...]
    default_agg: str
    unit: str                          # "count" | "INR" | "years" | "pct" | "skills" | "days"
    definition: str
    table: str = "employees"           # "employees" | "finance"
    needs: Tuple[str, ...] = ()        # auxiliary joins: "skill_agg", "leave_agg"
    better: Optional[str] = None       # "HIGHER" | "LOWER" | None (no defined polarity)
    intrinsic_agg: bool = False        # agg is part of the concept (headcount, attrition, share)
    caveat: Optional[str] = None


MEASURES: Dict[str, MeasureDef] = {
    "headcount": MeasureDef(
        "headcount", "Headcount", None, ("COUNT",), "COUNT", "count",
        "Number of employee records matching the criteria.", intrinsic_agg=True),
    "ctc": MeasureDef(
        "ctc", "Annual CTC", "ctc", ("AVG", "SUM", "MIN", "MAX", "MEDIAN"), "AVG", "INR",
        "Annual cost-to-company (annual_ctc) from the employee master."),
    "monthly_salary": MeasureDef(
        "monthly_salary", "Monthly Salary", "monthly_salary", ("AVG", "SUM", "MIN", "MAX", "MEDIAN"), "AVG", "INR",
        "Monthly salary (monthly_salary) from the employee master."),
    "tenure": MeasureDef(
        "tenure", "Tenure", "tenure", ("AVG", "SUM", "MIN", "MAX", "MEDIAN"), "AVG", "years",
        "Years of service at ETS (infinite_exp)."),
    "experience": MeasureDef(
        "experience", "Total Experience", "experience", ("AVG", "SUM", "MIN", "MAX", "MEDIAN"), "AVG", "years",
        "Total professional experience in years (total_exp)."),
    "prior_experience": MeasureDef(
        "prior_experience", "Prior Experience", "prior_experience", ("AVG", "SUM", "MIN", "MAX", "MEDIAN"), "AVG", "years",
        "Experience before joining ETS in years (prior_exp)."),
    "age": MeasureDef(
        "age", "Age", "age", ("AVG", "MIN", "MAX", "MEDIAN"), "AVG", "years",
        "Current age in years derived from date of birth."),
    "attrition": MeasureDef(
        "attrition", "Attrition Rate", None, ("RATE",), "RATE", "pct",
        "Cumulative attrition = employees with status Exited / all employee records in the group x 100.",
        better="LOWER", intrinsic_agg=True,
        caveat="Cumulative (not annualised) attrition over all recorded employees."),
    "concentration": MeasureDef(
        "concentration", "Employee Concentration", None, ("SHARE",), "SHARE", "pct",
        "Share of the analysed employee population that falls in the group (group headcount / population headcount x 100).",
        intrinsic_agg=True),
    "skill_coverage": MeasureDef(
        "skill_coverage", "Skill Coverage", "skill_count", ("AVG", "SUM", "MIN", "MAX", "MEDIAN"), "AVG", "skills",
        "Average number of distinct skills recorded per employee in the skills table.",
        needs=("skill_agg",), better="HIGHER"),
    "leave_utilization": MeasureDef(
        "leave_utilization", "Leave Utilization", "leave_days", ("AVG", "SUM", "MIN", "MAX", "MEDIAN"), "AVG", "days",
        "Average leave days recorded per employee (sum of day_value in the leaves table / employees in the group).",
        needs=("leave_agg",),
        caveat="Leave records exist for only a subset of employees; employees without leave records count as 0 days."),
    "hike": MeasureDef(
        "hike", "Salary Hike", None, ("AVG", "MIN", "MAX"), "AVG", "pct",
        "Year-on-year hike percentage from authoritative (non-synthetic) finance history records.",
        table="finance",
        caveat="Only authoritative Excel-sourced finance history records are used; synthetic derived records are excluded."),
    "bonus": MeasureDef(
        "bonus", "Bonus", None, ("AVG", "SUM", "MIN", "MAX"), "AVG", "INR",
        "Bonus amount from authoritative (non-synthetic) finance history records.",
        table="finance",
        caveat="Only authoritative Excel-sourced finance history records are used; synthetic derived records are excluded."),
    "promotions": MeasureDef(
        "promotions", "Promotions", None, ("COUNT",), "COUNT", "count",
        "Number of authoritative finance history records flagged as promotions.",
        table="finance", intrinsic_agg=True,
        caveat="Only authoritative Excel-sourced finance history records are used; synthetic derived records are excluded."),
}

FINANCE_DIMENSIONS = {"year", "department", "location", "state", "job_level", "gender", "status", "job_title", "salary_band", "age_group", "project"}


# ---------------------------------------------------------------------------
# Lexicon (declarative concept vocabulary)
# Each entry: surface phrase (lower-case, space separated) -> (kind, payload)
# ---------------------------------------------------------------------------

DIMENSION_NOUNS: Dict[str, List[str]] = {
    "department": ["department", "departments", "dept", "depts", "business unit", "business units", "division", "divisions"],
    "location": ["location", "locations", "city", "cities", "office", "offices", "site", "sites", "base location", "work location", "delivery location", "delivery locations", "delivery center", "delivery centers"],
    "state": ["state", "states", "project state", "project states"],
    "project": ["project", "projects", "program", "programs", "account", "accounts"],
    "gender": ["gender", "genders", "sex"],
    "job_level": ["grade", "grades", "job level", "job levels", "level", "levels", "seniority level", "seniority levels", "career level", "career levels", "band level"],
    "job_title": ["job title", "job titles", "title", "titles", "designation", "designations", "role", "roles", "position", "positions", "job role", "job roles"],
    "salary_band": ["salary band", "salary bands", "salary bin", "salary bins", "pay band", "pay bands", "salary bracket", "salary brackets", "ctc band", "ctc bands", "salary range", "salary ranges", "compensation band", "compensation bands", "band", "bands"],
    "status": ["status", "employment status", "employee status", "statuses"],
    "manager": ["manager", "managers", "reporting manager", "reporting managers", "supervisor", "supervisors", "delivery manager", "delivery managers"],
    "age_group": ["age group", "age groups", "age band", "age bands", "age bracket", "age brackets", "age range", "age ranges", "age cohort", "age cohorts", "age distribution", "age breakdown"],
    "primary_skill": ["primary skill", "primary skills"],
    "skill": ["skill", "skills", "technology", "technologies", "tech stack", "tech stacks", "competency", "competencies", "skill set", "skillset", "skill sets"],
    "leave_type": ["leave type", "leave types", "type of leave", "types of leave", "leave category", "leave categories"],
    "year": ["year", "years", "financial year", "fiscal year"],
}
PLURAL_DIMENSION_FORMS = {
    p for forms in DIMENSION_NOUNS.values() for p in forms
    if p.endswith("s") and p not in {"status", "sex", "years"}
} | {"cities", "statuses", "competencies", "technologies", "skillset"}

MEASURE_NOUNS: Dict[str, List[str]] = {
    "headcount": ["headcount", "head count", "headcounts", "employee count", "staff count", "staff strength", "workforce size",
                  "team size", "number of employees", "number of people", "number of staff", "employee strength", "strength",
                  "size", "population size", "count of employees", "employee numbers"],
    "ctc": ["ctc", "annual ctc", "salary", "salaries", "compensation", "pay", "package", "packages", "earnings",
            "earns", "earn", "earning", "earner", "earners", "top earner", "top earners", "highest earner", "highest earners",
            "highest paid", "highest-paid", "lowest paid", "paid",
            "annual salary", "remuneration", "cost to company", "cost-to-company", "payroll", "salary cost", "payroll cost",
            "compensation cost", "wage", "wages", "income", "cost"],
    "monthly_salary": ["monthly salary", "monthly pay", "monthly compensation", "monthly ctc"],
    "tenure": ["tenure", "tenures", "years of service", "service years", "length of service", "time at ets", "years at ets",
               "years with ets", "time with ets", "service tenure", "company tenure", "seniority in years", "longevity"],
    "experience": ["experience", "total experience", "work experience", "overall experience", "years of experience", "industry experience"],
    "prior_experience": ["prior experience", "previous experience", "experience before ets", "pre-ets experience", "prior exp"],
    "age": ["age", "ages", "employee age"],
    "attrition": ["attrition", "attrition rate", "attrition rates", "turnover", "turnover rate", "churn", "churn rate",
                  "exit rate", "attrition percentage", "separation rate", "leaver rate", "attrition %"],
    "concentration": ["employee concentration", "concentration", "workforce concentration", "share", "workforce share",
                      "share of employees", "share of workforce", "proportion", "proportion of employees",
                      "percentage of employees", "percent of employees", "% of employees", "% of workforce", "headcount share",
                      "representation", "density"],
    "skill_coverage": ["skill coverage", "skills coverage", "skill breadth", "skills breadth", "number of skills",
                       "skill count", "skills count", "skills per employee", "skill depth", "capability coverage"],
    "leave_utilization": ["leave utilization", "leave utilisation", "leave usage", "leave days", "leaves taken", "leave taken",
                          "days of leave", "leave consumption", "leave", "leaves", "time off", "leave balance used"],
    "hike": ["hike", "hikes", "salary hike", "salary hikes", "increment", "increments", "raise", "raises", "appraisal hike",
             "pay rise", "hike percentage", "hike %", "promotion hike", "promotion hikes"],
    "bonus": ["bonus", "bonuses", "bonus payout", "bonus payouts"],
    "promotions": ["promotions", "promotion count", "number of promotions", "promotion"],
}
# measures that imply a SUM aggregation in their surface form
SUM_IMPLYING_MEASURE_PHRASES = {"payroll", "salary cost", "payroll cost", "compensation cost", "cost"}

AGG_WORDS: Dict[str, str] = {
    "average": "AVG", "avg": "AVG", "mean": "AVG", "typical": "AVG", "avg.": "AVG", "per capita": "AVG", "per-employee": "AVG",
    "total": "SUM", "sum": "SUM", "overall": "SUM", "aggregate": "SUM", "combined": "SUM", "cumulative": "SUM",
    "minimum": "MIN", "min": "MIN", "min.": "MIN",
    "maximum": "MAX", "max": "MAX", "max.": "MAX",
    "median": "MEDIAN",
}

COUNT_CUES = ["how many", "number of", "count of", "count", "total number of", "headcount of", "how big", "how large"]

RANK_WORDS: Dict[str, str] = {
    "highest": "DESC", "most": "DESC", "largest": "DESC", "biggest": "DESC", "greatest": "DESC", "top": "DESC",
    "maximum": "DESC", "max": "DESC", "peak": "DESC", "leading": "DESC", "longest": "DESC", "oldest": "DESC",
    "richest": "DESC", "best-paid": "DESC", "best paid": "DESC", "highest-paid": "DESC", "highest paid": "DESC",
    "lowest": "ASC", "least": "ASC", "fewest": "ASC", "smallest": "ASC", "bottom": "ASC", "minimum": "ASC", "min": "ASC",
    "shortest": "ASC", "youngest": "ASC", "lowest-paid": "ASC", "lowest paid": "ASC", "newest": "ASC",
}
# superlatives that carry an implied measure
RANK_IMPLIED_MEASURE = {
    "longest": "tenure", "shortest": "tenure", "oldest": "age", "youngest": "age", "newest": "tenure",
    "richest": "ctc", "best-paid": "ctc", "best paid": "ctc", "highest-paid": "ctc", "highest paid": "ctc",
    "lowest-paid": "ctc", "lowest paid": "ctc",
}

COMPARATIVE_WORDS: Dict[str, str] = {
    "higher": "HIGHER", "more": "HIGHER", "larger": "HIGHER", "bigger": "HIGHER", "greater": "HIGHER", "longer": "HIGHER",
    "older": "HIGHER", "costlier": "HIGHER", "richer": "HIGHER",
    "lower": "LOWER", "less": "LOWER", "fewer": "LOWER", "smaller": "LOWER", "shorter": "LOWER", "younger": "LOWER", "cheaper": "LOWER",
}

THRESHOLD_PHRASES: Dict[str, str] = {
    "above": ">", "over": ">", "more than": ">", "greater than": ">", "higher than": ">", "exceeding": ">", "exceeds": ">",
    "exceed": ">", "beyond": ">", "in excess of": ">", "upwards of": ">", ">": ">",
    "at least": ">=", "minimum of": ">=", "no less than": ">=", "not less than": ">=", ">=": ">=", "or more": ">=",
    "below": "<", "under": "<", "less than": "<", "fewer than": "<", "lower than": "<", "<": "<", "beneath": "<",
    "at most": "<=", "maximum of": "<=", "no more than": "<=", "not more than": "<=", "up to": "<=", "<=": "<=", "or less": "<=",
}
RELATIVE_AVG_PHRASES: Dict[str, str] = {
    "above average": ">", "above-average": ">", "higher than average": ">", "more than average": ">",
    "above the average": ">", "above the overall average": ">", "above the company average": ">",
    "below average": "<", "below-average": "<", "lower than average": "<", "less than average": "<",
    "below the average": "<", "below the overall average": "<", "below the company average": "<",
}

COMPARE_CUES = ["compare", "compared", "comparing", "comparison", "versus", "vs", "vs.", "relative to", "differ", "differs",
                "difference", "differences", "contrast", "against", "how does", "stack up", "gap between", "gap in", "gap"]
GAP_NOUNS = ["gap", "gaps", "difference", "spread", "disparity", "variance", "range", "delta"]
OUTLIER_PHRASES = ["most unusual", "unusual", "stands out", "stand out", "stands out most", "outlier", "outliers", "anomalous",
                   "anomaly", "anomalies", "most different", "deviates", "deviate", "deviation", "atypical", "out of line"]
BASELINE_PHRASES = ["overall ets baseline", "ets baseline", "overall baseline", "baseline", "company average", "ets average",
                    "overall average", "organisation average", "organization average", "company-wide average", "the overall ets",
                    "the rest of ets", "rest of the company", "rest of ets", "everyone else", "all employees", "entire workforce",
                    "whole company", "the company", "overall workforce"]

GROUP_PREPS = ["by", "per", "across", "for each", "for every", "each", "every", "within each", "in each", "grouped by",
               "broken down by", "break down by", "split by", "segmented by", "wise", "-wise", "among", "between the"]
STRATIFY_PHRASES = ["controlling for", "after controlling for", "adjusting for", "after adjusting for", "holding constant",
                    "stratified by", "within the same", "conditioning on", "accounting for", "normalised for", "normalized for"]

STRUCTURE_NOUNS = ["combination", "combinations", "segment", "segments", "group", "groups", "cohort", "cohorts", "population",
                   "populations", "bucket", "buckets", "slice", "slices", "category", "categories", "breakdown", "breakdowns",
                   "distribution", "distributions", "split", "matrix", "mix", "profile", "profiles", "pair", "pairs", "cell", "cells",
                   "cross-section", "intersection", "intersections", "cluster", "clusters", "subgroup", "subgroups", "analysis",
                   "metric", "metrics", "measure", "measures", "figure", "figures", "number", "numbers", "value", "values",
                   "level-wise", "view", "picture", "trend", "trends", "pattern", "patterns", "data", "record", "records"]

POPULATION_NOUNS = ["employees", "employee", "staff", "people", "persons", "person", "workforce", "personnel", "workers",
                    "worker", "team members", "headcount pool", "resources", "members", "colleagues", "individuals", "folks",
                    "employees'", "ets", "company", "organisation", "organization", "firm", "earners", "earner", "joiners"]
ROW_TARGET_WORDS = ["who", "whom", "employee", "employees", "person", "people", "staff", "individual", "individuals", "earners", "earner", "names"]

NEGATION_PHRASES = ["not", "outside", "outside of", "excluding", "except", "other than", "non", "non-", "apart from", "besides",
                    "aside from", "without", "exclude", "excluded", "not in", "beyond"]

LIST_CUES = ["list", "show", "display", "give me", "name", "names of", "who are", "find", "fetch", "get", "enumerate", "which employees"]

REASONING_CUES = ["why", "explain", "explanation", "recommend", "recommendation", "recommendations", "prioritize", "prioritise",
                  "priority", "priorities", "suggest", "suggests", "suggestion", "should", "implication", "implications",
                  "interpret", "interpretation", "insight", "insights", "strategy", "strategic", "risk", "risks", "what does that",
                  "what does this", "what changes", "assess", "assessment", "evaluate", "justify", "support the recommendation",
                  "action", "actions", "improve", "improvement", "mitigate", "concern", "concerns", "focus", "invest", "investment",
                  "would you", "advise", "advice", "what can we", "how can we", "plan", "takeaway", "takeaways", "narrative",
                  "story", "health", "signal", "signals", "watch", "attention"]

POLICY_CUES = ["policy", "policies", "guideline", "guidelines", "handbook", "procedure", "procedures", "rule", "rules",
               "regulation", "regulations", "eligibility", "eligible", "entitlement", "entitled", "code of conduct",
               "carry forward", "carry-forward", "notice period", "reimbursement", "reimbursed", "reimburse", "gold bullion",
               "retention bonus", "cryptocurrency", "approval process", "criteria for promotion",
               "promotion criteria", "promotion policy", "leave policy", "travel policy", "what does ets mean", "definition of"]

EVALUATIVE_TERMS: Dict[str, str] = {
    "best": "POS", "better": "POS", "strongest": "POS", "stronger": "POS", "healthiest": "POS", "healthier": "POS",
    "performing": "NEUTRAL", "performance": "NEUTRAL", "performs": "NEUTRAL", "perform": "NEUTRAL", "top-performing": "POS",
    "top performing": "POS", "good": "POS", "great": "POS", "excellent": "POS", "efficient": "POS", "effective": "POS",
    "successful": "POS", "thriving": "POS", "ideal": "POS", "optimal": "POS",
    "worst": "NEG", "worse": "NEG", "weakest": "NEG", "weaker": "NEG", "bad": "NEG", "poor": "NEG", "poorest": "NEG",
    "struggling": "NEG", "underperforming": "NEG", "inefficient": "NEG", "unhealthy": "NEG",
}

UNSUPPORTED_CONCEPTS: Dict[str, str] = {
    # customer / quality metrics
    "csat": "customer satisfaction (CSAT) scores", "customer satisfaction": "customer satisfaction scores",
    "nps": "Net Promoter Score (NPS)", "net promoter": "Net Promoter Score (NPS)", "satisfaction": "satisfaction scores",
    "satisfaction score": "satisfaction scores", "happiness": "employee happiness / sentiment", "sentiment": "employee sentiment",
    "morale": "employee morale", "engagement": "employee engagement scores", "engagement score": "employee engagement scores",
    "enps": "employee Net Promoter Score",
    # commercial / billing
    "billable hours": "billable hours / timesheets", "billable": "billable utilisation", "billability": "billable utilisation",
    "billable utilization": "billable utilisation", "billable utilisation": "billable utilisation", "utilization rate": "billable utilisation",
    "timesheet": "timesheets", "timesheets": "timesheets", "billing rate": "billing rates", "billing rates": "billing rates",
    "billing": "client billing", "invoice": "invoicing", "invoices": "invoicing", "revenue": "revenue", "revenues": "revenue",
    "profit": "profit", "profits": "profit", "profitability": "profitability", "margin": "margins", "margins": "margins",
    "ebitda": "EBITDA", "dso": "days sales outstanding", "cash runway": "cash runway", "runway": "cash runway",
    "burn rate": "burn rate", "roi": "return on investment", "client": "client-level data", "clients": "client-level data",
    "customer": "customer-level data", "customers": "customer-level data",
    # performance / productivity
    "productivity": "productivity measures", "productive": "productivity measures", "output": "productivity / output measures",
    "performance rating": "performance ratings", "performance ratings": "performance ratings", "performance score": "performance ratings",
    "performance scores": "performance ratings", "appraisal rating": "appraisal ratings", "appraisal ratings": "appraisal ratings",
    "rating": "ratings", "ratings": "ratings", "kpi score": "KPI scores", "okr": "OKR attainment", "okrs": "OKR attainment",
    # time / workforce operations
    "overtime": "overtime records", "bench": "bench / allocation status", "bench strength": "bench / allocation status",
    "allocation": "allocation / utilisation records", "absenteeism": "absenteeism records", "attendance": "attendance records",
    "training hours": "training records", "training": "training records", "certification": "certification records",
    "certifications": "certification records", "education": "education records", "degree": "education records",
    "university": "education records",
    # recruitment
    "open positions": "open positions / requisitions", "vacancies": "vacancies / requisitions", "vacancy": "vacancies / requisitions",
    "requisitions": "open requisitions", "time to hire": "recruitment metrics", "time-to-hire": "recruitment metrics",
    "cost per hire": "recruitment metrics", "cost-per-hire": "recruitment metrics", "offer acceptance": "recruitment metrics",
    "candidates": "candidate pipeline data", "pipeline": "recruitment pipeline data", "hiring plan": "hiring plans",
    # forward-looking
    "forecast": "forecasts / projections", "forecasts": "forecasts / projections", "projection": "forecasts / projections",
    "projections": "forecasts / projections", "predict": "predictions", "prediction": "predictions", "next year": "future-period data",
    "fy25": "FY25 projections", "fy26": "FY26 projections", "fy27": "FY27 projections", "budget": "budgets", "budgets": "budgets",
    # misc
    "exit reason": "exit reasons", "exit reasons": "exit reasons", "reason for leaving": "exit reasons", "exit interview": "exit interviews",
    "flight risk score": "flight-risk scores", "succession": "succession planning data", "stock price": "stock prices",
    "market salary": "external market salary benchmarks", "market rate": "external market salary benchmarks",
    "industry benchmark": "external benchmarks", "competitor": "competitor data", "competitors": "competitor data",
    "weather": "weather", "cricket": "cricket scores", "recipe": "cooking recipes", "chocolate cake": "recipes",
    "president": "political figures", "bitcoin": "cryptocurrency prices", "horoscope": "astrology", "movie tickets": "entertainment expenses",
}

DISCOURSE_FRAME_HEADS = {
    "perspective", "standpoint", "viewpoint", "view", "lens", "angle", "review", "dashboard", "workforce", "data", "dataset",
    "records", "purposes", "purpose", "report", "presentation", "meeting", "briefing", "audience", "leadership", "board",
    "context", "point of view", "summary", "discussion", "update", "deck", "ets", "organisation", "organization", "company",
    "information", "numbers", "database",
}
DISCOURSE_FRAME_LEADS = ("from", "for", "looking at", "using", "based on", "as per", "according to", "in terms of the",
                         "with respect to the", "considering", "taking", "from the", "in the context of", "speaking as",
                         "as an", "as a", "within the")

PRONOUN_REFS = ["their", "they", "them", "his", "her", "hers", "him", "those", "these", "that one", "this one", "same",
                "the above", "previous", "earlier", "aforementioned", "its",
                "this employee", "that employee", "this person", "that person", "selected employee"]

LOOKUP_ATTRIBUTE_WORDS: Dict[str, str] = {
    "manager": "manager", "reporting manager": "manager", "boss": "manager", "supervisor": "manager", "reports to": "manager",
    "reporting to": "manager", "report to": "manager",
    "department": "department", "dept": "department", "location": "location", "city": "location", "office": "location",
    "state": "state", "project": "project", "title": "job_title", "job title": "job_title", "designation": "job_title",
    "role": "job_title", "position": "job_title", "grade": "job_level", "level": "job_level", "band": "job_level",
    "salary": "ctc", "ctc": "ctc", "compensation": "ctc", "pay": "ctc", "package": "ctc",
    "tenure": "tenure", "experience": "experience", "skills": "skills", "skill": "skills", "email": "email",
    "joining date": "start_date", "join date": "start_date", "start date": "start_date", "joined": "start_date",
    "status": "status", "age": "age", "gender": "gender", "details": "profile", "profile": "profile", "information": "profile",
    "info": "profile",
}

NUMBER_WORDS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "fifteen": 15, "twenty": 20, "a dozen": 12, "dozen": 12, "single": 1,
}

# Values whose lower-case surface form is an ordinary English word: they bind only when
# written with their canonical capitalisation or when an explicit field noun is adjacent.
CASE_SENSITIVE_VALUES = {"it", "core", "infra", "active"}

VALUE_ALIASES: Dict[str, Dict[str, List[str]]] = {
    "location": {"Bangalore": ["bengaluru", "blr", "bangalore office"], "Hyderabad": ["hyd"], "Chennai": ["madras"], "Pune": []},
    "state": {"ND": ["north dakota"], "NH": ["new hampshire"], "AK": ["alaska"]},
    "gender": {"Male": ["male", "males", "men", "man"], "Female": ["female", "females", "women", "woman", "ladies"]},
    "status": {
        "Active": ["active", "current", "currently employed", "existing", "current workforce", "current employees",
                   "present", "serving", "on roll", "on-roll", "still employed", "still working", "remaining", "retained", "currently active",
                   "currently working", "operational staff", "working employees"],
        "Exited": ["exited", "exit", "exits", "leavers", "leaver", "left", "former", "ex-employees", "ex employees", "resigned",
                   "attrited", "departed", "separated", "terminated", "no longer with", "who left", "have left", "has left",
                   "past employees", "alumni", "churned"],
    },
    "department": {"QA": ["quality assurance", "testing department"], "IT": ["information technology"], "Infra": ["infrastructure"]},
}

KNOWN_NON_ETS_VALUES: Dict[str, List[str]] = {
    "location": ["delhi", "new delhi", "mumbai", "bombay", "kolkata", "calcutta", "noida", "gurgaon", "gurugram", "ahmedabad",
                 "kochi", "cochin", "mysore", "mysuru", "coimbatore", "trivandrum", "london", "singapore", "dubai", "tokyo",
                 "sydney", "paris", "berlin", "new york", "chicago", "toronto", "jaipur", "lucknow", "indore", "nagpur", "vizag"],
    "state": ["texas", "california", "florida", "ohio", "georgia", "virginia", "washington", "oregon", "nevada", "arizona",
              "karnataka", "telangana", "maharashtra", "tamil nadu", "kerala", "andhra pradesh"],
    "department": ["hr", "human resources", "finance", "sales", "marketing", "legal", "operations", "admin", "administration",
                   "devops", "support", "management", "accounts", "procurement", "r&d", "research", "engineering",
                   "data science", "analytics", "security", "facilities"],
}

STATUS_DEFAULT_WORDS = {"current workforce", "current employees", "currently employed"}

# Words carrying no analytical meaning (excluded from coverage accounting)
FUNCTION_WORDS = {
    "a", "an", "the", "of", "in", "on", "at", "to", "for", "from", "with", "and", "or", "is", "are", "was", "were", "be",
    "been", "being", "do", "does", "did", "has", "have", "had", "what", "which", "who", "whom", "whose", "how", "where",
    "when", "that", "this", "these", "those", "it", "its", "there", "their", "our", "we", "us", "you", "your", "i", "me",
    "my", "please", "can", "could", "would", "will", "shall", "may", "might", "tell", "give", "show", "list", "provide",
    "identify", "find", "get", "let", "know", "see", "then", "than", "as", "by", "per", "each", "every", "any", "all",
    "both", "either", "neither", "into", "within", "across", "among", "between", "about", "up", "down", "out", "over",
    "under", "also", "only", "just", "so", "very", "much", "many", "more", "most", "some", "such", "if", "were", "goal",
    "currently", "now", "today", "overall", "respectively", "versus", "vs", "same", "other", "another", "two", "level",
    "second", "first", "second-level", "break", "compare", "using", "work", "works", "working", "based", "located",
    "employed", "sitting", "having", "make", "made", "look", "looking", "number", "available", "recorded", "current",
    "ets", "company", "organisation", "organization", "here", "s", "'s", "’s", "kind", "type", "types", "versus",
    "against", "relative", "compared", "comparison", "differ", "difference", "rank", "ranked", "ranking", "order", "sorted",
    "sort", "descending", "ascending", "group", "groups", "segment", "segments", "combination", "combinations",
}


# ---------------------------------------------------------------------------
# Live catalog (values from the authoritative database)
# ---------------------------------------------------------------------------

class SemanticCatalog:
    """Loads categorical value domains from SQLite at first use and exposes lexicon lookups."""

    _instance: Optional["SemanticCatalog"] = None
    _lock = threading.Lock()

    def __init__(self, conn=None):
        if conn is None:
            from backend.app.ai.db import sqlite_engine
            conn = sqlite_engine.conn
        self.conn = conn
        self.values: Dict[str, List[str]] = {}
        self.population_total: int = 0
        self._load()

    @classmethod
    def get(cls) -> "SemanticCatalog":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = SemanticCatalog()
        return cls._instance

    def _distinct(self, sql: str) -> List[str]:
        cur = self.conn.cursor()
        cur.execute(sql)
        out = []
        for row in cur.fetchall():
            v = row[0]
            if v is None:
                continue
            s = str(v).strip()
            if s:
                out.append(s)
        return out

    def _load(self) -> None:
        q = self._distinct
        self.values["department"] = q("SELECT DISTINCT department FROM employees")
        self.values["location"] = q("SELECT DISTINCT location FROM employees")
        self.values["state"] = q("SELECT DISTINCT state FROM employees")
        self.values["project"] = q("SELECT DISTINCT project FROM employees")
        self.values["gender"] = q("SELECT DISTINCT gender FROM employees")
        self.values["job_level"] = q("SELECT DISTINCT job_level FROM employees")
        self.values["job_title"] = q("SELECT DISTINCT job_title FROM employees")
        self.values["salary_band"] = q("SELECT DISTINCT salary_bin FROM employees")
        self.values["status"] = q("SELECT DISTINCT current_status FROM employees")
        self.values["manager"] = q("SELECT DISTINCT manager FROM employees")
        self.values["primary_skill"] = q("SELECT DISTINCT primary_skill FROM employees")
        self.values["skill"] = q("SELECT DISTINCT skill_name FROM skills")
        self.values["leave_type"] = q("SELECT DISTINCT leave_type FROM leaves")
        self.values["year"] = q("SELECT DISTINCT year FROM finance_history WHERE is_synthetic = 0")
        self.values["age_group"] = ["Under 25", "25-29", "30-34", "35-39", "40-44", "45-49", "50+"]
        cur = self.conn.cursor()
        cur.execute("SELECT COUNT(*) FROM employees")
        self.population_total = int(cur.fetchone()[0])

    # -- value helpers -------------------------------------------------------
    def is_valid_value(self, field_key: str, value: Any) -> bool:
        dom = self.values.get(field_key)
        if dom is None:
            return True
        vals = value if isinstance(value, (list, tuple)) else [value]
        low = {d.lower() for d in dom}
        return all(str(v).lower() in low for v in vals)

    def canonical_value(self, field_key: str, value: str) -> Optional[str]:
        for d in self.values.get(field_key, []):
            if d.lower() == str(value).lower():
                return d
        return None


def salary_band_surface_forms(band: str) -> List[str]:
    """Generate natural surface forms for a salary band label such as '< 5L', '10-15L', '20L+'."""
    b = band.strip().lower()
    forms = {b, b.replace(" ", "")}
    m = re.match(r"^<\s*(\d+)\s*l$", b)
    if m:
        n = m.group(1)
        forms |= {f"< {n}l", f"<{n}l", f"under {n}l", f"below {n}l", f"less than {n}l", f"under {n} lakh", f"below {n} lakh",
                  f"less than {n} lakh", f"sub {n}l", f"sub-{n}l", f"up to {n}l", f"0-{n}l"}
    m = re.match(r"^(\d+)\s*-\s*(\d+)\s*l$", b)
    if m:
        a, c = m.group(1), m.group(2)
        forms |= {f"{a}-{c}l", f"{a} - {c}l", f"{a}-{c} lakh", f"{a} to {c} lakh", f"{a} to {c}l", f"{a}l-{c}l", f"{a}–{c}l"}
    m = re.match(r"^(\d+)\s*l\s*\+$", b)
    if m:
        n = m.group(1)
        forms |= {f"{n}l+", f"{n} l+", f"{n}l plus", f"{n} lakh plus", f"{n} lakh+", f"{n}+ lakh", f"above {n}l", f"over {n}l",
                  f"{n}l and above", f"{n} lakh and above"}
    return sorted(forms)
