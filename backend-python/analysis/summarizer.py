from groq import Groq
from sqlalchemy.orm import Session
from models.db_models import DocumentChunk
from config.settings import get_settings

settings = get_settings()


def summarize_contract(db: Session, document_id: str) -> str:
    """
    Generate a 5-bullet plain English summary of the contract.
    Uses first 5 chunks as context (covers most important clauses).
    """
    client = Groq(api_key=settings.GROQ_API_KEY)

    chunks = db.query(DocumentChunk).filter(
        DocumentChunk.document_id == document_id
    ).order_by(DocumentChunk.chunk_index).limit(8).all()

    if not chunks:
        return "Unable to generate summary — no content found."

    context = "\n\n".join([c.text for c in chunks])

    prompt = f"""You are a legal contract summarizer. Read this contract and provide a concise summary.

CONTRACT TEXT:
{context}

Provide exactly 5 bullet points covering:
1. What is this contract about (type + parties)
2. Key financial terms (amounts, rates, payments)
3. Duration and timeline
4. Important obligations on each party
5. Any termination or exit conditions

Format: Start each point with "• " and keep each point to 1-2 sentences max.
Use plain simple English — imagine explaining to someone with no legal background."""

    response = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=500,
    )

    return response.choices[0].message.content.strip()