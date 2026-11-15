"""Groq-hosted Whisper: am, so, ar, en (base Whisper is weak on Amharic). Also detects the spoken language."""

from __future__ import annotations

import httpx

from config import settings

NAME = "groq"
LANGS = {"am", "en", "so", "ar"}
# Whisper's verbose_json reports the language by English name.
NAMES = {"amharic": "am", "english": "en", "somali": "so", "arabic": "ar", "tigrinya": "ti", "oromo": "om"}


def available(language: str | None) -> bool:
    return bool(settings.groq_key) and (language is None or language in LANGS)


async def transcribe(audio: bytes, mime: str, language: str | None) -> tuple[str, str | None]:
    """Returns (text, detected language code or None)."""
    data = {"model": settings.groq_stt_model, "response_format": "verbose_json"}
    if language:
        data["language"] = language
    ext = next((e for k, e in (("wav", "wav"), ("mpeg", "mp3"), ("mp3", "mp3"), ("webm", "webm"), ("mp4", "m4a")) if k in mime), "ogg")
    async with httpx.AsyncClient(timeout=settings.stt_timeout) as client:
        r = await client.post(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {settings.groq_key}"},
            data=data,
            files={"file": (f"voice.{ext}", audio, mime)},
        )
        r.raise_for_status()
        body = r.json()
    detected = NAMES.get(str(body.get("language", "")).lower())
    return str(body.get("text", "")).strip(), detected
