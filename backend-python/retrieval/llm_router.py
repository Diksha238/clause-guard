"""
Multi-model LLM router.

Supports multiple models across providers behind one simple interface.
Adding a new live provider later (OpenAI, Anthropic) just means adding
a new branch in generate() — the rest of the app (routes, frontend)
doesn't need to change.
"""
from groq import Groq
import google.generativeai as genai
from config.settings import get_settings

settings = get_settings()

# ── Model registry ────────────────────────────────────────────────────────────
# "available" models actually call a real API. "locked" models are shown in the
# UI for transparency about the architecture but are not wired up (no paid key).

AVAILABLE_MODELS = {
    "llama-3.3-70b": {
        "label": "Llama 3.3 70B",
        "provider": "groq",
        "model_id": "llama-3.3-70b-versatile",
        "available": True,
    },
    "llama-3.1-8b": {
        "label": "Llama 3.1 8B (Fast)",
        "provider": "groq",
        "model_id": "llama-3.1-8b-instant",
        "available": True,
    },
    "gemini-flash": {
        "label": "Gemini 2.5 Flash-Lite",
        "provider": "gemini",
        "model_id": "gemini-2.5-flash-lite",
        "available": True,
    },
    "gpt-4": {
        "label": "GPT-4",
        "provider": "openai",
        "model_id": "gpt-4",
        "available": False,
    },
    "claude": {
        "label": "Claude 3.5 Sonnet",
        "provider": "anthropic",
        "model_id": "claude-3-5-sonnet",
        "available": False,
    },
}

DEFAULT_MODEL = "llama-3.3-70b"

_groq_client: Groq | None = None
_gemini_configured = False


def _get_groq_client() -> Groq:
    global _groq_client
    if _groq_client is None:
        _groq_client = Groq(api_key=settings.GROQ_API_KEY)
    return _groq_client


def _ensure_gemini_configured():
    global _gemini_configured
    if not _gemini_configured:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        _gemini_configured = True


def list_models() -> list[dict]:
    """Returns model metadata for the frontend model picker."""
    return [
        {"id": key, "label": cfg["label"], "available": cfg["available"]}
        for key, cfg in AVAILABLE_MODELS.items()
    ]


def generate(model_key: str, system_prompt: str, user_prompt: str, temperature: float = 0.1, max_tokens: int = 1024) -> str:
    """
    Generate a completion using the selected model.
    Falls back to DEFAULT_MODEL if the requested model is unknown or locked.
    """
    config = AVAILABLE_MODELS.get(model_key)
    if not config or not config["available"]:
        config = AVAILABLE_MODELS[DEFAULT_MODEL]

    if config["provider"] == "groq":
        client = _get_groq_client()
        response = client.chat.completions.create(
            model=config["model_id"],
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content.strip()

    elif config["provider"] == "gemini":
        _ensure_gemini_configured()
        model = genai.GenerativeModel(
            model_name=config["model_id"],
            system_instruction=system_prompt,
        )
        response = model.generate_content(
            user_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=temperature,
                max_output_tokens=max_tokens,
            ),
        )
        return response.text.strip()

    raise ValueError(f"Provider '{config['provider']}' is not wired up yet")