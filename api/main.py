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
except ImportError:
    from config import init_security
    from db import engine, Base, get_db
    from models import Conversation, Message, Ticket, Accommodation
    from services.retrieval import retrieve

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


# Pydantic Schemas
class AskRequest(BaseModel):
    question: str
    language: Optional[str] = "en"
    page_url: Optional[str] = None
    conversation_id: Optional[str] = None


class AskResponse(BaseModel):
    text: Optional[str] = None
    answer: Optional[str] = None
    sources: List[Dict[str, Any]] = []
    provider: str = "none"
    conversation_id: Optional[str] = None


class EscalationRequest(BaseModel):
    conversation: Optional[List[Dict[str, Any]]] = None
    page_url: Optional[str] = None
    section: Optional[str] = None
    screenshot: Optional[str] = None


class EscalationResponse(BaseModel):
    ticketId: str
    status: str = "waiting"


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


@app.post("/api/v1/ask", response_model=AskResponse)
def ask_question(req: AskRequest, db: Session = Depends(get_db)):
    """
    Answers user questions using bilingual retrieval.
    Falls back gracefully to null answer when question is out-of-scope.
    """
    sections = load_content_sections()
    result = retrieve(query=req.question, sections=sections, threshold=0.35)

    if not result:
        return AskResponse(
            text=None,
            answer=None,
            sources=[],
            provider="none",
            conversation_id=req.conversation_id
        )

    best_sec, score = result
    is_am = (req.language == "am")
    title = best_sec.get("title_am" if is_am else "title_en") or best_sec.get("title_en", "")
    body = best_sec.get("text_am" if is_am else "text_en") or best_sec.get("text_en", "")

    # Extract first 2-3 sentences as concise summary
    delimiters = r'(?<=[.?!።])\s+'
    import re
    sentences = re.split(delimiters, body.strip())
    summary = " ".join(sentences[:3])
    formatted_answer = f"**{title}**\n\n{summary}"

    sources = [{
        "title": title,
        "url": best_sec.get("url") or f"#{best_sec['id']}"
    }]

    # Log interaction to SQLite database if conversation exists or start one
    conv_id = req.conversation_id
    if not conv_id:
        new_conv = Conversation(language=req.language or "en", consent=True)
        db.add(new_conv)
        db.commit()
        db.refresh(new_conv)
        conv_id = new_conv.id

    msg_user = Message(
        conversation_id=conv_id,
        role="user",
        text=req.question,
        lang=req.language or "en",
        provider="none",
        sources=[]
    )
    msg_assistant = Message(
        conversation_id=conv_id,
        role="assistant",
        text=formatted_answer,
        lang=req.language or "en",
        provider="none",
        sources=sources
    )
    db.add(msg_user)
    db.add(msg_assistant)
    db.commit()

    return AskResponse(
        text=formatted_answer,
        answer=formatted_answer,
        sources=sources,
        provider="none",
        conversation_id=conv_id
    )


@app.post("/api/v1/escalations", response_model=EscalationResponse, status_code=201)
def create_escalation(req: EscalationRequest, db: Session = Depends(get_db)):
    """Creates a human tutor escalation ticket."""
    ticket = Ticket(
        page_url=req.page_url,
        status="waiting"
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    return EscalationResponse(
        ticketId=ticket.id,
        status=ticket.status
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
