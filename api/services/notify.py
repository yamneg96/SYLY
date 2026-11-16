"""Telegram messages sent by the server (alerts, tutor replies). No-op without a bot token."""

from __future__ import annotations

import logging
import os

import httpx

from config import settings

log = logging.getLogger("syly")
_username: str | None = settings.telegram_username or None
# Same proxy as the bot, for networks that block api.telegram.org (http://… or socks5://…).
_proxy = os.getenv("TELEGRAM_PROXY", "").strip() or None


def _client(timeout: float) -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=timeout, proxy=_proxy)


async def telegram(chat_id: str, text: str) -> bool:
    if not settings.telegram_token or not chat_id:
        return False
    url = f"https://api.telegram.org/bot{settings.telegram_token}/sendMessage"
    try:
        async with _client(10) as client:
            r = await client.post(url, json={"chat_id": chat_id, "text": text[:4000]})
            return r.status_code == 200
    except httpx.HTTPError as e:
        log.warning("telegram send failed: %s", type(e).__name__)
        return False


NL = chr(10)  # a line break, written this way so no tool can turn it into something else


def helper_link() -> str:
    """Where a tutor opens the waiting requests."""
    return f"{settings.public_base_url or 'http://localhost:8080'}/demo/helper.html"


def tutor_text(ticket_id: int, language: str, page_url: str | None, question: str, has_screenshot: bool) -> tuple[str, str]:
    """(subject, body) for the tutors. Only what the learner wrote and where: never a contact, a token or a chat id."""
    q = " ".join((question or "").split())[:400] or "(no question was written)"
    lines = [
        f"A learner asked for a person and no tutor is online. Request {ticket_id}, language {language}.",
        "",
        f"Question: {q}",
        f"Page: {page_url or 'unknown'}",
    ]
    if has_screenshot:
        lines.append("A screenshot is attached to the request: open it on the helper page.")
    lines += ["", f"Open the waiting requests: {helper_link()}", "The learner sees your reply on the page, or on Telegram if they chose it."]
    return f"SYLY: new request {ticket_id} ({language})", NL.join(lines)


async def tutors(ticket_id: int, language: str, page_url: str | None, question: str, has_screenshot: bool = False) -> dict[str, bool]:
    """Tell the tutors: Telegram group and/or email. One channel failing never stops the other. Returns which worked."""
    from services import mailer

    subject, body = tutor_text(ticket_id, language, page_url, question, has_screenshot)
    done = {"telegram": False, "email": False}
    # Each channel is guarded on its own: whatever goes wrong in one is logged and never stops the other or the learner's request.
    if settings.tutor_telegram_chat:
        try:
            done["telegram"] = await telegram(settings.tutor_telegram_chat, subject + NL + NL + body)
        except Exception as e:  # noqa: BLE001
            log.warning("tutor telegram failed: %s", type(e).__name__)
    if settings.tutor_emails:
        try:
            done["email"] = await mailer.send(settings.tutor_emails, subject, body)
        except Exception as e:  # noqa: BLE001
            log.warning("tutor email failed: %s", type(e).__name__)
    if not any(done.values()) and (settings.tutor_telegram_chat or settings.tutor_emails):
        log.warning("request %s: the tutors could not be told (%s)", ticket_id, ", ".join(k for k, v in done.items() if not v))
    return done


async def bot_username() -> str | None:
    """From TELEGRAM_BOT_USERNAME, else asked once from Telegram (getMe)."""
    global _username
    if _username or not settings.telegram_token:
        return _username
    try:
        async with _client(5) as client:
            r = await client.get(f"https://api.telegram.org/bot{settings.telegram_token}/getMe")
            _username = r.json().get("result", {}).get("username")
    except (httpx.HTTPError, ValueError):
        return None
    return _username
