"""Gemini text to speech: the voice for languages the online read-aloud list has no voice for (Oromo, Tigrinya).

It returns a finished WAV file. Quality for om and ti is [unverified]: a model listening back recovers close wording
(scripts/voice_roundtrip.py), but only a native speaker can judge the pronunciation. Text leaves the host, so the widget and
the bot call this only after consent. Uses GEMINI_API_KEY; the model and voice are GEMINI_TTS_MODEL and GEMINI_TTS_VOICE.
"""

from __future__ import annotations

import base64
import logging
import re
import struct
import time
from pathlib import Path

import httpx

from config import settings

log = logging.getLogger("syly")
NAME = "gemini-tts"
LANGS = {"am", "en", "ar", "om", "ti", "so"}


def available(language: str) -> bool:
    return bool(settings.gemini_key) and language in LANGS


_skip_until: dict[str, float] = {}  # model -> time before which it is not tried again (quota used up, or not available)
SKIP_SECONDS = 300


def models() -> list[str]:
    return [m.strip() for m in settings.gemini_tts_model.split(",") if m.strip()]


async def _one(client: httpx.AsyncClient, model: str, text: str) -> bytes | None:
    body = {
        "contents": [{"parts": [{"text": text}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": settings.gemini_tts_voice}}},
        },
    }
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    r = await client.post(url, headers={"x-goog-api-key": settings.gemini_key}, json=body)  # a header, never the URL: URLs end up in logs
    r.raise_for_status()
    parts = r.json()["candidates"][0]["content"]["parts"]
    inline = next((p.get("inlineData") or p.get("inline_data") for p in parts if p.get("inlineData") or p.get("inline_data")), None)
    if not inline:
        return None
    data = base64.b64decode(inline["data"])
    return data if data.startswith(b"RIFF") else pcm_to_wav(data, inline.get("mimeType") or inline.get("mime_type") or "")


def pcm_to_wav(pcm: bytes, mime: str) -> bytes | None:
    """Some Gemini voice models return raw 16-bit samples (audio/L16;rate=24000) instead of a WAV file: wrap them."""
    if not pcm or not mime.lower().startswith("audio/l16"):
        return None
    m = re.search(r"rate=(\d+)", mime)
    rate = int(m.group(1)) if m else 24000
    return b"RIFF" + struct.pack("<I", 36 + len(pcm)) + b"WAVEfmt " + struct.pack("<IHHIIHH", 16, 1, 1, rate, rate * 2, 2, 16) + b"data" + struct.pack("<I", len(pcm)) + pcm


async def speak(text: str, language: str, out: Path) -> bool:
    """Writes a WAV file to `out` and returns True, or returns False when no model could (the next voice is tried)."""
    if not available(language):
        return False
    async with httpx.AsyncClient(timeout=settings.provider_timeout * 4) as client:
        for model in models():
            if _skip_until.get(model, 0) > time.monotonic():
                continue
            try:
                data = await _one(client, model, text)
            except Exception as e:  # noqa: BLE001 - any failure means "try the next model, then the next voice"
                status = getattr(getattr(e, "response", None), "status_code", "")
                log.warning("gemini tts %s failed (%s): %s %s", model, language, type(e).__name__, status)
                if status in (403, 404, 429):  # quota used up or model not available: leave it alone for a while
                    _skip_until[model] = time.monotonic() + SKIP_SECONDS
                continue
            if data:
                out.write_bytes(data)
                return True
            log.warning("gemini tts %s gave something that is not a WAV file (%s)", model, language)
    return False
