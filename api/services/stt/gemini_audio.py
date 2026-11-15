"""Gemini audio input used as speech to text. Quality for am/om/ti/so is [unverified]: see scripts/stt_check.py."""

from __future__ import annotations

import base64

import httpx

from config import settings

NAME = "gemini"
LANG_NAMES = {"am": "Amharic", "en": "English", "om": "Afaan Oromo", "ti": "Tigrinya", "so": "Somali", "ar": "Arabic"}


def available(language: str | None) -> bool:
    return bool(settings.gemini_key)


async def transcribe(audio: bytes, mime: str, language: str | None) -> str | None:
    lang = LANG_NAMES.get(language or "", "the spoken language")
    prompt = (
        f"Transcribe this audio exactly as spoken, in {lang}, in its own script. "
        "Reply with the transcript only: no translation, no notes. If there is no speech, reply with nothing."
    )
    body = {
        "contents": [{"role": "user", "parts": [
            {"inline_data": {"mime_type": mime, "data": base64.b64encode(audio).decode()}},
            {"text": prompt},
        ]}],
        "generationConfig": {"temperature": 0},
    }
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent"
    async with httpx.AsyncClient(timeout=settings.stt_timeout) as client:
        r = await client.post(url, params={"key": settings.gemini_key}, json=body)
        r.raise_for_status()
        data = r.json()
    parts = (data.get("candidates") or [{}])[0].get("content", {}).get("parts", [])
    return "".join(p.get("text", "") for p in parts).strip()
