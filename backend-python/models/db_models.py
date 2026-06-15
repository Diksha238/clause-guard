from sqlalchemy import Column, String, Integer, Text, DateTime, Float, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector
from config.database import Base
from config.settings import get_settings
import uuid

settings = get_settings()


class Document(Base):
    """One row per uploaded contract PDF."""
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)   # from Spring Boot JWT
    filename = Column(String, nullable=False)
    file_size_bytes = Column(Integer)
    total_pages = Column(Integer)
    total_chunks = Column(Integer, default=0)
    risk_score = Column(Float, nullable=True)               # set after Phase 2 analysis
    risk_summary = Column(JSON, nullable=True)              # {"HIGH": 2, "MEDIUM": 3, "LOW": 1}
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")


class DocumentChunk(Base):
    """One row per text chunk — stores embedding for vector search."""
    __tablename__ = "document_chunks"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)    # order within document
    page_number = Column(Integer, nullable=True)
    text = Column(Text, nullable=False)
    embedding = Column(Vector(settings.EMBEDDING_DIMENSION), nullable=False)

    # Phase 2 fields — risk tagging
    risk_label = Column(String, nullable=True)       # "HIGH" | "MEDIUM" | "LOW" | None
    risk_category = Column(String, nullable=True)    # "non_compete" | "termination" | etc.
    risk_explanation = Column(Text, nullable=True)   # plain English explanation

    document = relationship("Document", back_populates="chunks")
class ChatMessage(Base):
    """Stores chat conversation history per document for persistent chat-style UI."""
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String, nullable=False)          # "user" | "ai"
    content = Column(Text, nullable=False)
    sources = Column(JSON, nullable=True)          # list of source chunk references (for AI messages)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
