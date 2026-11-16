"""Signed session cookie for developers (not learners). No extra library: HMAC-SHA256 over a small JSON body."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time

from config import session_secret, settings

COOKIE = "syly_session"
MAX_AGE = 7 * 24 * 3600  # 7 days
CSRF_HEADER = "x-requested-with"
CSRF_VALUE = "syly"


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _mac(body: str) -> str:
    return _b64(hmac.new(session_secret(settings), body.encode(), hashlib.sha256).digest())


def make(account_id: int, now: float | None = None) -> str:
    body = _b64(json.dumps({"aid": account_id, "exp": int((now or time.time()) + MAX_AGE)}, separators=(",", ":")).encode())
    return f"{body}.{_mac(body)}"


def read(cookie: str | None, now: float | None = None) -> int | None:
    """The account id in a valid, unexpired cookie, else None."""
    if not cookie or "." not in cookie:
        return None
    body, mac = cookie.rsplit(".", 1)
    if not hmac.compare_digest(mac, _mac(body)):
        return None
    try:
        data = json.loads(_unb64(body))
        if int(data["exp"]) <= (now or time.time()):
            return None
        return int(data["aid"])
    except (ValueError, KeyError, TypeError):
        return None


# A tutor's cookie is a separate cookie with a different payload (an e-mail address, not an account id), so neither can pass for the other.
TUTOR_COOKIE = "syly_tutor"
TUTOR_MAX_AGE = 12 * 3600  # one shift


def make_tutor(email: str, now: float | None = None) -> str:
    body = _b64(json.dumps({"tm": email, "exp": int((now or time.time()) + TUTOR_MAX_AGE)}, separators=(",", ":")).encode())
    return f"{body}.{_mac(body)}"


def read_tutor(cookie: str | None, now: float | None = None) -> str | None:
    """The e-mail address in a valid, unexpired tutor cookie, else None."""
    if not cookie or "." not in cookie:
        return None
    body, mac = cookie.rsplit(".", 1)
    if not hmac.compare_digest(mac, _mac(body)):
        return None
    try:
        data = json.loads(_unb64(body))
        if int(data["exp"]) <= (now or time.time()):
            return None
        return str(data["tm"])
    except (ValueError, KeyError, TypeError):
        return None
