from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from pathlib import Path
import shutil
import os

from config.database import get_db
from config.settings import get_settings
from config.jwt_auth import verify_jwt_token
from models.schemas import (
    DocumentUploadResponse,
    ChatRequest,
    ChatResponse,
    SourceChunk,
    DocumentSummary,
    RiskAnalysisResponse,
    RiskClause,
)
from models.db_models import Document
from ingestion.pipeline import ingest_document
from retrieval.vector_search import retrieve_similar_chunks
from retrieval.llm_qa import generate_answer
from analysis.risk_scanner import scan_document_for_risks
from analysis.summarizer import summarize_contract

settings = get_settings()
router = APIRouter()


# ── Auth helper ───────────────────────────────────────────────────────────────

def get_current_user(user_email: str = Depends(verify_jwt_token)) -> str:
    """
    Verifies the JWT issued by the Spring Boot auth-service and
    returns the user's email (used as user_id throughout).

    Frontend must send: Authorization: Bearer <jwt_token>
    """
    return user_email


# ── Upload ────────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_contract(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """
    Upload a contract PDF → parse → chunk → embed → store in pgvector.
    Returns document_id for all subsequent operations.
    """
    # Validate file type
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    # Validate file size
    contents = await file.read()
    size_mb = len(contents) / (1024 * 1024)
    if size_mb > settings.MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max size: {settings.MAX_FILE_SIZE_MB}MB"
        )

    # Save temporarily
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    tmp_path = Path(settings.UPLOAD_DIR) / f"{user_id}_{file.filename}"
    with open(tmp_path, "wb") as f:
        f.write(contents)

    try:
        document = ingest_document(
            db=db,
            file_path=tmp_path,
            filename=file.filename,
            user_id=user_id,
        )
    finally:
        # Always clean up temp file
        if tmp_path.exists():
            tmp_path.unlink()

    return DocumentUploadResponse(
        document_id=document.id,
        filename=document.filename,
        total_pages=document.total_pages,
        total_chunks=document.total_chunks,
    )


# ── Chat / Q&A ────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
async def chat_with_contract(
    request: ChatRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """
    Ask a question about a contract.
    Retrieves relevant chunks via pgvector, generates answer via Groq.

    Example questions:
    - "What is the notice period?"
    - "Are there any non-compete clauses?"
    - "What happens if I terminate early?"
    """
    # Verify document belongs to this user
    document = db.query(Document).filter(
        Document.id == request.document_id,
        Document.user_id == user_id,
    ).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Retrieve similar chunks
    chunks = retrieve_similar_chunks(
        db=db,
        document_id=request.document_id,
        query=request.question,
    )

    # Generate answer via Groq
    answer = generate_answer(request.question, chunks)

    # Build source references
    source_chunks = [
        SourceChunk(
            chunk_index=chunk.chunk_index,
            page_number=chunk.page_number,
            text=chunk.text[:300] + "..." if len(chunk.text) > 300 else chunk.text,
            risk_label=chunk.risk_label,
        )
        for chunk in chunks
    ]

    return ChatResponse(
        answer=answer,
        source_chunks=source_chunks,
        document_id=request.document_id,
    )


# ── Document Management ───────────────────────────────────────────────────────

@router.get("/documents", response_model=list[DocumentSummary])
async def list_documents(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """List all contracts uploaded by this user."""
    documents = db.query(Document).filter(Document.user_id == user_id).all()
    return documents


@router.get("/documents/{document_id}", response_model=DocumentSummary)
async def get_document(
    document_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """Get details of a specific contract."""
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == user_id,
    ).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    return document


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """Delete a contract and all its chunks."""
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == user_id,
    ).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    db.delete(document)
    db.commit()

    return {"message": "Document deleted successfully", "document_id": document_id}


# ── Risk Analysis ─────────────────────────────────────────────────────────────

@router.post("/documents/{document_id}/analyze", response_model=RiskAnalysisResponse)
async def analyze_document_risks(
    document_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """
    Scan entire contract for risky clauses.

    Pipeline:
    1. Keyword pre-filter on all chunks (fast)
    2. Groq LLM confirms each suspected risky chunk
    3. Tags chunks with risk_label (HIGH/MEDIUM/LOW)
    4. Calculates overall risk score 0-100
    5. Generates plain English summary

    Risk categories detected:
    - HIGH: high interest rates, non-compete, termination without cause, penalties
    - MEDIUM: auto-renewal, liability limitation, IP assignment, indemnification
    - LOW: jurisdiction, governing law
    """
    # Verify ownership
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == user_id,
    ).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Run risk scan
    result = scan_document_for_risks(db=db, document_id=document_id)

    # Generate summary
    summary = summarize_contract(db=db, document_id=document_id)

    # Build response
    risky_clauses = [
        RiskClause(
            chunk_id=chunk.id,
            chunk_index=chunk.chunk_index,
            page_number=chunk.page_number,
            text=chunk.text,
            risk_label=chunk.risk_label,
            risk_category=chunk.risk_category or "general",
            risk_explanation=chunk.risk_explanation or "",
        )
        for chunk in result["risky_chunks"]
    ]

    return RiskAnalysisResponse(
        document_id=document_id,
        overall_risk_score=result["overall_risk_score"],
        risk_breakdown=result["risk_breakdown"],
        risky_clauses=risky_clauses,
        summary=summary,
    )