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
from services import notify, sites, webhook
from services import tutors as tutor_svc
from services import session
from services.i18n import t

router = APIRouter(prefix="/api/v1", tags=["human help"])
ONLINE_WINDOW = tutor_svc.ONLINE_WINDOW
principal = tutor_svc.principal


def require_helper(who: tutor_svc.Principal = Depends(principal)) -> None:
    """Team-level helper endpoints (adding jobs, interview-support requests, the text outbox): the team's helper key, or a signed-in
    tutor from the SYLY team list. Open when HELPER_KEY is not set and nobody is signed in (the local demo)."""
    if who.admin or (who.email and tutor_svc.norm(who.email) in tutor_svc.team_emails()):
        return
    raise HTTPException(403, "This is only for the SYLY team.")


def helper_online(db: Session, site_key: str | None = None) -> bool:
    """Is a tutor really there for a request from this site? (an available, signed-in tutor on that site's list, or the team's helper page)"""
    return tutor_svc.helper_online(db, site_key)


def _ticket(db: Session, ticket_id: int) -> Ticket:
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(404, f"Ticket {ticket_id} not found.")
    return ticket


def _learner_or_helper(ticket: Ticket, token: str | None, helper_key: str | None, request: Request | None = None, db: Session | None = None) -> None:
    """The learner (their ticket key), the team's helper key, or a signed-in tutor of this ticket's site."""
    if token and secrets.compare_digest(token, ticket.access_token):
        return
    if settings.helper_key and helper_key and secrets.compare_digest(helper_key, settings.helper_key):
        return
    if request is not None and db is not None and session.read_tutor(request.cookies.get(session.TUTOR_COOKIE)):
        who = tutor_svc.principal(request, helper_key)
        if tutor_svc.can_access(db, who, ticket):
            return
    if not settings.helper_key and not token:
        return  # demo mode: helper page without a key
    raise HTTPException(404, f"Ticket {ticket.id} not found.")


def _helper_ticket(db: Session, ticket_id: int, who: tutor_svc.Principal) -> Ticket:
    """A ticket this helper may see; another site's ticket looks exactly like a missing one."""
    ticket = _ticket(db, ticket_id)
    if not tutor_svc.can_access(db, who, ticket):
        raise HTTPException(404, f"Ticket {ticket_id} not found.")
    return ticket


def _mark_accepted(ticket: Ticket, who: tutor_svc.Principal | None, status: str) -> None:
    """Remember who took a request and when (the first time), so we can see that tutors really answer."""
    if status == "active" and ticket.accepted_at is None:
        ticket.accepted_at = datetime.now(timezone.utc)
        ticket.helper_email = who.email if who and who.email else ticket.helper_email


@router.post("/escalations", status_code=201, response_model=EscalationOut, summary="Talk to a person: open a ticket")
async def create_escalation(body: EscalationIn, tasks: BackgroundTasks, db: Session = Depends(get_db),
                            x_site_key: str | None = Header(default=None)) -> EscalationOut:
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
        site_key=x_site_key if x_site_key and sites.tutor_emails_for(db, x_site_key)[0] is not None else None,
    )
    db.add(ticket)
    db.flush()
    for line in body.conversation:
        db.add(Message(ticket_id=ticket.id, author="learner" if line.role == "learner" else line.role, text=line.text, lang=line.lang))
    db.commit()
    tasks.add_task(webhook.fire, "ticket.opened", {"ticketId": ticket.id, "page_url": ticket.page_url, "language": ticket.language})
    username = await notify.bot_username()
    link = f"https://t.me/{username}?start=t{ticket.id}_{ticket.access_token}" if username and body.channel == "web" else None
    online = helper_online(db, ticket.site_key)
    if not online:
        # Nobody is watching the helper page: tell the tutors (Telegram group, email). In the background, so a slow relay never slows the learner.
        question = next((m.text for m in reversed(body.conversation) if m.role == "learner"), "")
        # A site the developer registered may name its own tutor addresses; with none, the SYLY team's own are used.
        site_name, site_emails = sites.tutor_emails_for(db, x_site_key)
        tasks.add_task(notify.tutors, ticket.id, ticket.language, ticket.page_url, question, bool(body.screenshot), site_name, site_emails)
    return EscalationOut(ticketId=ticket.id, helper_online=online, token=ticket.access_token, telegram_link=link)


@router.get("/escalations", response_model=list[TicketOut], summary="Helper page: tickets by status (a tutor sees their sites' requests)")
def list_escalations(status: str = Query("waiting", pattern="^(waiting|active|closed|open|all)$"), db: Session = Depends(get_db),
                     who: tutor_svc.Principal = Depends(principal)) -> list[TicketOut]:
    q = select(Ticket).order_by(Ticket.created_at)
    if status == "open":
        q = q.where(Ticket.status != "closed")
    elif status != "all":
        q = q.where(Ticket.status == status)
    now = datetime.now(timezone.utc)
    out = []
    for tk in db.scalars(q).all():
        if not tutor_svc.can_access(db, who, tk):
            continue
        created = tk.created_at if tk.created_at.tzinfo else tk.created_at.replace(tzinfo=timezone.utc)
        item = TicketOut.model_validate(tk)
        item.has_screenshot = bool(tk.screenshot)
        item.waiting_minutes = int((now - created).total_seconds() // 60)
        out.append(item)
    return out


@router.get("/escalations/{ticket_id}/screenshot", summary="Helper page: the learner's screenshot")
def get_screenshot(ticket_id: int, db: Session = Depends(get_db), who: tutor_svc.Principal = Depends(principal)) -> dict:
    return {"screenshot": _helper_ticket(db, ticket_id, who).screenshot}


@router.patch("/escalations/{ticket_id}", response_model=TicketOut, summary="Helper: accept or close a ticket")
def update_escalation(ticket_id: int, body: TicketUpdate, db: Session = Depends(get_db), who: tutor_svc.Principal = Depends(principal)) -> TicketOut:
    ticket = _helper_ticket(db, ticket_id, who)
    ticket.status = body.status
    if body.helper_name:
        ticket.helper_name = body.helper_name
    _mark_accepted(ticket, who, body.status)
    db.commit()
    return TicketOut.model_validate(ticket)


@router.get("/escalations/{ticket_id}/messages", response_model=list[MessageOut], summary="Messages after an id (polling)")
def list_messages(
    ticket_id: int,
    request: Request,
    after: int = 0,
    token: str | None = None,
    x_helper_key: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> list[Message]:
    ticket = _ticket(db, ticket_id)
    _learner_or_helper(ticket, token, x_helper_key, request, db)
    q = select(Message).where(Message.ticket_id == ticket_id, Message.id > after).order_by(Message.id)
    return list(db.scalars(q).all())


@router.post("/escalations/{ticket_id}/messages", status_code=201, response_model=MessageOut, summary="Helper or learner message")
async def post_message(
    ticket_id: int,
    body: MessageIn,
    request: Request,
    token: str | None = None,
    x_helper_key: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Message:
    ticket = _ticket(db, ticket_id)
    who: tutor_svc.Principal | None = None
    if body.author in ("helper", "system"):
        who = principal(request, x_helper_key)
        if not tutor_svc.can_access(db, who, ticket):
            raise HTTPException(404, f"Ticket {ticket_id} not found.")
    else:
        _learner_or_helper(ticket, token, None, request, db)
    msg = Message(ticket_id=ticket_id, author=body.author, name=body.name, text=body.text, lang=body.lang)
    db.add(msg)
    if body.author == "helper":
        ticket.status = "active"
        ticket.helper_name = body.name or ticket.helper_name
        _mark_accepted(ticket, who, "active")
    db.commit()
    chat = decrypt(ticket.notify_enc)
    if body.author == "helper" and chat:
        await notify.telegram(chat, t("helperReply", ticket.language, id=ticket.id, text=body.text))
    return msg


@router.post("/helper/presence", status_code=204, response_class=Response, summary="Team helper page heartbeat (key-based; tutors use /tutor/presence)",
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


@router.get("/escalations/{ticket_id}/screen", summary="Helper: latest screen-share frame",
            responses={200: {"content": {"image/jpeg": {}}}, 404: {"description": "Not sharing"}})
def get_frame(ticket_id: int, db: Session = Depends(get_db), who: tutor_svc.Principal = Depends(principal)) -> Response:
    _helper_ticket(db, ticket_id, who)
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
