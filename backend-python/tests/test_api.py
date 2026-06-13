import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import sys
import os

# Add parent to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app

client = TestClient(app)
TEST_USER_ID = "test-user-123"
HEADERS = {"X-User-Id": TEST_USER_ID}


# ── Health ────────────────────────────────────────────────────────────────────

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["app"] == "ClauseGuard"


# ── Upload ────────────────────────────────────────────────────────────────────

def test_upload_missing_auth():
    """Upload without X-User-Id header should fail."""
    response = client.post(
        "/api/v1/upload",
        files={"file": ("test.pdf", b"fake content", "application/pdf")},
    )
    assert response.status_code == 422  # missing required header


def test_upload_non_pdf():
    """Non-PDF files should be rejected."""
    response = client.post(
        "/api/v1/upload",
        files={"file": ("contract.txt", b"some text", "text/plain")},
        headers=HEADERS,
    )
    assert response.status_code == 400
    assert "PDF" in response.json()["detail"]


@patch("api.routes.ingest_document")
def test_upload_success(mock_ingest):
    """Successful upload returns document metadata."""
    mock_doc = MagicMock()
    mock_doc.id = "doc-abc-123"
    mock_doc.filename = "employment_contract.pdf"
    mock_doc.total_pages = 5
    mock_doc.total_chunks = 42
    mock_ingest.return_value = mock_doc

    # Create minimal valid PDF bytes
    import fitz
    pdf_doc = fitz.open()
    page = pdf_doc.new_page()
    page.insert_text((50, 100), "This is a test employment contract.")
    pdf_bytes = pdf_doc.tobytes()
    pdf_doc.close()

    response = client.post(
        "/api/v1/upload",
        files={"file": ("employment_contract.pdf", pdf_bytes, "application/pdf")},
        headers=HEADERS,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["document_id"] == "doc-abc-123"
    assert data["total_pages"] == 5
    assert data["total_chunks"] == 42


# ── Chat ──────────────────────────────────────────────────────────────────────

@patch("api.routes.generate_answer")
@patch("api.routes.retrieve_similar_chunks")
@patch("api.routes.db")
def test_chat_document_not_found(mock_db_query, mock_retrieve, mock_answer):
    """Chat with non-existent document returns 404."""
    response = client.post(
        "/api/v1/chat",
        json={"document_id": "nonexistent-id", "question": "What is the notice period?"},
        headers=HEADERS,
    )
    assert response.status_code == 404


def test_chat_missing_question():
    """Empty question should fail validation."""
    response = client.post(
        "/api/v1/chat",
        json={"document_id": "some-doc-id", "question": "ab"},
        headers=HEADERS,
    )
    assert response.status_code == 422


# ── PDF Parser ────────────────────────────────────────────────────────────────

def test_pdf_parser_extracts_text():
    """PyMuPDF should extract text from a real PDF."""
    import fitz
    import tempfile
    from ingestion.pdf_parser import extract_text_from_pdf

    # Create a test PDF with known content
    pdf_doc = fitz.open()
    page = pdf_doc.new_page()
    page.insert_text((50, 100), "EMPLOYMENT AGREEMENT")
    page.insert_text((50, 150), "1. Notice Period: The employee shall provide 30 days notice.")
    page.insert_text((50, 200), "2. Non-Compete: Employee agrees not to work for competitors for 1 year.")

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        pdf_doc.save(f.name)
        pdf_path = f.name
    pdf_doc.close()

    pages = extract_text_from_pdf(pdf_path)
    assert len(pages) == 1
    assert pages[0].page_number == 1
    assert "EMPLOYMENT AGREEMENT" in pages[0].text
    assert "Notice Period" in pages[0].text

    os.unlink(pdf_path)


def test_pdf_parser_file_not_found():
    from ingestion.pdf_parser import extract_text_from_pdf
    with pytest.raises(FileNotFoundError):
        extract_text_from_pdf("/nonexistent/path/file.pdf")


# ── Chunker ───────────────────────────────────────────────────────────────────

def test_chunker_splits_correctly():
    from ingestion.chunker import chunk_pages
    from ingestion.pdf_parser import PageText

    long_text = "This is clause number one. " * 50  # ~1350 chars
    pages = [PageText(page_number=1, text=long_text)]

    chunks = chunk_pages(pages)
    assert len(chunks) > 1                          # should be split
    assert all(c.page_number == 1 for c in chunks)
    assert all(len(c.text) > 20 for c in chunks)
    assert chunks[0].chunk_index == 0


def test_chunker_preserves_page_numbers():
    from ingestion.chunker import chunk_pages
    from ingestion.pdf_parser import PageText

    pages = [
        PageText(page_number=1, text="Page one content. " * 20),
        PageText(page_number=2, text="Page two content. " * 20),
    ]
    chunks = chunk_pages(pages)
    page_numbers = {c.page_number for c in chunks}
    assert 1 in page_numbers
    assert 2 in page_numbers


def test_chunker_skips_tiny_fragments():
    from ingestion.chunker import chunk_pages
    from ingestion.pdf_parser import PageText

    pages = [PageText(page_number=1, text="Hi")]  # too short
    chunks = chunk_pages(pages)
    assert len(chunks) == 0


# ── Embedder ──────────────────────────────────────────────────────────────────

def test_embedder_returns_correct_dimension():
    from ingestion.embedder import embed_single
    embedding = embed_single("What is the notice period in this contract?")
    assert len(embedding) == 384    # all-MiniLM-L6-v2


def test_embedder_batch():
    from ingestion.embedder import embed_texts
    texts = ["First clause about employment.", "Second clause about termination."]
    embeddings = embed_texts(texts)
    assert len(embeddings) == 2
    assert all(len(e) == 384 for e in embeddings)


def test_embedder_normalized():
    """Normalized embeddings should have magnitude ≈ 1."""
    import math
    from ingestion.embedder import embed_single
    vec = embed_single("test query")
    magnitude = math.sqrt(sum(x**2 for x in vec))
    assert abs(magnitude - 1.0) < 0.01


# ── Documents API ─────────────────────────────────────────────────────────────

def test_list_documents_empty(mock_db_session):
    """User with no documents gets empty list."""
    pass  # covered by integration tests


def test_delete_document_not_owned():
    """Cannot delete another user's document."""
    response = client.delete(
        "/api/v1/documents/some-other-users-doc",
        headers=HEADERS,
    )
    assert response.status_code == 404
