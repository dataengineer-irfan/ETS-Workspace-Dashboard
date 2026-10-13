import os
import re
import datetime
import hashlib
import logging
from typing import Dict, Any, List, Tuple
from backend.app.ai.embedding_engine import embedding_engine
from backend.app.ai.vector_store import vector_store

logger = logging.getLogger("rag_document_indexer")

DEFAULT_DOCS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "data", "documents")
)

def parse_frontmatter(file_content: str) -> Tuple[Dict[str, Any], str]:
    """
    Parses optional YAML-like frontmatter delimited by --- and returns metadata dict + body text.
    """
    meta = {}
    body = file_content.strip()

    if file_content.startswith("---"):
        parts = file_content.split("---", 2)
        if len(parts) >= 3:
            raw_meta = parts[1].strip()
            body = parts[2].strip()
            current_list_key = None
            for line in raw_meta.splitlines():
                line_str = line.strip()
                if not line_str:
                    continue
                if line_str.startswith("- ") and current_list_key:
                    val = line_str[2:].strip()
                    meta[current_list_key].append(val)
                elif ":" in line_str:
                    k, v = line_str.split(":", 1)
                    k = k.strip()
                    v = v.strip()
                    if not v:
                        current_list_key = k
                        meta[k] = []
                    else:
                        current_list_key = None
                        if v.isdigit():
                            meta[k] = int(v)
                        else:
                            meta[k] = v
    return meta, body

def deterministic_chunk_text(text: str, chunk_size: int = 450, overlap: int = 80) -> List[str]:
    """
    Splits text deterministically into coherent chunks respecting markdown headings,
    paragraphs, and sentence boundaries.
    """
    # Split by markdown headers or double newlines first
    paragraphs = re.split(r'\n{2,}|\n(?=#+ )', text)
    paragraphs = [p.strip() for p in paragraphs if p.strip()]

    chunks = []
    current_chunk = ""

    for p in paragraphs:
        if not current_chunk:
            current_chunk = p
        elif len(current_chunk) + len(p) + 2 <= chunk_size:
            current_chunk += "\n\n" + p
        else:
            # Paragraph exceeds chunk size; commit current_chunk
            chunks.append(current_chunk)
            if len(p) <= chunk_size:
                current_chunk = p
            else:
                # Split large paragraph by sentences
                sentences = re.split(r'(?<=[.?!])\s+', p)
                sub_chunk = ""
                for s in sentences:
                    if not sub_chunk:
                        sub_chunk = s
                    elif len(sub_chunk) + len(s) + 1 <= chunk_size:
                        sub_chunk += " " + s
                    else:
                        chunks.append(sub_chunk)
                        # Overlap
                        tail = sub_chunk[-overlap:] if len(sub_chunk) > overlap else ""
                        sub_chunk = (tail + " " + s).strip()
                current_chunk = sub_chunk

    if current_chunk and current_chunk.strip():
        chunks.append(current_chunk.strip())

    return chunks if chunks else [text.strip()]

class DocumentIndexer:
    def __init__(self, docs_dir: str = DEFAULT_DOCS_DIR, vector_store=None, embedding_engine=None):
        from backend.app.ai.vector_store import vector_store as default_vs
        from backend.app.ai.embedding_engine import embedding_engine as default_emb
        self.docs_dir = docs_dir
        self.vector_store = vector_store if vector_store is not None else default_vs
        self.embedding_engine = embedding_engine if embedding_engine is not None else default_emb


    def sync_documents(self) -> Dict[str, Any]:
        """
        Scans docs_dir, detects content changes via SHA256 hashes,
        indexes new or modified documents, and removes deleted ones.
        Unchanged documents are NOT re-embedded.
        """
        if not os.path.exists(self.docs_dir):
            logger.warning(f"[DocumentIndexer] Documents dir does not exist: {self.docs_dir}")
            return {"indexed": 0, "skipped": 0, "deleted": 0, "total": 0}

        indexed_docs = self.vector_store.get_indexed_documents()
        current_disk_ids = set()

        stats = {"indexed": 0, "skipped": 0, "deleted": 0, "total": 0}

        for fname in sorted(os.listdir(self.docs_dir)):
            if not (fname.endswith(".md") or fname.endswith(".txt")):
                continue

            fpath = os.path.join(self.docs_dir, fname)
            with open(fpath, "r", encoding="utf-8") as f:
                content = f.read()

            content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
            meta, body = parse_frontmatter(content)

            doc_id = meta.get("document_id") or os.path.splitext(fname)[0]
            current_disk_ids.add(doc_id)
            stats["total"] += 1

            # Check if document is already indexed with identical content hash
            if doc_id in indexed_docs and indexed_docs[doc_id]["content_hash"] == content_hash:
                logger.debug(f"[DocumentIndexer] Document '{doc_id}' unchanged (hash match). Skipping.")
                stats["skipped"] += 1
                continue

            # Document is new or changed: chunk and embed
            logger.info(f"[DocumentIndexer] Indexing document '{doc_id}' ({fname})...")
            raw_chunks = deterministic_chunk_text(body, chunk_size=400, overlap=80)
            
            chunk_objs = []
            chunk_texts = []
            for idx, ctext in enumerate(raw_chunks):
                chunk_objs.append({
                    "text": ctext,
                    "metadata": {
                        "document_id": doc_id,
                        "document_name": meta.get("document_name", doc_id),
                        "chunk_index": idx,
                        "source": meta.get("source", fname)
                    }
                })
                chunk_texts.append(ctext)

            # Compute dense embeddings
            embeddings = self.embedding_engine.embed_batch(chunk_texts)

            raw_auths = meta.get("authorizations", ["ALL"])
            if isinstance(raw_auths, list):
                authorizations = raw_auths
            elif isinstance(raw_auths, str):
                try:
                    import json as _json
                    parsed = _json.loads(raw_auths)
                    authorizations = parsed if isinstance(parsed, list) else [raw_auths]
                except Exception:
                    authorizations = [raw_auths]
            else:
                authorizations = ["ALL"]

            doc_meta = {
                "document_id": doc_id,
                "document_name": meta.get("document_name", doc_id),
                "document_type": meta.get("document_type", "POLICY"),
                "source": meta.get("source", fname),
                "version": meta.get("version", 1),
                "content_hash": content_hash,
                "authorizations": authorizations,
                "created_at": meta.get("created_at") or datetime.datetime.now(datetime.timezone.utc).isoformat()
            }

            self.vector_store.save_document(
                doc_meta=doc_meta,
                chunks=chunk_objs,
                embeddings=embeddings,
                embedding_model=self.embedding_engine.model_name
            )
            stats["indexed"] += 1

        # Delete any documents in DB that are no longer on disk
        for doc_id in list(indexed_docs.keys()):
            if doc_id not in current_disk_ids:
                logger.info(f"[DocumentIndexer] Deleting orphaned document '{doc_id}' from vector store.")
                self.vector_store.delete_document(doc_id)
                stats["deleted"] += 1

        logger.info(f"[DocumentIndexer] Sync complete: {stats}")
        return stats

document_indexer = DocumentIndexer()
