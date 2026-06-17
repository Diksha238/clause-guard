from typing import List
from models.db_models import DocumentChunk
from retrieval.llm_router import generate, DEFAULT_MODEL


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


def generate_answer(question: str, chunks: List[DocumentChunk], model_key: str = DEFAULT_MODEL) -> str:
    """
    Generate a RAG answer using the selected model (Groq Llama variants or Gemini).
    Falls back to the default model if an unavailable/locked model is requested.
    """
    if not chunks:
        return "I couldn't find any relevant clauses in the contract to answer this question."

    prompt = build_rag_prompt(question, chunks)

    return generate(
        model_key=model_key,
        system_prompt="You are ClauseGuard — a helpful, accurate legal contract analyzer. Always ground your answers in the actual contract text provided.",
        user_prompt=prompt,
        temperature=0.1,
        max_tokens=1024,
    )