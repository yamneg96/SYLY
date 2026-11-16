"""Every call the bot makes to the SYLY API, in one place (tests replace these functions)."""

from __future__ import annotations

import os

import httpx

# Every language the API accepts: the bot passes the chat's own language, so answers come back in it (om, ti, so are beta).
API_LANGS = ("am", "en", "ar", "om", "ti", "so")
API = os.getenv("API_URL", "http://localhost:8000").rstrip("/")


async def _json(method: str, path: str, timeout: float = 30, **kw) -> object:
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.request(method, f"{API}{path}", **kw)
        r.raise_for_status()
        return r.json() if r.content and "json" in r.headers.get("content-type", "") else None


async def ask(question: str, language: str, allow_ai: bool, cid: str, simple: bool) -> dict:
    return await _json("POST", "/api/v1/ask", json={"question": question, "language": language if language in API_LANGS else "en",
                                                     "allow_ai": allow_ai, "conversation_id": cid, "simple": simple})


async def escalate(history: list, language: str, chat_id: str, cid: str) -> dict:
    return await _json("POST", "/api/v1/escalations", timeout=15, json={
        "conversation": history, "language": language if language in API_LANGS else "en", "channel": "telegram",
        "notify_telegram_chat": chat_id, "conversation_id": cid})


async def link_ticket(ticket_id: str, chat_id: str, token: str) -> bool:
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(f"{API}/api/v1/escalations/{ticket_id}/telegram", params={"chat_id": chat_id, "token": token})
        return r.status_code == 204


async def data(cid: str) -> dict:
    return await _json("GET", f"/api/v1/data/{cid}", timeout=15)


async def delete_data(cid: str) -> dict:
    return await _json("DELETE", f"/api/v1/data/{cid}", timeout=15)


async def content() -> list[dict]:
    body = await _json("GET", "/api/v1/content", timeout=15)
    return (body or {}).get("sections", [])


async def jobs() -> list[dict]:
    return await _json("GET", "/api/v1/jobs", timeout=15) or []


async def subscribe(chat_id: str, keyword: str, location: str, language: str) -> None:
    await _json("POST", "/api/v1/alerts", timeout=10, json={
        "channel": "telegram", "address": chat_id, "keyword": keyword, "location": location,
        "language": language if language in API_LANGS else "en"})


async def alerts(chat_id: str) -> list[dict]:
    return await _json("GET", "/api/v1/alerts", timeout=10, params={"channel": "telegram", "address": chat_id}) or []


async def stop_alert(alert_id: int) -> None:
    async with httpx.AsyncClient(timeout=10) as client:
        (await client.delete(f"{API}/api/v1/alerts/{alert_id}")).raise_for_status()


async def stop_all(chat_id: str) -> None:
    await _json("DELETE", "/api/v1/alerts", timeout=10, params={"channel": "telegram", "address": chat_id})


async def accommodate(job_id: str, needs: list[str], note: str | None, chat_id: str, language: str) -> dict:
    return await _json("POST", "/api/v1/accommodations", timeout=15, json={
        "job_id": job_id, "needs": needs, "note": note, "contact_channel": "telegram", "contact": chat_id,
        "language": language if language in API_LANGS else "en"})


async def transcribe(audio: bytes, language: str) -> dict:
    """{text, language, engine, beta}; language "auto" when the chat has not chosen one."""
    return await _json("POST", "/api/v1/voice/transcribe", timeout=60,
                       data={"language": language}, files={"file": ("voice.ogg", audio, "audio/ogg")})


async def speak(text: str, language: str) -> tuple[bytes, str] | None:
    """(audio bytes, content type); OGG/Opus when the API has ffmpeg, else MP3. None if no voice."""
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(f"{API}/api/v1/voice/speak", json={"text": text[:3000], "language": language, "format": "ogg"})
    if r.status_code != 200:
        return None
    return r.content, r.headers.get("content-type", "audio/mpeg")
