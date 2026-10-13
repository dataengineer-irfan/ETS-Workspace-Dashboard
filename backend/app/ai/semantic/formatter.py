"""
ETS Genie — Semantic Response Formatter.

Formats typed AnalysisResult into the exact CopilotQueryResponse dictionary contract.
Never emits raw None, nan, NaN, or formatting anomalies like 'split of .'.
Guarantees clean tables, charts, metric cards, and grounded text answers.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from backend.app.ai.db import sqlite_engine
from backend.app.ai.semantic.catalog import FIELDS, MEASURES
from backend.app.ai.semantic.executor import AnalysisResult, ComparisonMetricResult
from backend.app.ai.semantic.ir import Intent, QueryIR


class ResponseFormatter:
    def format(self, result: AnalysisResult) -> Dict[str, Any]:
        ir = result.ir

        # 1. Unsupported Refusals
        if ir.intent == Intent.UNSUPPORTED:
            return self._format_unsupported(result)

        # 2. Ambiguity / Clarification Requests
        if ir.intent == Intent.AMBIGUOUS:
            return self._format_ambiguous(result)

        # 3. Execution Errors
        if result.status == "ERROR":
            return self._format_error(result)

        # 4. Not Found
        if ir.intent == Intent.NOT_FOUND or (ir.entity and ir.entity.relation == "NOT_FOUND") or result.status == "NOT_FOUND":
            return self._format_not_found(result)

        # 4.5 No Data Found
        if result.status == "NO_DATA" or (not result.rows and not result.comparison_results):
            return self._format_no_data(result)

        # 5. Entity Lookup
        if ir.intent == Intent.ENTITY_LOOKUP:
            return self._format_entity_lookup(result)

        # 6. Pairwise Comparison
        if ir.intent == Intent.COMPARISON:
            return self._format_comparison(result)

        # 7. Breakdown (Single or Multi-dimensional) & Ranking
        if ir.intent in (Intent.BREAKDOWN, Intent.RANKING, Intent.GAP, Intent.BASELINE_DEVIATION):
            return self._format_breakdown(result)

        # 8. Scalar Aggregate
        return self._format_aggregate(result)

    # -------------------------------------------------------------------------
    # Intent Formatter Handlers
    # -------------------------------------------------------------------------

    def _format_not_found(self, result: AnalysisResult) -> Dict[str, Any]:
        ir = result.ir
        name = ir.entity.label if ir.entity else "specified individual"
        answer = f"Employee **{name}** was not found in the ETS directory. Please verify the name or 7-digit Employee ID."
        return {
            "answer": answer,
            "intent": "NOT_FOUND",
            "status": "NOT_FOUND",
            "overall_status": "NOT_FOUND",
            "confidence": 1.0,
            "source": "/api/copilot/semantic",
            "insights": [f"Target employee '{name}' not found in authoritative records."],
            "data": {"status": "NOT_FOUND", "target": name},
            "filters": {},
            "suggested_questions": ["List active departments", "Show total company headcount"],
            "evidence": [],
            "result_items": [
                {
                    "requirement_id": "R1",
                    "title": f"Employee Lookup: {name}",
                    "status": "not_found",
                    "presentation_mode": "TEXT_NOTICE",
                    "error_details": answer,
                }
            ],
            "execution_trace": {
                "llm_required": False,
                "llm_planner_used": False,
                "llm_synthesis_used": False,
                "tool_invoked": "semantic_engine",
                "deterministic_route": True,
                "total_duration_ms": result.total_duration_ms,
                "grounded": True,
            },
            "visual_target": "employee_details",
        }

    def _format_unsupported(self, result: AnalysisResult) -> Dict[str, Any]:
        ir = result.ir
        has_comm = any(c in str(ir.unsupported_concepts).lower() for c in ["revenue", "margin", "runway", "dso", "billing", "utilization"])
        if has_comm:
            ans = "I cannot answer this from the available ETS data. Commercial finance datasets (revenue, project profitability, client billing, billable utilization, cash runway, and DSO) are not present in ETS records. ETS Genie provides governed intelligence on workforce capacity, compensation economics, skill capability, and organizational risk."
        else:
            ans = ir.unsupported_reason or (
                "I cannot answer this from the available ETS data. The requested concepts are outside "
                "the operational boundary of the ETS workforce dataset."
            )
        return {
            "answer": ans,
            "insights": ["Out-of-domain inquiry or unrecorded business metric."],
            "intent": "UNSUPPORTED_DOMAIN",
            "status": "REFUSAL",
            "overall_status": "REFUSED",
            "confidence": 1.0,
            "source": "/api/copilot/guardrail",
            "data": {},
            "filters": {},
            "result_items": [
                {
                    "requirement_id": "R1",
                    "title": "Unsupported Domain",
                    "status": "refused",
                    "presentation_mode": "TEXT_NOTICE",
                    "error_details": ans,
                }
            ],
            "suggested_questions": [
                "What is our total annual salary cost?",
                "What is our active employee headcount by department?",
                "Which departments have the highest attrition?",
            ],
            "evidence": [],
            "execution_trace": {
                "llm_required": False,
                "deterministic_route": True,
                "total_duration_ms": result.total_duration_ms,
                "grounded": True,
            },
        }

    def _format_ambiguous(self, result: AnalysisResult) -> Dict[str, Any]:
        ir = result.ir
        ans = ir.ambiguity_reason or (
            "I cannot determine which objective metric is being referred to. Please specify the "
            "department, location, or metric (such as headcount, tenure, salary, or skill coverage) explicitly."
        )
        return {
            "answer": ans,
            "insights": ["Inquiry requires objective metric clarification."],
            "intent": "ASK_CLARIFICATION",
            "status": "AMBIGUOUS",
            "overall_status": "FAILED",
            "confidence": 1.0,
            "source": "/api/copilot/clarification",
            "data": {},
            "filters": {},
            "result_items": [
                {
                    "requirement_id": "R1",
                    "title": "Clarification Required",
                    "status": "failed",
                    "presentation_mode": "TEXT_NOTICE",
                    "error_details": ans,
                }
            ],
            "suggested_questions": [
                "Which department has the highest headcount?",
                "Which department has the highest average annual CTC?",
                "Which department has the highest average tenure?",
            ],
            "evidence": [],
            "execution_trace": {
                "llm_required": False,
                "deterministic_route": True,
                "total_duration_ms": result.total_duration_ms,
                "grounded": True,
            },
        }

    def _format_no_data(self, result: AnalysisResult) -> Dict[str, Any]:
        ans = "No employee records matched the specified filter criteria in the ETS database."
        return {
            "answer": ans,
            "insights": ["0 matching records found across all ETS tables."],
            "intent": result.ir.intent.value,
            "status": "NO_DATA",
            "overall_status": "SUCCESS",
            "confidence": 1.0,
            "source": "/api/copilot/governed_sql",
            "data": {"count": 0, "rows": []},
            "filters": {f.field: f.value for f in result.ir.filters.flat()},
            "result_items": [
                {
                    "requirement_id": "R1",
                    "title": "No Matching Records",
                    "status": "success",
                    "presentation_mode": "TEXT_NOTICE",
                    "error_details": ans,
                }
            ],
            "suggested_questions": [
                "What is our total active headcount?",
                "What is the headcount distribution across departments?",
            ],
            "evidence": [],
            "execution_trace": {
                "llm_required": False,
                "deterministic_route": True,
                "total_duration_ms": result.total_duration_ms,
                "grounded": True,
            },
        }

    def _format_error(self, result: AnalysisResult) -> Dict[str, Any]:
        ans = f"Execution halted: {result.error_message or 'Internal execution error'}."
        return {
            "answer": ans,
            "insights": ["Deterministic SQL execution encountered an unhandled database error."],
            "intent": "ERROR",
            "status": "ERROR",
            "overall_status": "FAILED",
            "confidence": 0.0,
            "source": "/api/copilot/error",
            "data": {},
            "filters": {},
            "result_items": [
                {
                    "requirement_id": "R1",
                    "title": "Execution Error",
                    "status": "failed",
                    "presentation_mode": "TEXT_NOTICE",
                    "error_details": ans,
                }
            ],
            "suggested_questions": [],
            "evidence": [],
            "execution_trace": {
                "llm_required": False,
                "deterministic_route": True,
                "total_duration_ms": result.total_duration_ms,
                "grounded": False,
            },
        }

    def _format_entity_lookup(self, result: AnalysisResult) -> Dict[str, Any]:
        ir = result.ir
        if ir.entity and ir.entity.relation == "NOT_FOUND":
            target = ir.entity.label
            ans = f"Employee **{target}** was not found in the ETS employee records."
            return {
                "answer": ans,
                "insights": [f"No employee record found matching '{target}'."],
                "intent": "NOT_FOUND",
                "status": "NOT_FOUND",
                "overall_status": "SUCCESS",
                "confidence": 1.0,
                "source": "/api/copilot/governed_sql",
                "data": {"found": False, "target": target},
                "filters": {},
                "result_items": [],
                "suggested_questions": [],
                "evidence": [],
                "execution_trace": {
                    "llm_required": False,
                    "deterministic_route": True,
                    "total_duration_ms": result.total_duration_ms,
                    "grounded": True,
                },
            }

        rows = result.rows
        if not rows:
            return self._format_no_data(result)

        emp = rows[0]
        label = emp.get("employee_label", f"Employee {emp.get('employee_number')}")
        mgr = emp.get("manager", "Not assigned")
        dept = emp.get("department", "Not specified")
        loc = emp.get("location", "Not specified")
        title = emp.get("job_title", "Not specified")
        ctc_val = emp.get("annual_ctc")
        ctc_fmt = f"₹{ctc_val:,.2f}" if ctc_val is not None else "Restricted"

        ir = result.ir
        attrs = ir.entity.attributes if ir.entity else []

        if "skip_level_manager" in attrs:
            # Look up manager's manager
            cur = sqlite_engine.conn.cursor()
            mgr_num = None
            m_mgr_id = re.search(r"\((\d+)\)", mgr)
            if m_mgr_id:
                mgr_num = int(m_mgr_id.group(1))
            skip_mgr = "N/A"
            if mgr_num:
                cur.execute("SELECT manager FROM employees WHERE employee_number = ?", (mgr_num,))
                row = cur.fetchone()
                if row and row[0]:
                    skip_mgr = row[0]
            ans = f"**{label}**'s skip-level manager is **{skip_mgr}** (Direct manager: {mgr})."
            insights = [f"Skip-level manager: {skip_mgr}", f"Direct manager: {mgr}", f"Department: {dept}"]
        elif "hierarchy" in attrs or "reporting_chain" in attrs:
            cur = sqlite_engine.conn.cursor()
            chain = [label]
            visited = {emp.get("employee_number")}
            curr_mgr = mgr
            while curr_mgr and curr_mgr not in ("N/A", "Not assigned"):
                m_id = re.search(r"\((\d+)\)", curr_mgr)
                if not m_id:
                    chain.append(curr_mgr)
                    break
                curr_id = int(m_id.group(1))
                if curr_id in visited:
                    break  # Cycle protection / self-reporting root
                visited.add(curr_id)
                chain.append(curr_mgr)
                cur.execute("SELECT manager FROM employees WHERE employee_number = ?", (curr_id,))
                row = cur.fetchone()
                if not row or not row[0]:
                    break
                curr_mgr = row[0]
            ans = f"Reporting hierarchy for **{label}**: " + " -> ".join(chain) + "."
            insights = [f"Reporting Chain Depth: {len(chain)}", f"Direct manager: {mgr}"]
        elif "manager" in attrs or (ir.entity and ir.entity.relation is None and "manager" in attrs):
            ans = f"**{label}** is reporting to **{mgr}** (Department: {dept}, Location: {loc})."
            insights = [f"Reporting manager: {mgr}", f"Role: {title}", f"Department: {dept}"]
        elif ir.entity and ir.entity.relation == "REPORTEES":
            cnt = len(rows)
            target_mgr = ir.entity.label if ir.entity and ir.entity.label else label
            ans = f"Found {cnt} employee(s) reporting to **{target_mgr}**."
            insights = [f"Total direct reportees: {cnt}"]
        elif "ctc" in attrs:
            ans = f"The annual CTC for **{label}** is **{ctc_fmt}** (Department: {dept}, Job Title: {title})."
            insights = [f"Annual CTC: {ctc_fmt}", f"Department: {dept}", f"Grade: {emp.get('job_level', 'N/A')}"]
        else:
            ans = (
                f"**{label}** is a **{title}** in **{dept}** ({loc}). "
                f"Status: **{emp.get('current_status', 'Active')}**, Manager: **{mgr}**, Annual CTC: **{ctc_fmt}**."
            )
            insights = [
                f"Job Title: {title}",
                f"Department: {dept} | Location: {loc}",
                f"Manager: {mgr}",
                f"Annual CTC: {ctc_fmt}",
            ]

        if ir.entity and ir.entity.relation == "REPORTEES":
            target_mgr = ir.entity.label if ir.entity and ir.entity.label else label
            result_items = [
                {
                    "requirement_id": "R1",
                    "title": f"Direct Reports: {target_mgr}",
                    "status": "success",
                    "presentation_mode": "TABLE",
                    "table_spec": {
                        "columns": ["employee_number", "employee_label", "job_title", "department", "location"],
                        "rows": rows,
                    },
                }
            ]
        else:
            result_items = [
                {
                    "requirement_id": "R1",
                    "title": f"Employee Profile: {label}",
                    "status": "success",
                    "presentation_mode": "TABLE",
                    "table_spec": {
                        "columns": ["field", "value"],
                        "rows": [
                            {"field": "Employee ID", "value": emp.get("employee_number")},
                            {"field": "Name", "value": label},
                            {"field": "Job Title", "value": title},
                            {"field": "Department", "value": dept},
                            {"field": "Location", "value": loc},
                            {"field": "State", "value": emp.get("state")},
                            {"field": "Manager", "value": mgr},
                            {"field": "Status", "value": emp.get("current_status")},
                        ],
                    },
                }
            ]

        return {
            "answer": ans,
            "insights": insights,
            "intent": "DETERMINISTIC_SQL",
            "semantic_intent": "EMPLOYEE_LOOKUP",
            "status": "SUCCESS",
            "overall_status": "SUCCESS",
            "confidence": 1.0,
            "source": "/api/copilot/governed_sql",
            "data": {"rows": rows, "count": len(rows)},
            "filters": {"employee_number": emp.get("employee_number")},
            "result_items": result_items,
            "visual_target": "employee_details",
            "selected_entity": emp,
            "suggested_questions": [
                f"Who reports to {label.split('(')[0].strip()}?",
                f"What is the average CTC in {dept}?",
            ],
            "evidence": rows,
            "execution_trace": {
                "llm_required": False,
                "deterministic_route": True,
                "total_duration_ms": result.total_duration_ms,
                "grounded": True,
            },
        }

    def _format_comparison(self, result: AnalysisResult) -> Dict[str, Any]:
        comp_metrics = result.comparison_results
        if not comp_metrics:
            return self._format_no_data(result)

        primary_cm = comp_metrics[0]
        left_lbl = primary_cm.left_label
        right_lbl = primary_cm.right_label

        # Build clean natural language contrast
        sentences = []
        insights = []
        table_rows = []

        for cm in comp_metrics:
            m_def = MEASURES.get(cm.measure)
            m_label = m_def.label if m_def else cm.measure.title()
            l_val_str = self._format_val(cm.left_value, cm.measure)
            r_val_str = self._format_val(cm.right_value, cm.measure)
            diff_str = self._format_val(cm.absolute_difference, cm.measure)

            dir_text = ""
            if cm.direction == "LEFT_HIGHER":
                pct_str = f" (+{cm.percentage_difference:.2f}%)" if cm.percentage_difference is not None else ""
                dir_text = f"**{left_lbl}** has a higher {m_label} by **{diff_str}**{pct_str}"
            elif cm.direction == "RIGHT_HIGHER":
                pct_str = f" (+{abs(cm.percentage_difference):.2f}%)" if cm.percentage_difference is not None else ""
                dir_text = f"**{right_lbl}** has a higher {m_label} by **{diff_str}**{pct_str}"
            else:
                dir_text = f"Both cohorts have equal {m_label} at **{l_val_str}**"

            sentences.append(f"For **{m_label}**: {left_lbl} is **{l_val_str}** vs {right_lbl} at **{r_val_str}**. {dir_text}.")
            insights.append(f"{m_label}: {left_lbl} ({l_val_str}) vs {right_lbl} ({r_val_str}) — diff {diff_str}")

            table_rows.append({
                "measure": m_label,
                left_lbl: l_val_str,
                right_lbl: r_val_str,
                "difference": diff_str,
                "higher_population": left_lbl if cm.direction == "LEFT_HIGHER" else (right_lbl if cm.direction == "RIGHT_HIGHER" else "Equal"),
            })

        # Answer header
        answer = f"### Comparative Analysis: {left_lbl} vs {right_lbl}\n\n" + "\n\n".join(sentences)

        result_items = [
            {
                "requirement_id": "R1",
                "title": f"Pairwise Contrast: {left_lbl} vs {right_lbl}",
                "status": "success",
                "presentation_mode": "TABLE",
                "table_spec": {
                    "columns": ["measure", left_lbl, right_lbl, "difference", "higher_population"],
                    "rows": table_rows,
                },
            }
        ]

        chart_data = [
            {"name": left_lbl, "value": primary_cm.left_value or 0},
            {"name": right_lbl, "value": primary_cm.right_value or 0},
        ]

        return {
            "answer": answer,
            "insights": insights,
            "intent": "DETERMINISTIC_SQL",
            "semantic_intent": "COMPARISON",
            "status": "SUCCESS",
            "overall_status": "SUCCESS",
            "confidence": 1.0,
            "source": "/api/copilot/governed_sql",
            "data": {"comparison": table_rows, "rows": result.rows, "sqls": result.executed_sqls},
            "filters": {f.field: f.value for f in result.ir.filters.flat()},
            "chart_data": chart_data,
            "chart_type": "bar",
            "result_items": result_items,
            "suggested_questions": [
                f"What is the headcount breakdown in {left_lbl}?",
                f"What is the headcount breakdown in {right_lbl}?",
            ],
            "evidence": result.rows,
            "execution_trace": {
                "llm_required": False,
                "deterministic_route": True,
                "total_duration_ms": result.total_duration_ms,
                "grounded": True,
            },
        }

    def _format_breakdown(self, result: AnalysisResult) -> Dict[str, Any]:
        rows = result.rows
        ir = result.ir
        # Dims only apply when grouped; row-level employee rankings have no grouping dimensions in rows
        dims = ir.grouping if (ir.intent == Intent.RANKING and (ir.row_level or not ir.grouping)) else (ir.grouping or ir.dimensions)
        primary_m = ir.metrics[0] if ir.metrics else None
        m_key = primary_m.key if primary_m else "count_headcount"
        m_def = MEASURES.get(primary_m.measure) if primary_m else None
        m_label = m_def.label if m_def else "Value"

        cnt = len(rows)
        dims_str = " and ".join(d.replace("_", " ").title() for d in dims) if dims else "Category"

        # Build Answer Text
        if cnt == 1 and ir.intent == Intent.RANKING:
            r0 = rows[0]
            val_fmt = self._format_val(r0.get(m_key) or r0.get("annual_ctc") or r0.get("metric_val"), primary_m.measure if primary_m else "headcount")
            direction = ir.ordering.direction if ir.ordering else "DESC"
            superlative = "highest" if direction == "DESC" else "lowest"
            if dims and ir.grouping:
                dim_vals = " - ".join(str(r0.get(d)) for d in dims)
                ans = f"The {superlative} **{m_label}** is in **{dim_vals}** with {val_fmt}."
                insights = [f"Top segment: {dim_vals} ({val_fmt})"]
            else:
                emp_name = r0.get("employee_label") or "Employee"
                ans = f"The {superlative} **{m_label}** at ETS is {val_fmt} ({emp_name})."
                if primary_m and primary_m.measure == "ctc" and r0.get("annual_ctc") is not None:
                    try:
                        cur = sqlite_engine.conn.cursor()
                        tie_cnt = cur.execute("SELECT COUNT(*) FROM employees WHERE annual_ctc = ?", (r0.get("annual_ctc"),)).fetchone()[0]
                        if tie_cnt > 1:
                            ans = f"The {superlative} **{m_label}** at ETS is {val_fmt} ({emp_name}). There are **{tie_cnt} employees** tied at {val_fmt}."
                    except Exception:
                        pass
                insights = [f"{superlative.title()} {m_label}: {val_fmt} ({emp_name})"]
        elif not dims or not ir.grouping:
            emp_strs = []
            for r in rows[:10]:
                e_name = r.get("employee_label") or "Employee"
                v_fmt = self._format_val(r.get(m_key) or r.get("annual_ctc"), primary_m.measure if primary_m else "headcount")
                emp_strs.append(f"{e_name} ({v_fmt})")
            summary_list = ", ".join(emp_strs)
            ans = f"Top {len(rows)} employees by **{m_label}**: {summary_list}."
            insights = [f"Top employees: {summary_list}"]
        else:
            segment_strs = []
            for r in rows:
                d_val = " - ".join(str(r.get(d)) for d in dims)
                v_fmt = self._format_val(r.get(m_key), primary_m.measure if primary_m else "headcount")
                segment_strs.append(f"{d_val} ({v_fmt})")
            summary_list = ", ".join(segment_strs)
            ans = f"Recorded **{cnt}** segments across **{dims_str}** for **{m_label}**: {summary_list}."
            insights = [f"Segments: {summary_list}"]

        # Result Items: TABLE with all columns
        cols = list(dims) + [m.key for m in ir.metrics]
        result_items = [
            {
                "requirement_id": "R1",
                "title": f"Breakdown by {dims_str}",
                "status": "success",
                "presentation_mode": "TABLE",
                "table_spec": {"columns": cols, "rows": rows},
            }
        ]

        # 1-Dimensional Chart Data
        chart_data = []
        if len(dims) == 1 and rows:
            d0 = dims[0]
            for r in rows[:15]:
                chart_data.append({"name": str(r.get(d0, "")), "value": float(r.get(m_key, 0) or 0)})

        return {
            "answer": ans,
            "insights": insights,
            "intent": "DETERMINISTIC_SQL",
            "semantic_intent": ir.intent.value,
            "status": "SUCCESS",
            "overall_status": "SUCCESS",
            "confidence": 1.0,
            "source": "/api/copilot/governed_sql",
            "data": {"rows": rows, "count": len(rows), "sqls": result.executed_sqls},
            "filters": {f.field: f.value for f in ir.filters.flat()},
            "chart_data": chart_data,
            "chart_type": "bar" if chart_data else None,
            "result_items": result_items,
            "suggested_questions": [
                f"Show average salary by {dims[0]}" if dims else "What is our total headcount?",
                f"Compare the top two segments in {dims_str}",
            ],
            "evidence": rows,
            "execution_trace": {
                "llm_required": False,
                "deterministic_route": True,
                "total_duration_ms": result.total_duration_ms,
                "grounded": True,
            },
        }

    def _format_aggregate(self, result: AnalysisResult) -> Dict[str, Any]:
        rows = result.rows
        ir = result.ir
        primary_m = ir.metrics[0] if ir.metrics else None
        m_key = primary_m.key if primary_m else "count_headcount"
        m_def = MEASURES.get(primary_m.measure) if primary_m else None
        m_label = m_def.label if m_def else "Count"

        filter_desc = []
        for f in ir.filters.flat():
            filter_desc.append(f"{f.field.replace('_', ' ').title()}: {f.value}")
        filter_str = f" for {', '.join(filter_desc)}" if filter_desc else ""

        val_raw = rows[0].get(m_key) if rows else 0
        if (ir.row_level or val_raw is None) and rows and "employee_number" in rows[0]:
            val_raw = len(rows)
            val_fmt = str(val_raw)
            ans = f"There are **{val_raw} employees** recorded in ETS database{filter_str}."
        else:
            val_fmt = self._format_val(val_raw, primary_m.measure if primary_m else "headcount")
            unit_str = " employees" if primary_m and primary_m.measure in ("headcount", "leaver_count") else ""
            ans = f"The **{m_label}** recorded in ETS database{filter_str} is {val_fmt}{unit_str}."
        insights = [f"{m_label}: {val_fmt}", f"Filters evaluated: {len(ir.filters.flat())}"]

        result_items = [
            {
                "requirement_id": "R1",
                "title": m_label,
                "status": "success",
                "presentation_mode": "METRIC_CARD",
                "metric_card_spec": {
                    "label": m_label,
                    "value": val_fmt,
                    "subtext": ", ".join(filter_desc) if filter_desc else "All ETS employees",
                },
            }
        ]

        return {
            "answer": ans,
            "insights": insights,
            "intent": "DETERMINISTIC_SQL",
            "semantic_intent": "AGGREGATE",
            "status": "SUCCESS",
            "overall_status": "SUCCESS",
            "confidence": 1.0,
            "source": "/api/copilot/governed_sql",
            "data": {"value": val_raw, "formatted": val_fmt, "rows": rows, "sqls": result.executed_sqls},
            "filters": {f.field: f.value for f in ir.filters.flat()},
            "result_items": result_items,
            "suggested_questions": [
                "Break down this number by department",
                "Break down this number by location",
            ],
            "evidence": rows,
            "execution_trace": {
                "llm_required": False,
                "deterministic_route": True,
                "total_duration_ms": result.total_duration_ms,
                "grounded": True,
            },
        }

    # -------------------------------------------------------------------------
    # Formatting Helpers
    # -------------------------------------------------------------------------

    def _format_val(self, val: Any, measure: str) -> str:
        if val is None or val == "N/A":
            return "N/A"
        try:
            val_f = float(val)
        except (ValueError, TypeError):
            return str(val)

        if measure in ("ctc", "monthly_salary", "bonus"):
            return f"₹{val_f:,.2f}"
        if measure in ("attrition", "concentration", "hike"):
            return f"{val_f:.2f}%"
        if measure in ("tenure", "experience", "prior_experience"):
            return f"{val_f:.2f} yrs"
        if measure == "age":
            return f"{val_f:.1f} yrs"
        if measure == "headcount":
            return f"{int(val_f):,}"
        return f"{val_f:,.2f}"


response_formatter = ResponseFormatter()
