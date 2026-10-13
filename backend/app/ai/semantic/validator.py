"""
ETS Genie — Semantic IR Validator.

Enforces schema integrity and semantic sanity on QueryIR before execution.
Ensures invalid, contradictory, or unsupported queries never reach the SQL planner.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

from backend.app.ai.semantic.catalog import FIELDS, MEASURES, SemanticCatalog
from backend.app.ai.semantic.ir import Intent, IRStatus, QueryIR


@dataclass
class ValidationResult:
    is_valid: bool
    status: IRStatus
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    suggested_intent: Optional[Intent] = None
    refusal_reason: Optional[str] = None


class IRValidator:
    def __init__(self, catalog: Optional[SemanticCatalog] = None):
        self.catalog = catalog or SemanticCatalog.get()

    def validate(self, ir: QueryIR) -> ValidationResult:
        errors: List[str] = []
        warnings: List[str] = []

        # 1. Non-executable Intents (already flagged as controlled responses)
        if ir.intent == Intent.UNSUPPORTED:
            return ValidationResult(
                is_valid=False,
                status=IRStatus.UNSUPPORTED,
                errors=["Unsupported analytical domain or business concept."],
                refusal_reason=ir.unsupported_reason or "The requested inquiry cannot be answered from authoritative ETS records.",
            )

        if ir.intent == Intent.AMBIGUOUS:
            return ValidationResult(
                is_valid=False,
                status=IRStatus.AMBIGUOUS,
                errors=["Ambiguous or underspecified query intent."],
                refusal_reason=ir.ambiguity_reason or "Please clarify the metric or entity you wish to analyse.",
            )

        if ir.intent == Intent.NOT_FOUND:
            return ValidationResult(
                is_valid=True,
                status=IRStatus.VALID,
                warnings=[f"Target employee '{ir.entity.label if ir.entity else ''}' not found in ETS records."],
            )

        if ir.intent == Intent.DELEGATE_POLICY:
            return ValidationResult(
                is_valid=True,
                status=IRStatus.DELEGATED,
                warnings=["Query is an HR policy / handbook inquiry delegated to semantic document search."],
            )

        if ir.intent == Intent.DELEGATE_CONTEXT:
            return ValidationResult(
                is_valid=True,
                status=IRStatus.DELEGATED,
                warnings=["Query contains anaphoric pronouns delegated to conversation context resolver."],
            )

        # 2. Unresolved Entities Check
        if ir.unresolved_entities:
            ent_msgs = [e.get("reason", f"Unrecognized entity: {e.get('raw')}") for e in ir.unresolved_entities]
            warnings.extend(ent_msgs)

        # 3. Entity Lookup Validation
        if ir.intent == Intent.ENTITY_LOOKUP:
            if not ir.entity:
                errors.append("Entity lookup intent requires a valid Employee reference.")
            elif not ir.entity.employee_number:
                errors.append("Entity lookup requires a verified 7-digit Employee ID.")
            return ValidationResult(
                is_valid=len(errors) == 0,
                status=IRStatus.VALID if not errors else IRStatus.INVALID,
                errors=errors,
                warnings=warnings,
            )

        # 4. Metrics Validation
        if ir.intent in (Intent.AGGREGATE, Intent.BREAKDOWN, Intent.RANKING, Intent.COMPARISON, Intent.GAP, Intent.BASELINE_DEVIATION):
            if not ir.metrics:
                errors.append(f"Intent {ir.intent.value} requires at least one metric specification.")
            else:
                for m in ir.metrics:
                    if m.measure not in MEASURES:
                        errors.append(f"Unknown or unsupported measure key: '{m.measure}'. Supported measures: {list(MEASURES.keys())}")
                    else:
                        m_def = MEASURES[m.measure]
                        if m.agg not in m_def.allowed_aggs and m.agg != "AVG":
                            warnings.append(f"Aggregation '{m.agg}' is not standard for measure '{m.measure}' (allowed: {m_def.allowed_aggs}).")

        # 5. Dimensions & Grouping Validation
        for dim in ir.dimensions:
            if dim not in FIELDS:
                errors.append(f"Referenced dimension '{dim}' does not exist in the ETS semantic catalog.")
            elif not FIELDS[dim].groupable:
                errors.append(f"Field '{dim}' is a numeric measure or row-level attribute and cannot be used as a grouping dimension.")

        for grp in ir.grouping:
            if grp not in FIELDS:
                errors.append(f"Grouping field '{grp}' does not exist in the ETS semantic catalog.")

        # 6. Filter Specifications Validation
        all_filters = ir.filters.flat()
        field_values_seen: dict[str, set] = {}
        for f in all_filters:
            if f.field not in FIELDS:
                errors.append(f"Filter field '{f.field}' does not exist in the ETS semantic catalog.")
            else:
                # Check value validity against live catalog domain
                if not self.catalog.is_valid_value(f.field, f.value):
                    warnings.append(f"Value '{f.value}' for field '{f.field}' does not match any current records in the ETS database.")

                # Check for contradictory equality filters on the same field:
                # e.g., department = 'IT' AND department = 'Core' in the same filter group
                if f.op == "=":
                    if f.field not in field_values_seen:
                        field_values_seen[f.field] = set()
                    field_values_seen[f.field].add(f.value)
                    if len(field_values_seen[f.field]) > 1:
                        errors.append(f"Contradictory conditions detected: field '{f.field}' cannot simultaneously equal {list(field_values_seen[f.field])}.")

        # 7. Comparison Validation
        if ir.intent == Intent.COMPARISON:
            if not ir.comparison:
                errors.append("Comparison intent requires a ComparisonSpec.")
            else:
                comp = ir.comparison
                if not comp.left or not comp.right:
                    errors.append("Comparison requires both left and right cohorts to be defined.")
                else:
                    if comp.left.kind == "FILTERED" and comp.left.filters.is_empty():
                        errors.append("Comparison left cohort has no filter constraints.")
                    if comp.right.kind == "FILTERED" and comp.right.filters.is_empty():
                        errors.append("Comparison right cohort has no filter constraints.")
                    # Ensure cohorts are not identical
                    if comp.left.label.lower() == comp.right.label.lower():
                        errors.append(f"Cannot compare cohort '{comp.left.label}' against itself.")

        # 8. Ranking Validation
        if ir.intent == Intent.RANKING:
            if not ir.ordering:
                errors.append("Ranking intent requires an OrderingSpec with metric and direction.")
            if ir.limit is not None and ir.limit <= 0:
                errors.append(f"Ranking limit must be a positive integer (got {ir.limit}).")

        # 9. Thresholds Validation
        for t in ir.thresholds:
            # Check relative threshold vs baseline
            if t.relative_to == "BASELINE":
                if t.op not in (">", "<", ">=", "<="):
                    errors.append(f"Invalid threshold operator '{t.op}'.")
            elif t.value is None:
                errors.append(f"Absolute threshold on '{t.metric_key}' requires a numeric target value.")

        is_valid = len(errors) == 0
        final_status = IRStatus.VALID if is_valid else IRStatus.INVALID
        refusal = " ; ".join(errors) if errors else None

        return ValidationResult(
            is_valid=is_valid,
            status=final_status,
            errors=errors,
            warnings=warnings,
            refusal_reason=refusal,
        )


ir_validator = IRValidator()
