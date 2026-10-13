import os
import json
import logging
from typing import Dict, Any, List, Optional
from contextvars import ContextVar
from dataclasses import dataclass, field
from backend.app.ai.ollama_client import ollama_client

logger = logging.getLogger("model_gateway")

from backend.app.ai.call_tracker import (
    CallTracker,
    get_current_tracker,
    reset_call_tracker,
    record_model_call,
    record_rag_call,
)

class ModelGateway:
    """
    Decoupled Model Gateway for ETS Genie.
    Configurable via environment variables without modifying business logic.
    Gracefully adapts between developer laptop profile and enterprise GPU server profile.
    """
    def __init__(self):
        self.ollama = ollama_client

    @property
    def configured_rag_model(self) -> str:
        # Default enterprise target is Granite 3.1 8B, falling back to locally installed qwen2.5:3b
        target = os.getenv("ETS_RAG_MODEL", "granite3.1-dense:8b")
        if self._is_model_installed(target):
            return target
        return os.getenv("ETS_LOCAL_RAG_MODEL", "qwen2.5:3b")

    @property
    def configured_sql_model(self) -> str:
        # Default enterprise target is Qwen 2.5-Coder 7B, falling back to locally installed qwen2.5-coder:3b
        target = os.getenv("ETS_SQL_MODEL", "qwen2.5-coder:7b")
        if self._is_model_installed(target):
            return target
        return os.getenv("ETS_LOCAL_SQL_MODEL", "qwen2.5-coder:3b")

    @property
    def configured_embedding_model(self) -> str:
        target = os.getenv("ETS_EMBED_MODEL", "bge-large-en-v1.5")
        if self._is_model_installed(target):
            return target
        return os.getenv("ETS_LOCAL_EMBED_MODEL", "nomic-embed-text:latest")

    @property
    def configured_reasoning_model(self) -> str:
        target = os.getenv("ETS_REASONING_MODEL", "granite3.1-dense:8b")
        if self._is_model_installed(target):
            return target
        return os.getenv("ETS_LOCAL_REASONING_MODEL", "qwen2.5:3b")

    @property
    def configured_verifier_model(self) -> str:
        target = os.getenv("ETS_VERIFIER_MODEL", "qwen2.5:1.5b")
        if self._is_model_installed(target):
            return target
        return self.configured_rag_model

    def _is_model_installed(self, model_name: str) -> bool:
        installed = self.list_installed_models()
        return model_name in installed or f"{model_name}:latest" in installed

    def list_installed_models(self) -> List[str]:
        try:
            import urllib.request
            req = urllib.request.Request(f"{self.ollama.base_url}/api/tags")
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return [m["name"] for m in data.get("models", [])]
        except Exception:
            return ["qwen2.5:3b", "qwen2.5-coder:3b", "nomic-embed-text:latest"]

    # ------------------------------------------------------------------
    # Gateway-boundary invocation counter (authoritative LLM call proof)
    # Incremented BEFORE any network IO in generate() — the earliest
    # possible interception point at the ModelGateway boundary.
    # Use get_invocation_count() in tests instead of the context-var
    # call_tracker to get the true boundary proof.
    # ------------------------------------------------------------------
    _gateway_invocation_count: int = 0

    @classmethod
    def get_invocation_count(cls) -> int:
        """Return total ModelGateway.generate() calls since last reset."""
        return cls._gateway_invocation_count

    @classmethod
    def reset_invocation_count(cls) -> None:
        """Reset the gateway-level counter (call this in test setUp)."""
        cls._gateway_invocation_count = 0

    def generate(
        self,
        prompt: str,
        system: Optional[str] = None,
        task_type: str = "RAG",  # 'RAG', 'SQL', 'ROUTER', 'REASONING'
        temperature: float = 0.0,
        max_tokens: int = 250
    ) -> Optional[str]:
        # Authoritative boundary counter — incremented BEFORE the actual network call.
        # This is the proof point: if a deterministic query reaches here, the architecture
        # failed to route it correctly.
        ModelGateway._gateway_invocation_count += 1
        if task_type == "REASONING":
            model = self.configured_reasoning_model
        elif task_type == "RAG":
            model = self.configured_rag_model
        else:
            model = self.configured_sql_model
        return self.ollama.generate(
            prompt=prompt,
            system=system,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            task_type=task_type
        )

model_gateway = ModelGateway()
