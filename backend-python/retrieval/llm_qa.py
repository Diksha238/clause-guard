from groq import Groq
from typing import List
from models.db_models import DocumentChunk
from config.settings import get_settings

settings = get_settings()

_client: Groq | None = None


def get_groq_client() -> Groq:
    global _client
    if _client is None:
        _client = Groq(api_key=settings.GROQ_API_KEY)
    return _client


def build_rag_prompt(question: str, chunks: List[DocumentChunk]) -> str:
    """
    Build the prompt with retrieved clause context.
    Structured so LLM knows exactly what to do.
    """
    context_parts = []
    for i, chunk in enumerate(chunks, 1):
        page_info = f"Page {chunk.page_number}" if chunk.page_number else "Unknown page"
        context_parts.append(f"[Clause {i} — {page_info}]\n{chunk.text}")

    context = "\n\n---\n\n".join(context_parts)

    return f"""You are ClauseGuard, an expert legal contract analyzer.
You are given relevant clauses from a contract document and a user question.

RELEVANT CONTRACT CLAUSES:
{context}

USER QUESTION: {question}

INSTRUCTIONS:
- Answer based ONLY on the contract clauses provided above
- Be specific — quote or reference the exact clause when possible
- If the contract doesn't address the question, say so clearly
- Use simple, plain language (avoid legal jargon where possible)
- Keep the answer concise but complete
- If you find something risky or unusual, flag it

ANSWER:"""


def generate_answer(question: str, chunks: List[DocumentChunk]) -> str:
    """
    Call Groq (Llama 3.3 70B) with RAG context and return the answer.
    """
    if not chunks:
        return "I couldn't find any relevant clauses in the contract to answer this question."

    client = get_groq_client()
    prompt = build_rag_prompt(question, chunks)

    response = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[
            {
                "role": "system",
                "content": "You are ClauseGuard — a helpful, accurate legal contract analyzer. Always ground your answers in the actual contract text provided."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0.1,        # low temp for factual accuracy
        max_tokens=1024,
    )

    return response.choices[0].message.content.strip()
