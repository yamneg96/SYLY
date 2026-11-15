"""
SYLY Assistant - Ask Router
File: api/routers/ask.py

Handles:
- POST /api/v1/ask: Bilingual question answering with local keyword retrieval thresholding,
  Gemini Flash LLM integration, and source citation guardrails.
"""

from __future__ import annotations
import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

try:
    from ..db import get_db
    from ..models import Conversation, Message
    from ..services.retrieval import retrieve
    from ..services.providers import cloud_gemini
    from ..services.guard import process_llm_response
except (ImportError, ValueError):
    try:
        from api.db import get_db
        from api.models import Conversation, Message
        from api.services.retrieval import retrieve
        from api.services.providers import cloud_gemini
        from api.services.guard import process_llm_response
    except ImportError:
        from db import get_db
        from models import Conversation, Message
        from services.retrieval import retrieve
        from services.providers import cloud_gemini
        from services.guard import process_llm_response

router = APIRouter(prefix="/ask", tags=["ask"])

SECTIONS_CACHE: List[Dict[str, Any]] = []


def get_content_sections() -> List[Dict[str, Any]]:
    """Loads and caches lesson sections from demo/data/content.json."""
    global SECTIONS_CACHE
    if SECTIONS_CACHE:
        return SECTIONS_CACHE

    base_dir = Path(__file__).resolve().parent.parent.parent
    content_file = base_dir / "demo" / "data" / "content.json"
    if content_file.exists():
        try:
            with open(content_file, "r", encoding="utf-8") as f:
                SECTIONS_CACHE = json.load(f)
        except Exception as e:
            print(f"[WARN] Failed to load content.json in ask router: {e}")
    return SECTIONS_CACHE


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


@router.post("", response_model=AskResponse)
async def ask_question(
    req: AskRequest,
    db: Session = Depends(get_db)
):
    """
    Answers user questions:
    1. Evaluates local keyword search against retrieval threshold (0.35).
    2. If below threshold: does not call LLM; returns null answer.
    3. If above threshold: invokes Gemini Flash provider and parses through guardrail.
    4. If cloud key is missing or model fails: falls back to local retrieval summary.
    """
    sections = get_content_sections()
    lang = req.language or "en"
    result = retrieve(query=req.question, sections=sections, threshold=0.35)

    # 1. Gate: If nothing scores above threshold, do NOT call model (FR-T4)
    if not result:
        return AskResponse(
            text=None,
            answer=None,
            sources=[],
            provider="none",
            conversation_id=req.conversation_id
        )

    best_sec, score = result
    matched_sections = [best_sec]

    answer_text: Optional[str] = None
    sources: List[Dict[str, Any]] = []
    provider_used = "none"

    # 2. If provider is cloud and GEMINI_API_KEY is present, call Gemini Flash
    has_gemini_key = bool(os.getenv("GEMINI_API_KEY"))
    provider_pref = os.getenv("PROVIDER", "cloud").lower()

    if has_gemini_key and provider_pref != "none":
        try:
            raw_output = await cloud_gemini.answer(
                question=req.question,
                sections=matched_sections,
                language=lang
            )
            guardrail_result = process_llm_response(
                raw_text=raw_output,
                original_sections=matched_sections
            )
            if guardrail_result.get("text"):
                answer_text = guardrail_result["text"]
                sources = guardrail_result.get("sources", [])
                provider_used = "cloud_gemini"
        except Exception as exc:
            print(f"[WARN] Cloud LLM execution failed: {exc}. Falling back to local summary.")

    # 3. Fallback to local keyword search summary if LLM was skipped or unavailable
    if not answer_text and provider_used == "none":
        is_am = (lang == "am")
        title = best_sec.get("title_am" if is_am else "title_en") or best_sec.get("title_en", "")
        body = best_sec.get("text_am" if is_am else "text_en") or best_sec.get("text_en", "")
        sentences = re.split(r'(?<=[.?!።])\s+', body.strip())
        summary = " ".join(sentences[:3])

        answer_text = f"**{title}**\n\n{summary}"
        sources = [{
            "title": title,
            "url": best_sec.get("url") or f"#{best_sec['id']}"
        }]
        provider_used = "none"

    # Persist interaction to database
    conv_id = req.conversation_id
    if not conv_id:
        new_conv = Conversation(language=lang, consent=True)
        db.add(new_conv)
        db.commit()
        db.refresh(new_conv)
        conv_id = new_conv.id

    msg_user = Message(
        conversation_id=conv_id,
        role="user",
        text=req.question,
        lang=lang,
        provider=provider_used,
        sources=[]
    )
    msg_assistant = Message(
        conversation_id=conv_id,
        role="assistant",
        text=answer_text or "",
        lang=lang,
        provider=provider_used,
        sources=sources
    )
    db.add(msg_user)
    db.add(msg_assistant)
    db.commit()

    return AskResponse(
        text=answer_text,
        answer=answer_text,
        sources=sources,
        provider=provider_used,
        conversation_id=conv_id
    )
