"""Plain-text email through an SMTP relay (Brevo, Gmail, anything with STARTTLS). No-op until SMTP_* and SENDER_EMAIL are set.

Used to tell the tutors that a request is waiting. Never put a password, a key or a learner's contact in a message here.
"""

from __future__ import annotations

import asyncio
import logging
import smtplib
from email.message import EmailMessage
from email.utils import formataddr

from config import settings

log = logging.getLogger("syly")


def configured() -> bool:
    return bool(settings.smtp_host and settings.smtp_user and settings.smtp_pass and settings.sender_email)


def _send(to: list[str], subject: str, body: str, html: str | None = None) -> None:
    msg = EmailMessage()
    msg["From"] = formataddr(("SYLY", settings.sender_email))
    msg["To"] = ", ".join(to)
    msg["Subject"] = subject
    msg.set_content(body)
    if html:
        msg.add_alternative(html, subtype="html")  # clients that cannot show HTML show the plain text above
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
        smtp.starttls()
        smtp.login(settings.smtp_user, settings.smtp_pass)
        smtp.send_message(msg)


async def send(to: list[str], subject: str, body: str, html: str | None = None) -> bool:
    """True when the relay accepted the message. Any failure is logged without secrets and returns False."""
    if not to or not configured():
        return False
    try:
        await asyncio.to_thread(_send, to, subject, body, html)
        log.info("email sent to %d tutor address(es)", len(to))
        return True
    except (smtplib.SMTPException, OSError) as e:
        log.warning("email failed: %s", type(e).__name__)  # the type only: messages from the relay can echo the login
        return False
