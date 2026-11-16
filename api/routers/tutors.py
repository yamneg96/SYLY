"""Tutors: sign in with a code sent to their e-mail address, say Available or Away, and see who else is there.

The tutor lists are the ones developers enter in the dashboard (and the SYLY team's TUTOR_EMAILS): see services/tutors.py.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import get_db
from models import TutorPresence
from routers.portal import csrf
from services import email_template as tpl
from services import mailer, session, tutors

router = APIRouter(prefix="/api/v1/tutor", tags=["tutors"])


class CodeRequestIn(BaseModel):
    email: str = Field(min_length=3, max_length=320)


class VerifyIn(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    code: str = Field(min_length=6, max_length=6, pattern=r"^[0-9]{6}$")


class PresenceIn(BaseModel):
    status: Literal["available", "away"]
    name: str | None = Field(default=None, max_length=80, description="The first name learners see")


def _secure(request: Request) -> bool:
    return request.headers.get("x-forwarded-proto", request.url.scheme) == "https"


def current_tutor(request: Request) -> str:
    email = session.read_tutor(request.cookies.get(session.TUTOR_COOKIE))
    if not email:
        raise HTTPException(401, "Please sign in as a tutor first.")
    return email


def _me(db: Session, email: str) -> dict:
    row = db.scalar(select(TutorPresence).where(TutorPresence.email == tutors.norm(email)))
    where = tutors.where_listed(db, email)
    return {"email": tutors.norm(email), "name": row.name if row else "", "status": row.status if row else "away",
            "sites": where["sites"], "team": where["team"]}


@router.post("/login/request", summary="Ask for a sign-in code by e-mail", dependencies=[Depends(csrf)])
async def request_code(body: CodeRequestIn, db: Session = Depends(get_db)) -> dict:
    """The answer is the same whether or not the address is on a tutor list, so nobody can find out who the tutors are."""
    email = tutors.norm(body.email)
    if tutors.is_listed(db, email):
        code = tutors.issue_code(db, email)
        if code:
            await mailer.send([email], tpl.code_subject(), tpl.code_text(code), tpl.code_html(code))
    return {"ok": True, "delivery": mailer.configured(), "message": "If this address is on a tutor list, a code was sent to it. It works for 10 minutes."}


@router.post("/login/verify", summary="Sign in with the code", dependencies=[Depends(csrf)])
def verify(body: VerifyIn, request: Request, response: Response, db: Session = Depends(get_db)) -> dict:
    email = tutors.norm(body.email)
    if not (tutors.is_listed(db, email) and tutors.check_code(db, email, body.code)):
        raise HTTPException(401, "That code did not work. It may be wrong or expired: ask for a new one.")
    response.set_cookie(session.TUTOR_COOKIE, session.make_tutor(email), max_age=session.TUTOR_MAX_AGE, httponly=True,
                        secure=_secure(request), samesite="lax", path="/")
    return {"tutor": _me(db, email)}


@router.post("/logout", summary="Sign out (and stop counting as available)", dependencies=[Depends(csrf)])
def logout(request: Request, response: Response, db: Session = Depends(get_db)) -> dict:
    email = session.read_tutor(request.cookies.get(session.TUTOR_COOKIE))
    if email:
        tutors.set_presence(db, email, "away")
    response.delete_cookie(session.TUTOR_COOKIE, path="/")
    return {"ok": True}


@router.get("/me", summary="The signed-in tutor")
def me(request: Request, db: Session = Depends(get_db)) -> dict:
    email = current_tutor(request)
    if not tutors.is_listed(db, email):  # removed from every list since they signed in
        raise HTTPException(401, "You are no longer on a tutor list. Ask the person who runs your site.")
    return {"tutor": _me(db, email)}


@router.post("/presence", summary="Heartbeat: I am here (available) or I am away", dependencies=[Depends(csrf)])
def presence(body: PresenceIn, request: Request, db: Session = Depends(get_db)) -> dict:
    """The helper page sends this every 30 seconds only while the tab is visible and the person did something in the last
    2 minutes. After 90 seconds without one, the tutor stops counting as available."""
    email = current_tutor(request)
    if not tutors.is_listed(db, email):
        raise HTTPException(401, "You are no longer on a tutor list. Ask the person who runs your site.")
    tutors.set_presence(db, email, body.status, body.name)
    return {"tutor": _me(db, email)}


@router.get("/online", summary="Tutors who are available now (for the helper page)")
def online(who: tutors.Principal = Depends(tutors.principal), db: Session = Depends(get_db)) -> dict:
    """Names only, never e-mail addresses. A tutor sees the colleagues on their own lists; the team's key sees all."""
    rows = tutors.available_tutors(db)
    if not who.admin and who.email:
        mates = tutors.colleagues(db, who.email)
        rows = [r for r in rows if r.email in mates]
    now = datetime.now(timezone.utc)
    return {"online": [{"name": r.name or r.email.split("@")[0], "seconds_ago": int((now - (r.seen_at if r.seen_at.tzinfo else r.seen_at.replace(tzinfo=timezone.utc))).total_seconds())} for r in rows]}
