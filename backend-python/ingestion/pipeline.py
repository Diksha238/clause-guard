from sqlalchemy.orm import Session
from pathlib import Path
from models.db_models import Document, DocumentChunk
from ingestion.pdf_parser import extract_text_from_pdf, get_pdf_metadata
from ingestion.chunker import chunk_pages
from ingestion.embedder import embed_texts


def ingest_document(
    db: Session,
    file_path: str | Path,
    filename: str,
    user_id: str,
) -> Document:
    """
    Full pipeline: PDF file → DB rows with embeddings.

    Steps:
    1. Extract text (PyMuPDF)
    2. Chunk text (LangChain splitter)
    3. Generate embeddings (sentence-transformers)
    4. Store Document + DocumentChunk rows in pgvector DB

    Returns the created Document ORM object.
    """
    file_path = Path(file_path)

    # ── Step 1: Extract text ──────────────────────────────────────────────
    print(f"📄 Parsing PDF: {filename}")
    pages = extract_text_from_pdf(file_path)
    metadata = get_pdf_metadata(file_path)

    # ── Step 2: Chunk ─────────────────────────────────────────────────────
    chunks = chunk_pages(pages)
    print(f"✂️  Created {len(chunks)} chunks from {metadata['total_pages']} pages")

    # ── Step 3: Embed ─────────────────────────────────────────────────────
    print("🔢 Generating embeddings...")
    chunk_texts = [c.text for c in chunks]
    embeddings = embed_texts(chunk_texts)
    print(f"✅ Embeddings done — dim={len(embeddings[0])}")

    # ── Step 4: Save to DB ────────────────────────────────────────────────
    document = Document(
        user_id=user_id,
        filename=filename,
        file_size_bytes=file_path.stat().st_size,
        total_pages=metadata["total_pages"],
        total_chunks=len(chunks),
    )
    db.add(document)
    db.flush()      # get document.id before inserting chunks

    chunk_rows = [
        DocumentChunk(
            document_id=document.id,
            chunk_index=chunk.chunk_index,
            page_number=chunk.page_number,
            text=chunk.text,
            embedding=embeddings[i],
        )
        for i, chunk in enumerate(chunks)
    ]
    db.bulk_save_objects(chunk_rows)
    db.commit()
    db.refresh(document)

    print(f"💾 Document saved — id={document.id}")
    return document
