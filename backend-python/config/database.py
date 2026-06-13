from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from pgvector.sqlalchemy import Vector
from config.settings import get_settings

settings = get_settings()

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency — yields DB session, closes after request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create tables + enable pgvector extension."""
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()
    Base.metadata.create_all(bind=engine)
    print("✅ Database initialized with pgvector extension")
