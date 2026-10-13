"""
ETS Genie — Semantic Query Intermediate Representation (IR).

The IR is the single contract between language understanding (parser) and
deterministic execution (validator -> planner -> executor -> formatter).

Design rules
------------
* The IR stores *semantic* content (catalog keys, typed operators, typed values),
  never raw user words.  Every field / metric / dimension referenced here is a key
  into ``catalog.SemanticCatalog``.
* Nothing in the IR is optional-by-accident: absence is explicit (empty list / None),
  and every ambiguity, unsupported concept, assumption and unresolved entity is recorded
  so that later stages can refuse instead of guessing.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any, Dict, List, Optional, Union


class Intent(str, Enum):
    AGGREGATE = "AGGREGATE"                 # scalar metric(s) over a (filtered) population
    BREAKDOWN = "BREAKDOWN"                 # metric(s) grouped by one or more dimensions
    RANKING = "RANKING"                     # ordered groups / employees with optional limit
    COMPARISON = "COMPARISON"               # cohort A vs cohort B on metric(s)
    GAP = "GAP"                             # largest spread between any two groups
    BASELINE_DEVIATION = "BASELINE_DEVIATION"  # groups that deviate most from the overall baseline
    LIST = "LIST"                           # row-level employee listing
    ENTITY_LOOKUP = "ENTITY_LOOKUP"         # facts about one named / identified employee
    NOT_FOUND = "NOT_FOUND"                 # named entity not found in database records
    # Non-executable intents (controlled responses)
    UNSUPPORTED = "UNSUPPORTED"
    AMBIGUOUS = "AMBIGUOUS"
    INVALID = "INVALID"
    # Explicitly delegated (contractual, not hidden fallback)
    DELEGATE_POLICY = "DELEGATE_POLICY"             # document / policy RAG
    DELEGATE_EXECUTIVE = "DELEGATE_EXECUTIVE"       # open strategic question with no analytical core
    DELEGATE_CONTEXT = "DELEGATE_CONTEXT"           # anaphoric follow-up needing conversation history


class IRStatus(str, Enum):
    VALID = "VALID"
    AMBIGUOUS = "AMBIGUOUS"
    UNSUPPORTED = "UNSUPPORTED"
    INVALID = "INVALID"
    DELEGATED = "DELEGATED"
    NOT_FOUND = "NOT_FOUND"


class NullPolicy(str, Enum):
    EXCLUDE = "EXCLUDE"                 # NULL measures are excluded from aggregates (SQL default)
    REPORT_AS_UNKNOWN = "REPORT_AS_UNKNOWN"


class Calc(str, Enum):
    ABSOLUTE_DIFF = "absolute_difference"
    SIGNED_DIFF = "signed_difference"
    PCT_DIFF = "percentage_difference"
    RATIO = "ratio"
    DIRECTION = "direction"


@dataclass
class MetricSpec:
    measure: str                 # catalog measure key, e.g. "ctc", "headcount", "attrition"
    agg: str                     # "AVG" | "SUM" | "MIN" | "MAX" | "MEDIAN" | "COUNT" | "RATE"
    explicit_agg: bool = True    # False when the aggregation was defaulted (recorded as assumption)

    @property
    def key(self) -> str:
        if self.measure == "headcount":
            return "count_headcount"
        if self.measure == "attrition":
            return "rate_attrition"
        if self.measure == "concentration":
            return "share_concentration"
        if self.measure == "skill_coverage":
            return "avg_skill_coverage"
        if self.measure == "leave_utilization":
            return "avg_leave_utilization"
        return f"{self.agg.lower()}_{self.measure}"


@dataclass
class FilterSpec:
    field: str                   # catalog field key, e.g. "department", "status", "ctc"
    op: str                      # "=", "!=", "IN", "NOT IN", ">", "<", ">=", "<=", "BETWEEN"
    value: Any
    source: str = ""             # surface text, for diagnostics only


@dataclass
class FilterGroup:
    conjunction: str = "AND"     # "AND" | "OR"
    items: List[Union["FilterGroup", FilterSpec]] = field(default_factory=list)

    def is_empty(self) -> bool:
        return not self.items

    def flat(self) -> List[FilterSpec]:
        out: List[FilterSpec] = []
        for it in self.items:
            if isinstance(it, FilterGroup):
                out.extend(it.flat())
            else:
                out.append(it)
        return out

    def fields(self) -> List[str]:
        return [f.field for f in self.flat()]


@dataclass
class Cohort:
    label: str
    filters: FilterGroup = field(default_factory=FilterGroup)
    kind: str = "FILTERED"       # "FILTERED" | "BASELINE" (all employees) | "COMPLEMENT"


@dataclass
class ComparisonSpec:
    left: Cohort
    right: Cohort
    calculations: List[str] = field(default_factory=list)
    expected_direction: Optional[str] = None   # "LEFT_HIGHER" | "LEFT_LOWER" (premise in question)
    stratify_by: List[str] = field(default_factory=list)


@dataclass
class OrderingSpec:
    metric_key: str              # MetricSpec.key or a row-level measure key
    direction: str               # "ASC" | "DESC"


@dataclass
class ThresholdSpec:
    metric_key: str
    op: str                      # ">", "<", ">=", "<="
    value: Optional[float] = None
    relative_to: Optional[str] = None   # "BASELINE" for above/below-average semantics
    scope: str = "GROUP"         # "GROUP" (HAVING / post-aggregation) | "ROW"


@dataclass
class FollowUp:
    kind: str                    # "DRILLDOWN" | "WITHIN_GROUP_EXTREMES" | "OUTLIER" | "RERUN_WITH_FILTER" | "SUPPORTING_MEASURES"
    dimensions: List[str] = field(default_factory=list)
    filters: FilterGroup = field(default_factory=FilterGroup)
    count: Optional[int] = None


@dataclass
class EntityRef:
    employee_number: int
    label: str
    attributes: List[str] = field(default_factory=list)   # requested attributes, e.g. ["manager"]
    relation: Optional[str] = None                         # "REPORTEES" for "who reports to X"


@dataclass
class QueryIR:
    raw_question: str
    normalized_question: str = ""
    intent: Intent = Intent.AMBIGUOUS
    status: IRStatus = IRStatus.VALID
    metrics: List[MetricSpec] = field(default_factory=list)
    dimensions: List[str] = field(default_factory=list)      # semantic dimensions referenced
    grouping: List[str] = field(default_factory=list)        # dimensions actually grouped (GROUP BY)
    filters: FilterGroup = field(default_factory=FilterGroup)
    ordering: Optional[OrderingSpec] = None
    limit: Optional[int] = None
    row_level: bool = False                                   # ranking / listing individual employees
    comparison: Optional[ComparisonSpec] = None
    calculations: List[str] = field(default_factory=list)
    thresholds: List[ThresholdSpec] = field(default_factory=list)
    followups: List[FollowUp] = field(default_factory=list)
    entity: Optional[EntityRef] = None
    null_policy: NullPolicy = NullPolicy.EXCLUDE
    confidence: float = 0.0
    reasoning_required: bool = False
    reasoning_goal: Optional[str] = None
    evaluative_terms: List[str] = field(default_factory=list)
    evaluative_unresolved: bool = False
    ambiguity_reason: Optional[str] = None
    unsupported_concepts: List[str] = field(default_factory=list)
    unsupported_reason: Optional[str] = None
    unresolved_entities: List[Dict[str, str]] = field(default_factory=list)
    assumptions: List[str] = field(default_factory=list)
    discourse_frame: Optional[str] = None
    unparsed_terms: List[str] = field(default_factory=list)
    trace: List[str] = field(default_factory=list)

    def primary_metric(self) -> Optional[MetricSpec]:
        return self.metrics[0] if self.metrics else None

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["intent"] = self.intent.value
        d["status"] = self.status.value
        d["null_policy"] = self.null_policy.value
        d["metrics"] = [dict(m, key=f"{m['agg'].lower()}_{m['measure']}") for m in d["metrics"]]
        return d
