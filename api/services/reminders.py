"""A request nobody has picked up after a while: tell the tutors again, and tell the learner the truth.

Once per request, about 10 minutes after it was opened, if it is still waiting. The learner gets a system message
("no_tutor_yet") that their panel turns into words in their language; the tutors get the alert again (marked as a reminder).
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from db import SessionLocal
from models import Message, Ticket
from services import notify, sites

log = logging.getLogger("syly.reminders")
REMIND_AFTER = timedelta(minutes=10)
EVERY_SECONDS = 60


def _aware(d: datetime) -> datetime:
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def due(db: Session, now: datetime | None = None) -> list[Ticket]:
    now = now or datetime.now(timezone.utc)
    rows = db.scalars(select(Ticket).where(Ticket.status == "waiting", Ticket.reminded_at.is_(None))).all()
    return [t for t in rows if _aware(t.created_at) <= now - REMIND_AFTER]


async def run_once(db: Session, now: datetime | None = None) -> int:
    """Remind for every request that is due. Returns how many were handled."""
    now = now or datetime.now(timezone.utc)
    tickets = due(db, now)
    for tk in tickets:
        tk.reminded_at = now
        db.add(Message(ticket_id=tk.id, author="system", text="no_tutor_yet"))
        db.commit()
        first = db.scalar(select(Message).where(Message.ticket_id == tk.id, Message.author == "learner").order_by(Message.id))
        site_name, emails = sites.tutor_emails_for(db, tk.site_key) if tk.site_key else (None, None)
        try:
            await notify.tutors(tk.id, tk.language, tk.page_url, "STILL WAITING: " + (first.text if first else ""), bool(tk.screenshot), site_name, emails)
        except Exception:  # noqa: BLE001 - a broken channel must not stop the loop
            log.warning("reminder for request %s could not be sent", tk.id)
    return len(tickets)


async def loop() -> None:
    while True:
        try:
            with SessionLocal() as db:
                await run_once(db)
        except Exception:  # noqa: BLE001
            log.exception("reminder pass failed")
        await asyncio.sleep(EVERY_SECONDS)
