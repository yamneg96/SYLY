"""Telegram messages sent by the server (alerts, tutor replies). No-op without a bot token."""

from __future__ import annotations

import logging
import os
import time

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


def tutor_text(ticket_id: int, language: str, page_url: str | None, question: str, has_screenshot: bool, site_name: str | None = None) -> tuple[str, str]:
    """(subject, plain-text body) for the tutors. Only what the learner wrote and where: never a contact, a token or a chat id."""
    from services import email_template as tpl

    return tpl.subject(ticket_id, language), tpl.text(ticket_id, language, page_url, question, has_screenshot, site_name, helper_link())


# Alerts per hour per target (a site, or the SYLY team): a site key is public, so without a limit anyone could fill a tutor's inbox.
ALERTS_PER_HOUR = 20
_recent: dict[str, list[float]] = {}


def allow_alert(target: str, now: float | None = None) -> bool:
    t = now if now is not None else time.monotonic()
    window = [x for x in _recent.get(target, []) if t - x < 3600]
    if len(window) >= ALERTS_PER_HOUR:
        _recent[target] = window
        return False
    window.append(t)
    _recent[target] = window
    return True


async def tutors(ticket_id: int, language: str, page_url: str | None, question: str, has_screenshot: bool = False,
                 site_name: str | None = None, emails: list[str] | None = None) -> dict[str, bool]:
    """Tell the tutors. `emails` are the addresses the site's developer entered: when there are some, ONLY they are told (the SYLY
    team's inbox and Telegram group are the fallback for sites that gave none). One channel failing never stops the other.
    Returns which channels worked."""
    from services import email_template as tpl
    from services import mailer

    own = bool(emails)
    to = list(emails) if own else list(settings.tutor_emails)
    group = "" if own else settings.tutor_telegram_chat
    done = {"telegram": False, "email": False}
    if not (to or group):
        return done
    if not allow_alert(f"{site_name or 'team'}:{','.join(to)}"):
        log.warning("request %s: too many alerts this hour for this site; the request is on the helper page", ticket_id)
        return done
    subject, body = tutor_text(ticket_id, language, page_url, question, has_screenshot, site_name)
    # Each channel is guarded on its own: whatever goes wrong in one is logged and never stops the other or the learner's request.
    if group:
        try:
            done["telegram"] = await telegram(group, subject + NL + NL + body)
        except Exception as e:  # noqa: BLE001
            log.warning("tutor telegram failed: %s", type(e).__name__)
    if to:
        try:
            html_part = tpl.html_body(ticket_id, language, page_url, question, has_screenshot, site_name, helper_link(), own_addresses=own)
            done["email"] = await mailer.send(to, subject, body, html_part)
        except Exception as e:  # noqa: BLE001
            log.warning("tutor email failed: %s", type(e).__name__)
    if not any(done.values()):
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
