"""POST /ask, /content, GET /config (FR-T1..T4, FR-AD1)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from config import settings
from db import get_db
from models import Question, Section
from routers.help import helper_online
from schemas import AskIn, AskOut, ConfigOut, ContentIn, ContentOut, Created
from services import content, notify
from services.answer import answer

router = APIRouter(prefix="/api/v1", tags=["assistant"])


@router.post("/ask", response_model=AskOut, summary="Answer a question from the course, with sources")
async def ask(body: AskIn, db: Session = Depends(get_db)) -> AskOut:
    cid = body.conversation_id or uuid.uuid4().hex
    out = await answer(content.index(db), body.question.strip(), body.language, body.allow_ai, body.simple)
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


@router.post("/content", status_code=201, response_model=Created, summary="Host sends its lessons to be indexed")
def post_content(body: ContentIn, db: Session = Depends(get_db)) -> Created:
    n = content.replace_lessons(db, [s.model_dump() for s in body.sections])
    db.commit()
    content.rebuild(db)
    return Created(id=n, message=f"{n} sections indexed")


@router.get("/content", response_model=ContentOut, summary="The indexed sections (lessons and jobs)")
def get_content(db: Session = Depends(get_db)) -> ContentOut:
    return ContentOut(sections=[row.data for row in db.scalars(select(Section)).all()])


@router.get("/config", response_model=ConfigOut, summary="What the widget needs to know at start")
async def get_config(db: Session = Depends(get_db)) -> ConfigOut:
    return ConfigOut(
        ai=settings.ai_enabled,
        provider=settings.provider if settings.ai_enabled else "none",
        helper_online=helper_online(db),
        telegram_bot=await notify.bot_username(),
    )
