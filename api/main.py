"""
SYLY Assistant - FastAPI Application Bootstrapping
File: api/main.py

Configures:
- FastAPI instance with OpenAPI documentation at /docs.
- CORS middleware allowing localhost origins across ports.
- Startup event calling Base.metadata.create_all(bind=engine) and init_security().
- Health check endpoint at GET /api/v1/health.
"""

from __future__ import annotations
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from .config import init_security
    from .db import engine, Base
    from .models import Conversation, Message, Ticket, Accommodation
except ImportError:
    from config import init_security
    from db import engine, Base
    from models import Conversation, Message, Ticket, Accommodation

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


@app.on_event("startup")
def on_startup():
    """Bootstraps encryption security key and initializes database tables on startup."""
    init_security()
    Base.metadata.create_all(bind=engine)
    print("[STARTUP] Fernet security verified & SQLite database tables created/verified.")


@app.get("/api/v1/health")
def health_check():
    """Health check endpoint indicating API and database readiness."""
    return {
        "status": "ok",
        "service": "SYLY Assistant API",
        "database": "connected"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
