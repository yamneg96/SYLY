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
