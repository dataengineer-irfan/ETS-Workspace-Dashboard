import os
import json
import sqlite3
import logging
import datetime
import numpy as np
from typing import Dict, Any, List, Optional

logger = logging.getLogger("rag_vector_store")

DEFAULT_DB_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "data", "rag_index.db")
)

class SQLiteVectorStore:
    """
    Production persistent SQLite vector index.
    Stores document metadata and dense chunk embeddings on disk.
    Performs true cosine vector similarity via vectorized dot products.
    Applies role-based authorization filtering BEFORE evidence reaches retrieval.
    """
    def __init__(self, db_path: str = DEFAULT_DB_PATH):
        self.db_path = db_path
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS rag_documents (
                document_id TEXT PRIMARY KEY,
                document_name TEXT NOT NULL,
                document_type TEXT NOT NULL,
                source TEXT NOT NULL,
                version INTEGER NOT NULL DEFAULT 1,
                content_hash TEXT NOT NULL,
                authorizations TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            """)

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS rag_chunks (
                chunk_id TEXT PRIMARY KEY,
                document_id TEXT NOT NULL,
                chunk_index INTEGER NOT NULL,
                text TEXT NOT NULL,
                metadata TEXT NOT NULL,
                embedding_model TEXT NOT NULL,
                embedding BLOB NOT NULL,
                FOREIGN KEY (document_id) REFERENCES rag_documents(document_id) ON DELETE CASCADE
            );
            """)

            cursor.execute("CREATE INDEX IF NOT EXISTS idx_rag_chunks_doc ON rag_chunks(document_id);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_rag_docs_hash ON rag_documents(content_hash);")
            conn.commit()

    def get_indexed_documents(self) -> Dict[str, Dict[str, Any]]:
        """
        Returns a dictionary of all indexed documents mapped by document_id.
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM rag_documents")
            rows = cursor.fetchall()
            docs = {}
            for r in rows:
                docs[r["document_id"]] = {
                    "document_id": r["document_id"],
                    "document_name": r["document_name"],
                    "document_type": r["document_type"],
                    "source": r["source"],
                    "version": r["version"],
                    "content_hash": r["content_hash"],
                    "authorizations": json.loads(r["authorizations"]),
                    "created_at": r["created_at"],
                    "updated_at": r["updated_at"]
                }
            return docs

    def delete_document(self, document_id: str):
        """
        Deletes a document and all its chunks from the persistent store.
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM rag_chunks WHERE document_id = ?", (document_id,))
            cursor.execute("DELETE FROM rag_documents WHERE document_id = ?", (document_id,))
            conn.commit()
            logger.info(f"[VectorStore] Deleted document '{document_id}' and all associated chunks.")

    def save_document(
        self,
        doc_meta: Dict[str, Any],
        chunks: List[Dict[str, Any]],
        embeddings: np.ndarray,
        embedding_model: str
    ):
        """
        Saves or updates document metadata and its chunk vectors.
        """
        doc_id = doc_meta["document_id"]
        # Delete old chunks if updating existing document
        self.delete_document(doc_id)

        with self._get_connection() as conn:
            cursor = conn.cursor()
            now = datetime.datetime.now(datetime.timezone.utc).isoformat()
            cursor.execute("""
            INSERT INTO rag_documents (
                document_id, document_name, document_type, source, version,
                content_hash, authorizations, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                doc_id,
                doc_meta.get("document_name", doc_id),
                doc_meta.get("document_type", "POLICY"),
                doc_meta.get("source", "MANUAL"),
                doc_meta.get("version", 1),
                doc_meta["content_hash"],
                json.dumps(doc_meta.get("authorizations", ["ALL"])),
                doc_meta.get("created_at", now),
                now
            ))

            for idx, chunk in enumerate(chunks):
                chunk_id = f"{doc_id}_c{idx:03d}"
                vec_bytes = embeddings[idx].astype(np.float32).tobytes()
                cursor.execute("""
                INSERT INTO rag_chunks (
                    chunk_id, document_id, chunk_index, text, metadata, embedding_model, embedding
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    chunk_id,
                    doc_id,
                    idx,
                    chunk["text"],
                    json.dumps(chunk.get("metadata", {})),
                    embedding_model,
                    vec_bytes
                ))

            conn.commit()
            logger.info(f"[VectorStore] Indexed document '{doc_id}' with {len(chunks)} chunks.")

    def similarity_search(
        self,
        query_vector: np.ndarray,
        top_k: int = 3,
        user_roles: Optional[List[str]] = None,
        min_score: float = 0.35
    ) -> List[Dict[str, Any]]:
        """
        Performs genuine semantic vector search:
        1. Filters candidate chunks by document authorization.
        2. Computes cosine similarity via dot product of unit-normalized vectors.
        3. Enforces min_score threshold and top_k constraint.
        4. Returns structured evidence with exact similarity scores.
        """
        if user_roles is None:
            user_roles = ["ALL"]
        user_roles_set = set(r.upper() for r in user_roles)
        user_roles_set.add("ALL")

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT 
                c.chunk_id,
                c.document_id,
                c.chunk_index,
                c.text,
                c.metadata,
                c.embedding,
                d.document_name,
                d.document_type,
                d.source,
                d.authorizations
            FROM rag_chunks c
            JOIN rag_documents d ON c.document_id = d.document_id
            """)
            rows = cursor.fetchall()

        if not rows:
            return []

        # Filter by authorization and extract embeddings
        authorized_rows = []
        vec_list = []
        for r in rows:
            auths = set(json.loads(r["authorizations"]))
            # Document must permit ALL or intersect with user roles
            if "ALL" in auths or auths.intersection(user_roles_set):
                vec = np.frombuffer(r["embedding"], dtype=np.float32)
                vec_list.append(vec)
                authorized_rows.append(r)

        if not authorized_rows:
            logger.warning(f"[VectorStore] 0 chunks matched user roles {user_roles}")
            return []

        # Vectorized dot product against all candidate chunks
        candidate_matrix = np.vstack(vec_list) # [N, D]
        # Query vector is [D], so matrix @ query is [N]
        scores = np.dot(candidate_matrix, query_vector.astype(np.float32))

        # Filter and rank
        results = []
        for i, score in enumerate(scores):
            f_score = float(score)
            if f_score >= min_score:
                row = authorized_rows[i]
                results.append({
                    "chunk_id": row["chunk_id"],
                    "document_id": row["document_id"],
                    "chunk_index": row["chunk_index"],
                    "document_name": row["document_name"],
                    "document_type": row["document_type"],
                    "source": row["source"],
                    "text": row["text"],
                    "metadata": json.loads(row["metadata"]),
                    "similarity_score": round(f_score, 4)
                })

        results.sort(key=lambda x: x["similarity_score"], reverse=True)
        return results[:top_k]

vector_store = SQLiteVectorStore()
