from groq import Groq
from sqlalchemy.orm import Session
from typing import List
from models.db_models import Document, DocumentChunk
from config.settings import get_settings
import json
import re

settings = get_settings()


def get_full_text(db: Session, document_id: str, max_chunks: int = 15) -> str:
    """Concatenate chunks into a single text block for comparison (capped to control token usage)."""
    chunks = db.query(DocumentChunk).filter(
        DocumentChunk.document_id == document_id
    ).order_by(DocumentChunk.chunk_index).limit(max_chunks).all()

    return "\n\n".join([c.text for c in chunks])


def compare_contracts(db: Session, doc_id_a: str, doc_id_b: str) -> dict:
    """
    Compare two contracts using Groq and return structured differences.

    Returns:
    {
        "summary": "...",
        "differences": [
            {"aspect": "Notice Period", "contract_a": "...", "contract_b": "...", "impact": "..."},
            ...
        ],
        "recommendation": "..."
    }
    """
    doc_a = db.query(Document).filter(Document.id == doc_id_a).first()
    doc_b = db.query(Document).filter(Document.id == doc_id_b).first()

    if not doc_a or not doc_b:
        raise ValueError("One or both documents not found")

    text_a = get_full_text(db, doc_id_a)
    text_b = get_full_text(db, doc_id_b)

    client = Groq(api_key=settings.GROQ_API_KEY)

    prompt = f"""You are a legal contract comparison expert. Compare these two contracts and identify key differences.

CONTRACT A ("{doc_a.filename}"):
{text_a}

---

CONTRACT B ("{doc_b.filename}"):
{text_b}

Respond ONLY with a valid JSON object (no markdown, no explanation outside JSON):
{{
  "summary": "2-3 sentence overview of how these contracts differ overall",
  "differences": [
    {{
      "aspect": "short name like 'Notice Period' or 'Interest Rate' or 'Termination Clause'",
      "contract_a": "what Contract A says about this aspect (1-2 sentences, plain English)",
      "contract_b": "what Contract B says about this aspect (1-2 sentences, plain English)",
      "impact": "which contract is more favorable and why (1 sentence)",
      "severity": "HIGH" or "MEDIUM" or "LOW"
    }}
  ],
  "recommendation": "1-2 sentence overall recommendation on which contract has better terms, or note if they're similar"
}}

Rules:
- Find 4-8 meaningful differences (financial terms, durations, obligations, penalties, termination conditions)
- severity: HIGH if the difference significantly impacts one party financially or legally, MEDIUM for moderate impact, LOW for minor/procedural differences
- Use plain English, no legal jargon
- If a contract doesn't mention an aspect, say "Not specified" """

    response = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
        max_tokens=1500,
    )

    raw = response.choices[0].message.content.strip()
    raw = re.sub(r"```json|```", "", raw).strip()

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        result = {
            "summary": "Unable to parse comparison results.",
            "differences": [],
            "recommendation": "",
        }

    result["document_a"] = {"id": doc_a.id, "filename": doc_a.filename}
    result["document_b"] = {"id": doc_b.id, "filename": doc_b.filename}

    return result