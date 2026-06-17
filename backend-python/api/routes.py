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
    CompareRequest,
    CompareResponse,
    ComparisonDifference,
    ChatMessageOut,
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
    from retrieval.llm_router import DEFAULT_MODEL
    answer = generate_answer(request.question, chunks, model_key=request.model or DEFAULT_MODEL)

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
    # Persist chat history for this document
    from models.db_models import ChatMessage

    user_msg = ChatMessage(
        document_id=request.document_id,
        role="user",
        content=request.question,
    )
    ai_msg = ChatMessage(
        document_id=request.document_id,
        role="ai",
        content=answer,
        sources=[s.model_dump() for s in source_chunks],
    )
    db.add(user_msg)
    db.add(ai_msg)
    db.commit()

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
# ── Contract Comparison ──────────────────────────────────────────────────────

@router.post("/compare", response_model=CompareResponse)
async def compare_two_contracts(
    request: CompareRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """
    Compare two contracts and highlight key differences.

    Both documents must belong to the requesting user.
    Returns aspect-by-aspect comparison with severity ratings
    and an overall recommendation.
    """
    from analysis.comparator import compare_contracts

    doc_a = db.query(Document).filter(
        Document.id == request.document_id_a,
        Document.user_id == user_id,
    ).first()
    doc_b = db.query(Document).filter(
        Document.id == request.document_id_b,
        Document.user_id == user_id,
    ).first()

    if not doc_a or not doc_b:
        raise HTTPException(status_code=404, detail="One or both documents not found")

    if request.document_id_a == request.document_id_b:
        raise HTTPException(status_code=400, detail="Cannot compare a document with itself")

    result = compare_contracts(db=db, doc_id_a=request.document_id_a, doc_id_b=request.document_id_b)

    return CompareResponse(**result)
# ── PDF Report Export ────────────────────────────────────────────────────────

@router.get("/documents/{document_id}/report")
async def download_risk_report_pdf(
    document_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """
    Generate and download a polished PDF risk report for a document.

    Requires the document to have already been analyzed via /analyze
    (uses stored risk_score, risk_summary, and per-chunk risk fields).
    """
    from fastapi.responses import Response
    from analysis.pdf_report import generate_risk_report_pdf
    from analysis.summarizer import summarize_contract
    from models.db_models import DocumentChunk

    document = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == user_id,
    ).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if document.risk_score is None:
        raise HTTPException(status_code=400, detail="Document has not been analyzed yet. Call /analyze first.")

    risky_chunks = db.query(DocumentChunk).filter(
        DocumentChunk.document_id == document_id,
        DocumentChunk.risk_label.isnot(None),
    ).order_by(DocumentChunk.chunk_index).all()

    risky_clauses = [
        {
            "risk_label": c.risk_label,
            "risk_category": c.risk_category,
            "page_number": c.page_number,
            "text": c.text,
            "risk_explanation": c.risk_explanation,
        }
        for c in risky_chunks
    ]

    summary = summarize_contract(db=db, document_id=document_id)

    pdf_bytes = generate_risk_report_pdf(
        filename=document.filename,
        overall_risk_score=document.risk_score,
        risk_breakdown=document.risk_summary or {"HIGH": 0, "MEDIUM": 0, "LOW": 0},
        risky_clauses=risky_clauses,
        summary=summary,
    )

    safe_name = document.filename.rsplit(".", 1)[0]
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="clauseguard-report-{safe_name}.pdf"'},
    )
# ── Chat History ──────────────────────────────────────────────────────────────

@router.get("/documents/{document_id}/messages", response_model=list[ChatMessageOut])
async def get_chat_history(
    document_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """
    Get the full chat conversation history for a document.

    Used to restore previous Q&A sessions when a user re-opens
    a document from their history sidebar (ChatGPT/Claude-style).
    """
    from models.db_models import ChatMessage

    document = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == user_id,
    ).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    messages = db.query(ChatMessage).filter(
        ChatMessage.document_id == document_id
    ).order_by(ChatMessage.created_at).all()

    return messages
# ── Models ────────────────────────────────────────────────────────────────────

@router.get("/models")
async def get_available_models(user_id: str = Depends(get_current_user)):
    """
    List all models the frontend can show in its model picker.
    'available: false' models are shown for transparency but are disabled in the UI.
    """
    from retrieval.llm_router import list_models
    return list_models()