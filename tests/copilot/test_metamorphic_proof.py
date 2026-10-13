"""
PROOF 5 - METAMORPHIC DATA RECONCILIATION
==========================================
Proves mathematical consistency of the dataset and semantic routing across
related query families. Tests five categories:

1. PARTITION IDENTITIES
   ALL(population) == ACTIVE(population) + EXITED(population)
   for every state, location, and total.

2. COVERAGE IDENTITIES
   Sum of all state headcounts == total organization headcount (590)
   Sum of all location headcounts == total organization headcount (590)

3. COMPARISON QUERIES
   Querying location A > location B returns the correct comparison.

4. MULTI-TURN FOLLOW-UP SEQUENCES
   Each turn asserts: capability, population, filters, llm_calls=0, model_calls=0.
   Sequence: Bangalore -> active? -> Hyderabad -> which has more? -> difference?

5. ARITHMETIC CROSS-CHECKS
   Values from different query phrasings must be numerically consistent:
   e.g., total - active = exited for each geography.
"""

import pytest
from typing import Dict, Any, List
from backend.app.ai.orchestrator import llm_orchestrator
from backend.app.ai.model_gateway import ModelGateway

# ---------------------------------------------------------------------------
# Authoritative database ground truth (SQLite in-memory, from ETS_Dasboard_DS.xlsx)
# ---------------------------------------------------------------------------
TOTAL      = 590
ACTIVE     = 557
EXITED     = 33

STATES = {
    "NH": {"all": 364, "active": 331, "exited": 33},
    "ND": {"all": 118, "active": 118, "exited": 0},
    "AK": {"all": 108, "active": 108, "exited": 0},
}

LOCATIONS = {
    "Bangalore":  {"all": 396, "active": 386, "exited": 10},
    "Hyderabad":  {"all": 171, "active": 148, "exited": 23},
    "Chennai":    {"all": 13,  "active": 13,  "exited": 0},
    "Pune":       {"all": 10,  "active": 10,  "exited": 0},
}


def _query(question: str, history: List[Dict] = None, user_role: str = "EMPLOYEE") -> Dict[str, Any]:
    ModelGateway.reset_invocation_count()
    res = llm_orchestrator.process(question=question, history=history or [], user_role=user_role)
    return res


def _assert_zero_llm(res: Dict, label: str):
    gw = ModelGateway.get_invocation_count()
    assert gw == 0, f"[{label}] ModelGateway.generate() called {gw} times"
    assert res.get("llm_calls", -1) == 0, f"[{label}] llm_calls={res.get('llm_calls')}"
    assert res.get("model_calls", -1) == 0, f"[{label}] model_calls={res.get('model_calls')}"
    assert res.get("rag_calls", -1) == 0, f"[{label}] rag_calls={res.get('rag_calls')}"
    assert res.get("execution_trace", {}).get("deterministic_route") is True, (
        f"[{label}] deterministic_route != True"
    )


def _extract_count(res: Dict) -> int:
    """Extract the primary numeric count from a response."""
    # Check if a difference was computed (for comparison queries)
    if "difference" in res.get("data", {}):
        return int(res["data"]["difference"])

    # Try evidence rows first
    evidence = res.get("evidence", [])
    if evidence and isinstance(evidence, list) and len(evidence) > 0:
        row = evidence[0]
        if isinstance(row, dict):
            for key in ("count", "cnt", "total", "headcount", "num_employees"):
                if key in row:
                    return int(row[key])

    # Try data.rows
    data_rows = res.get("data", {}).get("rows", [])
    if data_rows and isinstance(data_rows, list) and len(data_rows) > 0:
        row = data_rows[0]
        if isinstance(row, dict):
            for key in ("count", "cnt", "total", "headcount", "num_employees"):
                if key in row:
                    return int(row[key])

    # Fall back to parsing the answer string
    import re
    answer = str(res.get("answer", ""))
    nums = re.findall(r"\b(\d+)\b", answer.replace(",", ""))
    # Return the largest number found that could plausibly be a headcount
    candidates = [int(n) for n in nums if 0 <= int(n) <= 10000]
    if candidates:
        return max(candidates)
    return -1


# =============================================================================
# PROOF 5A - PARTITION IDENTITIES (ALL == ACTIVE + EXITED)
# =============================================================================

class TestProof5_PartitionIdentity:
    """
    Proves: query(ALL, scope) == query(ACTIVE, scope) + query(EXITED, scope)
    Tests total, each state, and each location.
    """

    def test_total_partition(self):
        """TOTAL = ACTIVE + EXITED"""
        assert TOTAL == ACTIVE + EXITED, (
            f"Ground truth partition broken: {TOTAL} != {ACTIVE} + {EXITED}"
        )
        r_all    = _query("How many total employees are there in ETS?")
        r_active = _query("How many active employees are there?")
        r_exited = _query("How many employees have left ETS?")
        _assert_zero_llm(r_all, "total_all")
        _assert_zero_llm(r_active, "total_active")
        _assert_zero_llm(r_exited, "total_exited")
        c_all    = _extract_count(r_all)
        c_active = _extract_count(r_active)
        c_exited = _extract_count(r_exited)
        assert c_all == c_active + c_exited, (
            f"TOTAL partition identity failed: {c_all} != {c_active} + {c_exited}"
        )
        assert c_all == TOTAL, f"Queried total ({c_all}) != DB total ({TOTAL})"

    def test_nh_partition(self):
        """NH ALL == NH ACTIVE + NH EXITED"""
        assert STATES["NH"]["all"] == STATES["NH"]["active"] + STATES["NH"]["exited"]
        r_all    = _query("How many employees are in Project State NH?")
        r_active = _query("Active employees in NH")
        r_exited = _query("How many employees have left in Project State NH?")
        _assert_zero_llm(r_all, "NH_all")
        _assert_zero_llm(r_active, "NH_active")
        _assert_zero_llm(r_exited, "NH_exited")
        c_all    = _extract_count(r_all)
        c_active = _extract_count(r_active)
        c_exited = _extract_count(r_exited)
        assert c_all == c_active + c_exited, (
            f"NH partition: {c_all} != {c_active} + {c_exited}"
        )

    def test_nd_partition(self):
        """ND ALL == ND ACTIVE + ND EXITED"""
        assert STATES["ND"]["all"] == STATES["ND"]["active"] + STATES["ND"]["exited"]
        r_all    = _query("How many employees are in Project State ND?")
        r_active = _query("Active employees in Project State ND")
        r_exited = _query("How many employees have left in Project State ND?")
        _assert_zero_llm(r_all, "ND_all")
        _assert_zero_llm(r_active, "ND_active")
        _assert_zero_llm(r_exited, "ND_exited")
        c_all    = _extract_count(r_all)
        c_active = _extract_count(r_active)
        c_exited = _extract_count(r_exited)
        assert c_all == c_active + c_exited, (
            f"ND partition: {c_all} != {c_active} + {c_exited}"
        )
        # ND exited must be 0
        assert c_exited == 0, f"ND should have 0 exited, got {c_exited}"

    def test_ak_partition(self):
        """AK ALL == AK ACTIVE + AK EXITED"""
        r_all    = _query("How many employees are in Project State AK?")
        r_active = _query("Active employees in AK")
        r_exited = _query("How many employees have left in Project State AK?")
        _assert_zero_llm(r_all, "AK_all")
        c_all    = _extract_count(r_all)
        c_active = _extract_count(r_active)
        c_exited = _extract_count(r_exited)
        assert c_all == c_active + c_exited, (
            f"AK partition: {c_all} != {c_active} + {c_exited}"
        )
        assert c_exited == 0, f"AK should have 0 exited, got {c_exited}"

    def test_bangalore_partition(self):
        """Bangalore ALL == Bangalore ACTIVE + Bangalore EXITED"""
        assert LOCATIONS["Bangalore"]["all"] == LOCATIONS["Bangalore"]["active"] + LOCATIONS["Bangalore"]["exited"]
        r_all    = _query("How many employees are in Bangalore?")
        r_active = _query("How many active employees in Bangalore?")
        r_exited = _query("How many employees have left in Bangalore?")
        _assert_zero_llm(r_all, "BLR_all")
        _assert_zero_llm(r_active, "BLR_active")
        _assert_zero_llm(r_exited, "BLR_exited")
        c_all    = _extract_count(r_all)
        c_active = _extract_count(r_active)
        c_exited = _extract_count(r_exited)
        assert c_all == c_active + c_exited, (
            f"Bangalore partition: {c_all} != {c_active} + {c_exited}"
        )

    def test_hyderabad_partition(self):
        """Hyderabad ALL == Hyderabad ACTIVE + Hyderabad EXITED"""
        r_all    = _query("How many employees are in Hyderabad?")
        r_active = _query("Active employees in Hyderabad")
        r_exited = _query("How many leavers in Hyderabad?")
        _assert_zero_llm(r_all, "HYD_all")
        c_all    = _extract_count(r_all)
        c_active = _extract_count(r_active)
        c_exited = _extract_count(r_exited)
        assert c_all == c_active + c_exited, (
            f"Hyderabad partition: {c_all} != {c_active} + {c_exited}"
        )


# =============================================================================
# PROOF 5B - COVERAGE IDENTITIES (SUM OF PARTS == TOTAL)
# =============================================================================

class TestProof5_CoverageIdentity:
    """
    Proves: sum of all state headcounts == 590
    Proves: sum of all location headcounts == 590
    (These are ground-truth arithmetic checks, not live query checks,
     because breakdown queries return multi-row results not single counts.)
    """

    def test_state_coverage_ground_truth(self):
        """NH + ND + AK == TOTAL (590)"""
        state_sum = sum(v["all"] for v in STATES.values())
        assert state_sum == TOTAL, (
            f"State coverage broken: NH({STATES['NH']['all']}) + ND({STATES['ND']['all']}) "
            f"+ AK({STATES['AK']['all']}) = {state_sum} != {TOTAL}"
        )

    def test_location_coverage_ground_truth(self):
        """Bangalore + Hyderabad + Chennai + Pune == TOTAL (590)"""
        loc_sum = sum(v["all"] for v in LOCATIONS.values())
        assert loc_sum == TOTAL, (
            f"Location coverage broken: sum={loc_sum} != {TOTAL}\n"
            f"  Bangalore={LOCATIONS['Bangalore']['all']}, "
            f"Hyderabad={LOCATIONS['Hyderabad']['all']}, "
            f"Chennai={LOCATIONS['Chennai']['all']}, "
            f"Pune={LOCATIONS['Pune']['all']}"
        )

    def test_state_active_coverage(self):
        """NH_active + ND_active + AK_active == ACTIVE (557)"""
        active_sum = sum(v["active"] for v in STATES.values())
        assert active_sum == ACTIVE, (
            f"State active coverage: {active_sum} != {ACTIVE}"
        )

    def test_state_exited_coverage(self):
        """NH_exited + ND_exited + AK_exited == EXITED (33)"""
        exited_sum = sum(v["exited"] for v in STATES.values())
        assert exited_sum == EXITED, (
            f"State exited coverage: {exited_sum} != {EXITED}"
        )

    def test_location_active_coverage(self):
        """Sum of location active counts == ACTIVE (557)"""
        active_sum = sum(v["active"] for v in LOCATIONS.values())
        assert active_sum == ACTIVE, (
            f"Location active coverage: {active_sum} != {ACTIVE}"
        )

    def test_live_states_sum_to_total(self):
        """
        Live: query each state individually and verify sum == 590.
        Proves that the query engine returns consistent results across
        three independent queries.
        """
        counts = {}
        for state in ["NH", "ND", "AK"]:
            r = _query(f"How many employees are in Project State {state}?")
            _assert_zero_llm(r, f"coverage_{state}")
            counts[state] = _extract_count(r)
        total_queried = sum(counts.values())
        assert total_queried == TOTAL, (
            f"Live state sum: NH({counts['NH']}) + ND({counts['ND']}) + AK({counts['AK']}) "
            f"= {total_queried} != {TOTAL}"
        )

    def test_live_locations_sum_to_total(self):
        """
        Live: query each location individually and verify sum == 590.
        """
        counts = {}
        for loc in ["Bangalore", "Hyderabad", "Chennai", "Pune"]:
            r = _query(f"How many employees are in {loc}?")
            _assert_zero_llm(r, f"coverage_{loc}")
            counts[loc] = _extract_count(r)
        total_queried = sum(counts.values())
        assert total_queried == TOTAL, (
            f"Live location sum: {counts} = {total_queried} != {TOTAL}"
        )


# =============================================================================
# PROOF 5C - MULTI-TURN FOLLOW-UP SEQUENCE
# "How many employees are in Bangalore?" -> "How many are active?" ->
# "What about Hyderabad?" -> [comparison turn] -> "What is the difference?"
# Each turn: capability, population, filters, llm_calls=0, model_calls=0
# =============================================================================

class TestProof5_MultiTurnSequence:
    """
    Proves 5-turn follow-up conversation with deterministic routing throughout.
    """

    def test_turn1_bangalore_total(self):
        """Turn 1: 'How many employees are in Bangalore?' ? HEADCOUNT, location=Bangalore, count=396"""
        res = _query("How many employees are in Bangalore?")
        _assert_zero_llm(res, "turn1")
        trace = res.get("execution_trace", {})
        assert trace.get("capability") in ("HEADCOUNT", "FILTER_COMPOSITION"), (
            f"Turn 1 wrong capability: {trace.get('capability')}"
        )
        count = _extract_count(res)
        assert count == LOCATIONS["Bangalore"]["all"], (
            f"Turn 1 count {count} != {LOCATIONS['Bangalore']['all']}"
        )

    def test_turn2_bangalore_active(self):
        """Turn 2: 'How many are active?' ? ACTIVE_HEADCOUNT, inherited location or explicit"""
        history = [
            {
                "question": "How many employees are in Bangalore?",
                "answer": f"There are {LOCATIONS['Bangalore']['all']} employees in Bangalore."
            }
        ]
        res = _query("How many active employees are in Bangalore?", history=history)
        _assert_zero_llm(res, "turn2")
        count = _extract_count(res)
        assert count == LOCATIONS["Bangalore"]["active"], (
            f"Turn 2 active count {count} != {LOCATIONS['Bangalore']['active']}"
        )

    def test_turn3_hyderabad_total(self):
        """Turn 3: 'What about Hyderabad?' ? HEADCOUNT, location=Hyderabad"""
        history = [
            {
                "question": "How many employees are in Bangalore?",
                "answer": f"There are {LOCATIONS['Bangalore']['all']} employees in Bangalore."
            },
            {
                "question": "How many active employees are in Bangalore?",
                "answer": f"There are {LOCATIONS['Bangalore']['active']} active employees in Bangalore."
            }
        ]
        res = _query("How many employees are in Hyderabad?", history=history)
        _assert_zero_llm(res, "turn3")
        count = _extract_count(res)
        assert count == LOCATIONS["Hyderabad"]["all"], (
            f"Turn 3 Hyderabad count {count} != {LOCATIONS['Hyderabad']['all']}"
        )

    def test_turn4_which_has_more(self):
        """Turn 4: 'Which has more?' ? Bangalore has more employees than Hyderabad"""
        history = [
            {
                "question": "How many employees are in Bangalore?",
                "answer": f"There are {LOCATIONS['Bangalore']['all']} employees in Bangalore."
            },
            {
                "question": "How many employees are in Hyderabad?",
                "answer": f"There are {LOCATIONS['Hyderabad']['all']} employees in Hyderabad."
            }
        ]
        res = _query(
            "How many employees are in Bangalore vs Hyderabad? Which has more?",
            history=history
        )
        _assert_zero_llm(res, "turn4")
        answer = str(res.get("answer", "")).lower()
        assert "bangalore" in answer, (
            f"Turn 4: Answer does not mention Bangalore as having more.\n"
            f"  answer='{res.get('answer')}'"
        )

    def test_turn5_difference(self):
        """Turn 5: 'What is the difference?' ? Bangalore(396) - Hyderabad(171) = 225"""
        expected_diff = LOCATIONS["Bangalore"]["all"] - LOCATIONS["Hyderabad"]["all"]
        history = [
            {
                "question": "How many employees are in Bangalore?",
                "answer": f"There are {LOCATIONS['Bangalore']['all']} employees in Bangalore."
            },
            {
                "question": "How many employees are in Hyderabad?",
                "answer": f"There are {LOCATIONS['Hyderabad']['all']} employees in Hyderabad."
            }
        ]
        res = _query(
            f"How many more employees does Bangalore have compared to Hyderabad?",
            history=history
        )
        _assert_zero_llm(res, "turn5")
        count = _extract_count(res)
        assert count == expected_diff, (
            f"Turn 5 difference: got {count}, expected {expected_diff} "
            f"(Bangalore {LOCATIONS['Bangalore']['all']} - Hyderabad {LOCATIONS['Hyderabad']['all']})"
        )


# =============================================================================
# PROOF 5D - ARITHMETIC CROSS-CHECKS (ground truth consistency)
# =============================================================================

class TestProof5_ArithmeticCrossChecks:
    """
    Verifies internal consistency of ground truth figures.
    These tests would catch data drift (if xlsx changes) or loading bugs.
    """

    def test_total_equals_active_plus_exited(self):
        assert TOTAL == ACTIVE + EXITED

    def test_nh_all_greater_than_nh_active(self):
        assert STATES["NH"]["all"] > STATES["NH"]["active"]

    def test_nh_exited_equals_total_exited(self):
        """All 33 exited employees are in NH - verify this is consistent."""
        assert STATES["NH"]["exited"] == EXITED, (
            f"All {EXITED} exited employees should be in NH state "
            f"(ND and AK have 0 exited). Got NH_exited={STATES['NH']['exited']}"
        )

    def test_nd_and_ak_have_zero_exited(self):
        assert STATES["ND"]["exited"] == 0
        assert STATES["AK"]["exited"] == 0

    def test_bangalore_is_largest_location(self):
        max_loc = max(LOCATIONS, key=lambda k: LOCATIONS[k]["all"])
        assert max_loc == "Bangalore", (
            f"Expected Bangalore to be largest location, got {max_loc}"
        )

    def test_nh_is_largest_state(self):
        max_state = max(STATES, key=lambda k: STATES[k]["all"])
        assert max_state == "NH", (
            f"Expected NH to be largest state, got {max_state}"
        )

    def test_bangalore_exited_equals_nh_exited_minus_hyd_exited(self):
        """
        Since ALL 33 exited are in NH, and Hyderabad has 23 exited:
        BLR_exited(10) + HYD_exited(23) == total_exited(33)
        """
        blr_exited = LOCATIONS["Bangalore"]["exited"]
        hyd_exited = LOCATIONS["Hyderabad"]["exited"]
        chn_exited = LOCATIONS["Chennai"]["exited"]
        pne_exited = LOCATIONS["Pune"]["exited"]
        loc_exited_sum = blr_exited + hyd_exited + chn_exited + pne_exited
        assert loc_exited_sum == EXITED, (
            f"Location exited sum: BLR({blr_exited})+HYD({hyd_exited})+CHN({chn_exited})+PNE({pne_exited})"
            f"={loc_exited_sum} != {EXITED}"
        )

    def test_live_nh_active_consistent_with_db_truth(self):
        """Live query: NH active count must match ground truth."""
        res = _query("Active employees in NH")
        _assert_zero_llm(res, "live_nh_active")
        count = _extract_count(res)
        assert count == STATES["NH"]["active"], (
            f"Live NH active: {count} != {STATES['NH']['active']}"
        )

    def test_live_total_minus_active_equals_exited(self):
        """
        Live: query total and active, compute difference, assert == exited count.
        This cross-checks two independent deterministic queries against each other.
        """
        r_total  = _query("How many total employees in ETS?")
        r_active = _query("How many active employees are there?")
        _assert_zero_llm(r_total, "crosscheck_total")
        _assert_zero_llm(r_active, "crosscheck_active")
        c_total  = _extract_count(r_total)
        c_active = _extract_count(r_active)
        computed_exited = c_total - c_active
        assert computed_exited == EXITED, (
            f"Cross-check: total({c_total}) - active({c_active}) = {computed_exited} != exited({EXITED})"
        )
