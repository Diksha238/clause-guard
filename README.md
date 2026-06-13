# ⚖️ ClauseGuard — AI Legal Contract Analyzer

Upload any contract PDF → ask questions in plain English → get clause-level risk analysis.

## Architecture

```
User uploads PDF
     ↓
FastAPI (Python) ← RAG Core
     ↓
PyMuPDF → text extract
     ↓
LangChain → chunks (500 tokens, 50 overlap)
     ↓
sentence-transformers → embeddings (all-MiniLM-L6-v2, dim=384)
     ↓
pgvector (PostgreSQL) → vector store
     ↓
User question → embed → cosine search → top-5 chunks
     ↓
Groq (Llama 3.3 70B) → generate answer with clause references
     ↓
Response + source clauses
```

## Stack

| Layer | Tech | Why |
|-------|------|-----|
| Backend (RAG) | Python + FastAPI | LangChain ecosystem maturity |
| LLM | Groq Llama 3.3 70B | Fast inference, free tier |
| Embeddings | sentence-transformers | Local, free, 384-dim |
| Vector DB | pgvector (PostgreSQL) | No extra infra |
| PDF Parsing | PyMuPDF | Fastest + cleanest |
| Auth | Spring Boot | JWT expertise |
| Frontend | React + Tailwind | ChatPDF-style UI |

## Quick Start

### 1. Prerequisites
- Docker + Docker Compose
- Python 3.11+
- Groq API key (free at console.groq.com)

### 2. Environment setup
```bash
cd backend-python
cp .env.example .env
# Edit .env — add your GROQ_API_KEY
```

### 3. Start with Docker
```bash
docker-compose up
```

This starts:
- PostgreSQL + pgvector on port 5432
- FastAPI on port 8000

### 4. Without Docker (local dev)
```bash
cd backend-python
pip install -r requirements.txt
uvicorn main:app --reload
```

FastAPI docs: http://localhost:8000/docs

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/v1/upload` | Upload contract PDF |
| POST | `/api/v1/chat` | Ask a question |
| GET | `/api/v1/documents` | List user's contracts |
| GET | `/api/v1/documents/{id}` | Get contract details |
| DELETE | `/api/v1/documents/{id}` | Delete contract |

All endpoints require `X-User-Id` header (set by Spring Boot auth gateway in production).

## Example Usage

```bash
# Upload a contract
curl -X POST http://localhost:8000/api/v1/upload \
  -H "X-User-Id: user123" \
  -F "file=@employment_contract.pdf"
# → {"document_id": "abc-123", "total_pages": 8, "total_chunks": 67}

# Ask a question
curl -X POST http://localhost:8000/api/v1/chat \
  -H "X-User-Id: user123" \
  -H "Content-Type: application/json" \
  -d '{"document_id": "abc-123", "question": "What is the notice period?"}'
# → {"answer": "The notice period is 30 days as specified in Clause 5.2 on page 3..."}
```

## Project Structure

```
clauseguard/
├── backend-python/
│   ├── main.py                  ← FastAPI app entry
│   ├── config/
│   │   ├── settings.py          ← Pydantic settings
│   │   └── database.py          ← SQLAlchemy + pgvector
│   ├── models/
│   │   ├── db_models.py         ← Document + DocumentChunk ORM
│   │   └── schemas.py           ← Pydantic request/response schemas
│   ├── ingestion/
│   │   ├── pdf_parser.py        ← PyMuPDF text extraction
│   │   ├── chunker.py           ← LangChain text splitter
│   │   ├── embedder.py          ← sentence-transformers
│   │   └── pipeline.py          ← Full ingestion orchestrator
│   ├── retrieval/
│   │   ├── vector_search.py     ← pgvector cosine search
│   │   └── llm_qa.py            ← Groq RAG answer generation
│   ├── analysis/                ← Phase 2: risk detection
│   ├── api/
│   │   └── routes.py            ← All FastAPI routes
│   └── tests/
│       └── test_api.py          ← pytest suite
│
├── backend-java/                ← Phase 2: Spring Boot auth
├── frontend/                    ← Phase 2: React dashboard
└── docker-compose.yml
```

## Phases

- **Phase 1 (Week 1-2)** ✅ — Core RAG: upload, chunk, embed, Q&A
- **Phase 2 (Week 3-4)** — Risk scanner: non-compete, termination, liability, penalty detection
- **Phase 3 (Week 5-6)** — Risk score 0-100, contract summary, comparison
- **Phase 4 (Week 7-8)** — React dashboard, PDF highlighting, export report

## Running Tests

```bash
cd backend-python
pytest tests/ -v
```