import os
import json
import time
import logging
import urllib.request
import urllib.error
import numpy as np
from typing import List, Optional, Union

logger = logging.getLogger("rag_embedding_engine")

OLLAMA_EMBED_URL = "http://localhost:11434/api/embeddings"
DEFAULT_EMBED_MODEL = "nomic-embed-text:latest"

class LocalEmbeddingEngine:
    """
    Production local embedding engine using local Ollama (nomic-embed-text).
    Generates genuine dense vectors, unit-normalized for exact cosine similarity.
    NO FALLBACK: If Ollama embedding fails, an explicit error is raised.
    """
    def __init__(self, model_name: str = DEFAULT_EMBED_MODEL):
        self.model_name = model_name
        self._dimension = 768

    @property
    def dimension(self) -> int:
        return self._dimension

    def _embed_via_ollama(self, text: str) -> np.ndarray:
        """
        Calls local Ollama embedding API. Returns unit-normalized vector.
        Raises RuntimeError on any failure — no silent fallback.
        """
        payload = {
            "model": self.model_name,
            "prompt": text
        }
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            OLLAMA_EMBED_URL,
            data=data,
            headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=15.0) as resp:
                res = json.loads(resp.read().decode("utf-8"))
                emb = res.get("embedding")
                if emb:
                    vec = np.array(emb, dtype=np.float32)
                    norm = np.linalg.norm(vec)
                    if norm > 1e-9:
                        vec = vec / norm
                    return vec
                raise RuntimeError(
                    f"Ollama returned empty embedding for model '{self.model_name}'"
                )
        except RuntimeError:
            raise
        except Exception as e:
            raise RuntimeError(
                f"Ollama embedding generation failed: {e}"
            ) from e

    def embed_text(self, text: str) -> np.ndarray:
        """
        Embeds a single string into a unit-normalized float32 numpy vector.
        Uses Ollama exclusively. Raises RuntimeError if Ollama is unavailable.
        """
        clean_text = text.strip() or "empty"
        vec = self._embed_via_ollama(clean_text)
        self._dimension = len(vec)
        return vec

    def embed_batch(self, texts: List[str]) -> np.ndarray:
        """
        Embeds a batch of strings into a unit-normalized float32 2D numpy array [N, D].
        """
        vectors = []
        for t in texts:
            vectors.append(self.embed_text(t))
        return np.vstack(vectors)

embedding_engine = LocalEmbeddingEngine()
