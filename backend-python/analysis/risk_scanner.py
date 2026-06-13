from groq import Groq
from sqlalchemy.orm import Session
from typing import List
from models.db_models import Document, DocumentChunk
from config.settings import get_settings
import json
import re

settings = get_settings()

# ── Risk Categories ───────────────────────────────────────────────────────────

RISK_CATEGORIES = {
    "high_interest_rate": {
        "label": "HIGH",
        "keywords": ["interest", "rate", "per month", "per annum", "% per"],
        "description": "Unusually high interest rate clause",
    },
    "non_compete": {
        "label": "HIGH",
        "keywords": ["non-compete", "non compete", "not compete", "competitor", "competing business"],
        "description": "Non-compete restriction on employment",
    },
    "termination_without_cause": {
        "label": "HIGH",
        "keywords": ["terminate", "termination", "without cause", "without notice", "at will", "immediate termination"],
        "description": "Termination without cause or notice",
    },
    "penalty_clause": {
        "label": "HIGH",
        "keywords": ["penalty", "late payment penalty", "liquidated damages", "per default"],
        "description": "Heavy penalty or liquidated damages clause",
    },
    "auto_renewal": {
        "label": "MEDIUM",
        "keywords": ["auto renew", "automatic renewal", "automatically renewed", "unless terminated"],
        "description": "Auto-renewal trap — contract renews unless you cancel",
    },
    "liability_limitation": {
        "label": "MEDIUM",
        "keywords": ["limitation of liability", "limited liability", "not liable", "no liability", "exclude liability"],
        "description": "Liability limitation clause",
    },
    "unilateral_modification": {
        "label": "MEDIUM",
        "keywords": ["sole discretion", "right to modify", "reserves the right", "may change", "without consent"],
        "description": "One party can modify terms unilaterally",
    },
    "intellectual_property": {
        "label": "MEDIUM",
        "keywords": ["intellectual property", "work for hire", "assigns all rights", "ownership of work", "IP rights"],
        "description": "IP ownership assigned to other party",
    },
    "indemnification": {
        "label": "MEDIUM",
        "keywords": ["indemnify", "indemnification", "hold harmless", "defend and indemnify"],
        "description": "Broad indemnification obligation",
    },
    "jurisdiction": {
        "label": "LOW",
        "keywords": ["jurisdiction", "governing law", "courts of", "dispute resolution", "arbitration"],
        "description": "Jurisdiction / dispute resolution clause",
    },
}


def keyword_scan_chunk(text: str) -> List[str]:
    """Fast keyword-based pre-filter — returns matched risk category keys."""
    text_lower = text.lower()
    matched = []
    for category, config in RISK_CATEGORIES.items():
        if any(kw in text_lower for kw in config["keywords"]):
            matched.append(category)
    return matched


def analyze_chunk_with_llm(
    client: Groq,
    chunk_text: str,
    suspected_categories: List[str],
) -> dict:
    """
    Use Groq to confirm risk and generate plain-English explanation.
    Only called for chunks that passed keyword pre-filter.
    """
    categories_str = ", ".join(suspected_categories)

    prompt = f"""You are a legal contract risk analyzer. Analyze this contract clause and determine if it contains risky terms.

CLAUSE TEXT:
{chunk_text}

SUSPECTED RISK CATEGORIES: {categories_str}

Respond ONLY with a valid JSON object (no markdown, no explanation outside JSON):
{{
  "is_risky": true/false,
  "risk_label": "HIGH" or "MEDIUM" or "LOW" or null,
  "risk_category": "the most relevant category name" or null,
  "explanation": "1-2 sentence plain English explanation of why this is risky, written for a non-lawyer" or null
}}

Rules:
- is_risky: true only if clause genuinely disadvantages one party
- risk_label: HIGH for financial/career-limiting risks, MEDIUM for moderate risks, LOW for informational
- explanation: simple language, no jargon, mention specific numbers/terms if present
- If not actually risky, set is_risky: false and others to null"""

    response = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
        max_tokens=300,
    )

    raw = response.choices[0].message.content.strip()

    # Strip markdown fences if present
    raw = re.sub(r"```json|```", "", raw).strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"is_risky": False, "risk_label": None, "risk_category": None, "explanation": None}


def calculate_risk_score(chunks: List[DocumentChunk]) -> float:
    """
    Calculate overall risk score 0-100 based on risky chunks.

    Scoring:
    - HIGH clause: 20 points (max 3 counted = 60)
    - MEDIUM clause: 10 points (max 3 counted = 30)
    - LOW clause: 3 points (max 3 counted = 9)
    - Capped at 100
    """
    high_count = sum(1 for c in chunks if c.risk_label == "HIGH")
    medium_count = sum(1 for c in chunks if c.risk_label == "MEDIUM")
    low_count = sum(1 for c in chunks if c.risk_label == "LOW")

    score = (
        min(high_count, 3) * 20 +
        min(medium_count, 3) * 10 +
        min(low_count, 3) * 3
    )
    return min(float(score), 100.0)


def scan_document_for_risks(db: Session, document_id: str) -> dict:
    """
    Full risk scan pipeline for a document.

    1. Load all chunks
    2. Keyword pre-filter (fast, no API call)
    3. LLM confirmation for matched chunks (Groq API)
    4. Save risk labels to DB
    5. Calculate overall risk score
    6. Return structured risk report
    """
    from groq import Groq
    client = Groq(api_key=settings.GROQ_API_KEY)

    chunks = db.query(DocumentChunk).filter(
        DocumentChunk.document_id == document_id
    ).order_by(DocumentChunk.chunk_index).all()

    if not chunks:
        raise ValueError(f"No chunks found for document {document_id}")

    risky_chunks = []
    processed = 0

    for chunk in chunks:
        # Step 1: keyword pre-filter
        suspected = keyword_scan_chunk(chunk.text)
        if not suspected:
            continue

        # Step 2: LLM confirmation
        result = analyze_chunk_with_llm(client, chunk.text, suspected)
        processed += 1

        if result.get("is_risky"):
            chunk.risk_label = result.get("risk_label")
            chunk.risk_category = result.get("risk_category")
            chunk.risk_explanation = result.get("explanation")
            db.add(chunk)
            risky_chunks.append(chunk)

    db.commit()

    # Recalculate risk score
    risk_score = calculate_risk_score(risky_chunks)

    # Risk breakdown
    breakdown = {
        "HIGH": sum(1 for c in risky_chunks if c.risk_label == "HIGH"),
        "MEDIUM": sum(1 for c in risky_chunks if c.risk_label == "MEDIUM"),
        "LOW": sum(1 for c in risky_chunks if c.risk_label == "LOW"),
    }

    # Update document
    document = db.query(Document).filter(Document.id == document_id).first()
    document.risk_score = risk_score
    document.risk_summary = breakdown
    db.add(document)
    db.commit()

    print(f"✅ Risk scan complete — score={risk_score}, risky_chunks={len(risky_chunks)}, llm_calls={processed}")

    return {
        "document_id": document_id,
        "overall_risk_score": risk_score,
        "risk_breakdown": breakdown,
        "risky_chunks": risky_chunks,
        "total_chunks_scanned": len(chunks),
    }