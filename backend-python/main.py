from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from config.database import init_db
from config.settings import get_settings
from api.routes import router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init DB + preload embedding model."""
    print("🚀 ClauseGuard starting up...")
    init_db()

    # Preload embedding model so first request isn't slow
    from ingestion.embedder import get_embedding_model
    get_embedding_model()

    print("✅ ClauseGuard ready!")
    yield
    print("👋 ClauseGuard shutting down")


app = FastAPI(
    title="ClauseGuard API",
    description="AI-powered legal contract analyzer — upload any contract PDF and ask questions in plain English",
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

# CORS — allow React frontend (adjust in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://clause-guard-ui.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1", tags=["ClauseGuard"])


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }
