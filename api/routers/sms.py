"""
SYLY Assistant - Strict SMS Gateway Router
File: api/routers/sms.py

Features:
- POST /sms/inbound: Accepts { "from": "string", "text": "string" }.
- Parses leading keywords: ASK, JOBS, HELP, STOP.
- Keyword ASK: sends query to retrieval/answer pipeline.
- Keyword JOBS: returns available remote jobs/opportunities.
- Keyword HELP: creates a human tutor ticket in SQLAlchemy database.
- Keyword STOP: handles opt-out confirmation.
- Strict length truncation:
    * If Ethiopic characters (U+1200-U+137F) present: max 70 chars (slice to 67 + "...").
    * If Latin/English: max 160 chars (slice to 157 + "...").
- Returns PlainTextResponse with Content-Type: text/plain.
"""

from __future__ import annotations
import json
import os
import re
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

try:
    from ..db import get_db
    from ..models import Conversation, Message, Ticket
    from ..services.retrieval import retrieve
    from ..services.webhook import fire_ticket_webhook
except (ImportError, ValueError):
    try:
        from api.db import get_db
        from api.models import Conversation, Message, Ticket
        from api.services.retrieval import retrieve
        from api.services.webhook import fire_ticket_webhook
    except ImportError:
        from db import get_db
        from models import Conversation, Message, Ticket
        from services.retrieval import retrieve
        from services.webhook import fire_ticket_webhook

router = APIRouter(prefix="/sms", tags=["sms"])

ETHIOPIC_REGEX = re.compile(r"[\u1200-\u137F]")
SECTIONS_CACHE: List[Dict[str, Any]] = []
JOBS_CACHE: List[Dict[str, Any]] = []


def has_ethiopic(text: str) -> bool:
    """Checks if text contains Ethiopic Unicode characters (U+1200 to U+137F)."""
    return bool(ETHIOPIC_REGEX.search(text))


def truncate_sms(text: str) -> str:
    """
    Strictly truncates SMS response per gateway constraints:
    - If Ethiopic (Unicode): max 70 chars (slice to 67 + '...').
    - If Latin/English: max 160 chars (slice to 157 + '...').
    """
    if has_ethiopic(text):
        if len(text) > 70:
            return text[:67] + "..."
        return text
    else:
        if len(text) > 160:
            return text[:157] + "..."
        return text


def load_content_sections() -> List[Dict[str, Any]]:
    """Loads and caches lesson sections from demo/data/content.json."""
    global SECTIONS_CACHE
    if SECTIONS_CACHE:
        return SECTIONS_CACHE
    base_dir = Path(__file__).resolve().parent.parent.parent
    content_file = base_dir / "demo" / "data" / "content.json"
    if content_file.exists():
        try:
            with open(content_file, "r", encoding="utf-8") as f:
                SECTIONS_CACHE = json.load(f)
        except Exception as e:
            print(f"[WARN] Failed to load content.json for SMS: {e}")
    return SECTIONS_CACHE


def load_jobs() -> List[Dict[str, Any]]:
    """Loads and caches jobs from demo/data/jobs.json."""
    global JOBS_CACHE
    if JOBS_CACHE:
        return JOBS_CACHE
    base_dir = Path(__file__).resolve().parent.parent.parent
    jobs_file = base_dir / "demo" / "data" / "jobs.json"
    if jobs_file.exists():
        try:
            with open(jobs_file, "r", encoding="utf-8") as f:
                JOBS_CACHE = json.load(f)
        except Exception as e:
            print(f"[WARN] Failed to load jobs.json for SMS: {e}")
    return JOBS_CACHE


class SMSInbound(BaseModel):
    from_: str = Field(..., alias="from")
    text: str

    model_config = ConfigDict(populate_by_name=True)


def handle_ask_query(query: str, sender: str, db: Session) -> str:
    """Processes an ASK query against retrieval knowledge base."""
    if not query:
        return "Please include your question after ASK. Example: ASK what is virtual assistant?"

    sections = load_content_sections()
    is_am = has_ethiopic(query)
    lang = "am" if is_am else "en"

    result = retrieve(query=query, sections=sections, threshold=0.30)
    if not result:
        if is_am:
            return "ለዚህ ጥያቄ መልስ በትምህርቱ አልተገኘም። የአስተማሪ እርዳታ ለማግኘት HELP ብለው ይላኩ።"
        return "No answer found in lesson materials. Text HELP to reach a tutor."

    best_sec, _ = result
    title = best_sec.get("title_am" if is_am else "title_en") or best_sec.get("title_en", "")
    body = best_sec.get("text_am" if is_am else "text_en") or best_sec.get("text_en", "")

    # Extract first sentence for clean SMS format
    sentence_delim = "።" if is_am else "."
    parts = re.split(r'(?<=[.?!።])\s+', body.strip())
    first_sentence = parts[0] if parts else body.strip()

    if is_am:
        # Keep Amharic concise
        reply = f"{title}: {first_sentence}"
    else:
        reply = f"{title}: {first_sentence}"

    return reply


def handle_jobs_query(query: str) -> str:
    """Processes a JOBS query."""
    is_am = has_ethiopic(query)
    jobs = load_jobs()

    if is_am:
        return "የሥራ ዕድሎች: ቨርቹዋል ረዳት፣ ዳታ ኤንትሪ፣ የደንበኞች ድጋፍ። በ savanna/pages/jobs.html ይመልከቱ።"

    sub = query.strip()
    if sub and jobs:
        # Check if keyword matches any job
        matches = [
            j.get("title", "") for j in jobs
            if sub.lower() in j.get("title", "").lower() or sub.lower() in j.get("description", "").lower()
        ]
        if matches:
            titles = ", ".join(matches[:2])
            return f"SYLY Jobs matching '{sub}': {titles}. Apply at savanna/pages/jobs.html"

    return "SYLY Jobs: Virtual Assistant, Customer Support, Data Entry. Remote with accommodations. Visit savanna/pages/jobs.html or text HELP."


@router.post("/inbound", response_class=PlainTextResponse)
def sms_inbound(
    payload: SMSInbound,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
) -> PlainTextResponse:
    """
    Inbound SMS webhook endpoint.
    Parses ASK, JOBS, HELP, STOP commands and returns strictly truncated PlainTextResponse.
    """
    raw_text = payload.text.strip()
    sender = payload.from_.strip()

    if not raw_text:
        reply = "SYLY SMS: Send ASK <question>, JOBS for openings, HELP for a tutor, or STOP to opt out."
        return PlainTextResponse(content=truncate_sms(reply), media_type="text/plain")

    # Match first word/token case-insensitively
    tokens = raw_text.split(maxsplit=1)
    keyword = tokens[0].upper()
    remainder = tokens[1].strip() if len(tokens) > 1 else ""

    if keyword == "ASK":
        reply = handle_ask_query(remainder, sender, db)

    elif keyword == "JOBS":
        reply = handle_jobs_query(remainder)

    elif keyword == "HELP":
        # Create an escalation ticket for tutor triage
        ticket_id = str(uuid.uuid4())
        ticket = Ticket(
            id=ticket_id,
            conversation_id=None,
            page_url=f"sms:{sender}",
            section="sms_help",
            status="waiting"
        )
        db.add(ticket)
        db.commit()

        # Fire webhook background task if configured
        webhook_url = os.getenv("WEBHOOK_URL", "")
        if webhook_url:
            background_tasks.add_task(fire_ticket_webhook, ticket_id, f"sms:{sender}", webhook_url)

        if has_ethiopic(remainder):
            reply = "ጥያቄዎ ለአስተማሪ ደርሷል። በቅርቡ በSMS ወይም በስልክ እንደውላለን።"
        else:
            reply = "Your request has been routed to a human tutor. A tutor will contact you shortly."

    elif keyword == "STOP":
        if has_ethiopic(remainder):
            reply = "ከSYLY SMS አገልግሎት ወጥተዋል። እንደገና ለመመዝገብ START ይላኩ።"
        else:
            reply = "You have unsubscribed from SYLY SMS alerts. Text START to resubscribe."

    else:
        # Check if user sent a question directly without 'ASK' prefix
        if has_ethiopic(raw_text):
            reply = "SYLY: ASK [ጥያቄ]፣ JOBS [ሥራ]፣ HELP [እርዳታ] ወይም STOP ብለው ይላኩ።"
        else:
            reply = "SYLY SMS: Send ASK <question>, JOBS for openings, HELP for a tutor, or STOP to opt out."

    # Enforce strict length slicing
    final_output = truncate_sms(reply)
    return PlainTextResponse(content=final_output, media_type="text/plain")
