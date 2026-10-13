"""
ETS Genie — Semantic Execution Engine & AnalysisResult Builder.

Executes PlannedStatements against SQLite, computes deterministic calculations
(comparisons, deltas, percentages, ratios, baseline filters), and enforces NullPolicy.
Never returns raw None, nan, or unhandled exceptions.
"""
from __future__ import annotations

import math
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from backend.app.ai.db import sqlite_engine
from backend.app.ai.semantic.catalog import MEASURES
from backend.app.ai.semantic.ir import Calc, Intent, NullPolicy, QueryIR
from backend.app.ai.semantic.planner import ExecutionPlan


@dataclass
class ComparisonMetricResult:
    measure: str
    left_label: str
    left_value: Optional[float]
    right_label: str
    right_value: Optional[float]
    absolute_difference: Optional[float] = None
    signed_difference: Optional[float] = None
    percentage_difference: Optional[float] = None
    ratio: Optional[float] = None
    direction: Optional[str] = None
    unit: str = ""


@dataclass
class AnalysisResult:
    status: str  # "SUCCESS", "NO_DATA", "PARTIAL", "REFUSAL", "ERROR"
    ir: QueryIR
    rows: List[Dict[str, Any]] = field(default_factory=list)
    comparison_results: List[ComparisonMetricResult] = field(default_factory=list)
    baseline_values: Dict[str, Any] = field(default_factory=dict)
    summary_metric: Optional[Dict[str, Any]] = None
    filters_applied: List[str] = field(default_factory=list)
    executed_sqls: List[str] = field(default_factory=list)
    error_message: Optional[str] = None
    total_duration_ms: float = 0.0


class SemanticExecutor:
    def __init__(self, engine=None):
        self.engine = engine or sqlite_engine

    def execute(self, plan: ExecutionPlan) -> AnalysisResult:
        t0 = time.perf_counter()
        ir = plan.ir
        executed_sqls: List[str] = []
        result = AnalysisResult(status="SUCCESS", ir=ir)

        try:
            # 1. Baseline Statement (if required for relative thresholds or baseline comparison)
            baseline_row: Dict[str, Any] = {}
            for stmt in plan.statements:
                if stmt.expected_type == "BASELINE":
                    executed_sqls.append(stmt.sql)
                    params = getattr(stmt, "params", None) or None
                    b_rows = self.engine.execute_query(stmt.sql, params)
                    if b_rows and isinstance(b_rows, list) and len(b_rows) > 0:
                        baseline_row = b_rows[0]
                        result.baseline_values = baseline_row

            # 2. Entity Lookup Statement
            if ir.intent in (Intent.ENTITY_LOOKUP, Intent.NOT_FOUND):
                for stmt in plan.statements:
                    executed_sqls.append(stmt.sql)
                    params = getattr(stmt, "params", None) or None
                    rows = self.engine.execute_query(stmt.sql, params)
                    cleaned_rows = [self._sanitize_row(r, ir.null_policy) for r in rows]
                    result.rows = cleaned_rows
                    if ir.intent == Intent.NOT_FOUND or stmt.statement_id == "entity_not_found":
                        result.status = "NOT_FOUND"
                    else:
                        result.status = "SUCCESS" if cleaned_rows else "NO_DATA"
                result.executed_sqls = executed_sqls
                result.total_duration_ms = round((time.perf_counter() - t0) * 1000, 2)
                return result

            # 3. Comparison Statements
            if ir.intent == Intent.COMPARISON:
                left_rows: List[Dict[str, Any]] = []
                right_rows: List[Dict[str, Any]] = []

                for stmt in plan.statements:
                    executed_sqls.append(stmt.sql)
                    params = getattr(stmt, "params", None) or None
                    q_rows = self.engine.execute_query(stmt.sql, params)
                    cleaned = [self._sanitize_row(r, ir.null_policy) for r in q_rows]
                    if stmt.statement_id == "comp_left":
                        left_rows = cleaned
                    elif stmt.statement_id == "comp_right":
                        right_rows = cleaned

                # Combine into deterministic ComparisonMetricResult for each metric
                comp_spec = ir.comparison
                left_lbl = comp_spec.left.label if comp_spec else "Left"
                right_lbl = comp_spec.right.label if comp_spec else "Right"

                comp_results: List[ComparisonMetricResult] = []
                for m in ir.metrics:
                    m_key = m.key
                    m_def = MEASURES.get(m.measure)
                    unit = m_def.unit if m_def else ""

                    l_val = self._extract_numeric_val(left_rows, m_key)
                    r_val = self._extract_numeric_val(right_rows, m_key)

                    cmr = self._compute_comparison_metric(
                        measure=m.measure,
                        left_label=left_lbl,
                        left_val=l_val,
                        right_label=right_lbl,
                        right_val=r_val,
                        unit=unit,
                    )
                    comp_results.append(cmr)

                result.comparison_results = comp_results
                result.rows = left_rows + right_rows
                result.status = "SUCCESS"
                result.executed_sqls = executed_sqls
                result.total_duration_ms = round((time.perf_counter() - t0) * 1000, 2)
                return result

            # 4. Core Query Statement (Aggregate, Breakdown, Ranking)
            core_rows: List[Dict[str, Any]] = []
            for stmt in plan.statements:
                if stmt.expected_type in ("AGGREGATE", "BREAKDOWN", "LIST"):
                    executed_sqls.append(stmt.sql)
                    params = getattr(stmt, "params", None) or None
                    rows = self.engine.execute_query(stmt.sql, params)
                    core_rows = [self._sanitize_row(r, ir.null_policy) for r in rows]

            # 5. Apply Relative Baseline Thresholds in Python if requested
            if baseline_row and ir.thresholds:
                filtered_rows = []
                for r in core_rows:
                    matches_all = True
                    for t in ir.thresholds:
                        if t.relative_to == "BASELINE":
                            b_val = baseline_row.get(t.metric_key)
                            row_val = r.get(t.metric_key)
                            if b_val is not None and row_val is not None:
                                if t.op == ">" and not (row_val > b_val):
                                    matches_all = False
                                    break
                                elif t.op == "<" and not (row_val < b_val):
                                    matches_all = False
                                    break
                                elif t.op == ">=" and not (row_val >= b_val):
                                    matches_all = False
                                    break
                                elif t.op == "<=" and not (row_val <= b_val):
                                    matches_all = False
                                    break
                    if matches_all:
                        filtered_rows.append(r)
                core_rows = filtered_rows

            result.rows = core_rows
            result.status = "SUCCESS" if core_rows else "NO_DATA"

            # Primary summary metric for card display
            if core_rows and ir.intent == Intent.AGGREGATE and ir.metrics:
                primary_m = ir.metrics[0]
                result.summary_metric = {
                    "label": MEASURES[primary_m.measure].label,
                    "value": core_rows[0].get(primary_m.key),
                    "unit": MEASURES[primary_m.measure].unit,
                }

        except Exception as ex:
            result.status = "ERROR"
            result.error_message = str(ex)

        result.executed_sqls = executed_sqls
        result.total_duration_ms = round((time.perf_counter() - t0) * 1000, 2)
        return result

    # -------------------------------------------------------------------------
    # Deterministic Math Helpers
    # -------------------------------------------------------------------------

    def _extract_numeric_val(self, rows: List[Dict[str, Any]], key: str) -> Optional[float]:
        if not rows:
            return None
        v = rows[0].get(key)
        if v is None:
            return None
        try:
            val_f = float(v)
            return None if math.isnan(val_f) else val_f
        except (ValueError, TypeError):
            return None

    def _compute_comparison_metric(
        self,
        measure: str,
        left_label: str,
        left_val: Optional[float],
        right_label: str,
        right_val: Optional[float],
        unit: str,
    ) -> ComparisonMetricResult:
        res = ComparisonMetricResult(
            measure=measure,
            left_label=left_label,
            left_value=left_val,
            right_label=right_label,
            right_value=right_val,
            unit=unit,
        )

        if left_val is None or right_val is None:
            return res

        # 1. Absolute difference
        res.absolute_difference = round(abs(left_val - right_val), 2)

        # 2. Signed difference (Left - Right)
        res.signed_difference = round(left_val - right_val, 2)

        # 3. Direction & percentage difference (relative to lower cohort)
        if left_val > right_val:
            res.direction = "LEFT_HIGHER"
            if right_val > 0.0:
                res.percentage_difference = round(((left_val - right_val) / right_val) * 100.0, 2)
            res.ratio = round(left_val / right_val, 2) if right_val > 0.0 else None
        elif right_val > left_val:
            res.direction = "RIGHT_HIGHER"
            if left_val > 0.0:
                res.percentage_difference = round(((right_val - left_val) / left_val) * 100.0, 2)
            res.ratio = round(right_val / left_val, 2) if left_val > 0.0 else None
        else:
            res.direction = "EQUAL"
            res.percentage_difference = 0.0
            res.ratio = 1.0

        return res

    def _sanitize_row(self, row: Dict[str, Any], null_policy: NullPolicy) -> Dict[str, Any]:
        """Cleans null/nan values according to NullPolicy."""
        out = {}
        for k, v in row.items():
            if v is None:
                out[k] = "N/A" if null_policy == NullPolicy.REPORT_AS_UNKNOWN else None
            elif isinstance(v, float) and math.isnan(v):
                out[k] = "N/A" if null_policy == NullPolicy.REPORT_AS_UNKNOWN else None
            else:
                out[k] = v
        return out


semantic_executor = SemanticExecutor()
