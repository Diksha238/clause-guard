from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ── Upload ──────────────────────────────────────────────────────────────────

class DocumentUploadResponse(BaseModel):
    document_id: str
    filename: str
    total_pages: int
    total_chunks: int
    message: str = "Contract uploaded and processed successfully"


# ── Chat / Q&A ───────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    document_id: str
    question: str = Field(..., min_length=3, max_length=1000)
    model: Optional[str] = None   # e.g. "llama-3.3-70b", "llama-3.1-8b", "gemini-flash"


class SourceChunk(BaseModel):
    chunk_index: int
    page_number: Optional[int]
    text: str                   # snippet shown to user
    risk_label: Optional[str]   # populated in Phase 2


class ChatResponse(BaseModel):
    answer: str
    source_chunks: List[SourceChunk]
    document_id: str


# ── Document list ────────────────────────────────────────────────────────────

class DocumentSummary(BaseModel):
    id: str
    filename: str
    total_pages: int
    total_chunks: int
    risk_score: Optional[float]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Risk Analysis (Phase 2) ──────────────────────────────────────────────────

class RiskClause(BaseModel):
    chunk_id: str
    chunk_index: int
    page_number: Optional[int]
    text: str
    risk_label: str               # HIGH | MEDIUM | LOW
    risk_category: str            # non_compete | termination | liability | auto_renewal | penalty
    risk_explanation: str         # plain English


class RiskAnalysisResponse(BaseModel):
    document_id: str
    overall_risk_score: float     # 0-100
    risk_breakdown: dict          # {"HIGH": n, "MEDIUM": n, "LOW": n}
    risky_clauses: List[RiskClause]
    summary: str


# ── Contract Comparison ──────────────────────────────────────────────────────

class CompareRequest(BaseModel):
    document_id_a: str
    document_id_b: str


class ComparisonDifference(BaseModel):
    aspect: str
    contract_a: str
    contract_b: str
    impact: str
    severity: str


class CompareResponse(BaseModel):
    summary: str
    differences: List[ComparisonDifference]
    recommendation: str
    document_a: dict
    document_b: dict


# ── Chat History ──────────────────────────────────────────────────────────────

class ChatMessageOut(BaseModel):
    id: str
    role: str
    content: str
    sources: Optional[List[dict]] = None
    created_at: datetime

    class Config:
        from_attributes = True