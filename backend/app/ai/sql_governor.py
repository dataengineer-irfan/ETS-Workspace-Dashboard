import sqlglot
from sqlglot import exp
import time
from typing import Dict, Any, List, Optional
from backend.app.ai.db import sqlite_engine

ALLOWED_TABLES = {'employees', 'skills', 'leaves', 'finance_history'}
MAX_ROW_LIMIT = 200

class SQLGovernorError(Exception):
    pass

class SQLGovernor:
    def __init__(self, engine=sqlite_engine):
        self.engine = engine

    def validate_and_sanitize(self, sql_str: str) -> str:
        clean_sql = sql_str.strip().rstrip(';')
        # Remove any leading markdown code block ticks if LLM included them
        if clean_sql.startswith("```sql"):
            clean_sql = clean_sql[6:]
        elif clean_sql.startswith("```"):
            clean_sql = clean_sql[3:]
        if clean_sql.endswith("```"):
            clean_sql = clean_sql[:-3]
        clean_sql = clean_sql.strip()

        try:
            parsed = sqlglot.parse_one(clean_sql, read="sqlite")
        except Exception as e:
            raise SQLGovernorError(f"SQL Syntax parsing failure: {str(e)}")

        # 1. Enforce SELECT only
        if not isinstance(parsed, (exp.Select, exp.Union)):
            raise SQLGovernorError("Governed SQL policy violation: Only SELECT queries are permitted.")

        # 2. Check for disallowed expressions
        forbidden_types = (
            exp.Insert, exp.Update, exp.Delete, exp.Drop, exp.Alter,
            exp.Create, exp.Command, exp.Pragma
        )
        for node in parsed.walk():
            if isinstance(node, forbidden_types):
                raise SQLGovernorError(f"Governed SQL policy violation: Statement contains forbidden operation {type(node).__name__}.")

        # 3. Check table whitelist
        tables = {t.name.lower() for t in parsed.find_all(exp.Table)}
        for t in tables:
            if t not in ALLOWED_TABLES:
                raise SQLGovernorError(f"Governed SQL policy violation: Unauthorized table '{t}'. Allowed: {ALLOWED_TABLES}")

        # 4. Limit enforcement
        limit_exp = parsed.find(exp.Limit)
        if limit_exp is None:
            parsed = parsed.limit(100)
        else:
            try:
                curr_limit = int(limit_exp.expression.name)
                if curr_limit > MAX_ROW_LIMIT:
                    parsed = parsed.limit(MAX_ROW_LIMIT)
            except Exception:
                parsed = parsed.limit(100)

        return parsed.sql(dialect="sqlite")

    def execute_governed(self, sql_str: str) -> Dict[str, Any]:
        start_time = time.time()
        try:
            sanitized = self.validate_and_sanitize(sql_str)
            rows = self.engine.execute_query(sanitized)
            latency_ms = round((time.time() - start_time) * 1000, 2)
            return {
                "success": True,
                "sanitized_sql": sanitized,
                "row_count": len(rows),
                "rows": rows[:MAX_ROW_LIMIT],
                "latency_ms": latency_ms,
                "error": None
            }
        except SQLGovernorError as ge:
            return {
                "success": False,
                "sanitized_sql": sql_str,
                "row_count": 0,
                "rows": [],
                "latency_ms": round((time.time() - start_time) * 1000, 2),
                "error": str(ge)
            }
        except Exception as e:
            return {
                "success": False,
                "sanitized_sql": sql_str,
                "row_count": 0,
                "rows": [],
                "latency_ms": round((time.time() - start_time) * 1000, 2),
                "error": f"Execution error: {str(e)}"
            }

sql_governor = SQLGovernor()
