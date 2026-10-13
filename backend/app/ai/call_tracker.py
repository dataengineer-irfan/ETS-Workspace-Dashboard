from contextvars import ContextVar
from dataclasses import dataclass
from typing import Dict, Any

@dataclass
class CallTracker:
    llm_calls: int = 0
    planner_calls: int = 0
    semantic_llm_calls: int = 0
    sql_llm_calls: int = 0
    synthesis_calls: int = 0
    verifier_calls: int = 0
    rag_calls: int = 0
    model_calls: int = 0

    def to_dict(self) -> Dict[str, int]:
        return {
            "llm_calls": self.llm_calls,
            "planner_calls": self.planner_calls,
            "semantic_llm_calls": self.semantic_llm_calls,
            "sql_llm_calls": self.sql_llm_calls,
            "synthesis_calls": self.synthesis_calls,
            "verifier_calls": self.verifier_calls,
            "rag_calls": self.rag_calls,
            "model_calls": self.model_calls,
        }

_call_tracker_ctx: ContextVar[CallTracker] = ContextVar("call_tracker", default=CallTracker())

def get_current_tracker() -> CallTracker:
    return _call_tracker_ctx.get()

def reset_call_tracker() -> CallTracker:
    t = CallTracker()
    _call_tracker_ctx.set(t)
    return t

def record_model_call(task_type: str = "GENERAL"):
    t = get_current_tracker()
    t.llm_calls += 1
    t.model_calls += 1
    tt = task_type.upper()
    if "PLAN" in tt:
        t.planner_calls += 1
    elif "SEMANTIC" in tt:
        t.semantic_llm_calls += 1
    elif "SQL" in tt:
        t.sql_llm_calls += 1
    elif "SYNTH" in tt:
        t.synthesis_calls += 1
    elif "VERIF" in tt or "GROUND" in tt:
        t.verifier_calls += 1

def record_rag_call():
    t = get_current_tracker()
    t.rag_calls += 1
