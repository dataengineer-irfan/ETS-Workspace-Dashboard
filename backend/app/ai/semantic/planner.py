"""
ETS Genie — Semantic Query Planner & SQL Builder.

Transforms validated QueryIR into deterministic, governed SQL statements and execution plans.
Never generates SQL from raw natural-language strings.
Guarantees multi-dimensional preservation (eliminates the dimensions[0] bug entirely).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from backend.app.ai.semantic.catalog import FIELDS, MEASURES, SemanticCatalog
from backend.app.ai.semantic.ir import FilterGroup, FilterSpec, Intent, MetricSpec, QueryIR


@dataclass
class PlannedStatement:
    statement_id: str
    sql: str
    purpose: str
    params: List[Any] = field(default_factory=list)
    cohort_label: Optional[str] = None
    expected_type: str = "AGGREGATE"  # "SCALAR", "BREAKDOWN", "LIST", "ENTITY", "BASELINE"


@dataclass
class ExecutionPlan:
    ir: QueryIR
    statements: List[PlannedStatement] = field(default_factory=list)
    multi_step_calcs: List[str] = field(default_factory=list)
    requires_baseline: bool = False
    baseline_metrics: List[str] = field(default_factory=list)


class QueryPlanner:
    def __init__(self, catalog: Optional[SemanticCatalog] = None):
        self.catalog = catalog or SemanticCatalog.get()

    def plan(self, ir: QueryIR) -> ExecutionPlan:
        plan = ExecutionPlan(ir=ir)

        if ir.intent in (Intent.ENTITY_LOOKUP, Intent.NOT_FOUND):
            plan.statements.append(self._plan_entity_lookup(ir))
            return plan

        if ir.intent == Intent.COMPARISON:
            plan.statements.extend(self._plan_comparison(ir))
            plan.multi_step_calcs = list(ir.comparison.calculations) if ir.comparison else []
            return plan

        if ir.intent == Intent.BASELINE_DEVIATION or any(t.relative_to == "BASELINE" for t in ir.thresholds):
            plan.requires_baseline = True
            plan.baseline_metrics = [m.key for m in ir.metrics]
            # 1. Statement to fetch overall ETS baseline
            plan.statements.append(self._plan_baseline_statement(ir))

        # Core breakdown or aggregate statement
        plan.statements.append(self._plan_core_statement(ir))
        return plan

    # -------------------------------------------------------------------------
    # Core SQL Builders
    # -------------------------------------------------------------------------

    def _plan_entity_lookup(self, ir: QueryIR) -> PlannedStatement:
        emp_num = ir.entity.employee_number if ir.entity else 0
        if ir.intent == Intent.NOT_FOUND or (ir.entity and ir.entity.relation == "NOT_FOUND"):
            return PlannedStatement(
                statement_id="entity_not_found",
                sql="SELECT 1 WHERE 1=0",
                params=[],
                purpose=f"Non-existent entity {ir.entity.label if ir.entity else 'Unknown'}",
                expected_type="LIST",
            )
        if ir.entity and ir.entity.relation == "REPORTEES":
            # Finding employees who report to this person
            cur = self.catalog.conn.cursor()
            cur.execute("SELECT employee_label FROM employees WHERE employee_number = ?", (emp_num,))
            row = cur.fetchone()
            mgr_label = row[0] if row else ""
            clean_mgr = mgr_label.split("(")[0].strip()
            sql = (
                "SELECT employee_number, employee_label, job_title, department, location "
                "FROM employees WHERE manager LIKE ? OR manager LIKE ? LIMIT 100"
            )
            return PlannedStatement(
                statement_id="entity_reportees",
                sql=sql,
                params=[f"%{emp_num}%", f"%{clean_mgr}%"],
                purpose=f"Lookup employees reporting to {mgr_label}",
                expected_type="LIST",
            )

        sql = (
            "SELECT employee_number, first_name, last_name, employee_label, gender, location, state, "
            "department, job_level, job_title, manager, project, current_status, start_date, exit_date, "
            "annual_ctc, monthly_salary, prior_exp, infinite_exp, total_exp, salary_bin, primary_skill, "
            "date_of_birth, age "
            "FROM employees WHERE employee_number = ?"
        )
        return PlannedStatement(
            statement_id="entity_profile",
            sql=sql,
            params=[emp_num],
            purpose=f"Lookup profile for employee {emp_num}",
            expected_type="ENTITY",
        )

    def _plan_comparison(self, ir: QueryIR) -> List[PlannedStatement]:
        stmts: List[PlannedStatement] = []
        comp = ir.comparison
        if not comp:
            return stmts

        # Left Cohort SQL
        left_sql, left_params = self._build_cohort_sql(ir, comp.left.filters, comp.stratify_by)
        stmts.append(
            PlannedStatement(
                statement_id="comp_left",
                sql=left_sql,
                params=left_params,
                purpose=f"Calculate metrics for Left cohort ({comp.left.label})",
                cohort_label=comp.left.label,
                expected_type="BREAKDOWN" if comp.stratify_by else "AGGREGATE",
            )
        )

        # Right Cohort SQL
        if comp.right.kind == "BASELINE":
            right_sql, right_params = self._build_cohort_sql(ir, FilterGroup(), comp.stratify_by)
        else:
            right_sql, right_params = self._build_cohort_sql(ir, comp.right.filters, comp.stratify_by)

        stmts.append(
            PlannedStatement(
                statement_id="comp_right",
                sql=right_sql,
                params=right_params,
                purpose=f"Calculate metrics for Right cohort ({comp.right.label})",
                cohort_label=comp.right.label,
                expected_type="BREAKDOWN" if comp.stratify_by else "AGGREGATE",
            )
        )
        return stmts

    def _plan_baseline_statement(self, ir: QueryIR) -> PlannedStatement:
        """Calculates global ETS baseline over the entire workforce (or shared filters)."""
        select_parts = [self._sql_select_metric(m) for m in ir.metrics]
        joins = self._resolve_joins(ir.metrics)
        where_clause, params = self._build_where_clause(ir.filters)

        sql = f"SELECT {', '.join(select_parts)} FROM employees e {joins} {where_clause}"
        return PlannedStatement(
            statement_id="baseline_aggregate",
            sql=sql.strip(),
            params=params,
            purpose="Calculate overall ETS baseline for comparative threshold filtering",
            expected_type="BASELINE",
        )

    def _plan_core_statement(self, ir: QueryIR) -> PlannedStatement:
        """Builds the primary aggregate, multi-dimensional breakdown, or ranked statement."""
        select_cols: List[str] = []
        group_cols: List[str] = []

        # Row-level ranking without grouping (e.g., "Lowest annual CTC", "Highest salary", "Who has the longest tenure")
        if ir.intent == Intent.RANKING and not ir.grouping:
            primary_m = ir.metrics[0] if ir.metrics else None
            m_field = "e.annual_ctc"
            if primary_m:
                if primary_m.measure in ("ctc", "monthly_salary", "bonus"):
                    m_field = "e.annual_ctc"
                elif primary_m.measure in ("tenure", "experience"):
                    m_field = "e.infinite_exp"
                elif primary_m.measure == "age":
                    m_field = "e.age"
            select_cols = [
                "e.employee_number",
                "e.employee_label",
                "e.job_title",
                "e.department",
                "e.location",
                f"{m_field} AS annual_ctc" if m_field == "e.annual_ctc" else f"{m_field} AS {primary_m.measure if primary_m else 'val'}",
            ]
            if primary_m:
                select_cols.append(f"{m_field} AS {primary_m.key}")
        else:
            # 1. Multi-dimensional Grouping: ALL dimensions preserved! No truncation!
            for dim_key in ir.grouping:
                field_def = FIELDS[dim_key]
                select_cols.append(f"{field_def.sql} AS {dim_key}")
                group_cols.append(field_def.sql)

            # 2. Measures
            for m in ir.metrics:
                select_cols.append(self._sql_select_metric(m, ir.grouping or ir.dimensions))

        # Default columns for LIST / row queries or when select_cols is empty
        if not select_cols:
            select_cols = [
                "DISTINCT e.employee_number",
                "e.employee_label",
                "e.department",
                "e.job_title",
                "e.location",
                "e.current_status",
            ]

        # 3. From & Joins
        joins = self._resolve_joins(ir.metrics, ir.filters, ir.grouping or ir.dimensions)

        # 4. Where Clause
        where_clause, params = self._build_where_clause(ir.filters)

        # 5. Group By
        group_clause = f" GROUP BY {', '.join(group_cols)}" if group_cols else ""

        # 6. Having Clause for relative thresholds
        having_parts = []
        for t in ir.thresholds:
            if t.relative_to != "BASELINE" and t.scope == "GROUP" and t.value is not None:
                having_parts.append(f"{t.metric_key} {t.op} {t.value}")
        having_clause = f" HAVING {' AND '.join(having_parts)}" if having_parts else ""

        # 7. Order By
        order_clause = ""
        if ir.ordering:
            order_clause = f" ORDER BY {ir.ordering.metric_key} {ir.ordering.direction}"
        elif ir.grouping and ir.metrics:
            # Default order by primary metric descending
            order_clause = f" ORDER BY {ir.metrics[0].key} DESC"

        # 8. Limit
        limit_clause = f" LIMIT {ir.limit}" if ir.limit else ""

        sql = f"SELECT {', '.join(select_cols)} FROM employees e {joins} {where_clause}{group_clause}{having_clause}{order_clause}{limit_clause}"
        return PlannedStatement(
            statement_id="core_query",
            sql=sql.strip(),
            params=params,
            purpose="Core analytical query execution",
            expected_type="BREAKDOWN" if group_cols else ("LIST" if ir.intent == Intent.LIST else "AGGREGATE"),
        )

    def _build_cohort_sql(self, ir: QueryIR, cohort_filters: FilterGroup, stratify_by: List[str]) -> Tuple[str, List[Any]]:
        """Constructs metric SQL for a single comparison cohort."""
        select_cols = []
        group_cols = []

        for dim_key in stratify_by:
            field_def = FIELDS[dim_key]
            select_cols.append(f"{field_def.sql} AS {dim_key}")
            group_cols.append(field_def.sql)

        for m in ir.metrics:
            select_cols.append(self._sql_select_metric(m))

        # Combine cohort-specific filters with shared global filters
        combined_filters = FilterGroup(items=list(ir.filters.items) + list(cohort_filters.items))
        joins = self._resolve_joins(ir.metrics, combined_filters, stratify_by)
        where_clause, params = self._build_where_clause(combined_filters)
        group_clause = f" GROUP BY {', '.join(group_cols)}" if group_cols else ""

        sql = f"SELECT {', '.join(select_cols)} FROM employees e {joins} {where_clause}{group_clause}".strip()
        return sql, params

    # -------------------------------------------------------------------------
    # SQL Expression Helpers
    # -------------------------------------------------------------------------

    def _sql_select_metric(self, metric: MetricSpec, dimensions: Optional[List[str]] = None) -> str:
        m_def = MEASURES[metric.measure]
        key = metric.key

        if metric.measure == "headcount":
            return "COUNT(DISTINCT e.employee_number) AS count_headcount"

        if metric.measure == "attrition":
            return (
                "ROUND(CAST(COUNT(DISTINCT CASE WHEN e.current_status = 'Exited' THEN e.employee_number END) AS FLOAT) "
                "* 100.0 / NULLIF(COUNT(DISTINCT e.employee_number), 0), 2) AS rate_attrition"
            )

        if metric.measure == "concentration":
            tot = self.catalog.population_total or 590
            return f"ROUND(CAST(COUNT(DISTINCT e.employee_number) AS FLOAT) * 100.0 / {tot}, 2) AS share_concentration"

        if metric.measure == "skill_coverage":
            return "ROUND(AVG(COALESCE(sk.skill_cnt, 0)), 2) AS avg_skill_coverage"

        if metric.measure == "leave_utilization":
            return "ROUND(AVG(COALESCE(lv.leave_days, 0)), 2) AS avg_leave_utilization"

        if metric.measure == "hike":
            return f"ROUND(AVG(f.hike_percent * 100.0), 2) AS {key}"

        if metric.measure == "bonus":
            return f"ROUND(AVG(f.bonus), 2) AS {key}"

        # Standard numeric fields aggregated over employees table
        row_field = m_def.row_field
        if row_field and row_field in FIELDS:
            col_sql = FIELDS[row_field].sql
            dim_set = set(dimensions or [])
            if "year" in dim_set:
                if row_field == "ctc":
                    col_sql = "f.total_ctc"
                elif row_field == "monthly_salary":
                    col_sql = "f.monthly_salary"

            if metric.agg in ("AVG", "MEDIAN"):
                return f"ROUND(AVG({col_sql}), 2) AS {key}"
            elif metric.agg == "SUM":
                return f"ROUND(SUM({col_sql}), 2) AS {key}"
            elif metric.agg == "MIN":
                return f"MIN({col_sql}) AS {key}"
            elif metric.agg == "MAX":
                return f"MAX({col_sql}) AS {key}"

        return f"COUNT(*) AS {key}"

    def _resolve_joins(
        self,
        metrics: List[MetricSpec],
        filters: Optional[FilterGroup] = None,
        dimensions: Optional[List[str]] = None,
    ) -> str:
        """Determines auxiliary pre-aggregated joins needed for multi-table metrics, filters, and grouping dimensions."""
        joins = []
        needs = {need for m in metrics for need in MEASURES[m.measure].needs}

        filter_fields = {f.field for f in (filters.flat() if filters else [])}
        dim_fields = set(dimensions or [])

        if "skill" in filter_fields or "skill" in dim_fields:
            joins.append("JOIN (SELECT DISTINCT employee_number, skill_name FROM skills) s ON e.employee_number = s.employee_number")

        if "leave_type" in filter_fields or "leave_type" in dim_fields:
            joins.append("JOIN (SELECT DISTINCT employee_number, leave_type FROM leaves) l ON e.employee_number = l.employee_number")

        if "year" in filter_fields or "year" in dim_fields:
            if any(m.measure in ("ctc", "monthly_salary", "hike", "bonus") for m in metrics):
                joins.append("JOIN finance_history f ON e.employee_number = f.employee_number")
            else:
                joins.append("JOIN (SELECT DISTINCT employee_number, year FROM finance_history) f ON e.employee_number = f.employee_number")
        elif any(m.measure in ("hike", "bonus") for m in metrics) or "is_promotion" in filter_fields or "is_promotion" in dim_fields:
            joins.append("JOIN finance_history f ON e.employee_number = f.employee_number")

        if "skill_agg" in needs or "skill_count" in filter_fields:
            # Pre-aggregate skills to avoid duplicating employee rows
            joins.append(
                "LEFT JOIN (SELECT employee_number, COUNT(DISTINCT skill_name) AS skill_cnt "
                "FROM skills GROUP BY employee_number) sk ON e.employee_number = sk.employee_number"
            )

        if "leave_agg" in needs or "leave_days" in filter_fields:
            # Pre-aggregate leave days
            joins.append(
                "LEFT JOIN (SELECT employee_number, SUM(day_value) AS leave_days "
                "FROM leaves GROUP BY employee_number) lv ON e.employee_number = lv.employee_number"
            )

        return " " + " ".join(joins) if joins else ""

    def _build_where_clause(self, filter_group: FilterGroup) -> Tuple[str, List[Any]]:
        """Converts structured FilterGroup into parameterized SQL WHERE string."""
        clauses = []
        params = []
        for f in filter_group.flat():
            if f.field == "is_promotion":
                clauses.append("f.is_promotion = ?")
                params.append(f.value)
                continue

            f_def = FIELDS.get(f.field)
            if not f_def:
                continue
            col_sql = f_def.sql

            if f.op == "=":
                clauses.append(f"{col_sql} = ?")
                params.append(f.value)
            elif f.op == "!=":
                clauses.append(f"({col_sql} != ? OR {col_sql} IS NULL)")
                params.append(f.value)
            elif f.op in (">", "<", ">=", "<="):
                clauses.append(f"{col_sql} {f.op} ?")
                params.append(f.value)
            elif f.op == "IN" and isinstance(f.value, (list, tuple, set)):
                placeholders = ", ".join(["?"] * len(f.value))
                clauses.append(f"{col_sql} IN ({placeholders})")
                params.extend(list(f.value))
            elif f.op == "LIKE":
                clauses.append(f"{col_sql} LIKE ?")
                params.append(f.value)

        where_clause = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        return where_clause, params


query_planner = QueryPlanner()
