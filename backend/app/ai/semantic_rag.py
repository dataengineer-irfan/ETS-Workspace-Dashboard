import logging
import time
from typing import Dict, Any, List, Optional
from backend.app.ai.embedding_engine import embedding_engine
from backend.app.ai.vector_store import vector_store
from backend.app.ai.document_indexer import document_indexer

logger = logging.getLogger("semantic_rag")

MIN_RELEVANCE_SIMILARITY = 0.58

class SemanticRAG:
    """
    Production Local Semantic RAG Service.
    Performs true dense vector similarity search over authoritative organizational documents.
    Enforces document-level authorization and explicit RAG_NO_EVIDENCE semantics.
    """
    def __init__(self):
        self.indexer = document_indexer
        self.vector_store = vector_store
        self.embedding_engine = embedding_engine
        self._ensure_indexed()

    def _ensure_indexed(self):
        try:
            stats = self.indexer.sync_documents()
            logger.info(f"[SemanticRAG] Index initialized. Stats: {stats}")
        except Exception as e:
            logger.error(f"[SemanticRAG] Failed to sync document index on init: {e}")

    def retrieve(
        self,
        query: str,
        top_k: int = 3,
        user_roles: Optional[List[str]] = None,
        min_score: float = MIN_RELEVANCE_SIMILARITY
    ) -> Dict[str, Any]:
        """
        Executes genuine semantic vector retrieval:
        1. Encodes query into dense unit vector.
        2. Searches persistent SQLite vector index with role filtering and cosine similarity.
        3. Enforces min_score threshold.
        4. If zero chunks meet threshold -> returns RAG_NO_EVIDENCE (NO silent fallback!).
        """
        start = time.perf_counter()
        clean_q = query.strip()
        if not clean_q:
            return {
                "success": False,
                "error": "RAG_NO_EVIDENCE",
                "documents": [],
                "count": 0,
                "duration_ms": 0.0,
                "query": query
            }

        try:
            # 1. Embed query text into unit-normalized vector
            q_vec = self.embedding_engine.embed_text(clean_q)

            # 2. Vector search against persistent index
            results = self.vector_store.similarity_search(
                query_vector=q_vec,
                top_k=top_k,
                user_roles=user_roles or ["ALL"],
                min_score=min_score
            )
            duration_ms = round((time.perf_counter() - start) * 1000, 2)

            if not results:
                logger.info(f"[SemanticRAG] No evidence found above threshold {min_score} for query '{clean_q}'")
                return {
                    "success": False,
                    "error": "RAG_NO_EVIDENCE",
                    "documents": [],
                    "count": 0,
                    "duration_ms": duration_ms,
                    "query": query
                }

            logger.info(f"[SemanticRAG] Retrieved {len(results)} chunks in {duration_ms}ms. Top score: {results[0]['similarity_score']}")
            return {
                "success": True,
                "error": None,
                "documents": results,
                "count": len(results),
                "duration_ms": duration_ms,
                "query": query
            }
        except Exception as e:
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            logger.error(f"[SemanticRAG] Retrieval execution failed: {e}")
            return {
                "success": False,
                "error": f"RAG_FAILED: {str(e)}",
                "documents": [],
                "count": 0,
                "duration_ms": duration_ms,
                "query": query
            }

semantic_rag = SemanticRAG()
