from sentence_transformers import SentenceTransformer
from typing import List
from config.settings import get_settings
import numpy as np

settings = get_settings()

# Singleton — model loads once at startup, reused for all requests
_model: SentenceTransformer | None = None


def get_embedding_model() -> SentenceTransformer:
    global _model
    if _model is None:
        print(f"📦 Loading embedding model: {settings.EMBEDDING_MODEL}")
        _model = SentenceTransformer(settings.EMBEDDING_MODEL)
        print("✅ Embedding model loaded")
    return _model


def embed_texts(texts: List[str]) -> List[List[float]]:
    """
    Convert list of strings → list of embedding vectors.
    Uses batch processing for efficiency.

    all-MiniLM-L6-v2 specs:
    - Dimension: 384
    - Speed: ~14k sentences/sec on CPU
    - Free, runs locally — no API cost
    """
    model = get_embedding_model()
    embeddings = model.encode(
        texts,
        batch_size=32,
        show_progress_bar=len(texts) > 50,
        normalize_embeddings=True,      # cosine similarity = dot product
        convert_to_numpy=True,
    )
    return embeddings.tolist()


def embed_single(text: str) -> List[float]:
    """Embed a single query string — used at retrieval time."""
    return embed_texts([text])[0]
