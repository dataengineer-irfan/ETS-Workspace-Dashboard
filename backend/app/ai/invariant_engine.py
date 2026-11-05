import math
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from backend.app.ai.capability_registry import CapabilityEnum, CapabilityContract
from backend.app.ai.compositional import CompositionalInvariantEngine, MultiRequirementInvariantEngine

@dataclass
class InvariantResult:
    passed: bool
    invariant_name: str
    details: str
    diagnostic_data: Dict[str, Any] = field(default_factory=dict)

def _sql_literal(value: Any) -> str:
    return str(value).replace("'", "''")


_EMPLOYEE_FILTER_COLUMNS = {
    "department": "department",
    "location": "location",
    "state": "state",
    "project": "project",
    "job_level": "job_level",
    "status": "current_status",
    "module": "module",
    "gender": "gender",
    "salary_band": "salary_bin",
    "job_title": "job_title",
    "manager": "manager",
    "primary_skill": "primary_skill",
}


def _cohort_predicates(p, skip: Optional[set] = None) -> List[str]:
    """Predicates for the same filtered cohort the question asked for."""
    skip = skip or set()
    preds: List[str] = []
    if p.current_status and "status" not in skip:
        preds.append(f"current_status = '{_sql_literal(p.current_status)}'")
    if p.department and "department" not in skip:
        preds.append(f"LOWER(department) = '{_sql_literal(p.department).lower()}'")
    if p.physical_location and "location" not in skip:
        preds.append(f"location = '{_sql_literal(p.physical_location)}'")
    if p.project_state and "state" not in skip:
        preds.append(f"state = '{_sql_literal(p.project_state)}'")
    if p.job_level and "job_level" not in skip:
        preds.append(f"job_level = '{_sql_literal(p.job_level)}'")
    if p.project and "project" not in skip:
        preds.append(f"project = '{_sql_literal(p.project)}'")
    return preds


def _cohort_count_sql(contract, p, skip_field: str, not_null_column: str) -> str:
    """Count the request cohort, excluding the dimension being partitioned."""
    cohort = contract.meta.get("cohort")
    if cohort is None:
        preds = _cohort_predicates(p, skip={skip_field})
        preds.append(f"{not_null_column} IS NOT NULL AND {not_null_column} != ''")
        return f"SELECT COUNT(*) FROM employees WHERE {' AND '.join(preds)}"

    preds: List[str] = []
    skill_value = None
    for field, value in cohort.items():
        if field == skip_field or value is None:
            continue
        if field == "skill":
            skill_value = value
            continue
        column = _EMPLOYEE_FILTER_COLUMNS.get(field)
        if not column:
            continue
        if field == "department":
            preds.append(f"LOWER(e.{column}) = '{_sql_literal(value).lower()}'")
        else:
            preds.append(f"e.{column} = '{_sql_literal(value)}'")
    preds.append(f"e.{not_null_column} IS NOT NULL AND e.{not_null_column} != ''")
    if skill_value is not None:
        preds.append(f"s.skill_name = '{_sql_literal(skill_value)}'")
        source = "employees e JOIN skills s ON e.employee_number = s.employee_number"
        return f"SELECT COUNT(DISTINCT e.employee_number) FROM {source} WHERE {' AND '.join(preds)}"
    return f"SELECT COUNT(*) FROM employees e WHERE {' AND '.join(preds)}"


def _headcount_partition(measures: List[str]) -> bool:
    """A headcount or share split is checked. A compensation question is not."""
    if not measures:
        return True
    return any(m in ("headcount", "concentration", "attrition") for m in measures)


class InvariantEngine:
    """
    Reusable runtime invariant assertion engine.
    Enforces mathematical and relational invariants before responses reach the user.
    Fails closed with explicit diagnostic alerts if an invariant is violated.
    """

    @staticmethod
    def validate_capability_result(
        contract: CapabilityContract,
        rows: List[Dict[str, Any]],
        db_conn
    ) -> InvariantResult:
        cap = contract.capability
        p = contract.parameters

        # 0. Analytical Multi-Requirement Invariant Assertion
        if contract.meta.get("analytical_plan"):
            aqp = contract.meta["analytical_plan"]
            passed, details, diag = MultiRequirementInvariantEngine.validate(aqp, db_conn)
            if not passed:
                return InvariantResult(
                    passed=False,
                    invariant_name="MULTI_REQUIREMENT_INVARIANT_VIOLATION",
                    details=details,
                    diagnostic_data=diag
                )

        # 0.5 Generic Compositional Invariant Assertion
        if contract.meta.get("compositional_plan"):
            comp_plan = contract.meta["compositional_plan"]
            passed, details, diag = CompositionalInvariantEngine.validate(comp_plan, rows, db_conn)
            if not passed:
                return InvariantResult(
                    passed=False,
                    invariant_name="COMPOSITIONAL_INVARIANT_VIOLATION",
                    details=details,
                    diagnostic_data=diag
                )

        # 1. Unknown Filter Zero Invariant
        # If an unknown filter was specified (e.g., state='ZZ' or location='Delhi'),
        # the result count MUST be 0. It must NEVER return total employees (590)!
        if p.unrecognized_filter:
            if cap in (CapabilityEnum.ACTIVE_HEADCOUNT, CapabilityEnum.HEADCOUNT, CapabilityEnum.FILTER_COMPOSITION):
                cnt = 0
                if rows and len(rows) > 0:
                    cnt = list(rows[0].values())[0] if rows[0] else 0
                if cnt != 0:
                    return InvariantResult(
                        passed=False,
                        invariant_name="UNKNOWN_FILTER_ZERO_INVARIANT",
                        details=f"Unknown filter '{p.unrecognized_filter}' produced non-zero record count {cnt}. Filter was dropped!",
                        diagnostic_data={"filter": p.unrecognized_filter, "reported_count": cnt}
                    )

        # 2. Headcount Conservation Invariant
        if cap == CapabilityEnum.HEADCOUNT:
            cursor = db_conn.cursor()
            total = cursor.execute("SELECT COUNT(*) FROM employees").fetchone()[0]
            active = cursor.execute("SELECT COUNT(*) FROM employees WHERE current_status = 'Active'").fetchone()[0]
            exited = cursor.execute("SELECT COUNT(*) FROM employees WHERE current_status = 'Exited'").fetchone()[0]
            if total != active + exited:
                return InvariantResult(
                    passed=False,
                    invariant_name="HEADCOUNT_CONSERVATION_INVARIANT",
                    details=f"Conservation violated: total {total} != active {active} + exited {exited}",
                    diagnostic_data={"total": total, "active": active, "exited": exited}
                )

        measures = list(contract.meta.get("measures") or [])

        # 3. State Breakdown Partition Invariant
        if cap == CapabilityEnum.STATE_BREAKDOWN and not contract.meta.get("ranking") and contract.meta.get("mode") not in ("most", "least", "top_n", "bottom_n") and _headcount_partition(measures):
            sum_states = sum(r.get("count") or r.get("count_headcount") or 0 for r in rows)
            cursor = db_conn.cursor()
            non_null_cnt = cursor.execute(_cohort_count_sql(contract, p, "state", "state")).fetchone()[0]
            if sum_states != non_null_cnt:
                return InvariantResult(
                    passed=False,
                    invariant_name="STATE_PARTITION_INVARIANT",
                    details=f"State partition mismatch: sum of states {sum_states} != cohort count {non_null_cnt}",
                    diagnostic_data={"sum_states": sum_states, "cohort_count": non_null_cnt}
                )

        # 4. Location Breakdown Partition Invariant
        if cap == CapabilityEnum.LOCATION_BREAKDOWN and not contract.meta.get("ranking") and contract.meta.get("mode") not in ("most", "least", "top_n", "bottom_n") and _headcount_partition(measures):
            sum_locs = sum(r.get("count") or r.get("count_headcount") or 0 for r in rows)
            cursor = db_conn.cursor()
            non_null_cnt = cursor.execute(_cohort_count_sql(contract, p, "location", "location")).fetchone()[0]
            if sum_locs != non_null_cnt:
                return InvariantResult(
                    passed=False,
                    invariant_name="LOCATION_PARTITION_INVARIANT",
                    details=f"Location partition mismatch: sum of locations {sum_locs} != cohort count {non_null_cnt}",
                    diagnostic_data={"sum_locations": sum_locs, "cohort_count": non_null_cnt}
                )

        # 4.5 Gender Breakdown Partition Invariant
        if cap == CapabilityEnum.GENDER_BREAKDOWN and not contract.meta.get("ranking") and contract.meta.get("mode") != "most":
            sum_genders = sum(r.get("count") or r.get("count_headcount") or 0 for r in rows)
            cursor = db_conn.cursor()
            where_clauses = []
            if p.current_status:
                where_clauses.append(f"current_status = '{p.current_status}'")
            if p.project_state:
                where_clauses.append(f"state = '{p.project_state}'")
            if p.physical_location:
                where_clauses.append(f"location = '{p.physical_location}'")
            if p.department:
                where_clauses.append(f"LOWER(department) = '{p.department.lower()}'")
            where_str = f"WHERE {' AND '.join(where_clauses)} AND " if where_clauses else "WHERE "
            non_null_cnt = cursor.execute(f"SELECT COUNT(*) FROM employees {where_str}gender IS NOT NULL AND gender != ''").fetchone()[0]
            if sum_genders != non_null_cnt:
                return InvariantResult(
                    passed=False,
                    invariant_name="GENDER_PARTITION_INVARIANT",
                    details=f"Gender partition mismatch: sum of genders {sum_genders} != cohort count {non_null_cnt}",
                    diagnostic_data={"sum_genders": sum_genders, "cohort_count": non_null_cnt}
                )

        # 5. Attrition Rate Invariant
        if cap == CapabilityEnum.ATTRITION:
            if rows and len(rows) > 0:
                row = rows[0]
                rate = row.get("cumulative_attrition_rate") or row.get("annual_attrition_rate") or 0.0
                leavers = row.get("leavers", 0)
                denom = row.get("total_denominator") or row.get("total") or 1
                expected_rate = round((leavers / denom) * 100.0, 2)
                if abs(rate - expected_rate) > 0.05:
                    return InvariantResult(
                        passed=False,
                        invariant_name="ATTRITION_RATE_INVARIANT",
                        details=f"Attrition rate mismatch: reported {rate}% != expected {expected_rate}%",
                        diagnostic_data={"reported": rate, "expected": expected_rate, "leavers": leavers, "denom": denom}
                    )

        # 6. Ranking Ties Representation Invariant
        # Compensation checks apply only when the request's measure is compensation.
        compensation_request = (not measures) or any(m in ("ctc", "monthly_salary", "bonus") for m in measures)
        if cap == CapabilityEnum.RANKING and compensation_request:
            if rows and len(rows) > 0 and rows[0].get("annual_ctc") is not None:
                top_ctc = rows[0].get("annual_ctc")
                cursor = db_conn.cursor()
                direction = contract.parameters.direction or "DESC"
                op = "MAX" if direction == "DESC" else "MIN"
                preds = ["annual_ctc > 0"] + _cohort_predicates(p)
                actual_top = cursor.execute(f"SELECT {op}(annual_ctc) FROM employees WHERE {' AND '.join(preds)}").fetchone()[0]
                if actual_top is not None and abs(top_ctc - actual_top) > 0.01:
                    return InvariantResult(
                        passed=False,
                        invariant_name="RANKING_TIES_INVARIANT",
                        details=f"Top CTC {top_ctc} != actual {op} CTC {actual_top}",
                        diagnostic_data={"top_ctc": top_ctc, "actual_top": actual_top}
                    )

        # 7. Employee Lookup Cardinality Invariant
        if cap == CapabilityEnum.EMPLOYEE_LOOKUP:
            if contract.parameters and contract.parameters.inquiry_type in ("direct_reports_lookup", "reportees_lookup", "direct_reports"):
                pass  # Direct reports query legitimately returns multiple rows
            elif len(rows) > 1:
                return InvariantResult(
                    passed=False,
                    invariant_name="LOOKUP_CARDINALITY_INVARIANT",
                    details=f"Lookup cardinality violation: expected 0 or 1 row, got {len(rows)}",
                    diagnostic_data={"row_count": len(rows)}
                )

        return InvariantResult(
            passed=True,
            invariant_name="ALL_INVARIANTS_SATISFIED",
            details="All mathematical and relational invariants validated successfully."
        )

invariant_engine = InvariantEngine()
