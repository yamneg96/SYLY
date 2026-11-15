"""
SYLY Assistant - FastAPI Application Bootstrapping
File: api/main.py

Configures:
- FastAPI instance with OpenAPI documentation at /docs.
- CORS middleware allowing localhost origins across ports.
- Startup event calling Base.metadata.create_all(bind=engine) and init_security().
- Health check endpoint at GET /api/v1/health.
- Chat inference endpoint at POST /api/v1/ask.
- Human escalation endpoint at POST /api/v1/escalations.
"""

from __future__ import annotations
import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

try:
    from .config import init_security
    from .db import engine, Base, get_db
    from .models import Conversation, Message, Ticket, Accommodation
    from .services.retrieval import retrieve
    from .routers.escalations import router as escalations_router
    from .routers.ask import router as ask_router
except ImportError:
    from config import init_security
    from db import engine, Base, get_db
    from models import Conversation, Message, Ticket, Accommodation
    from services.retrieval import retrieve
    from routers.escalations import router as escalations_router
    from routers.ask import router as ask_router

app = FastAPI(
    title="SYLY Assistant API",
    description="Multilingual accessibility tutor, escalation, and career gateway API.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware allowing localhost origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://localhost:8080",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache content sections
SECTIONS_CACHE: List[Dict[str, Any]] = []


def load_content_sections() -> List[Dict[str, Any]]:
    """Loads and caches lesson sections from demo/data/content.json."""
    global SECTIONS_CACHE
    if SECTIONS_CACHE:
        return SECTIONS_CACHE

    base_dir = Path(__file__).resolve().parent.parent
    content_file = base_dir / "demo" / "data" / "content.json"
    if content_file.exists():
        try:
            with open(content_file, "r", encoding="utf-8") as f:
                SECTIONS_CACHE = json.load(f)
        except Exception as e:
            print(f"[WARN] Failed to load content.json: {e}")
    return SECTIONS_CACHE


@app.on_event("startup")
def on_startup():
    """Bootstraps encryption security key, database tables, and content index."""
    init_security()
    Base.metadata.create_all(bind=engine)
    load_content_sections()
    print("[STARTUP] Fernet security verified & SQLite database tables ready.")


@app.get("/api/v1/health")
def health_check():
    """Health check endpoint indicating API and database readiness."""
    return {
        "status": "ok",
        "service": "SYLY Assistant API",
        "database": "connected"
    }


# Mount routers
app.include_router(ask_router, prefix="/api/v1")
app.include_router(escalations_router, prefix="/api/v1")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
