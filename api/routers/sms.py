"""POST /sms/inbound {from, text} -> plain text, at most 160 characters (FR-CH2).

Keywords: ASK <question> (or any text), JOBS <word>, ALERT <word>, HELP, STOP.
A real SMS gateway would POST each incoming text here and send our reply back.
"""

from __future__ import annotations

import secrets
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from db import encrypt, get_db
from models import Alert, Job, Message, Ticket
from routers.jobs import address_hash, matches
from services import content, phone
from services.answer import answer
from services.i18n import t
from services.retrieval import detect_lang
from services.sms import fit

router = APIRouter(tags=["text route"])


class SmsIn(BaseModel):
    from_: str = Field(alias="from", min_length=3, max_length=20, examples=["0911000000"])
    text: str = Field(min_length=1, max_length=480, examples=["JOBS accountant"])


@router.post("/sms/inbound", response_class=PlainTextResponse, summary="Text route: reply in at most 160 characters")
async def inbound(body: SmsIn, db: Session = Depends(get_db)) -> str:
    sender = phone.normalize(body.from_)
    if not sender:
        raise HTTPException(400, "Phone number not recognised. Use 09…, 07… or +251….")
    text = body.text.strip()
    word, _, rest = text.partition(" ")
    cmd, rest = word.upper(), rest.strip()
    lang = detect_lang(rest or text, "am")
    if lang == "ar":
        lang = "en"  # no Arabic lesson text for keyword answers by SMS

    if cmd == "STOP":
        db.execute(delete(Alert).where(Alert.address_hash == address_hash("sms", sender)))
        db.commit()
        return t("smsStopped", lang)

    if cmd == "HELP":
        ticket = Ticket(channel="sms", language=lang, notify_enc=encrypt(sender), access_token=secrets.token_urlsafe(24))
        db.add(ticket)
        db.flush()
        if rest:
            db.add(Message(ticket_id=ticket.id, author="learner", text=rest, lang=lang))
        db.commit()
        return fit(t("smsHelpOpened", lang, id=ticket.id))

    if cmd == "JOBS":
        today = date.today().isoformat()
        jobs = [j.data for j in db.scalars(select(Job)).all() if j.data.get("deadline", "") >= today]
        probe = Alert(keyword=rest, location="")
        found = [j for j in jobs if matches(probe, j)]
        if not found:
            return fit(t("smsNoJobs", lang))
        items = "; ".join(
            f"{j.get(f'title_{lang}') or j['title_en']}, {j.get(f'location_{lang}') or j['location_en']}, {j['deadline'][5:]}"
            for j in found[:3]
        )
        return fit(t("smsJobs", lang, n=len(found), list=items))

    if cmd == "ALERT":
        if not rest:
            return fit(t("smsUsage", lang))
        db.add(Alert(channel="sms", address_enc=encrypt(sender) or "", address_hash=address_hash("sms", sender), keyword=rest, language=lang))
        db.commit()
        return fit(t("smsAlertOn", lang, keyword=rest))

    question = rest if cmd == "ASK" else text
    if not question:
        return fit(t("smsUsage", lang))
    idx = content.index(db)
    out = await answer(idx, question, lang, allow_ai=False, simple=True)  # SMS: keyword answer, nothing sent to a third party
    if not out.text:
        return fit(t("noAdvice" if out.reason == "no_advice" else "smsNotFound", lang))
    n = next((i for i, s in enumerate(idx.sections, 1) if s["id"] == out.section_id), 0)
    body_text = out.text.split("\n", 1)[-1]  # drop the "From the section" line to save characters
    return fit(body_text, t("smsSource", lang, n=n))
