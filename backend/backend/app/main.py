from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .settings import settings
from .db import Base, engine
from . import models  # noqa: F401
from .api import router as api_router

def create_app() -> FastAPI:
    app = FastAPI(title="ELN MVP API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Prototype table creation (replace with Alembic later)
    Base.metadata.create_all(bind=engine)

    app.include_router(api_router)

    @app.get("/health")
    def health():
        return {"ok": True}

    return app

app = create_app()
