from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
from models.db_models import DocumentChunk
from ingestion.embedder import embed_single
from config.settings import get_settings

settings = get_settings()


def retrieve_similar_chunks(
    db: Session,
    document_id: str,
    query: str,
    top_k: int | None = None,
) -> List[DocumentChunk]:
    """
    Embed the query and find the most similar chunks in pgvector.

    Uses cosine distance (<=> operator in pgvector).
    Filters by document_id so each user only searches their own contract.

    Returns chunks ordered by similarity (most relevant first).
    """
    k = top_k or settings.TOP_K_CHUNKS
    query_embedding = embed_single(query)

    # pgvector cosine distance — lower = more similar
    results = (
        db.query(DocumentChunk)
        .filter(DocumentChunk.document_id == document_id)
        .order_by(DocumentChunk.embedding.cosine_distance(query_embedding))
        .limit(k)
        .all()
    )

    return results


def get_chunk_by_id(db: Session, chunk_id: str) -> DocumentChunk | None:
    return db.query(DocumentChunk).filter(DocumentChunk.id == chunk_id).first()
