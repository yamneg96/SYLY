"""POST /ask, /content, GET /config (FR-T1..T4, FR-AD1)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from config import settings
from db import get_db
from models import Question, Section
from routers.help import helper_online
from schemas import AskIn, AskOut, ConfigOut, ContentIn, ContentOut, Created, TranslateIn, TranslateOut
from services import content, notify
from services.answer import answer, translate
from services.content import same_page
from services.retrieval import Index

router = APIRouter(prefix="/api/v1", tags=["assistant"])


@router.post("/ask", response_model=AskOut, summary="Answer a question from the course, with sources")
async def ask(body: AskIn, db: Session = Depends(get_db)) -> AskOut:
    cid = body.conversation_id or uuid.uuid4().hex
    idx = content.index(db)
    if body.sections:
        # FR-AD4: search the page's own sections plus our stored sections for this page.
        # Same threshold, prompt and guard; page sections are never stored.
        stored = [s for s in idx.sections if body.page_url and same_page(s["url"], body.page_url)]
        page = [content.page_to_section(s.model_dump()) for s in body.sections if s.url and s.text]
        idx = Index(stored + page, settings.threshold_en, settings.threshold_am)
    out = await answer(idx, body.question.strip(), body.language, body.allow_ai, body.simple)
    db.add(
        Question(
            conversation_id=cid,
            text=body.question.strip()[:500],
            language=body.language,
            section_id=out.section_id,
            provider=out.provider if out.text else "none",
            consent_ai=body.allow_ai,
        )
    )
    db.commit()
    return AskOut(
        answer=out.text,
        sources=out.sources,
        provider=out.provider,
        language=out.language,
        conversation_id=cid,
        reason=out.reason,
        audio=out.audio,
    )


@router.post("/translate", response_model=TranslateOut, summary="Translate an answer into the learner's language (needs consent)")
async def translate_text(body: TranslateIn) -> TranslateOut:
    # Only text the learner already sees is sent, and only after "Allow online answers" (NFR-S2). Nothing is stored.
    if not body.allow_ai:
        return TranslateOut(text=None, language=body.target, provider="none", reason="consent")
    if not settings.ai_enabled:
        return TranslateOut(text=None, language=body.target, provider="none", reason="unavailable")
    if body.source == body.target:
        return TranslateOut(text=body.text, language=body.target, provider="none")
    out, provider = await translate(body.text.strip(), body.target, body.source)
    if not out:
        return TranslateOut(text=None, language=body.target, provider="none", reason="failed")
    return TranslateOut(text=out, language=body.target, provider=provider)


@router.post("/content", status_code=201, response_model=Created, summary="Host sends its lessons to be indexed")
def post_content(body: ContentIn, db: Session = Depends(get_db)) -> Created:
    ids = [s.id for s in body.sections]
    dupes = sorted({i for i in ids if ids.count(i) > 1})
    if dupes:
        raise HTTPException(400, f"Each section needs its own id. Repeated: {', '.join(dupes[:5])}.")
    n = content.replace_lessons(db, [s.model_dump() for s in body.sections])
    db.commit()
    content.rebuild(db)
    return Created(id=n, message=f"{n} sections indexed")


@router.get("/content", response_model=ContentOut, summary="The indexed sections (lessons and jobs)")
def get_content(db: Session = Depends(get_db)) -> ContentOut:
    return ContentOut(sections=[row.data for row in db.scalars(select(Section)).all()])


@router.get("/config", response_model=ConfigOut, summary="What the widget needs to know at start")
async def get_config(page_url: str | None = Query(default=None, max_length=1000), db: Session = Depends(get_db),
                     x_site_key: str | None = Header(default=None)) -> ConfigOut:
    page_sections = sum(1 for s in content.index(db).sections if page_url and same_page(s["url"], page_url))
    return ConfigOut(
        page_sections=page_sections,
        ai=settings.ai_enabled,
        provider=settings.provider if settings.ai_enabled else "none",
        helper_online=helper_online(db, x_site_key),
        telegram_bot=await notify.bot_username(),
    )
