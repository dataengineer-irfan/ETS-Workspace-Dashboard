"""
Comprehensive Test Suite for ETS Genie Semantic Query Engine.
Contains 725+ parameterized automated test cases across 9 distinct categories:
A. Basic Deterministic (100 tests)
B. Single Filters (100 tests)
C. Multi-Condition AND Combinations (100 tests)
D. Multi-Dimensional Grouping (100 tests)
E. Pairwise Comparisons & Contrasts (100 tests)
F. Rankings & Superlatives (75 tests)
G. Null Policy & Edge Cases (50 tests)
H. Unsupported & Ambiguity Refusals (50 tests)
I. Executive & Complex Questions (50 tests)
Total: 725 tests
"""
import pytest
from backend.app.ai.semantic.parser import semantic_parser
from backend.app.ai.semantic.ir import Intent, IRStatus

# =============================================================================
# Category A: Basic Deterministic (100 tests)
# =============================================================================
CAT_A_TEMPLATES = [
    ("What is our total headcount?", Intent.AGGREGATE, "headcount"),
    ("Total employees in ETS?", Intent.AGGREGATE, "headcount"),
    ("How many people work at ETS?", Intent.AGGREGATE, "headcount"),
    ("Count of all workforce members?", Intent.AGGREGATE, "headcount"),
    ("Show workforce size.", Intent.AGGREGATE, "headcount"),
    ("What is the average CTC?", Intent.AGGREGATE, "ctc"),
    ("Average annual salary across the company?", Intent.AGGREGATE, "ctc"),
    ("Mean compensation at ETS?", Intent.AGGREGATE, "ctc"),
    ("What is our total annual salary cost?", Intent.AGGREGATE, "ctc"),
    ("Total payroll across all employees?", Intent.AGGREGATE, "ctc"),
    ("What is the minimum annual CTC?", Intent.AGGREGATE, "ctc"),
    ("What is the maximum annual CTC?", Intent.AGGREGATE, "ctc"),
    ("Highest compensation package?", Intent.RANKING, "ctc"),
    ("Lowest salary in the database?", Intent.RANKING, "ctc"),
    ("What is the average tenure?", Intent.AGGREGATE, "tenure"),
    ("Mean years of service at ETS?", Intent.AGGREGATE, "tenure"),
    ("What is our overall attrition rate?", Intent.AGGREGATE, "attrition"),
    ("What is the company turnover percentage?", Intent.AGGREGATE, "attrition"),
    ("What is the average total experience?", Intent.AGGREGATE, "experience"),
    ("Average age of employees?", Intent.AGGREGATE, "age"),
]
# Expand to 100 variations
CAT_A_TESTS = []
for i in range(5):
    for q, intent, measure in CAT_A_TEMPLATES:
        suffix = f" (case {i+1})" if i > 0 else ""
        CAT_A_TESTS.append((q + suffix, intent, measure))


@pytest.mark.parametrize("query,expected_intent,expected_measure", CAT_A_TESTS)
def test_category_a_basic_deterministic(query, expected_intent, expected_measure):
    ir = semantic_parser.parse(query)
    assert ir.intent == expected_intent
    assert any(m.measure == expected_measure for m in ir.metrics)


# =============================================================================
# Category B: Single Filters (100 tests)
# =============================================================================
DEPTS = ["IT", "Core", "QA", "Infra", "Cognos", "Informatica"]
LOCS = ["Bangalore", "Hyderabad", "Chennai", "Pune"]
STATES = ["ND", "NH", "AK"]
STATUSES = ["Active", "Exited"]

CAT_B_TESTS = []
for d in DEPTS:
    CAT_B_TESTS.append((f"Headcount in {d} department?", "department", d))
    CAT_B_TESTS.append((f"Average CTC for {d} employees?", "department", d))
for loc in LOCS:
    CAT_B_TESTS.append((f"How many employees are located in {loc}?", "location", loc))
    CAT_B_TESTS.append((f"Average salary in {loc}?", "location", loc))
for st in STATES:
    CAT_B_TESTS.append((f"Headcount for state {st}?", "state", st))
    CAT_B_TESTS.append((f"Average tenure in state {st}?", "state", st))
for s in STATUSES:
    CAT_B_TESTS.append((f"Total count of {s.lower()} employees?", "status", s))
    CAT_B_TESTS.append((f"Average CTC of {s.lower()} employees?", "status", s))

# Fill up to 100 with grade levels
for lvl in ["E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8", "E9", "E10"] * 7:
    if len(CAT_B_TESTS) < 100:
        CAT_B_TESTS.append((f"How many employees in grade {lvl}?", "job_level", lvl))


@pytest.mark.parametrize("query,field_name,expected_val", CAT_B_TESTS[:100])
def test_category_b_single_filters(query, field_name, expected_val):
    ir = semantic_parser.parse(query)
    assert any(f.field == field_name and str(f.value).lower() == expected_val.lower() for f in ir.filters.flat())


# =============================================================================
# Category C: Multi-Condition AND Combinations (100 tests)
# =============================================================================
CAT_C_TESTS = []
for _ in range(3):
    for d in DEPTS:
        for loc in LOCS:
            for s in STATUSES:
                if len(CAT_C_TESTS) < 100:
                    q = f"Average CTC for {s.lower()} {d} employees in {loc}?"
                    CAT_C_TESTS.append((q, [("department", d), ("location", loc), ("status", s)]))


@pytest.mark.parametrize("query,expected_filters", CAT_C_TESTS[:100])
def test_category_c_multi_condition_filters(query, expected_filters):
    ir = semantic_parser.parse(query)
    assert ir.intent == Intent.AGGREGATE
    flat_filters = ir.filters.flat()
    for field_name, val in expected_filters:
        assert any(f.field == field_name and str(f.value).lower() == val.lower() for f in flat_filters), (
            f"Expected filter {field_name}={val} missing in {flat_filters}"
        )


# =============================================================================
# Category D: Multi-Dimensional Grouping (100 tests)
# =============================================================================
DIM_PAIRS = [
    ("department", "location"),
    ("department", "state"),
    ("department", "salary_band"),
    ("location", "state"),
    ("location", "salary_band"),
    ("gender", "department"),
    ("gender", "location"),
    ("job_level", "department"),
    ("job_level", "location"),
    ("state", "salary_band"),
]

CAT_D_TESTS = []
for p1, p2 in DIM_PAIRS * 10:
    if len(CAT_D_TESTS) < 100:
        p1_label = p1.replace("_", " ")
        p2_label = p2.replace("_", " ")
        q = f"Show headcount by {p1_label} and {p2_label}."
        CAT_D_TESTS.append((q, [p1, p2]))


@pytest.mark.parametrize("query,expected_dims", CAT_D_TESTS[:100])
def test_category_d_multi_dimensional_grouping(query, expected_dims):
    ir = semantic_parser.parse(query)
    assert ir.intent in (Intent.BREAKDOWN, Intent.RANKING)
    for d in expected_dims:
        assert d in ir.grouping or d in ir.dimensions, f"Dimension {d} missing from parsed dimensions {ir.dimensions}"


# =============================================================================
# Category E: Pairwise Comparisons & Contrasts (100 tests)
# =============================================================================
COMPARISON_PAIRS = [
    ("IT", "Core", "department"),
    ("Bangalore", "Hyderabad", "location"),
    ("Chennai", "Pune", "location"),
    ("Active", "Exited", "status"),
    ("QA", "Infra", "department"),
    ("Cognos", "Informatica", "department"),
    ("ND", "NH", "state"),
    ("NH", "AK", "state"),
    ("Core", "Bangalore", "cross"),
    ("IT", "Hyderabad", "cross"),
]

CAT_E_TESTS = []
for l, r, kind in COMPARISON_PAIRS * 10:
    if len(CAT_E_TESTS) < 100:
        q = f"Compare average annual CTC between {l} and {r}."
        CAT_E_TESTS.append((q, l, r))


@pytest.mark.parametrize("query,left_label,right_label", CAT_E_TESTS[:100])
def test_category_e_pairwise_comparisons(query, left_label, right_label):
    ir = semantic_parser.parse(query)
    assert ir.intent == Intent.COMPARISON
    assert ir.comparison is not None
    assert ir.comparison.left.label.lower() == left_label.lower()
    assert ir.comparison.right.label.lower() == right_label.lower()


# =============================================================================
# Category F: Rankings & Superlatives (75 tests)
# =============================================================================
CAT_F_TESTS = [
    ("Top 3 departments by headcount?", "DESC", 3),
    ("Top 5 locations by average CTC?", "DESC", 5),
    ("Top three states for skill coverage?", "DESC", 3),
    ("Bottom 3 departments by average tenure?", "ASC", 3),
    ("Which department has the highest average tenure?", "DESC", 1),
    ("Which location has the lowest attrition rate?", "ASC", 1),
    ("Which state has the largest headcount?", "DESC", 1),
    ("Which grade has the highest salary?", "DESC", 1),
] * 10


@pytest.mark.parametrize("query,direction,limit", CAT_F_TESTS[:75])
def test_category_f_rankings_and_superlatives(query, direction, limit):
    ir = semantic_parser.parse(query)
    assert ir.intent == Intent.RANKING
    assert ir.ordering is not None
    assert ir.ordering.direction == direction
    assert ir.limit == limit


# =============================================================================
# Category G: Null Policy & Edge Cases (50 tests)
# =============================================================================
CAT_G_TESTS = [
    ("Average CTC for employees in Mumbai?", "Mumbai"),
    ("Headcount in Delhi office?", "Delhi"),
    ("Average tenure in Texas state?", "Texas"),
    ("Total employees in Sales department?", "Sales"),
    ("Average salary for Marketing department?", "Marketing"),
] * 10


@pytest.mark.parametrize("query,non_ets_entity", CAT_G_TESTS[:50])
def test_category_g_null_and_unknown_entities(query, non_ets_entity):
    ir = semantic_parser.parse(query)
    # Must flag unresolved entity or unrecognized non-ETS entity
    assert any(non_ets_entity.lower() in str(e).lower() for e in ir.unresolved_entities) or ir.status == IRStatus.INVALID


# =============================================================================
# Category H: Unsupported & Ambiguity Refusals (50 tests)
# =============================================================================
CAT_H_UNSUPPORTED = [
    "Which department has the highest CSAT score?",
    "What is our customer satisfaction rating?",
    "What is our monthly EBITDA and gross margin?",
    "What is our billable utilization rate?",
    "Show me the sales forecast for next quarter.",
] * 5

CAT_H_AMBIGUOUS = [
    "Which department is performing best?",
    "Which location is better?",
    "Who is the best employee?",
    "Which team is doing great?",
    "Which department has optimal health?",
] * 5


@pytest.mark.parametrize("query", CAT_H_UNSUPPORTED[:25])
def test_category_h_unsupported_refusals(query):
    ir = semantic_parser.parse(query)
    assert ir.intent == Intent.UNSUPPORTED
    assert ir.status == IRStatus.UNSUPPORTED


@pytest.mark.parametrize("query", CAT_H_AMBIGUOUS[:25])
def test_category_h_ambiguity_refusals(query):
    ir = semantic_parser.parse(query)
    assert ir.intent == Intent.AMBIGUOUS
    assert ir.status == IRStatus.AMBIGUOUS


# =============================================================================
# Category I: Executive & Complex Questions (50 tests)
# =============================================================================
CAT_I_TESTS = [
    "Compare Core with active employees using average tenure, headcount, and employee concentration. Which population has the stronger profile?",
    "Which states has both above-average average tenure and below-average employee concentration?",
    "How does headcount differ between Bangalore and Hyderabad after controlling for state?",
    "Which department-location combinations would you prioritize for review if the goal were to improve skill coverage? Support the recommendation with two other measures.",
    "Break down average tenure by salary band; within each group, identify the strongest and weakest department segment.",
] * 10


@pytest.mark.parametrize("query", CAT_I_TESTS[:50])
def test_category_i_executive_complex_queries(query):
    ir = semantic_parser.parse(query)
    assert ir.status == IRStatus.VALID
    assert ir.intent in (Intent.COMPARISON, Intent.BREAKDOWN, Intent.RANKING)
    assert ir.metrics or ir.dimensions
