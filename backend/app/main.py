from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .settings import settings
from .db import Base, engine
from . import models  # noqa: F401
from .api import router as api_router


def _ensure_legacy_columns() -> None:
    """Apply minimal runtime schema patch for legacy SQLite databases."""
    with engine.begin() as conn:
        columns = {row[1] for row in conn.execute(text("PRAGMA table_info(experiments)")).fetchall()}
        if "requester" not in columns:
            conn.execute(text("ALTER TABLE experiments ADD COLUMN requester VARCHAR(120)"))
        if "received_date" not in columns:
            conn.execute(text("ALTER TABLE experiments ADD COLUMN received_date DATE"))
        if "experiment_date" not in columns:
            conn.execute(text("ALTER TABLE experiments ADD COLUMN experiment_date DATE"))
        if "experiment_conditions" not in columns:
            conn.execute(text("ALTER TABLE experiments ADD COLUMN experiment_conditions TEXT"))

def create_app() -> FastAPI:
    app = FastAPI(title="ELN MVP API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Prototype table creation (replace with Alembic later)
    Base.metadata.create_all(bind=engine)
    _ensure_legacy_columns()

    app.include_router(api_router)

    @app.get("/health")
    def health():
        return {"ok": True}

    return app

app = create_app()
