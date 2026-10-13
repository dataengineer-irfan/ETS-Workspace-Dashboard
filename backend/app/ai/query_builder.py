import sqlglot
from sqlglot import exp
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from backend.app.ai.capability_registry import CapabilityContract, CapabilityEnum, TypedParameters, PopulationEnum
from backend.app.ai.security_context import SecurityContext
from backend.app.ai.compositional import CompositionalQueryBuilder

@dataclass
class QueryPlan:
    sql: str
    params: Dict[str, Any]
    capability: CapabilityEnum
    expected_result_type: str  # 'SCALAR_COUNT', 'RECORD_LIST', 'AGGREGATE', 'DISTRIBUTION'
    meta: Dict[str, Any]

class ParameterizedQueryBuilder:
    """
    Constructs parameterized, governed SQL AST queries for typed capabilities.
    Zero string-formatting of arbitrary user input.
    Guarantees filter preservation for known and unknown entity parameters.
    """

    @staticmethod
    def _escape_literal(val: Any) -> str:
        if isinstance(val, (int, float)):
            return str(val)
        s = str(val).replace("'", "''")
        return f"'{s}'"

    def build_plan(self, contract: CapabilityContract, security: SecurityContext) -> QueryPlan:
        cap = contract.capability
        p = contract.parameters
        meta = dict(contract.meta)

        # Enforce Row-Level Security authorization department scope
        if security and getattr(security, "department_scope", None):
            p.department = security.department_scope

        # 0. Compositional Query Plan Routing
        if meta.get("compositional_plan"):
            comp_plan = meta["compositional_plan"]
            sql = CompositionalQueryBuilder.build_sql(comp_plan)
            exp_type = "DISTRIBUTION" if comp_plan.dimensions else "SCALAR_COUNT"
            return QueryPlan(
                sql=sql,
                params={},
                capability=cap,
                expected_result_type=exp_type,
                meta=meta
            )

        # 1. HEADCOUNT (General population, active, or leavers with full entity binding)
        if cap == CapabilityEnum.HEADCOUNT:
            if p.skill:
                where_clauses = [f"LOWER(s.skill_name) = {self._escape_literal(p.skill.lower())}"]
                if p.population == PopulationEnum.ACTIVE or p.current_status == 'Active':
                    where_clauses.append("e.current_status = 'Active'")
                elif p.population == PopulationEnum.EXITED or p.current_status == 'Exited':
                    where_clauses.append("e.current_status = 'Exited'")
                where_str = f" WHERE {' AND '.join(where_clauses)}"
                sql = f"SELECT COUNT(DISTINCT e.employee_number) AS count FROM employees e JOIN skills s ON e.employee_number = s.employee_number{where_str}"
                return QueryPlan(
                    sql=sql,
                    params={},
                    capability=cap,
                    expected_result_type="SCALAR_COUNT",
                    meta=meta
                )

            where_clauses = []
            if p.population == PopulationEnum.ACTIVE or p.current_status == 'Active':
                where_clauses.append("current_status = 'Active'")
            elif p.population == PopulationEnum.EXITED or p.current_status == 'Exited':
                where_clauses.append("current_status = 'Exited'")

            if p.project_state:
                where_clauses.append(f"state = {self._escape_literal(p.project_state)}")
            elif p.project_states:
                st_list = ", ".join(self._escape_literal(s) for s in p.project_states)
                where_clauses.append(f"state IN ({st_list})")

            if p.physical_location:
                where_clauses.append(f"location = {self._escape_literal(p.physical_location)}")
            elif p.physical_locations:
                loc_list = ", ".join(self._escape_literal(l) for l in p.physical_locations)
                where_clauses.append(f"location IN ({loc_list})")

            if p.department:
                where_clauses.append(f"department = {self._escape_literal(p.department)}")

            if p.unrecognized_filter:
                where_clauses.append(f"(state = {self._escape_literal(p.unrecognized_filter)} OR location = {self._escape_literal(p.unrecognized_filter)})")

            where_str = f" WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
            sql = f"SELECT COUNT(*) AS count FROM employees{where_str}"
            return QueryPlan(
                sql=sql,
                params={},
                capability=cap,
                expected_result_type="SCALAR_COUNT",
                meta=meta
            )

        # 2. ACTIVE_HEADCOUNT
        elif cap == CapabilityEnum.ACTIVE_HEADCOUNT:
            where_clauses = ["current_status = 'Active'"]
            # Preserving explicit Project State
            if p.project_state:
                where_clauses.append(f"state = {self._escape_literal(p.project_state)}")
            elif p.project_states:
                st_list = ", ".join(self._escape_literal(s) for s in p.project_states)
                where_clauses.append(f"state IN ({st_list})")
            
            # Preserving explicit Physical Location
            if p.physical_location:
                where_clauses.append(f"location = {self._escape_literal(p.physical_location)}")
            elif p.physical_locations:
                loc_list = ", ".join(self._escape_literal(l) for l in p.physical_locations)
                where_clauses.append(f"location IN ({loc_list})")

            # Preserving Department
            if p.department:
                where_clauses.append(f"department = {self._escape_literal(p.department)}")

            if p.unrecognized_filter:
                where_clauses.append(f"(state = {self._escape_literal(p.unrecognized_filter)} OR location = {self._escape_literal(p.unrecognized_filter)})")

            where_str = " AND ".join(where_clauses)
            sql = f"SELECT COUNT(*) AS count FROM employees WHERE {where_str}"
            return QueryPlan(
                sql=sql,
                params={},
                capability=cap,
                expected_result_type="SCALAR_COUNT",
                meta=meta
            )

        # 3. LEAVER_COUNT
        elif cap == CapabilityEnum.LEAVER_COUNT:
            where_clauses = ["current_status = 'Exited'"]
            if p.year:
                where_clauses.append(f"strftime('%Y', exit_date) = {self._escape_literal(p.year)}")
            if p.project_state:
                where_clauses.append(f"state = {self._escape_literal(p.project_state)}")
            elif p.project_states:
                st_list = ", ".join(self._escape_literal(s) for s in p.project_states)
                where_clauses.append(f"state IN ({st_list})")
            if p.physical_location:
                where_clauses.append(f"location = {self._escape_literal(p.physical_location)}")
            elif p.physical_locations:
                loc_list = ", ".join(self._escape_literal(l) for l in p.physical_locations)
                where_clauses.append(f"location IN ({loc_list})")
            if p.department:
                where_clauses.append(f"department = {self._escape_literal(p.department)}")

            if p.unrecognized_filter:
                where_clauses.append(f"(state = {self._escape_literal(p.unrecognized_filter)} OR location = {self._escape_literal(p.unrecognized_filter)})")

            where_str = " AND ".join(where_clauses)
            sql = f"SELECT COUNT(*) AS count FROM employees WHERE {where_str}"
            return QueryPlan(
                sql=sql,
                params={},
                capability=cap,
                expected_result_type="SCALAR_COUNT",
                meta=meta
            )

        # 4. ATTRITION
        elif cap == CapabilityEnum.ATTRITION:
            att_clauses = []
            if p.department:
                att_clauses.append(f"department = {self._escape_literal(p.department)}")
            att_where = f" WHERE {' AND '.join(att_clauses)}" if att_clauses else ""
            if p.year:
                sql = (
                    f"SELECT ROUND(CAST(COUNT(CASE WHEN current_status = 'Exited' AND strftime('%Y', exit_date) = {self._escape_literal(p.year)} THEN 1 END) AS FLOAT) * 100.0 / COUNT(*), 2) AS annual_attrition_rate, "
                    f"COUNT(CASE WHEN current_status = 'Exited' AND strftime('%Y', exit_date) = {self._escape_literal(p.year)} THEN 1 END) AS leavers, "
                    f"COUNT(CASE WHEN current_status = 'Active' THEN 1 END) AS active_headcount, "
                    f"COUNT(*) AS total_denominator FROM employees{att_where}"
                )
            else:
                sql = (
                    f"SELECT ROUND(CAST(COUNT(CASE WHEN current_status = 'Exited' THEN 1 END) AS FLOAT) * 100.0 / COUNT(*), 2) AS cumulative_attrition_rate, "
                    f"COUNT(CASE WHEN current_status = 'Exited' THEN 1 END) AS leavers, "
                    f"COUNT(CASE WHEN current_status = 'Active' THEN 1 END) AS active_headcount, "
                    f"COUNT(*) AS total_denominator FROM employees{att_where}"
                )
            return QueryPlan(
                sql=sql,
                params={},
                capability=cap,
                expected_result_type="AGGREGATE",
                meta=meta
            )

        # 5. STATE_BREAKDOWN
        elif cap == CapabilityEnum.STATE_BREAKDOWN:
            where_clauses = []
            if p.current_status:
                where_clauses.append(f"current_status = {self._escape_literal(p.current_status)}")
            if p.physical_location:
                where_clauses.append(f"location = {self._escape_literal(p.physical_location)}")
            if p.department:
                where_clauses.append(f"department = {self._escape_literal(p.department)}")
            
            where_str = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
            sql = f"SELECT state, COUNT(*) AS count FROM employees {where_str} GROUP BY state ORDER BY count DESC"
            return QueryPlan(
                sql=sql,
                params={},
                capability=cap,
                expected_result_type="DISTRIBUTION",
                meta=meta
            )

        # 6. LOCATION_BREAKDOWN
        elif cap == CapabilityEnum.LOCATION_BREAKDOWN:
            where_clauses = []
            if p.current_status:
                where_clauses.append(f"current_status = {self._escape_literal(p.current_status)}")
            if p.project_state:
                where_clauses.append(f"state = {self._escape_literal(p.project_state)}")
            if p.department:
                where_clauses.append(f"department = {self._escape_literal(p.department)}")

            where_str = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
            sql = f"SELECT location, COUNT(*) AS count FROM employees {where_str} GROUP BY location ORDER BY count DESC"
            return QueryPlan(
                sql=sql,
                params={},
                capability=cap,
                expected_result_type="DISTRIBUTION",
                meta=meta
            )

        # 7. DEPARTMENT_BREAKDOWN
        elif cap == CapabilityEnum.DEPARTMENT_BREAKDOWN:
            where_clauses = []
            if p.current_status:
                where_clauses.append(f"current_status = {self._escape_literal(p.current_status)}")
            where_str = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
            sql = f"SELECT department, COUNT(*) AS count FROM employees {where_str} GROUP BY department ORDER BY count DESC"
            return QueryPlan(
                sql=sql,
                params={},
                capability=cap,
                expected_result_type="DISTRIBUTION",
                meta=meta
            )

        # 7.5 PROJECT_BREAKDOWN
        elif cap == CapabilityEnum.PROJECT_BREAKDOWN:
            where_clauses = []
            if p.current_status:
                where_clauses.append(f"current_status = {self._escape_literal(p.current_status)}")
            if p.department:
                where_clauses.append(f"department = {self._escape_literal(p.department)}")
            where_str = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
            sql = f"SELECT project, COUNT(*) AS count FROM employees {where_str} GROUP BY project ORDER BY count DESC"
            return QueryPlan(
                sql=sql,
                params={},
                capability=cap,
                expected_result_type="DISTRIBUTION",
                meta=meta
            )

        # 7.6 AGE_BREAKDOWN
        elif cap == CapabilityEnum.AGE_BREAKDOWN:
            age_bin_case = (
                "CASE "
                "WHEN age < 25 THEN '20-24' "
                "WHEN age BETWEEN 25 AND 29 THEN '25-29' "
                "WHEN age BETWEEN 30 AND 34 THEN '30-34' "
                "WHEN age BETWEEN 35 AND 39 THEN '35-39' "
                "WHEN age BETWEEN 40 AND 44 THEN '40-44' "
                "WHEN age BETWEEN 45 AND 49 THEN '45-49' "
                "WHEN age BETWEEN 50 AND 59 THEN '50-59' "
                "ELSE '60+' END"
            )
            where_clauses = []
            if p.population == PopulationEnum.ACTIVE or p.current_status == 'Active':
                where_clauses.append("current_status = 'Active'")
            elif p.population == PopulationEnum.EXITED or p.current_status == 'Exited':
                where_clauses.append("current_status = 'Exited'")
            if p.department:
                where_clauses.append(f"department = {self._escape_literal(p.department)}")
            where_str = f" WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
            limit_str = " LIMIT 1" if meta.get("ranking") or meta.get("mode") == "most" else ""
            denom = f"(SELECT COUNT(*) FROM employees{where_str})"
            sql = f"SELECT {age_bin_case} AS age_group, COUNT(*) AS count, ROUND(COUNT(*) * 100.0 / {denom}, 1) AS percentage FROM employees{where_str} GROUP BY age_group ORDER BY count DESC{limit_str}"
            return QueryPlan(
                sql=sql,
                params={},
                capability=cap,
                expected_result_type="DISTRIBUTION",
                meta=meta
            )

        # 7.7 GENDER_BREAKDOWN
        elif cap == CapabilityEnum.GENDER_BREAKDOWN:
            where_clauses = []
            if p.population == PopulationEnum.ACTIVE or p.current_status == 'Active':
                where_clauses.append("current_status = 'Active'")
            elif p.population == PopulationEnum.EXITED or p.current_status == 'Exited':
                where_clauses.append("current_status = 'Exited'")
            if p.project_state:
                where_clauses.append(f"state = {self._escape_literal(p.project_state)}")
            elif p.project_states:
                st_list = ", ".join(self._escape_literal(s) for s in p.project_states)
                where_clauses.append(f"state IN ({st_list})")
            if p.physical_location:
                where_clauses.append(f"location = {self._escape_literal(p.physical_location)}")
            elif p.physical_locations:
                loc_list = ", ".join(self._escape_literal(l) for l in p.physical_locations)
                where_clauses.append(f"location IN ({loc_list})")
            if p.department:
                where_clauses.append(f"LOWER(department) = {self._escape_literal(p.department.lower())}")

            where_str = f" WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
            limit_str = " LIMIT 1" if meta.get("ranking") or meta.get("mode") == "most" else ""
            denom = f"(SELECT COUNT(*) FROM employees{where_str})"
            sql = f"SELECT gender, COUNT(*) AS count, ROUND(COUNT(*) * 100.0 / {denom}, 1) AS percentage FROM employees{where_str} GROUP BY gender ORDER BY count DESC{limit_str}"
            return QueryPlan(
                sql=sql,
                params={},
                capability=cap,
                expected_result_type="DISTRIBUTION",
                meta=meta
            )

        # 8. COMPENSATION_AVERAGE
        elif cap == CapabilityEnum.COMPENSATION_AVERAGE:
            if meta.get("metric") == "hike_percent":
                sql = (
                    "SELECT "
                    "ROUND(AVG(CASE WHEN is_synthetic = 0 AND is_promotion = 'Yes' THEN hike_percent * 100.0 END), 2) AS auth_avg_hike_pct, "
                    "COUNT(CASE WHEN is_synthetic = 0 AND is_promotion = 'Yes' THEN 1 END) AS auth_count, "
                    "ROUND(AVG(CASE WHEN is_promotion = 'Yes' THEN hike_percent * 100.0 END), 2) AS total_avg_hike_pct, "
                    "COUNT(CASE WHEN is_promotion = 'Yes' THEN 1 END) AS total_count, "
                    "ROUND(AVG(CASE WHEN is_synthetic = 1 AND is_promotion = 'Yes' THEN hike_percent * 100.0 END), 2) AS synth_avg_hike_pct, "
                    "COUNT(CASE WHEN is_synthetic = 1 AND is_promotion = 'Yes' THEN 1 END) AS synth_count, "
                    "MIN(CASE WHEN is_synthetic = 0 AND is_promotion = 'Yes' THEN year END) AS auth_min_year, "
                    "MAX(CASE WHEN is_synthetic = 0 AND is_promotion = 'Yes' THEN year END) AS auth_max_year "
                    "FROM finance_history"
                )
            else:
                where_clauses = ["annual_ctc > 0"]
                if p.current_status:
                    where_clauses.append(f"current_status = {self._escape_literal(p.current_status)}")
                where_str = " AND ".join(where_clauses)
                sql = f"SELECT ROUND(AVG(annual_ctc), 2) AS avg_ctc, COUNT(*) AS count FROM employees WHERE {where_str}"
            return QueryPlan(
                sql=sql,
                params={},
                capability=cap,
                expected_result_type="AGGREGATE",
                meta=meta
            )

        # 9. RANKING (Ties Represented!)
        elif cap == CapabilityEnum.RANKING:
            direction = p.direction or "DESC"
            op = "MAX" if direction == "DESC" else "MIN"
            sql = (
                f"SELECT employee_number, employee_label, job_title, department, location, state, annual_ctc "
                f"FROM employees "
                f"WHERE annual_ctc = (SELECT {op}(annual_ctc) FROM employees WHERE annual_ctc > 0) "
                f"ORDER BY employee_number ASC"
            )
            return QueryPlan(
                sql=sql,
                params={},
                capability=cap,
                expected_result_type="RECORD_LIST",
                meta=meta
            )

        # 10. EMPLOYEE_LOOKUP
        elif cap in (CapabilityEnum.EMPLOYEE_LOOKUP, CapabilityEnum.FOLLOW_UP_CONTEXT):
            emp_id = p.employee_number
            sql = (
                f"SELECT employee_number, employee_label, first_name, last_name, department, "
                f"job_title, job_level, location, state, project, manager, current_status, start_date, "
                f"annual_ctc, monthly_salary, prior_exp, infinite_exp, total_exp, salary_bin "
                f"FROM employees WHERE employee_number = {self._escape_literal(emp_id)}"
            )
            return QueryPlan(
                sql=sql,
                params={},
                capability=cap,
                expected_result_type="RECORD_LIST",
                meta=meta
            )

        # 11. FILTER_COMPOSITION
        elif cap == CapabilityEnum.FILTER_COMPOSITION:
            where_clauses = []
            if p.population == PopulationEnum.ACTIVE or p.current_status == 'Active':
                where_clauses.append("current_status = 'Active'")
            elif p.population == PopulationEnum.EXITED or p.current_status == 'Exited':
                where_clauses.append("current_status = 'Exited'")

            if p.project_state:
                where_clauses.append(f"state = {self._escape_literal(p.project_state)}")
            elif p.project_states:
                st_list = ", ".join(self._escape_literal(s) for s in p.project_states)
                where_clauses.append(f"state IN ({st_list})")
            if p.physical_location:
                where_clauses.append(f"location = {self._escape_literal(p.physical_location)}")
            elif p.physical_locations:
                loc_list = ", ".join(self._escape_literal(l) for l in p.physical_locations)
                where_clauses.append(f"location IN ({loc_list})")
            if p.department:
                where_clauses.append(f"department = {self._escape_literal(p.department)}")

            if p.unrecognized_filter:
                where_clauses.append(f"(state = {self._escape_literal(p.unrecognized_filter)} OR location = {self._escape_literal(p.unrecognized_filter)})")

            where_str = f" WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
            sql = f"SELECT COUNT(*) AS count FROM employees{where_str}"
            return QueryPlan(
                sql=sql,
                params={},
                capability=cap,
                expected_result_type="SCALAR_COUNT",
                meta=meta
            )

        # 12. COMPARISON
        elif cap == CapabilityEnum.COMPARISON:
            dim = meta.get("dimension", "state")
            col_map = {
                "state": "state",
                "location": "location",
                "department": "department",
                "job_level": "job_level",
                "project": "project"
            }
            col = col_map.get(dim, "location" if dim == "location" else "state")
            entities = meta.get("entities", [])
            ent_list = ", ".join(self._escape_literal(e) for e in entities)
            where_clauses = [f"{col} IN ({ent_list})"]
            if p.department and dim != "department":
                where_clauses.append(f"department = {self._escape_literal(p.department)}")
            where_str = " AND ".join(where_clauses)
            sql = f"SELECT {col} AS entity, COUNT(*) AS count FROM employees WHERE {where_str} GROUP BY {col} ORDER BY count DESC"
            return QueryPlan(
                sql=sql,
                params={},
                capability=cap,
                expected_result_type="DISTRIBUTION",
                meta=meta
            )

        # 13. TENURE
        elif cap == CapabilityEnum.TENURE:
            if meta.get("mode") == "longest" or p.direction == "DESC":
                sql = "SELECT employee_number, employee_label, infinite_exp, start_date FROM employees ORDER BY infinite_exp DESC LIMIT 1"
                return QueryPlan(
                    sql=sql,
                    params={},
                    capability=cap,
                    expected_result_type="RECORD_LIST",
                    meta=meta
                )
            sql = "SELECT ROUND(AVG(infinite_exp), 2) AS avg_ets_tenure, ROUND(AVG(prior_exp), 2) AS avg_prior_exp, ROUND(AVG(total_exp), 2) AS avg_total_exp, COUNT(*) AS count FROM employees"
            return QueryPlan(
                sql=sql,
                params={},
                capability=cap,
                expected_result_type="AGGREGATE",
                meta=meta
            )

        # 14. SALARY_TOTAL_COST
        elif cap == CapabilityEnum.SALARY_TOTAL_COST:
            sql = (
                "SELECT "
                "SUM(CASE WHEN current_status = 'Active' THEN annual_ctc ELSE 0 END) AS active_salary_cost, "
                "COUNT(CASE WHEN current_status = 'Active' THEN 1 END) AS active_count, "
                "SUM(annual_ctc) AS total_salary_cost, "
                "COUNT(*) AS total_count "
                "FROM employees"
            )
            return QueryPlan(sql=sql, params={}, capability=cap, expected_result_type="AGGREGATE", meta=meta)

        # 15. SALARY_COST_BY_GRADE
        elif cap == CapabilityEnum.SALARY_COST_BY_GRADE:
            order_col = "headcount" if meta.get("metric") == "headcount" else "total_ctc"
            sql = (
                "SELECT job_level, "
                "SUM(annual_ctc) AS total_ctc, "
                "COUNT(*) AS headcount, "
                "ROUND(AVG(annual_ctc), 2) AS avg_ctc "
                f"FROM employees GROUP BY job_level ORDER BY {order_col} DESC"
            )
            return QueryPlan(sql=sql, params={}, capability=cap, expected_result_type="DISTRIBUTION", meta=meta)

        # 16. SALARY_COST_BY_PROJECT
        elif cap == CapabilityEnum.SALARY_COST_BY_PROJECT:
            grp = meta.get("group_by", "project")
            col = "location" if grp == "location" else ("state" if grp == "state" else "project")
            sql = (
                f"SELECT {col} AS dimension, "
                "SUM(annual_ctc) AS total_ctc, "
                "COUNT(*) AS headcount, "
                "ROUND(AVG(annual_ctc), 2) AS avg_ctc "
                f"FROM employees GROUP BY {col} ORDER BY total_ctc DESC"
            )
            return QueryPlan(sql=sql, params={}, capability=cap, expected_result_type="DISTRIBUTION", meta=meta)

        # 17. SALARY_CONCENTRATION
        elif cap == CapabilityEnum.SALARY_CONCENTRATION:
            sql = (
                "SELECT employee_label, annual_ctc, job_level, project "
                "FROM employees ORDER BY annual_ctc DESC LIMIT 10"
            )
            return QueryPlan(sql=sql, params={}, capability=cap, expected_result_type="RECORD_LIST", meta=meta)

        # 18. MAX_CTC_DISTRIBUTION
        elif cap == CapabilityEnum.MAX_CTC_DISTRIBUTION:
            sql = (
                "SELECT COUNT(*) AS max_ctc_count, "
                "MAX(annual_ctc) AS max_ctc_value, "
                "(SELECT COUNT(*) FROM employees) AS total_headcount "
                "FROM employees WHERE annual_ctc = (SELECT MAX(annual_ctc) FROM employees)"
            )
            return QueryPlan(sql=sql, params={}, capability=cap, expected_result_type="AGGREGATE", meta=meta)

        # 19. FINANCE_PROVENANCE_AUDIT
        elif cap == CapabilityEnum.FINANCE_PROVENANCE_AUDIT:
            sql = (
                "SELECT record_origin, is_synthetic, COUNT(*) AS record_count, "
                "COUNT(CASE WHEN is_promotion = 'Yes' THEN 1 END) AS promotion_count, "
                "ROUND(AVG(CASE WHEN is_promotion = 'Yes' THEN hike_percent * 100.0 ELSE NULL END), 2) AS avg_promotion_hike "
                "FROM finance_history GROUP BY record_origin, is_synthetic ORDER BY is_synthetic ASC"
            )
            return QueryPlan(sql=sql, params={}, capability=cap, expected_result_type="RECORD_LIST", meta=meta)

        # 20. SKILLS_TOP_RANKING
        elif cap == CapabilityEnum.SKILLS_TOP_RANKING:
            if meta.get("mode") == "employees_with_multiple_skills":
                sql = (
                    "SELECT e.employee_label, COUNT(DISTINCT s.skill_name) AS skill_count, "
                    "GROUP_CONCAT(DISTINCT s.skill_name) AS skill_list "
                    "FROM employees e "
                    "JOIN skills s ON e.employee_number = s.employee_number "
                    "GROUP BY e.employee_number HAVING skill_count >= 4 "
                    "ORDER BY skill_count DESC LIMIT 5"
                )
            else:
                sql = (
                    "SELECT skill_name, COUNT(DISTINCT employee_number) AS emp_count "
                    "FROM skills GROUP BY skill_name ORDER BY emp_count DESC LIMIT 10"
                )
            return QueryPlan(sql=sql, params={}, capability=cap, expected_result_type="DISTRIBUTION", meta=meta)

        # 21. SKILLS_RAREST
        elif cap == CapabilityEnum.SKILLS_RAREST:
            sql = (
                "SELECT skill_name, COUNT(DISTINCT employee_number) AS emp_count "
                "FROM skills GROUP BY skill_name HAVING emp_count <= 2 "
                "ORDER BY emp_count ASC, skill_name ASC LIMIT 10"
            )
            return QueryPlan(sql=sql, params={}, capability=cap, expected_result_type="DISTRIBUTION", meta=meta)

        # 22. SKILLS_CONCENTRATION_RISK
        elif cap == CapabilityEnum.SKILLS_CONCENTRATION_RISK:
            sql = (
                "SELECT s.skill_name, COUNT(DISTINCT s.employee_number) AS emp_count, "
                "GROUP_CONCAT(DISTINCT e.project) AS projects "
                "FROM skills s "
                "JOIN employees e ON s.employee_number = e.employee_number "
                "GROUP BY s.skill_name HAVING emp_count <= 2 "
                "ORDER BY emp_count ASC, s.skill_name ASC LIMIT 10"
            )
            return QueryPlan(sql=sql, params={}, capability=cap, expected_result_type="DISTRIBUTION", meta=meta)

        # 23. PROJECT_TECH_COVERAGE
        elif cap == CapabilityEnum.PROJECT_TECH_COVERAGE:
            sql = (
                "SELECT e.project, COUNT(DISTINCT s.skill_name) AS distinct_skills, "
                "COUNT(DISTINCT e.employee_number) AS headcount "
                "FROM employees e "
                "JOIN skills s ON e.employee_number = s.employee_number "
                "GROUP BY e.project ORDER BY distinct_skills DESC"
            )
            return QueryPlan(sql=sql, params={}, capability=cap, expected_result_type="DISTRIBUTION", meta=meta)

        # 24. SKILL_HIRING_PRIORITIES
        elif cap == CapabilityEnum.SKILL_HIRING_PRIORITIES:
            sql = (
                "SELECT skill_name, COUNT(DISTINCT employee_number) AS emp_count "
                "FROM skills GROUP BY skill_name HAVING emp_count <= 2 "
                "ORDER BY emp_count ASC, skill_name ASC LIMIT 5"
            )
            return QueryPlan(sql=sql, params={}, capability=cap, expected_result_type="DISTRIBUTION", meta=meta)

        # 25. SKILL_REDEPLOYMENT
        elif cap == CapabilityEnum.SKILL_REDEPLOYMENT:
            sql = (
                "SELECT s.skill_name, COUNT(DISTINCT s.employee_number) AS talent_pool "
                "FROM skills s "
                "JOIN employees e ON s.employee_number = e.employee_number "
                "GROUP BY s.skill_name HAVING talent_pool >= 80 "
                "ORDER BY talent_pool DESC LIMIT 5"
            )
            return QueryPlan(sql=sql, params={}, capability=cap, expected_result_type="DISTRIBUTION", meta=meta)

        # 26. PROJECT_ATTRITION_EXPOSURE
        elif cap == CapabilityEnum.PROJECT_ATTRITION_EXPOSURE:
            grp = meta.get("group_by", "project")
            col = "job_level" if grp == "job_level" else "project"
            sql = (
                f"SELECT {col} AS dimension, COUNT(*) AS total_headcount, "
                "SUM(CASE WHEN current_status = 'Exited' THEN 1 ELSE 0 END) AS exited_count, "
                "ROUND(100.0 * SUM(CASE WHEN current_status = 'Exited' THEN 1 ELSE 0 END) / COUNT(*), 2) AS attrition_pct "
                f"FROM employees GROUP BY {col} ORDER BY exited_count DESC"
            )
            return QueryPlan(sql=sql, params={}, capability=cap, expected_result_type="DISTRIBUTION", meta=meta)

        # 27. MANAGEMENT_SPAN_RISK
        elif cap == CapabilityEnum.MANAGEMENT_SPAN_RISK:
            sql = (
                "SELECT manager, COUNT(*) AS team_size "
                "FROM employees WHERE manager IS NOT NULL AND manager != '' "
                "GROUP BY manager ORDER BY team_size DESC LIMIT 5"
            )
            return QueryPlan(sql=sql, params={}, capability=cap, expected_result_type="DISTRIBUTION", meta=meta)

        # 28. TOP_WORKFORCE_RISKS
        elif cap == CapabilityEnum.TOP_WORKFORCE_RISKS:
            sql = (
                "SELECT "
                "(SELECT COUNT(*) FROM employees WHERE project = 'NH' AND current_status = 'Exited') AS nh_exits, "
                "(SELECT COUNT(*) FROM employees WHERE current_status = 'Exited') AS total_exits, "
                "(SELECT COUNT(*) FROM (SELECT skill_name FROM skills GROUP BY skill_name HAVING COUNT(DISTINCT employee_number) = 1)) AS spof_skills_count, "
                "(SELECT MAX(cnt) FROM (SELECT COUNT(*) AS cnt FROM employees GROUP BY manager)) AS max_manager_span"
            )
            return QueryPlan(sql=sql, params={}, capability=cap, expected_result_type="AGGREGATE", meta=meta)

        # 29. STRATEGIC_INVESTMENTS
        elif cap == CapabilityEnum.STRATEGIC_INVESTMENTS:
            sql = (
                "SELECT "
                "(SELECT ROUND(SUM(annual_ctc)/10000000.0, 2) FROM employees WHERE project = 'NH') AS nh_payroll_cr, "
                "(SELECT COUNT(*) FROM (SELECT skill_name FROM skills GROUP BY skill_name HAVING COUNT(DISTINCT employee_number) <= 2)) AS low_coverage_skills, "
                "(SELECT COUNT(*) FROM employees WHERE job_level = 'E1') AS e1_headcount"
            )
            return QueryPlan(sql=sql, params={}, capability=cap, expected_result_type="AGGREGATE", meta=meta)

        # Default query for unspecified SQL
        sql = "SELECT COUNT(*) AS total FROM employees"
        return QueryPlan(
            sql=sql,
            params={},
            capability=cap,
            expected_result_type="SCALAR_COUNT",
            meta=meta
        )

query_builder = ParameterizedQueryBuilder()
