"""Send ONE test alert to the tutors, the same way a real "Talk to a person" with nobody online does.

    python scripts/tutor_alert_check.py

It reads .env (SENDER_EMAIL, SMTP_*, TUTOR_EMAILS, TUTOR_TELEGRAM_CHAT, TELEGRAM_BOT_TOKEN, PUBLIC_BASE_URL) and prints which
channels worked. The message says TEST, so the tutors know it is not a learner. Secrets are never printed.
Telegram needs a network that reaches api.telegram.org (docs/telegram.md); the email needs the relay to accept the sender address.
"""

from __future__ import annotations

import asyncio
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_env() -> None:
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


async def main() -> int:
    os.environ["DATA_DIR"] = tempfile.mkdtemp(prefix="alert-check-")
    load_env()
    sys.path.insert(0, str(ROOT / "api"))
    from config import settings
    from services import mailer, notify

    print("email configured:   ", mailer.configured(), f"(relay {settings.smtp_host or '-'}, sender {settings.sender_email or '-'})")
    print("tutor addresses:    ", len(settings.tutor_emails))
    print("telegram group set: ", bool(settings.tutor_telegram_chat), "| bot token set:", bool(settings.telegram_token))
    if not (settings.tutor_emails or settings.tutor_telegram_chat):
        print("\nNothing to send: set TUTOR_EMAILS and/or TUTOR_TELEGRAM_CHAT in .env")
        return 1
    result = await notify.tutors(0, "en", f"{notify.helper_link()}", "TEST: this is a test of the alert. No learner is waiting.", False)
    for channel, worked in result.items():
        print(f"{channel:9} {'SENT' if worked else 'not sent'}")
    return 0 if any(result.values()) else 2


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
