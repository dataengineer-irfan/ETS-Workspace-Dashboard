"""
ETS Genie — Semantic Query Parser.

Transforms natural-language questions into the structured QueryIR.
Strictly decoupled from SQL generation and execution.
Uses the SemanticCatalog declarative lexicons and live schema domains.
No brittle regex routing trees.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Set, Tuple

from backend.app.ai.semantic.catalog import (
    AGG_WORDS,
    BASELINE_PHRASES,
    CASE_SENSITIVE_VALUES,
    COMPARE_CUES,
    COMPARATIVE_WORDS,
    COUNT_CUES,
    DIMENSION_NOUNS,
    DISCOURSE_FRAME_HEADS,
    DISCOURSE_FRAME_LEADS,
    EVALUATIVE_TERMS,
    FIELDS,
    FUNCTION_WORDS,
    GAP_NOUNS,
    GROUP_PREPS,
    KNOWN_NON_ETS_VALUES,
    LIST_CUES,
    LOOKUP_ATTRIBUTE_WORDS,
    MEASURE_NOUNS,
    MEASURES,
    NEGATION_PHRASES,
    NUMBER_WORDS,
    OUTLIER_PHRASES,
    PLURAL_DIMENSION_FORMS,
    POLICY_CUES,
    POPULATION_NOUNS,
    PRONOUN_REFS,
    RANK_IMPLIED_MEASURE,
    RANK_WORDS,
    REASONING_CUES,
    RELATIVE_AVG_PHRASES,
    ROW_TARGET_WORDS,
    STATUS_DEFAULT_WORDS,
    STRATIFY_PHRASES,
    STRUCTURE_NOUNS,
    SUM_IMPLYING_MEASURE_PHRASES,
    THRESHOLD_PHRASES,
    UNSUPPORTED_CONCEPTS,
    VALUE_ALIASES,
    SemanticCatalog,
    salary_band_surface_forms,
)
from backend.app.ai.semantic.ir import (
    Calc,
    Cohort,
    ComparisonSpec,
    EntityRef,
    FilterGroup,
    FilterSpec,
    FollowUp,
    Intent,
    IRStatus,
    MetricSpec,
    NullPolicy,
    OrderingSpec,
    QueryIR,
    ThresholdSpec,
)


class SemanticParser:
    def __init__(self, catalog: Optional[SemanticCatalog] = None):
        self.catalog = catalog or SemanticCatalog.get()
        self._build_surface_index()

    def _build_surface_index(self) -> None:
        """Build fast token-sequence matchers for value domains and aliases."""
        self.value_index: List[Tuple[str, str, str]] = []  # (phrase_lower, field_key, canonical_value)

        # 1. Departments
        for d in self.catalog.values.get("department", []):
            self.value_index.append((d.lower(), "department", d))
        for can, aliases in VALUE_ALIASES.get("department", {}).items():
            for a in aliases:
                self.value_index.append((a.lower(), "department", can))

        # 2. Locations
        for loc in self.catalog.values.get("location", []):
            self.value_index.append((loc.lower(), "location", loc))
        for can, aliases in VALUE_ALIASES.get("location", {}).items():
            for a in aliases:
                self.value_index.append((a.lower(), "location", can))

        # 3. States
        for st in self.catalog.values.get("state", []):
            self.value_index.append((st.lower(), "state", st))
        for can, aliases in VALUE_ALIASES.get("state", {}).items():
            for a in aliases:
                self.value_index.append((a.lower(), "state", can))

        # 4. Status
        for can, aliases in VALUE_ALIASES.get("status", {}).items():
            for a in aliases:
                self.value_index.append((a.lower(), "status", can))

        # 5. Gender
        for can, aliases in VALUE_ALIASES.get("gender", {}).items():
            for a in aliases:
                self.value_index.append((a.lower(), "gender", can))

        # 6. Job levels
        for jl in self.catalog.values.get("job_level", []):
            self.value_index.append((jl.lower(), "job_level", jl))
            self.value_index.append((f"grade {jl.lower()}", "job_level", jl))
            self.value_index.append((f"level {jl.lower()}", "job_level", jl))

        # 7. Salary bands
        for sb in self.catalog.values.get("salary_band", []):
            for form in salary_band_surface_forms(sb):
                self.value_index.append((form.lower(), "salary_band", sb))

        # 8. Job titles (all 43)
        for jt in self.catalog.values.get("job_title", []):
            self.value_index.append((jt.lower(), "job_title", jt))

        # 9. Skills
        schema_dimension_words = {
            'project', 'department', 'location', 'state', 'grade', 'level',
            'manager', 'workforce', 'employee', 'data', 'management', 'technical',
            'support', 'content', 'analysis', 'business', 'operations', 'service',
            'and', 'the', 'for', 'with', 'etc', 'application', 'planning', 'workflows',
            'gathering', 'tuning', 'manuals', 'studio', 'reporting', 'delivery',
        }
        for sk in self.catalog.values.get("skill", []):
            s_clean = str(sk).strip()
            if not s_clean:
                continue
            s_lower = s_clean.lower()
            self.value_index.append((s_lower, "skill", s_clean))
            # Also index constituent technology tokens (e.g. 'python', 'java', 'react', 'docker', 'k8s')
            parts = re.split(r'[\s/&(),+-]+', s_clean)
            for part in parts:
                p_clean = part.strip()
                p_lower = p_clean.lower()
                if len(p_clean) >= 3 and p_lower not in schema_dimension_words:
                    self.value_index.append((p_lower, "skill", s_clean))
                    if p_lower == "k8s":
                        self.value_index.append(("k8s", "skill", s_clean))
                    elif p_lower == "js":
                        self.value_index.append(("javascript", "skill", s_clean))

        # Sort longest phrase first so longer matches take precedence
        self.value_index.sort(key=lambda x: len(x[0]), reverse=True)

        # 10. Dynamic Employee Names from SQLite database
        self.employee_index: List[Tuple[str, int, str]] = []  # (name_token_lower, emp_num, full_label)
        try:
            cur = self.catalog.conn.cursor()
            cur.execute("SELECT employee_number, employee_label, first_name, last_name FROM employees")
            rows = cur.fetchall()
            STOP_TOKENS = {"test", "lead", "null", "none", "data", "tech", "team", "with", "from", "analyst", "engineer", "manager", "active", "core", "info"}
            token_map: Dict[str, List[Tuple[int, str]]] = {}
            for emp_num, emp_label, fn, ln in rows:
                clean_full = emp_label.split("(")[0].strip().lower()
                if clean_full:
                    self.employee_index.append((clean_full, emp_num, emp_label))
                # Also index constituent tokens (first name, last name, etc.)
                tokens = set(re.findall(r"[a-z]+", clean_full))
                for tok in tokens:
                    if len(tok) >= 4 and tok not in STOP_TOKENS:
                        token_map.setdefault(tok, []).append((emp_num, emp_label))
            # Include unique tokens or low-collision tokens (<= 2 employees)
            for tok, matches in token_map.items():
                if len(matches) <= 2:
                    self.employee_index.append((tok, matches[0][0], matches[0][1]))
            # Sort longest full names first
            self.employee_index.sort(key=lambda x: len(x[0]), reverse=True)
        except Exception:
            pass

    def parse(self, question: str, context: Optional[Dict[str, Any]] = None) -> QueryIR:
        ir = QueryIR(raw_question=question)
        ir.trace.append("parse_start")

        # Step 1: Preprocessing & Discourse Frame extraction
        norm_q, frame = self._extract_discourse_frame(question)
        # Strip parenthetical example expressions such as (<5L, 5-10L, 10-15L, etc.) or (e.g. ...)
        norm_q = re.sub(r'\s*\([^)]*(?:etc|e\.g\.|such as|i\.e\.)[^)]*\)', '', norm_q)
        ir.normalized_question = norm_q
        ir.discourse_frame = frame
        if frame:
            ir.trace.append(f"frame_extracted:{frame}")

        # Step 2: Unsupported Concepts Check
        for unsup_phrase, unsup_label in UNSUPPORTED_CONCEPTS.items():
            if re.search(rf"\b{re.escape(unsup_phrase)}\b", norm_q, re.IGNORECASE):
                ir.unsupported_concepts.append(unsup_label)
        if ir.unsupported_concepts:
            ir.intent = Intent.UNSUPPORTED
            ir.status = IRStatus.UNSUPPORTED
            ir.confidence = 1.0
            concepts_str = ", ".join(sorted(set(ir.unsupported_concepts)))
            ir.unsupported_reason = f"ETS records do not contain operational or forward-looking data for: {concepts_str}."
            ir.trace.append(f"unsupported_concepts_found:{concepts_str}")
            return ir

        # Step 3: Policy / Handbook Check
        for pol_cue in POLICY_CUES:
            if re.search(rf"\b{re.escape(pol_cue)}\b", norm_q, re.IGNORECASE):
                # Ensure it's not just an aggregate query mentioning policy
                if not any(re.search(rf"\b{re.escape(c)}\b", norm_q, re.IGNORECASE) for c in COUNT_CUES + ["compare", "average", "highest"]):
                    ir.intent = Intent.DELEGATE_POLICY
                    ir.status = IRStatus.DELEGATED
                    ir.confidence = 1.0
                    ir.trace.append(f"policy_detected:{pol_cue}")
                    return ir

        # Step 4: Entity Lookup Detection (Employee Specific)
        entity_ref = self._detect_employee_lookup(norm_q)
        if entity_ref:
            if entity_ref.relation == "NOT_FOUND":
                ir.intent = Intent.NOT_FOUND
                ir.status = IRStatus.NOT_FOUND
                ir.entity = entity_ref
                ir.confidence = 1.0
                ir.trace.append(f"entity_not_found:{entity_ref.label}")
                return ir
            ir.intent = Intent.ENTITY_LOOKUP
            ir.status = IRStatus.VALID
            ir.entity = entity_ref
            ir.confidence = 0.95
            ir.trace.append(f"entity_lookup:{entity_ref.label}:{entity_ref.attributes}")
            return ir

        # Step 5: Follow-Up / Context Pronouns Check
        hist = context.get("history") if context else None
        active_filters = context.get("active_filters") or {} if context else {}
        active_emp = active_filters.get("employee_number")

        # Guard: Check for unbound pronouns referring to an individual without context or selected profile
        has_pronoun = any(re.search(rf"\b{re.escape(p)}\b", norm_q, re.IGNORECASE) for p in PRONOUN_REFS)
        if has_pronoun and not active_emp and (not hist or len(hist) == 0):
            ir.intent = Intent.AMBIGUOUS
            ir.status = IRStatus.AMBIGUOUS
            ir.confidence = 1.0
            ir.ambiguity_reason = "Please select an employee profile or specify an employee name/ID in your question."
            ir.trace.append("pronoun_without_antecedent")
            return ir

        # Guard: Check for 'selected SDM' / 'selected manager' without active manager filter
        if re.search(r"\bselected\s+(?:sdm|manager)\b", norm_q, re.IGNORECASE) and not active_filters.get("manager"):
            ir.intent = Intent.AMBIGUOUS
            ir.status = IRStatus.AMBIGUOUS
            ir.confidence = 1.0
            ir.ambiguity_reason = "Please select a Delivery Manager from the dropdown or specify a manager name in your question."
            ir.trace.append("selected_manager_without_filter")
            return ir

        if hist and len(hist) > 0:
            q_clean = norm_q.lower().strip()
            is_followup = False
            if any(re.search(rf"\b{re.escape(p)}\b", norm_q, re.IGNORECASE) for p in PRONOUN_REFS):
                is_followup = True
            elif any(q_clean.startswith(p) for p in ["what about", "how about", "and in ", "what if"]):
                is_followup = True
            elif any(p in q_clean for p in [
                "which has more", "which one has more", "which is higher", "which is more",
                "which state has more", "which location has more", "which department has more",
                "what is the difference", "what's the difference", "by how much", "by how many",
                "how many more"
            ]) or q_clean in ["difference", "diff", "difference?", "what about difference"]:
                is_followup = True
            elif not any(w in q_clean for w in ["bangalore", "hyderabad", "chennai", "pune", "nd", "nh", "ak"]) and any(w in q_clean for w in ["active", "exited", "left", "leavers", "working"]):
                is_followup = True

            if is_followup:
                ir.intent = Intent.DELEGATE_CONTEXT
                ir.status = IRStatus.DELEGATED
                ir.confidence = 0.8
                ir.trace.append("context_followup_detected")
                return ir

        # Step 7: Parse Core Analytical Components
        # A. Detect all entity filters (departments, locations, states, status, etc.)
        detected_filters, spans_consumed = self._extract_filters(norm_q, ir=ir)

        # B. Detect all dimensions (explicit dimension nouns or group prepositions)
        detected_dims = self._extract_dimensions(norm_q, detected_filters)
        ir.dimensions = detected_dims

        # C. Detect Measures & Aggregations
        detected_metrics = self._extract_metrics(norm_q)
        ir.metrics = detected_metrics

        # D. Detect Stratification / Controlling-for
        stratify_dims = self._extract_stratification(norm_q)

        # E. Detect Comparison Intent & Cohorts
        comparison_spec = self._extract_comparison(norm_q, detected_filters, detected_metrics, stratify_dims)

        # F. Detect Gap Intent ("biggest gap in X between any two Y")
        gap_detected = any(re.search(rf"\b{re.escape(g)}\b", norm_q, re.IGNORECASE) for g in GAP_NOUNS) and any(
            w in norm_q.lower() for w in ["between any two", "between two", "gap in", "biggest gap", "largest gap"]
        )

        # G. Detect Baseline Deviation Intent ("unusual groups compared with baseline")
        outlier_detected = any(re.search(rf"\b{re.escape(o)}\b", norm_q, re.IGNORECASE) for o in OUTLIER_PHRASES)

        # H. Detect Ranking / Superlatives & Limits
        ordering, limit, is_row_level = self._extract_ranking(norm_q, detected_metrics, detected_dims)

        # I. Detect Thresholds (e.g., "above-average tenure", "headcount below 50")
        thresholds = self._extract_thresholds(norm_q, detected_metrics)

        # J. Detect Follow-Up instructions ("within each group identify...", "then provide second-level...")
        followups = self._extract_followups(norm_q)

        # K. Detect Evaluative Terms & Ambiguity
        eval_terms, eval_unresolved = self._check_evaluative_ambiguity(norm_q, detected_metrics)
        ir.evaluative_terms = eval_terms
        ir.evaluative_unresolved = eval_unresolved

        # Step 8: Intent Synthesis & IR Population
        if comparison_spec:
            ir.intent = Intent.COMPARISON
            ir.comparison = comparison_spec
            # Shared filters that apply to both cohorts
            ir.filters = self._extract_shared_filters(detected_filters, comparison_spec)
        elif gap_detected:
            ir.intent = Intent.GAP
            ir.grouping = detected_dims
            ir.filters = FilterGroup(items=[FilterSpec(f["field"], f["op"], f["value"]) for f in detected_filters])
        elif outlier_detected:
            ir.intent = Intent.BASELINE_DEVIATION
            ir.grouping = detected_dims
            ir.filters = FilterGroup(items=[FilterSpec(f["field"], f["op"], f["value"]) for f in detected_filters])
        elif ordering or limit:
            ir.intent = Intent.RANKING
            ir.ordering = ordering
            ir.limit = limit
            ir.row_level = is_row_level
            if not is_row_level:
                ir.grouping = detected_dims
            ir.filters = FilterGroup(items=[FilterSpec(f["field"], f["op"], f["value"]) for f in detected_filters])
        elif detected_dims:
            ir.intent = Intent.BREAKDOWN
            ir.grouping = detected_dims
            ir.filters = FilterGroup(items=[FilterSpec(f["field"], f["op"], f["value"]) for f in detected_filters])
        elif any(re.search(rf"\b{re.escape(l)}\b", norm_q, re.IGNORECASE) for l in LIST_CUES) and (is_row_level or detected_filters):
            ir.intent = Intent.LIST
            ir.row_level = True
            ir.filters = FilterGroup(items=[FilterSpec(f["field"], f["op"], f["value"]) for f in detected_filters])
        else:
            ir.intent = Intent.AGGREGATE
            ir.filters = FilterGroup(items=[FilterSpec(f["field"], f["op"], f["value"]) for f in detected_filters])

        # Step 8.5: Ambiguity Check BEFORE defaulting metrics
        if ir.evaluative_unresolved and not ir.metrics and ir.intent != Intent.COMPARISON:
            ir.intent = Intent.AMBIGUOUS
            ir.status = IRStatus.AMBIGUOUS
            ir.confidence = 1.0
            ir.ambiguity_reason = (
                f"Question contains evaluative term '{eval_terms[0]}' without specifying an objective metric "
                f"(such as headcount, tenure, salary, or skill coverage)."
            )
            ir.trace.append("evaluative_ambiguity_flagged")
            return ir

        # Step 9: Default Metric Resolution
        if not ir.metrics:
            if ir.intent == Intent.RANKING and ir.ordering:
                # Metric implied by ranking
                m_key = ir.ordering.metric_key
                agg = "COUNT" if m_key.startswith("count_") else ("SUM" if m_key.startswith("sum_") else "AVG")
                clean_m = m_key.replace("count_", "").replace("avg_", "").replace("sum_", "")
                ir.metrics = [MetricSpec(measure=clean_m, agg=agg, explicit_agg=False)]
            elif ir.intent in (Intent.AGGREGATE, Intent.BREAKDOWN, Intent.RANKING):
                ir.metrics = [MetricSpec(measure="headcount", agg="COUNT", explicit_agg=False)]
                ir.assumptions.append("Defaulted measure to headcount as no specific metric was requested.")

        # Step 10: Check Strategic / Reasoning Requirements
        has_reasoning = any(re.search(rf"\b{re.escape(r)}\b", norm_q, re.IGNORECASE) for r in REASONING_CUES)
        if has_reasoning or followups or (ir.intent == Intent.COMPARISON and len(ir.metrics) > 1 and "stronger" in norm_q.lower()):
            ir.reasoning_required = True
            if "prioritize" in norm_q.lower() or "recommend" in norm_q.lower():
                ir.reasoning_goal = "prioritization_recommendation"
            elif "stronger profile" in norm_q.lower() or "stronger" in norm_q.lower():
                ir.reasoning_goal = "profile_synthesis"

        ir.thresholds = thresholds
        ir.followups = followups

        # Step 12: Confidence Scoring
        ir.confidence = self._calculate_confidence(ir)
        ir.trace.append(f"parsed_intent:{ir.intent.value}:confidence:{ir.confidence:.2f}")

        return ir

    # -------------------------------------------------------------------------
    # Helper extraction methods
    # -------------------------------------------------------------------------

    def _extract_discourse_frame(self, text: str) -> Tuple[str, Optional[str]]:
        """Separates opening discourse framing (e.g. 'From an HR analytics perspective,') from core query."""
        m = re.match(
            r"^\s*(?:From\s+(?:an?\s+)?(?:HR\s+analytics|executive|leadership|workforce|management)\s+(?:perspective|point of view|lens|standpoint)|"
            r"Looking\s+at\s+the\s+(?:ETS\s+)?workforce|"
            r"For\s+(?:an?\s+)?(?:executive\s+review|leadership\s+review|the\s+Employee\s+Dashboard|management)|"
            r"Using\s+the\s+available\s+employee\s+data|"
            r"Based\s+on\s+(?:the\s+)?available\s+records)[,:\s]+\s*(.*)$",
            text,
            re.IGNORECASE,
        )
        if m:
            frame_len = len(text) - len(m.group(1))
            return m.group(1).strip(), text[:frame_len].strip().rstrip(",:")
        return text.strip(), None

    def _extract_filters(self, text: str, ir: Optional[Any] = None) -> Tuple[List[Dict[str, Any]], Set[Tuple[int, int]]]:
        """Scans for valid domain entity values (Department, Location, State, Status, etc.)."""
        text_lower = text.lower()
        filters: List[Dict[str, Any]] = []
        consumed_spans: Set[Tuple[int, int]] = set()

        # Intercept explicit state / location / department targeting with potential arbitrary/injection payloads:
        # e.g. "state <something>", "project state <something>", "location <something>", "department <something>"
        for field, prefix_pat in [
            ("state", r"\b(?:project\s+state|state|province)\s+([^\n\r?]+?)(?:\?|$)"),
            ("location", r"\b(?:location|office|campus|site)\s+([^\n\r?]+?)(?:\?|$)"),
            ("department", r"\b(?:department|dept|division)\s+([^\n\r?]+?)(?:\?|$)"),
        ]:
            m_target = re.search(prefix_pat, text, re.IGNORECASE)
            if m_target:
                raw_target = m_target.group(1).strip()
                t_start, t_end = m_target.span(1)
                # If raw_target contains quotes, SQL tokens, or punctuation (likely injection or exact string)
                if any(c in raw_target for c in ["'", '"', ";", "--", "=", "<", ">"]):
                    clean_val = raw_target.strip("'\" \t")
                    filters.append({"field": field, "op": "=", "value": clean_val, "span": (t_start, t_end), "raw": raw_target})
                    consumed_spans.add((t_start, t_end))

        # Explicit 2-letter uppercase codes after "in" or "for" (e.g. "in ZZ", "in in ZZ")
        explicit_2letter = re.finditer(r'\b(?:in|for)(?:\s+in)?\s+([A-Z]{2})\b', text)
        for em in explicit_2letter:
            c = em.group(1).strip()
            e_start, e_end = em.span(1)
            # Guard against departments (QA, IT, HR, PR) and common English words/prepositions
            if c in {'IN', 'OR', 'ME', 'IT', 'IS', 'AT', 'TO', 'NO', 'SO', 'IF', 'WE', 'ON', 'AS', 'BY', 'OF', 'QA', 'HR', 'PR'}:
                continue
            # Guard against tokens followed by 'department' or 'dept'
            if re.match(r'\s*(?:department|dept|division)', text[e_end:], re.IGNORECASE):
                continue
            if not any(not (e_end <= s or e_start >= e) for s, e in consumed_spans):
                filters.append({"field": "state", "op": "=", "value": c, "span": (e_start, e_end), "raw": c})
                consumed_spans.add((e_start, e_end))

        # Check for negation prefixes: "outside Bangalore", "excluding Core", etc.
        for phrase, field_key, canon_val in self.value_index:
            # Word boundary regex
            pat = rf"\b{re.escape(phrase)}\b"
            for match in re.finditer(pat, text_lower):
                start, end = match.span()

                # Guard against overlapping with already matched phrases
                if any(not (end <= s or start >= e) for s, e in consumed_spans):
                    continue

                # Case sensitive check for tricky words ('it', 'core', 'infra')
                if phrase in CASE_SENSITIVE_VALUES:
                    orig_token = text[start:end]
                    # 'IT' must be uppercase OR preceded by 'department'
                    if phrase == "it":
                        has_dept_context = bool(re.search(r"\b(?:department|dept|division)\s+$", text_lower[:start]))
                        if not (orig_token.isupper() or has_dept_context):
                            continue
                    elif phrase == "core":
                        has_dept_context = bool(re.search(r"\b(?:department|dept|division)\s+$", text_lower[:start]))
                        # 'core' is a common English word; accept if capitalized or with dept context or compared with another dept
                        if not (orig_token[0].isupper() or has_dept_context or "it" in text_lower or "cognos" in text_lower):
                            continue

                # Guard 'reporting' skill from managerial context ('reporting to', 'reporting manager', 'is reporting')
                if phrase == "reporting" and field_key == "skill":
                    if re.search(r"\breporting\s+to\b|\breporting\s+manager\b|\bis\s+reporting\b", text_lower):
                        continue

                # Guard 'delivery' from being matched as a skill
                if phrase in ("delivery", "deliveries") and field_key == "skill":
                    continue

                # Guard 'manager' job_title from dimension context ('by manager', 'which manager', 'per manager')
                if phrase in ("manager", "managers") and field_key == "job_title":
                    has_title_context = bool(re.search(r"\b(?:job\s+title|title|role|designation)\s*(?:is|=|:)?\s*$", text_lower[:start]))
                    if not has_title_context:
                        continue

                # Check if negated
                prefix = text_lower[max(0, start - 25) : start]
                is_negated = any(re.search(rf"\b{re.escape(neg)}\s*$", prefix) for neg in NEGATION_PHRASES)
                op = "!=" if is_negated else "="

                filters.append({"field": field_key, "op": op, "value": canon_val, "span": (start, end), "raw": text[start:end]})
                consumed_spans.add((start, end))

        # Unknown Project States: e.g. "state ZZ", "project state ZZ", "in project state ZZ"
        explicit_state_matches = re.finditer(r'(?:project\s+state|state|province)\s+([A-Za-z0-9_-]+)\b', text, re.IGNORECASE)
        for sm in explicit_state_matches:
            c = sm.group(1).strip()
            s_start, s_end = sm.span(1)
            if not any(not (s_end <= s or s_start >= e) for s, e in consumed_spans):
                non_state_words = {
                    "breakdown", "distribution", "wise", "split", "per", "level", "in", "the", "our", "all",
                    "which", "what", "who", "whom", "whose", "where", "when", "how", "why",
                    "has", "have", "had", "having", "is", "are", "was", "were", "be", "been", "being",
                    "for", "by", "across", "each", "every", "within", "to", "from", "at", "and", "or", "of",
                    "between", "among", "with", "without", "a", "an", "does", "did", "do", "will", "can",
                    "largest", "highest", "lowest", "most", "least", "best", "top", "bottom", "more", "less",
                    "code", "codes", "name", "names", "column", "columns", "list", "total", "average", "avg",
                    "count", "headcount", "salary", "band", "bands", "combinations", "combination",
                }
                if c.lower() not in non_state_words:
                    filters.append({"field": "state", "op": "=", "value": c.upper(), "span": (s_start, s_end), "raw": c})
                    if ir is not None:
                        ir.unresolved_entities.append({"field": "state", "raw": c, "value": c.upper(), "reason": f"Non-ETS state: {c}"})
                    consumed_spans.add((s_start, s_end))

        # Unknown Departments: e.g. "department XYZ", "dept XYZ", "XYZ department"
        non_dept_words = {
            "breakdown", "distribution", "wise", "split", "per", "level", "in", "the", "our", "all",
            "which", "what", "who", "whom", "whose", "where", "when", "how", "why",
            "has", "have", "had", "having", "is", "are", "was", "were", "be", "been", "being",
            "for", "by", "across", "each", "every", "within", "to", "from", "at", "and", "or", "of",
            "between", "among", "with", "without", "a", "an", "does", "did", "do", "will", "can",
            "largest", "highest", "lowest", "most", "least", "best", "top", "bottom", "more", "less",
            "code", "codes", "name", "names", "column", "columns", "list", "total", "average", "avg",
            "count", "headcount", "tenure", "experience", "salary", "ctc", "hike", "attrition",
            "any", "no", "some", "combinations", "combination",
        }
        # Post-fix: "department XYZ"
        for dm in re.finditer(r'\b(?:department|dept|division)\s+([A-Za-z0-9_-]+)\b', text, re.IGNORECASE):
            c = dm.group(1).strip()
            d_start, d_end = dm.span(1)
            if not any(not (d_end <= s or d_start >= e) for s, e in consumed_spans):
                if c.lower() not in non_dept_words:
                    val = c.upper() if len(c) <= 3 else c.title()
                    filters.append({"field": "department", "op": "=", "value": val, "span": (d_start, d_end), "raw": c})
                    if ir is not None:
                        ir.unresolved_entities.append({"field": "department", "raw": c, "value": val, "reason": f"Non-ETS department: {c}"})
                    consumed_spans.add((d_start, d_end))

        # Pre-fix: "XYZ department"
        for dm in re.finditer(r'\b([A-Za-z0-9_-]+)\s+(?:department|dept|division)\b', text, re.IGNORECASE):
            c = dm.group(1).strip()
            d_start, d_end = dm.span(1)
            if not any(not (d_end <= s or d_start >= e) for s, e in consumed_spans):
                if c.lower() not in non_dept_words:
                    val = c.upper() if len(c) <= 3 else c.title()
                    filters.append({"field": "department", "op": "=", "value": val, "span": (d_start, d_end), "raw": c})
                    if ir is not None:
                        ir.unresolved_entities.append({"field": "department", "raw": c, "value": val, "reason": f"Non-ETS department: {c}"})
                    consumed_spans.add((d_start, d_end))

        # Known Non-ETS Values: location, state, department (e.g. Mumbai, Delhi, Texas, Sales, Marketing)
        for f_key in ("location", "state", "department"):
            for non_ets_val in KNOWN_NON_ETS_VALUES.get(f_key, []):
                pat = rf"\b{re.escape(non_ets_val)}\b"
                for m in re.finditer(pat, text_lower):
                    s_start, s_end = m.span()
                    if not any(not (s_end <= s or s_start >= e) for s, e in consumed_spans):
                        val = non_ets_val.upper() if len(non_ets_val) <= 3 else non_ets_val.title()
                        filters.append({"field": f_key, "op": "=", "value": val, "span": (s_start, s_end), "raw": text[s_start:s_end]})
                        if ir is not None:
                            ir.unresolved_entities.append({"field": f_key, "raw": text[s_start:s_end], "value": val, "reason": f"Non-ETS {f_key}: {val}"})
                        consumed_spans.add((s_start, s_end))

        # Promotion / Non-Promotion filters
        m_np = re.search(r"\b(?:non-promotion|non promotion|without promotion|no promotion)\b", text_lower)
        if m_np:
            filters.append({"field": "is_promotion", "op": "=", "value": "No", "span": m_np.span(), "raw": m_np.group(0)})
            consumed_spans.add(m_np.span())

        for m_p in re.finditer(r"\bpromotions?\b", text_lower):
            if not any(not (m_p.span()[1] <= s or m_p.span()[0] >= e) for s, e in consumed_spans):
                filters.append({"field": "is_promotion", "op": "=", "value": "Yes", "span": m_p.span(), "raw": m_p.group(0)})
                consumed_spans.add(m_p.span())
                break

        return filters, consumed_spans

    def _extract_dimensions(self, text: str, filters: List[Dict[str, Any]]) -> List[str]:
        """Detects grouping dimensions requested in the query."""
        dims: List[str] = []
        text_lower = text.lower()

        # Age distribution / demographic profile
        if any(w in text_lower for w in ["age distribution", "age breakdown", "age group", "age groups", "age demographics"]):
            if "age_group" not in dims:
                dims.append("age_group")

        # Check explicit dimension nouns
        for dim_key, noun_list in DIMENSION_NOUNS.items():
            for noun in noun_list:
                # Guard 'project' from matching 'project state' (which refers strictly to the state dimension)
                if dim_key == "project" and re.search(r"\bproject\s+states?\b", text_lower):
                    clean_without_proj_state = re.sub(r"\bproject\s+states?\b", "", text_lower)
                    if not re.search(rf"\b{re.escape(noun)}\b", clean_without_proj_state):
                        continue

                # Dimension requested with grouping prefix (e.g. "by department", "across states", "per location")
                # OR as compound dimension ("department-location combinations")
                # OR in "breakdown by X"
                compound_dim = "(?:location|department|salary\\s+band)" if dim_key == "project" else "(?:location|department|state|salary\\s+band)"
                dim_pat = rf"(?:(?:by|across|per|each|every|within|split\s+by|grouped\s+by|break\s+down\s+by)\s+(?:the\s+)?{re.escape(noun)}\b|{re.escape(noun)}[- ]{compound_dim}\b|\b(?:which|what)\s+{re.escape(noun)}\b|\b{re.escape(noun)}\s+combinations?\b|\b{re.escape(noun)}\s+(?:breakdown|distribution|split|wise|matrix)\b)"
                if re.search(dim_pat, text_lower):
                    if dim_key not in dims:
                        dims.append(dim_key)
                    break
                # Dimension connected via conjunction following a grouping preposition:
                # e.g. "by department and location", "across department and salary band"
                elif re.search(rf"\b(?:by|across|per|split by|grouped by|break down by)\s+[a-z_\s]+?\b(?:and|,)\s+(?:the\s+)?{re.escape(noun)}\b", text_lower):
                    if dim_key not in dims:
                        dims.append(dim_key)
                    break
                # Plural form appearing in breakdown contexts: "across departments", "compare across states"
                elif noun in PLURAL_DIMENSION_FORMS and re.search(rf"\b{re.escape(noun)}\b", text_lower):
                    if dim_key not in dims:
                        dims.append(dim_key)
                    break

        # Check matrix / cross-tab requests e.g. "manager grade competency matrix"
        if "matrix" in text_lower:
            for dim_key, noun_list in DIMENSION_NOUNS.items():
                for noun in noun_list:
                    # Guard 'manager' from matching 'manager grade' (which modifies the grade level)
                    if dim_key == "manager" and re.search(r"\bmanager\s+grades?\b", text_lower):
                        continue
                    if re.search(rf"\b{re.escape(noun)}\b.*?\bmatrix\b", text_lower):
                        if dim_key not in dims:
                            dims.append(dim_key)
                        break

        # Check compound hyphenated dimensions e.g. "department-location" or "location-department"
        m_compound = re.search(r"\b(department|location|state|salary band)[- ](department|location|state|salary band)\b", text_lower)
        if m_compound:
            d1, d2 = m_compound.group(1), m_compound.group(2)
            for k in [d1, d2]:
                k_norm = "salary_band" if k == "salary band" else k
                if k_norm in FIELDS and k_norm not in dims:
                    dims.append(k_norm)

        return dims

    def _extract_metrics(self, text: str) -> List[MetricSpec]:
        """Identifies metric(s) and aggregation functions requested in the query."""
        metrics: List[MetricSpec] = []
        text_lower = text.lower()

        # 1. Flatten all (noun, measure_key) pairs and sort by length descending
        # This guarantees "monthly salary" matches before "salary", "prior experience" before "experience",
        # and "total experience" before "experience"!
        all_measure_phrases: List[Tuple[str, str]] = []
        for m_key, noun_list in MEASURE_NOUNS.items():
            for noun in noun_list:
                all_measure_phrases.append((noun.lower(), m_key))
        all_measure_phrases.sort(key=lambda x: len(x[0]), reverse=True)

        consumed_spans: Set[Tuple[int, int]] = set()

        for noun, m_key in all_measure_phrases:
            pat = rf"\b{re.escape(noun)}\b"
            for match in re.finditer(pat, text_lower):
                start, end = match.span()
                if any(s <= start and end <= e for s, e in consumed_spans):
                    continue

                # Guard 'age' metric from dimension contexts ('age group', 'age distribution', 'age breakdown')
                if m_key == "age" and re.search(r"\bage\s+(?:group|groups|distribution|breakdown)\b", text_lower):
                    continue

                agg = MEASURES[m_key].default_agg
                explicit = False

                # Proximity-based aggregator binding (nearest agg word within 45 chars)
                nearest_agg = None
                nearest_dist = 9999
                for agg_word, agg_code in AGG_WORDS.items():
                    for m_agg in re.finditer(rf"\b{re.escape(agg_word)}\b", text_lower):
                        w_start, w_end = m_agg.span()
                        # If the aggregation word is internal to the measure phrase (e.g. 'total' in 'total experience'), skip it
                        if w_start >= start and w_end <= end:
                            continue
                        dist = (start - w_end) if w_end <= start else ((w_start - end) if w_start >= end else 0)
                        if dist < nearest_dist and dist <= 45:
                            nearest_dist = dist
                            nearest_agg = agg_code
                if nearest_agg:
                    agg = nearest_agg
                    explicit = True

                # Check sum-implying phrases
                if noun in SUM_IMPLYING_MEASURE_PHRASES:
                    agg = "SUM"
                    explicit = True

                # Avoid duplicate measure with same key
                if not any(m.measure == m_key for m in metrics):
                    metrics.append(MetricSpec(measure=m_key, agg=agg, explicit_agg=explicit))
                consumed_spans.add((start, end))

        # 2. Check for Count intent if no other metric found
        if not metrics and any(re.search(rf"\b{re.escape(c)}\b", text_lower) for c in COUNT_CUES):
            metrics.append(MetricSpec(measure="headcount", agg="COUNT", explicit_agg=True))

        return metrics

    def _extract_stratification(self, text: str) -> List[str]:
        """Detects 'after controlling for X', 'adjusting for Y' dimensions."""
        text_lower = text.lower()
        strat_dims: List[str] = []
        for strat_phrase in STRATIFY_PHRASES:
            m = re.search(rf"{re.escape(strat_phrase)}\s+([a-z\s]+?)(?:\?|$|,)", text_lower)
            if m:
                target = m.group(1).strip()
                for dim_key, noun_list in DIMENSION_NOUNS.items():
                    if any(n in target for n in noun_list):
                        if dim_key not in strat_dims:
                            strat_dims.append(dim_key)
        return strat_dims

    def _extract_comparison(
        self,
        text: str,
        filters: List[Dict[str, Any]],
        metrics: List[MetricSpec],
        stratify_dims: List[str],
    ) -> Optional[ComparisonSpec]:
        """Identifies Pairwise Comparisons (e.g. IT vs Core, Bangalore vs Hyderabad, Active vs Exited)."""
        text_lower = text.lower()
        has_compare_cue = any(re.search(rf"\b{re.escape(c)}\b", text_lower) for c in COMPARE_CUES)
        has_than_cue = bool(re.search(r"\b(?:higher|lower|more|less|greater)\b.*?\bthan\b", text_lower) or " than " in text_lower)
        if not has_compare_cue and not has_than_cue and not any(re.search(rf"\b{re.escape(w)}\b", text_lower) for w in ["differ between", "differs between", "higher than"]):
            return None

        # Check if we have two distinct cohorts in the query
        # Pattern 1: "between X and Y" / "compare X with Y"
        m_between = None
        if "between " in text_lower:
            m_between = re.search(r"\bbetween\s+(.+?)\s+(?:and|versus|vs\.?)\s+(.+?)(?:\s+(?:after|using|across|in|by|for|\?|$)|$)", text_lower)
        if not m_between:
            m_between = re.search(r"\b(?:between|compare)\s+(.+?)\s+(?:and|with|versus|vs\.?)\s+(.+?)(?:\s+(?:after|using|across|in|by|for|\?|$)|$)", text_lower)

        # Pattern 2: "higher/lower is X than Y" / "is X than Y"
        m_than = re.search(r"\b(?:higher|lower|more|less|greater)?\s*is\s+(.+?)(?:'s)?\s+[a-z\s]*?\s+than\s+(.+?)(?:'s)?(?:\?|$)", text_lower)

        left_cohort: Optional[Cohort] = None
        right_cohort: Optional[Cohort] = None

        if m_between:
            left_str = m_between.group(1).strip()
            right_str = m_between.group(2).strip()

            sorted_by_len = sorted(filters, key=lambda f: len(f.get("raw", "")), reverse=True)
            left_filters = [f for f in sorted_by_len if re.search(rf"(?<![\w-]){re.escape(f['raw'].lower())}(?![\w-])", left_str)]
            right_filters = [f for f in sorted_by_len if re.search(rf"(?<![\w-]){re.escape(f['raw'].lower())}(?![\w-])", right_str)]

            if left_filters:
                seen_lf = set()
                deduped_l = []
                for f in left_filters:
                    if f["field"] not in seen_lf:
                        seen_lf.add(f["field"])
                        deduped_l.append(f)
                left_filters = deduped_l

            if right_filters:
                seen_rf = set()
                deduped_r = []
                for f in right_filters:
                    if f["field"] not in seen_rf:
                        seen_rf.add(f["field"])
                        deduped_r.append(f)
                right_filters = deduped_r

            if left_filters and right_filters:
                left_cohort = Cohort(
                    label=left_filters[0]["value"],
                    filters=FilterGroup(items=[FilterSpec(f["field"], f["op"], f["value"]) for f in left_filters]),
                )
                right_cohort = Cohort(
                    label=right_filters[0]["value"],
                    filters=FilterGroup(items=[FilterSpec(f["field"], f["op"], f["value"]) for f in right_filters]),
                )
            elif left_filters and any(b in right_str for b in BASELINE_PHRASES):
                left_cohort = Cohort(label=left_filters[0]["value"], filters=FilterGroup(items=[FilterSpec(f["field"], f["op"], f["value"]) for f in left_filters]))
                right_cohort = Cohort(label="Overall ETS Baseline", kind="BASELINE")

        elif m_than:
            left_str = m_than.group(1).strip()
            right_str = m_than.group(2).strip()
            sorted_by_len = sorted(filters, key=lambda f: len(f.get("raw", "")), reverse=True)
            left_filters = [f for f in sorted_by_len if re.search(rf"(?<![\w-]){re.escape(f['raw'].lower())}(?![\w-])", left_str)]
            right_filters = [f for f in sorted_by_len if re.search(rf"(?<![\w-]){re.escape(f['raw'].lower())}(?![\w-])", right_str)]
            if left_filters:
                seen_lf = set()
                deduped_l = []
                for f in left_filters:
                    if f["field"] not in seen_lf:
                        seen_lf.add(f["field"])
                        deduped_l.append(f)
                left_filters = deduped_l

            if right_filters:
                seen_rf = set()
                deduped_r = []
                for f in right_filters:
                    if f["field"] not in seen_rf:
                        seen_rf.add(f["field"])
                        deduped_r.append(f)
                right_filters = deduped_r

            if left_filters and right_filters:
                left_cohort = Cohort(
                    label=left_filters[0]["value"],
                    filters=FilterGroup(items=[FilterSpec(f["field"], f["op"], f["value"]) for f in left_filters]),
                )
                right_cohort = Cohort(
                    label=right_filters[0]["value"],
                    filters=FilterGroup(items=[FilterSpec(f["field"], f["op"], f["value"]) for f in right_filters]),
                )

        # Fallback: if 2+ filters and (compare or than cue), use first filter as Left and second as Right based on appearance in text
        if not left_cohort and len(filters) >= 2 and (has_compare_cue or has_than_cue):
            # Sort filters by position in text
            sorted_filters = sorted(filters, key=lambda f: f["span"][0])
            left_cohort = Cohort(label=sorted_filters[0]["value"], filters=FilterGroup(items=[FilterSpec(sorted_filters[0]["field"], sorted_filters[0]["op"], sorted_filters[0]["value"])]))
            right_cohort = Cohort(label=sorted_filters[1]["value"], filters=FilterGroup(items=[FilterSpec(sorted_filters[1]["field"], sorted_filters[1]["op"], sorted_filters[1]["value"])]))

        if not left_cohort or not right_cohort:
            return None

        # Determine calculation requirements
        calcs = [Calc.ABSOLUTE_DIFF.value, Calc.SIGNED_DIFF.value, Calc.PCT_DIFF.value, Calc.DIRECTION.value]
        expected_dir = None
        for comp_word, dir_code in COMPARATIVE_WORDS.items():
            if re.search(rf"\b{re.escape(comp_word)}\b", text_lower):
                expected_dir = "LEFT_HIGHER" if dir_code == "HIGHER" else "LEFT_LOWER"
                break

        return ComparisonSpec(
            left=left_cohort,
            right=right_cohort,
            calculations=calcs,
            expected_direction=expected_dir,
            stratify_by=stratify_dims,
        )

    def _extract_shared_filters(self, all_filters: List[Dict[str, Any]], comp: ComparisonSpec) -> FilterGroup:
        """Filters that apply to the whole query, not cohort-specific."""
        left_vals = {f.value for f in comp.left.filters.flat()}
        right_vals = {f.value for f in comp.right.filters.flat()}
        shared = [
            FilterSpec(f["field"], f["op"], f["value"])
            for f in all_filters
            if f["value"] not in left_vals and f["value"] not in right_vals
        ]
        return FilterGroup(items=shared)

    def _extract_ranking(self, text: str, metrics: List[MetricSpec], dims: Optional[List[str]] = None) -> Tuple[Optional[OrderingSpec], Optional[int], bool]:
        """Extracts TOP N / HIGHEST / LOWEST ranking orders."""
        dims = dims or []
        text_lower = text.lower()
        ordering: Optional[OrderingSpec] = None
        limit: Optional[int] = None
        is_row_level = any(re.search(rf"\b{re.escape(w)}\b", text_lower) for w in ["who", "whom", "which employee", "which staff", "which person", "names of", "earner", "earners", "individuals"])

        # 1. Top N pattern: "top 3", "top three", "bottom 5"
        m_top = re.search(r"\b(top|bottom)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b", text_lower)
        if m_top:
            direction = "DESC" if m_top.group(1) == "top" else "ASC"
            num_str = m_top.group(2)
            limit = int(num_str) if num_str.isdigit() else NUMBER_WORDS.get(num_str, 3)
            metric_key = metrics[0].key if metrics else "count_headcount"
            ordering = OrderingSpec(metric_key=metric_key, direction=direction)
            return ordering, limit, is_row_level

        # 2. Superlatives: "highest", "lowest", "longest tenure", "most employees"
        for rank_word, direction in RANK_WORDS.items():
            if re.search(rf"\b{re.escape(rank_word)}\b", text_lower):
                # If rank_word is min/max/minimum/maximum and there are NO grouping dimensions and not row_level:
                # it's an aggregation function (MIN/MAX), NOT a ranking!
                if rank_word in ("minimum", "min", "maximum", "max") and not dims and not is_row_level:
                    continue
                limit = 1
                metric_key = metrics[0].key if metrics else "count_headcount"
                # Check if superlative implies a measure
                if rank_word in RANK_IMPLIED_MEASURE:
                    implied_m = RANK_IMPLIED_MEASURE[rank_word]
                    metric_key = f"avg_{implied_m}"
                    if not metrics:
                        metrics.append(MetricSpec(measure=implied_m, agg="AVG", explicit_agg=False))
                ordering = OrderingSpec(metric_key=metric_key, direction=direction)
                return ordering, limit, is_row_level

        # 3. Check for "which <dim> ... more" e.g. "which age group we have more employees", "which department has more"
        if re.search(r"\bwhich\s+[a-z_\s]+?\bmore\b", text_lower):
            limit = 1
            metric_key = metrics[0].key if metrics else "count_headcount"
            ordering = OrderingSpec(metric_key=metric_key, direction="DESC")
            return ordering, limit, is_row_level

        return None, None, is_row_level

    def _extract_thresholds(self, text: str, metrics: List[MetricSpec]) -> List[ThresholdSpec]:
        """Detects numeric thresholds (e.g. above 10 lakhs) and relative thresholds (above-average)."""
        thresholds: List[ThresholdSpec] = []
        text_lower = text.lower()

        # 1. Relative threshold phrases: "above-average average tenure", "below-average employee concentration"
        for phrase, op in RELATIVE_AVG_PHRASES.items():
            # Match phrase followed by measure noun
            pat = rf"{re.escape(phrase)}\s+([a-z\s]+?)(?:\s*(?:and|or|\?|$)|$)"
            for m in re.finditer(pat, text_lower):
                target_phrase = m.group(1).strip()
                target_m = None
                for m_key, noun_list in MEASURE_NOUNS.items():
                    if any(noun in target_phrase for noun in noun_list):
                        target_m = m_key
                        break
                if target_m:
                    m_key_full = f"avg_{target_m}" if target_m not in ("headcount", "concentration", "attrition") else target_m
                    if not any(t.metric_key == m_key_full and t.op == op for t in thresholds):
                        thresholds.append(ThresholdSpec(metric_key=m_key_full, op=op, relative_to="BASELINE", scope="GROUP"))

        # 2. Absolute numeric thresholds: "CTC above 10 lakhs", "tenure > 5 years"
        for phrase, op in THRESHOLD_PHRASES.items():
            pat = rf"\b{re.escape(phrase)}\s+(?:₹|inr|rs\.?)?\s*(\d+(?:\.\d+)?)\s*(lakhs?|lacs?|l|crores?|cr|k|years?|yrs?)?"
            for m in re.finditer(pat, text_lower):
                val_num = float(m.group(1))
                unit = (m.group(2) or "").lower()
                if unit in ("lakh", "lakhs", "lac", "lacs", "l"):
                    val_num *= 100000.0
                elif unit in ("crore", "crores", "cr"):
                    val_num *= 10000000.0
                elif unit == "k":
                    val_num *= 1000.0

                m_key_full = metrics[0].key if metrics else "avg_ctc"
                thresholds.append(ThresholdSpec(metric_key=m_key_full, op=op, value=val_num, scope="ROW"))

        return thresholds

    def _extract_followups(self, text: str) -> List[FollowUp]:
        """Detects multi-step analytical instructions in compound prompts."""
        followups: List[FollowUp] = []
        text_lower = text.lower()

        # "within each group, identify the strongest and weakest state segment"
        m_extremes = re.search(r"within\s+each\s+group[,\s]+identify\s+the\s+(?:strongest\s+and\s+weakest|highest\s+and\s+lowest)\s+([a-z\s]+?)\s+segment", text_lower)
        if m_extremes:
            target_dim = m_extremes.group(1).strip()
            dim_key = target_dim.replace(" ", "_")
            followups.append(FollowUp(kind="WITHIN_GROUP_EXTREMES", dimensions=[dim_key]))

        # "then provide a second-level breakdown by location"
        m_second = re.search(r"(?:then\s+provide\s+a\s+)?second[- ]level\s+breakdown\s+by\s+([a-z\s]+?)(?:\?|$|\.)", text_lower)
        if m_second:
            target_dim = m_second.group(1).strip()
            dim_key = target_dim.replace(" ", "_")
            followups.append(FollowUp(kind="DRILLDOWN", dimensions=[dim_key]))

        # "then identify the segment that stands out most"
        if "stands out most" in text_lower or "stand out most" in text_lower:
            followups.append(FollowUp(kind="OUTLIER"))

        # "Support the recommendation with two other measures"
        if "two other measures" in text_lower or "two other metrics" in text_lower:
            followups.append(FollowUp(kind="SUPPORTING_MEASURES", count=2))

        return followups

    def _check_evaluative_ambiguity(self, text: str, metrics: List[MetricSpec]) -> Tuple[List[str], bool]:
        """Flags questions with evaluative words (best, better, performing) without objective metric."""
        text_lower = text.lower()
        eval_found = []
        for word in EVALUATIVE_TERMS.keys():
            if re.search(rf"\b{re.escape(word)}\b", text_lower):
                eval_found.append(word)

        # If evaluative words exist and no objective metrics requested -> Unresolved Evaluative Ambiguity
        unresolved = bool(eval_found and not metrics and not any(k in text_lower for k in ["using", "profile", "profile?"]))
        return eval_found, unresolved

    def _detect_employee_lookup(self, text: str) -> Optional[EntityRef]:
        """Detects lookup for a specific named employee or employee number."""
        text_lower = text.lower()

        # 1. 7-digit Employee Number
        m_num = re.search(r"\b(10\d{5})\b", text)
        if m_num:
            emp_num = int(m_num.group(1))
            cur = self.catalog.conn.cursor()
            cur.execute("SELECT employee_label FROM employees WHERE employee_number = ?", (emp_num,))
            row = cur.fetchone()
            emp_label = row[0] if row else str(emp_num)
            
            is_reportees = bool(
                re.search(r"\b(?:who\s+reports\s+to|employees\s+reporting\s+to|who\s+is\s+reporting\s+to|direct\s+reports)\b", text_lower)
                and not ("who does" in text_lower or re.search(r"\bwho\s+is\s+\d+\s+reporting\s+to\b", text_lower))
            )
            is_manager = bool("manager" in text_lower or "report to" in text_lower or "reporting to" in text_lower)
            is_skip_level = bool(re.search(r"\b(?:skip[- ]level|second[- ]level|manager['’]s manager)\b", text_lower))
            is_hierarchy = bool(re.search(r"\b(?:hierarchy|chain|reporting line|reporting path)\b", text_lower))

            if is_reportees:
                return EntityRef(employee_number=emp_num, label=emp_label, relation="REPORTEES")
            elif is_skip_level:
                return EntityRef(employee_number=emp_num, label=emp_label, attributes=["skip_level_manager"])
            elif is_hierarchy:
                return EntityRef(employee_number=emp_num, label=emp_label, attributes=["reporting_chain"])
            elif is_manager:
                return EntityRef(employee_number=emp_num, label=emp_label, attributes=["manager"])
            else:
                attrs = [attr for word, attr in LOOKUP_ATTRIBUTE_WORDS.items() if word in text_lower]
                return EntityRef(employee_number=emp_num, label=emp_label, attributes=attrs or ["profile"])

        # 2. Explicit Named Person Manager Lookup (Checks for candidate person name)
        m_person = re.search(r"\bwho\s+is\s+([a-z\s]+?)['’]s?\s+(?:skip[- ]level\s+)?manager\b", text_lower)
        if not m_person:
            m_person = re.search(r"\bwho\s+is\s+(?:the\s+)?(?:skip[- ]level\s+)?manager\s+(?:of|for)\s+([a-z\s]+?)(?:\?|$)", text_lower)
        if not m_person:
            m_person = re.search(r"\bwho\s+(?:does|is)\s+([a-z\s]+?)\s+(?:report|reporting)\s+to\b", text_lower)

        if m_person:
            target_str = m_person.group(1).strip()
            target_words = target_str.split()
            best_match = None
            if hasattr(self, "employee_index") and self.employee_index:
                for phrase, emp_num, emp_label in self.employee_index:
                    clean_emp = emp_label.split("(")[0].strip().lower()
                    if phrase == target_str or clean_emp == target_str:
                        best_match = (emp_num, emp_label)
                        break
                    if len(target_words) > 1 and all(w in clean_emp.split() for w in target_words):
                        best_match = (emp_num, emp_label)
                        break
                    if len(target_words) == 1 and phrase == target_str:
                        best_match = (emp_num, emp_label)
                        break

            if best_match:
                emp_num, emp_label = best_match
                is_skip_level = bool(re.search(r"\b(?:skip[- ]level|second[- ]level|manager['’]s manager)\b", text_lower))
                is_hierarchy = bool(re.search(r"\b(?:hierarchy|chain|reporting line|reporting path)\b", text_lower))
                if is_skip_level:
                    return EntityRef(employee_number=emp_num, label=emp_label, attributes=["skip_level_manager"])
                elif is_hierarchy:
                    return EntityRef(employee_number=emp_num, label=emp_label, attributes=["reporting_chain"])
                return EntityRef(employee_number=emp_num, label=emp_label, attributes=["manager"])
            else:
                return EntityRef(employee_number=0, label=target_str.title(), relation="NOT_FOUND")

        # 3. Dynamic employee name matching from SQLite employee_index
        if hasattr(self, "employee_index") and self.employee_index:
            for phrase, emp_num, emp_label in self.employee_index:
                pat = rf"\b{re.escape(phrase)}\b"
                if re.search(pat, text_lower):
                    # Disambiguate Manager lookup vs Direct Reports (Reportees) lookup
                    # A. Direct Reports / Reportees cues:
                    # "who reports to X", "who are X's direct reports", "employees reporting to X", "show X's direct reports"
                    is_reportees = bool(
                        re.search(rf"\b(?:who\s+reports\s+to|employees\s+reporting\s+to|who\s+is\s+reporting\s+to)\s+(?:the\s+)?{re.escape(phrase)}\b", text_lower)
                        or re.search(rf"\b{re.escape(phrase)}['’]s?\s+direct\s+reports\b", text_lower)
                        or "direct reports" in text_lower
                    )

                    # B. Manager lookup cues:
                    # "who is X reporting to", "who does X report to", "X is reporting to whom", "manager for X", "manager of X", "X's manager", "X manager"
                    is_manager = bool(
                        re.search(rf"\bwho\s+is\s+{re.escape(phrase)}\s+reporting\s+to\b", text_lower)
                        or re.search(rf"\bwho\s+does\s+{re.escape(phrase)}\s+report\s+to\b", text_lower)
                        or re.search(rf"\b{re.escape(phrase)}\s+is\s+reporting\s+to\s+whom\b", text_lower)
                        or "reporting to whom" in text_lower
                        or "manager" in text_lower
                        or ("reporting to" in text_lower and not is_reportees)
                    )

                    is_skip_level = bool(re.search(r"\b(?:skip[- ]level|second[- ]level|manager['’]s manager)\b", text_lower))
                    is_hierarchy = bool(re.search(r"\b(?:hierarchy|chain|reporting line|reporting path)\b", text_lower))

                    if is_reportees:
                        return EntityRef(employee_number=emp_num, label=emp_label, relation="REPORTEES")
                    elif is_skip_level:
                        return EntityRef(employee_number=emp_num, label=emp_label, attributes=["skip_level_manager"])
                    elif is_hierarchy:
                        return EntityRef(employee_number=emp_num, label=emp_label, attributes=["reporting_chain"])
                    elif is_manager:
                        return EntityRef(employee_number=emp_num, label=emp_label, attributes=["manager"])
                    else:
                        attrs = [attr for word, attr in LOOKUP_ATTRIBUTE_WORDS.items() if word in text_lower]
                        return EntityRef(
                            employee_number=emp_num,
                            label=emp_label,
                            attributes=attrs or ["profile"],
                        )

        return None

    def _calculate_confidence(self, ir: QueryIR) -> float:
        """Determines semantic parser confidence."""
        if ir.status in (IRStatus.UNSUPPORTED, IRStatus.AMBIGUOUS):
            return 1.0
        conf = 1.0
        if ir.assumptions:
            conf -= 0.05 * len(ir.assumptions)
        if ir.unresolved_entities:
            conf -= 0.15 * len(ir.unresolved_entities)
        if not ir.metrics and not ir.dimensions:
            conf -= 0.2
        return max(0.1, min(1.0, conf))


# Singleton instance
semantic_parser = SemanticParser()
