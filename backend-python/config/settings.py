from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "ClauseGuard"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    # Database (pgvector)
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/clauseguard"

    # Groq LLM
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # Gemini (Google AI Studio)
    GEMINI_API_KEY: str = ""

    # Embedding model (local, free)
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    EMBEDDING_DIMENSION: int = 384

    # Chunking config
    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 50

    # RAG retrieval
    TOP_K_CHUNKS: int = 5

    # File upload
    MAX_FILE_SIZE_MB: int = 10
    UPLOAD_DIR: str = "/tmp/clauseguard_uploads"

    # Spring Boot auth service (for JWT verification)
    AUTH_SERVICE_URL: str = "http://localhost:8080"

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()