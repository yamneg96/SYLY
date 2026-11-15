"""
SYLY Assistant - Escalations Router
File: api/routers/escalations.py

Handles:
- POST /api/v1/escalations: Creates a human tutor ticket from chat escalation.
- GET /api/v1/escalations: Lists waiting escalation tickets for helper/tutor view.
"""

from __future__ import annotations
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

try:
    from ..db import get_db
    from ..models import Conversation, Message, Ticket
except (ImportError, ValueError):
    try:
        from api.db import get_db
        from api.models import Conversation, Message, Ticket
    except ImportError:
        from db import get_db
        from models import Conversation, Message, Ticket

router = APIRouter(prefix="/escalations", tags=["escalations"])


# 1. Pydantic input/output schemas
class EscalationCreate(BaseModel):
    conversation: Optional[List[Dict[str, Any]]] = None
    page_url: Optional[str] = None
    section: Optional[str] = None


class EscalationResponse(BaseModel):
    ticketId: str


class TicketOut(BaseModel):
    id: str
    conversation_id: Optional[str] = None
    page_url: Optional[str] = None
    section: Optional[str] = None
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# 2. POST /api/v1/escalations
@router.post("", response_model=EscalationResponse, status_code=status.HTTP_201_CREATED)
def create_escalation(
    payload: EscalationCreate,
    db: Session = Depends(get_db)
):
    """
    Creates a new escalation ticket when a learner requests human assistance.
    Persists transcript if provided and sets ticket status to 'waiting'.
    """
    # 3. Generate a new UUID4 for the ticket_id
    ticket_id = str(uuid.uuid4())

    conv_id: Optional[str] = None
    if payload.conversation:
        # Determine language from conversation if possible
        detected_lang = "en"
        for m in payload.conversation:
            if m.get("lang"):
                detected_lang = m["lang"]
                break

        conv = Conversation(language=detected_lang, consent=True)
        db.add(conv)
        db.flush()
        conv_id = conv.id

        for m in payload.conversation:
            msg = Message(
                conversation_id=conv_id,
                role=m.get("role") or ("user" if m.get("sender") == "user" else "assistant"),
                text=m.get("text", ""),
                lang=m.get("lang") or detected_lang,
                sources=m.get("sources", [])
            )
            db.add(msg)

    # Resolve full page url with anchor section if needed
    full_url = payload.page_url
    if payload.section and full_url and "#" not in full_url:
        full_url = f"{full_url}#{payload.section.lstrip('#')}"

    # 4. Insert a new record into the tickets SQLAlchemy model
    ticket = Ticket(
        id=ticket_id,
        conversation_id=conv_id,
        page_url=full_url,
        section=payload.section,
        status="waiting"
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    # 6. Important: Leave a comment like # TODO: Fire webhook background task here right before the return statement.
    # TODO: Fire webhook background task here

    # 5. Return an HTTP 201 Created response with the JSON payload: { "ticketId": "the-uuid-string" }
    return EscalationResponse(ticketId=ticket_id)


# Task 2: GET /api/v1/escalations
@router.get("", response_model=List[TicketOut])
def list_escalations(
    status: Optional[str] = Query(default="waiting", description="Filter tickets by status"),
    db: Session = Depends(get_db)
):
    """
    Returns the list of escalation tickets filtered by status,
    ordered by created_at ascending (oldest first).
    Used by demo/helper.html for tutor triage.
    """
    query = select(Ticket)
    if status:
        query = query.where(Ticket.status == status)
    query = query.order_by(Ticket.created_at.asc())

    tickets = db.scalars(query).all()
    return tickets
