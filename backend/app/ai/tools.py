import time
from typing import Dict, Any, List, Optional
from backend.app.ai.call_tracker import record_rag_call
from backend.app.ai.db import sqlite_engine
from backend.app.ai.sql_governor import sql_governor
from backend.app.ai.semantic_rag import semantic_rag
from backend.app.analytics import analytics_engine

class GovernedToolRegistry:
    def __init__(self):
        self.sql_governor = sql_governor
        self.semantic_rag = semantic_rag
        self.analytics = analytics_engine

    def execute_sql(self, sql_query: str) -> Dict[str, Any]:
        """
        Executes a SELECT query against the governed SQLite in-memory database.
        Enforces AST validation, SELECT-only, table whitelist, and max row limits.
        """
        start = time.perf_counter()
        res = self.sql_governor.execute_governed(sql_query)
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        return {
            "tool": "governed_sql",
            "success": res.get("success", False),
            "sql": res.get("sanitized_sql", sql_query),
            "rows": res.get("rows", []),
            "row_count": res.get("row_count", 0),
            "duration_ms": duration_ms,
            "error": res.get("error")
        }

    def execute_analytics(self, domain: str, **kwargs) -> Dict[str, Any]:
        """
        Executes verified deterministic Python analytical calculations from AnalyticsEngine.
        Supported domains: 'home_kpis', 'calendar_kpis', 'salary_kpis', 'salary_trends', 'tech_kpis', 'state_kpis', 'employee_details'
        """
        start = time.perf_counter()
        data = None
        error = None
        try:
            if domain == "home_kpis":
                data = self.analytics.get_home_kpis()
            elif domain == "calendar_kpis":
                data = self.analytics.get_calendar_data()
            elif domain == "salary_kpis":
                data = self.analytics.get_salarywise_kpis()
            elif domain == "salary_trends":
                data = self.analytics.get_salarywise2_kpis()
            elif domain == "tech_kpis":
                data = self.analytics.get_techwise_kpis()
            elif domain == "state_kpis":
                data = self.analytics.get_statewise_kpis()
            elif domain == "employee_details":
                emp_id = kwargs.get("employee_number")
                if emp_id:
                    data = self.analytics.get_employee_details(int(emp_id))
                else:
                    error = "Missing employee_number parameter"
            else:
                error = f"Unsupported analytics domain: {domain}"
        except Exception as e:
            error = str(e)

        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        return {
            "tool": "governed_analytics",
            "domain": domain,
            "success": error is None and data is not None,
            "data": data,
            "duration_ms": duration_ms,
            "error": error
        }

    def execute_rag(self, query: str, top_k: int = 3, user_roles: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Retrieves authoritative organizational policies via local dense vector semantic similarity.
        Enforces role-based document authorization and minimum similarity threshold.
        """
        record_rag_call()
        start = time.perf_counter()
        res = self.semantic_rag.retrieve(query, top_k=top_k, user_roles=user_roles)
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        return {
            "tool": "semantic_rag",
            "query": query,
            "success": res.get("success", False),
            "documents": res.get("documents", []),
            "count": res.get("count", 0),
            "duration_ms": duration_ms,
            "error": res.get("error")
        }

tool_registry = GovernedToolRegistry()
