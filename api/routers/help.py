"""Talk to a person: escalations, helper page, presence, webhook (FR-H1..H5, FR-AD2)."""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from config import settings
from db import decrypt, encrypt, get_db
from models import HelperPresence, Message, Ticket, Webhook
from schemas import Created, EscalationIn, ScreenshotIn, EscalationOut, MessageIn, MessageOut, TicketOut, TicketUpdate, WebhookIn
from services import notify, webhook
from services.i18n import t

router = APIRouter(prefix="/api/v1", tags=["human help"])
ONLINE_WINDOW = timedelta(seconds=90)


def require_helper(x_helper_key: str | None = Header(default=None)) -> None:
    """Helper-only endpoints. Open when HELPER_KEY is not set (demo); set it in production."""
    if settings.helper_key and not secrets.compare_digest(x_helper_key or "", settings.helper_key):
        raise HTTPException(401, "Helper key missing or wrong. Send it in the X-Helper-Key header.")


def helper_online(db: Session) -> bool:
    since = datetime.now(timezone.utc) - ONLINE_WINDOW
    for p in db.scalars(select(HelperPresence)).all():
        seen = p.seen_at if p.seen_at.tzinfo else p.seen_at.replace(tzinfo=timezone.utc)
        if seen >= since:
            return True
    return False


def _ticket(db: Session, ticket_id: int) -> Ticket:
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(404, f"Ticket {ticket_id} not found.")
    return ticket


def _learner_or_helper(ticket: Ticket, token: str | None, helper_key: str | None) -> None:
    if token and secrets.compare_digest(token, ticket.access_token):
        return
    if settings.helper_key and helper_key and secrets.compare_digest(helper_key, settings.helper_key):
        return
    if not settings.helper_key and not token:
        return  # demo mode: helper page without a key
    raise HTTPException(404, f"Ticket {ticket.id} not found.")


@router.post("/escalations", status_code=201, response_model=EscalationOut, summary="Talk to a person: open a ticket")
async def create_escalation(body: EscalationIn, tasks: BackgroundTasks, db: Session = Depends(get_db)) -> EscalationOut:
    if body.screenshot and not body.screenshot.startswith("data:image/"):
        raise HTTPException(400, "The screenshot must be an image data URL (data:image/...).")
    ticket = Ticket(
        conversation_id=body.conversation_id,
        channel=body.channel,
        language=body.language,
        page_url=body.page_url,
        section=body.section,
        screenshot=body.screenshot,
        notify_enc=encrypt(body.notify_telegram_chat),
        access_token=secrets.token_urlsafe(24),
    )
    db.add(ticket)
    db.flush()
    for line in body.conversation:
        db.add(Message(ticket_id=ticket.id, author="learner" if line.role == "learner" else line.role, text=line.text, lang=line.lang))
    db.commit()
    tasks.add_task(webhook.fire, "ticket.opened", {"ticketId": ticket.id, "page_url": ticket.page_url, "language": ticket.language})
    username = await notify.bot_username()
    link = f"https://t.me/{username}?start=t{ticket.id}_{ticket.access_token}" if username and body.channel == "web" else None
    online = helper_online(db)
    if not online:
        # Nobody is watching the helper page: tell the tutors (Telegram group, email). In the background, so a slow relay never slows the learner.
        question = next((m.text for m in reversed(body.conversation) if m.role == "learner"), "")
        tasks.add_task(notify.tutors, ticket.id, ticket.language, ticket.page_url, question, bool(body.screenshot))
    return EscalationOut(ticketId=ticket.id, helper_online=online, token=ticket.access_token, telegram_link=link)


@router.get("/escalations", response_model=list[TicketOut], summary="Helper page: tickets by status",
            dependencies=[Depends(require_helper)])
def list_escalations(status: str = Query("waiting", pattern="^(waiting|active|closed|open|all)$"), db: Session = Depends(get_db)) -> list[TicketOut]:
    q = select(Ticket).order_by(Ticket.created_at)
    if status == "open":
        q = q.where(Ticket.status != "closed")
    elif status != "all":
        q = q.where(Ticket.status == status)
    now = datetime.now(timezone.utc)
    out = []
    for tk in db.scalars(q).all():
        created = tk.created_at if tk.created_at.tzinfo else tk.created_at.replace(tzinfo=timezone.utc)
        item = TicketOut.model_validate(tk)
        item.has_screenshot = bool(tk.screenshot)
        item.waiting_minutes = int((now - created).total_seconds() // 60)
        out.append(item)
    return out


@router.get("/escalations/{ticket_id}/screenshot", summary="Helper page: the learner's screenshot",
            dependencies=[Depends(require_helper)])
def get_screenshot(ticket_id: int, db: Session = Depends(get_db)) -> dict:
    return {"screenshot": _ticket(db, ticket_id).screenshot}


@router.patch("/escalations/{ticket_id}", response_model=TicketOut, summary="Helper: accept or close a ticket",
              dependencies=[Depends(require_helper)])
def update_escalation(ticket_id: int, body: TicketUpdate, db: Session = Depends(get_db)) -> TicketOut:
    ticket = _ticket(db, ticket_id)
    ticket.status = body.status
    if body.helper_name:
        ticket.helper_name = body.helper_name
    db.commit()
    return TicketOut.model_validate(ticket)


@router.get("/escalations/{ticket_id}/messages", response_model=list[MessageOut], summary="Messages after an id (polling)")
def list_messages(
    ticket_id: int,
    after: int = 0,
    token: str | None = None,
    x_helper_key: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> list[Message]:
    ticket = _ticket(db, ticket_id)
    _learner_or_helper(ticket, token, x_helper_key)
    q = select(Message).where(Message.ticket_id == ticket_id, Message.id > after).order_by(Message.id)
    return list(db.scalars(q).all())


@router.post("/escalations/{ticket_id}/messages", status_code=201, response_model=MessageOut, summary="Helper or learner message")
async def post_message(
    ticket_id: int,
    body: MessageIn,
    token: str | None = None,
    x_helper_key: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Message:
    ticket = _ticket(db, ticket_id)
    if body.author in ("helper", "system"):
        require_helper(x_helper_key)
    else:
        _learner_or_helper(ticket, token, None)
    msg = Message(ticket_id=ticket_id, author=body.author, name=body.name, text=body.text, lang=body.lang)
    db.add(msg)
    if body.author == "helper":
        ticket.status = "active"
        ticket.helper_name = body.name or ticket.helper_name
    db.commit()
    chat = decrypt(ticket.notify_enc)
    if body.author == "helper" and chat:
        await notify.telegram(chat, t("helperReply", ticket.language, id=ticket.id, text=body.text))
    return msg


@router.post("/helper/presence", status_code=204, response_class=Response, summary="Helper page heartbeat: a tutor is online",
             dependencies=[Depends(require_helper)])
def presence(name: str = Query("Tutor", max_length=80), db: Session = Depends(get_db)) -> None:
    row = db.scalar(select(HelperPresence).where(HelperPresence.name == name))
    if row:
        row.seen_at = datetime.now(timezone.utc)
    else:
        db.add(HelperPresence(name=name))
    db.commit()


@router.post("/webhooks", status_code=201, response_model=Created, summary="Register a URL for ticket.opened")
def register_webhook(body: WebhookIn, db: Session = Depends(get_db)) -> Created:
    hook = Webhook(url=str(body.url), events=list(body.events))
    db.add(hook)
    db.commit()
    return Created(id=hook.id, message=f"Webhook registered for {', '.join(body.events)}")


@router.post("/escalations/{ticket_id}/telegram", status_code=204, response_class=Response, summary="Bot: send tutor replies for this ticket to a Telegram chat")
def link_telegram(ticket_id: int, chat_id: str = Query(max_length=40), token: str = Query(max_length=64), db: Session = Depends(get_db)) -> None:
    ticket = _ticket(db, ticket_id)
    if not secrets.compare_digest(token, ticket.access_token):
        raise HTTPException(404, f"Ticket {ticket_id} not found.")
    ticket.notify_enc = encrypt(chat_id)
    db.commit()


# Screen share: the learner's browser posts a JPEG every 2 s while sharing. Frames stay in
# memory only (never stored) and are dropped when sharing stops or the server restarts.
_frames: dict[int, tuple[bytes, datetime]] = {}
JPEG_MAGIC = bytes([0xFF, 0xD8])


@router.post("/escalations/{ticket_id}/screen", status_code=204, response_class=Response, summary="Learner: latest screen-share frame (JPEG, memory only)")
async def post_frame(ticket_id: int, request: Request, token: str = Query(max_length=64), db: Session = Depends(get_db)) -> None:
    ticket = _ticket(db, ticket_id)
    if not secrets.compare_digest(token, ticket.access_token):
        raise HTTPException(404, f"Ticket {ticket_id} not found.")
    data = await request.body()
    if not data or len(data) > 1_500_000 or not data.startswith(JPEG_MAGIC):
        raise HTTPException(400, "Send one JPEG image under 1.5 MB.")
    _frames[ticket_id] = (data, datetime.now(timezone.utc))


@router.get("/escalations/{ticket_id}/screen", summary="Helper: latest screen-share frame", dependencies=[Depends(require_helper)],
            responses={200: {"content": {"image/jpeg": {}}}, 404: {"description": "Not sharing"}})
def get_frame(ticket_id: int) -> Response:
    frame = _frames.get(ticket_id)
    if not frame or datetime.now(timezone.utc) - frame[1] > timedelta(seconds=10):
        _frames.pop(ticket_id, None)
        raise HTTPException(404, "The learner is not sharing their screen.")
    return Response(frame[0], media_type="image/jpeg", headers={"Cache-Control": "no-store"})


@router.post("/escalations/{ticket_id}/screenshot", status_code=204, response_class=Response, summary="Learner: attach a screenshot (Android fallback)")
def post_screenshot(ticket_id: int, body: ScreenshotIn, token: str = Query(max_length=64), db: Session = Depends(get_db)) -> None:
    ticket = _ticket(db, ticket_id)
    if not secrets.compare_digest(token, ticket.access_token):
        raise HTTPException(404, f"Ticket {ticket_id} not found.")
    if not body.screenshot.startswith("data:image/"):
        raise HTTPException(400, "The screenshot must be an image data URL (data:image/...).")
    ticket.screenshot = body.screenshot
    db.add(Message(ticket_id=ticket_id, author="system", text="screenshot_attached"))
    db.commit()
