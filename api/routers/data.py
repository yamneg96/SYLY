"""Learner data export and delete (NFR-S4) and the teacher view (FR-AD3)."""

from __future__ import annotations

from collections import Counter

from fastapi import APIRouter, Depends, Query
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from db import get_db
from models import Message, Question, Ticket

router = APIRouter(prefix="/api/v1", tags=["data and teacher"])


@router.get("/data/{conversation_id}", summary="Everything held for this conversation id")
def export(conversation_id: str, db: Session = Depends(get_db)) -> dict:
    questions = db.scalars(select(Question).where(Question.conversation_id == conversation_id)).all()
    tickets = db.scalars(select(Ticket).where(Ticket.conversation_id == conversation_id)).all()
    return {
        "conversation_id": conversation_id,
        "questions": [{"text": q.text, "language": q.language, "section": q.section_id, "at": q.created_at.isoformat()} for q in questions],
        "tickets": [
            {
                "id": tk.id, "status": tk.status, "page_url": tk.page_url,
                "messages": [
                    {"author": m.author, "text": m.text, "at": m.created_at.isoformat()}
                    for m in db.scalars(select(Message).where(Message.ticket_id == tk.id)).all()
                ],
            }
            for tk in tickets
        ],
    }


@router.delete("/data/{conversation_id}", summary="Delete everything held for this conversation id")
def erase(conversation_id: str, db: Session = Depends(get_db)) -> dict:
    ids = [tk.id for tk in db.scalars(select(Ticket).where(Ticket.conversation_id == conversation_id)).all()]
    if ids:
        db.execute(delete(Message).where(Message.ticket_id.in_(ids)))
        db.execute(delete(Ticket).where(Ticket.id.in_(ids)))
    n = db.execute(delete(Question).where(Question.conversation_id == conversation_id)).rowcount
    db.commit()
    return {"deleted_questions": n, "deleted_tickets": len(ids)}


@router.get("/stats/questions", summary="Teacher view: most asked questions, counts only")
def top_questions(min_count: int = Query(5, ge=5), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(Question)).all()
    counts = Counter((" ".join(q.text.lower().split()).strip("?!. "), q.section_id) for q in rows)
    return [
        {"question": text, "times_asked": n, "section": section}
        for (text, section), n in counts.most_common(50)
        if n >= min_count
    ]
