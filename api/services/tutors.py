"""Who the tutors are, and which of them are really there.

Who: the e-mail addresses a site's developer entered in the dashboard (Site.settings["tutor_emails"]) and, for sites that gave none and
for the demo pages, the SYLY team's TUTOR_EMAILS. Those lists ARE the tutor accounts: a tutor proves an address is theirs with a 6-digit
code sent to it, and is removed by deleting the address from the list.

Really there: a tutor is available when they pressed Available and their page has sent a heartbeat in the last 90 seconds. The page only
sends heartbeats while the tab is visible and the person did something in the last 2 minutes, so a forgotten tab stops counting by itself.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from config import session_secret, settings
from models import HelperPresence, Site, Ticket, TutorCode, TutorPresence
from services import session

ONLINE_WINDOW = timedelta(seconds=90)
CODE_TTL = timedelta(minutes=10)
MAX_ATTEMPTS = 5
CODES_PER_10_MIN = 3
CODES_PER_HOUR_ALL = 60  # all addresses together: caps what the e-mail relay can be made to send
_sent: list[float] = []


def norm(email: str | None) -> str:
    return (email or "").strip().lower()


def team_emails() -> set[str]:
    return {norm(e) for e in settings.tutor_emails if norm(e)}


def site_emails(site: Site | None) -> set[str]:
    return {norm(e) for e in ((site.settings or {}).get("tutor_emails", []) if site else []) if isinstance(e, str)}


def allowed_emails(db: Session, site_key: str | None) -> set[str]:
    """Who may help with requests from this site: its own tutors, or the SYLY team when it named none (and for requests with no site)."""
    if site_key:
        site = db.scalar(select(Site).where(Site.public_key == site_key))
        own = site_emails(site)
        if own:
            return own
    return team_emails()


def is_listed(db: Session, email: str) -> bool:
    e = norm(email)
    if not e:
        return False
    if e in team_emails():
        return True
    return any(e in site_emails(site) for site in db.scalars(select(Site)).all())


def where_listed(db: Session, email: str) -> dict:
    """The sites (names) whose tutor list has this address, and whether the SYLY team list has it."""
    e = norm(email)
    return {"sites": [s.name for s in db.scalars(select(Site)).all() if e in site_emails(s)], "team": e in team_emails()}


def colleagues(db: Session, email: str) -> set[str]:
    """Everyone who shares a tutor list with this address (themselves included)."""
    e = norm(email)
    out: set[str] = set()
    if e in team_emails():
        out |= team_emails()
    for site in db.scalars(select(Site)).all():
        lst = site_emails(site)
        if e in lst:
            out |= lst
    return out | {e}


# ---------------------------------------------------------------- sign-in codes
def _hash(email: str, code: str) -> str:
    return hashlib.sha256(session_secret(settings) + b"|" + norm(email).encode() + b"|" + code.encode()).hexdigest()


def issue_code(db: Session, email: str, now: datetime | None = None) -> str | None:
    """A new 6-digit code, or None when too many were asked for (3 per address per 10 minutes, 60 an hour in all)."""
    now = now or datetime.now(timezone.utc)
    t = time.monotonic()
    recent = [x for x in _sent if t - x < 3600]
    _sent[:] = recent
    if len(recent) >= CODES_PER_HOUR_ALL:
        return None
    since = now - timedelta(minutes=10)
    asked = db.scalars(select(TutorCode).where(TutorCode.email == norm(email), TutorCode.created_at >= since)).all()
    if len(asked) >= CODES_PER_10_MIN:
        return None
    code = f"{secrets.randbelow(10**6):06d}"
    db.add(TutorCode(email=norm(email), code_hash=_hash(email, code), expires_at=now + CODE_TTL, created_at=now))
    db.commit()
    _sent.append(t)
    return code


def check_code(db: Session, email: str, code: str, now: datetime | None = None) -> bool:
    """True once for the right, unexpired code (at most 5 wrong tries per code)."""
    now = now or datetime.now(timezone.utc)
    row = db.scalar(select(TutorCode).where(TutorCode.email == norm(email), TutorCode.used.is_(False)).order_by(TutorCode.id.desc()))
    if not row:
        return False
    expires = row.expires_at if row.expires_at.tzinfo else row.expires_at.replace(tzinfo=timezone.utc)
    if expires <= now or row.attempts >= MAX_ATTEMPTS:
        return False
    row.attempts += 1
    ok = hmac.compare_digest(row.code_hash, _hash(email, str(code).strip()))
    if ok:
        row.used = True
    db.commit()
    return ok


# ---------------------------------------------------------------- presence
def _fresh(seen: datetime, now: datetime) -> bool:
    seen = seen if seen.tzinfo else seen.replace(tzinfo=timezone.utc)
    return seen >= now - ONLINE_WINDOW


def set_presence(db: Session, email: str, status: str, name: str | None = None, now: datetime | None = None) -> TutorPresence:
    now = now or datetime.now(timezone.utc)
    row = db.scalar(select(TutorPresence).where(TutorPresence.email == norm(email)))
    if not row:
        row = TutorPresence(email=norm(email))
        db.add(row)
    row.status = status if status in ("available", "away") else "away"
    row.seen_at = now
    if name is not None and name.strip():
        row.name = name.strip()[:80]
    db.commit()
    return row


def available_tutors(db: Session, site_key: str | None = None, now: datetime | None = None) -> list[TutorPresence]:
    """Tutors who are really there for requests from this site (all of them when no site is given)."""
    now = now or datetime.now(timezone.utc)
    allowed = allowed_emails(db, site_key) if site_key is not None else None
    rows = db.scalars(select(TutorPresence).where(TutorPresence.status == "available")).all()
    return [r for r in rows if _fresh(r.seen_at, now) and (allowed is None or r.email in allowed)]


def helper_online(db: Session, site_key: str | None = None, now: datetime | None = None) -> bool:
    """Is someone there who can take a request from this site? A signed-in available tutor, or the team's key-based helper page."""
    now = now or datetime.now(timezone.utc)
    if any(_fresh(p.seen_at, now) for p in db.scalars(select(HelperPresence)).all()):
        return True
    return bool(available_tutors(db, site_key, now))


# ---------------------------------------------------------------- who is calling the helper endpoints
@dataclass
class Principal:
    email: str | None  # a signed-in tutor
    admin: bool  # the team's helper key (or the open demo mode): sees every request


def principal(request: Request, x_helper_key: str | None = Header(default=None)) -> Principal:
    """Helper-only endpoints: the team's helper key, or a signed-in tutor. With no HELPER_KEY set (the local demo) they are open."""
    if x_helper_key and settings.helper_key and secrets.compare_digest(x_helper_key, settings.helper_key):
        return Principal(None, True)
    email = session.read_tutor(request.cookies.get(session.TUTOR_COOKIE))
    if email:
        if request.method not in ("GET", "HEAD", "OPTIONS") and request.headers.get(session.CSRF_HEADER) != session.CSRF_VALUE:
            raise HTTPException(403, "This request was not sent from the SYLY helper page. Reload the page and try again.")
        return Principal(email, False)
    if not settings.helper_key:
        return Principal(None, True)
    raise HTTPException(401, "Sign in as a tutor, or send the helper key in the X-Helper-Key header.")


def can_access(db: Session, who: Principal, ticket: Ticket) -> bool:
    return who.admin or (who.email is not None and norm(who.email) in allowed_emails(db, ticket.site_key))
