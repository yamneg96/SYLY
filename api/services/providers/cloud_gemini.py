"""Gemini (Google) provider: server-side key only (NFR-S1)."""

from __future__ import annotations

import httpx

from config import settings

NAME = "gemini"


def available() -> bool:
    return bool(settings.gemini_key)


async def complete(system: str, user: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent"
    body = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"},
    }
    async with httpx.AsyncClient(timeout=settings.provider_timeout) as client:
        r = await client.post(url, params={"key": settings.gemini_key}, json=body)
        r.raise_for_status()
        data = r.json()
    return "".join(p.get("text", "") for p in data["candidates"][0]["content"]["parts"])
