"""Addis AI (api.addisassistant.com): Amharic TTS and STT fallback (FR-A4, SDS 2.4).

From the official docs (docs.addisassistant.com, read 15 Nov 2026) and a live probe with our key:
- TTS: POST /api/v1/voice/generations, header x-api-key, JSON {text, voice_id, language, output_format,
  client_request_id (required for paid generation)}; response JSON with data.audio_url (signed URL)
  and sometimes an inline audio data URL. Voices: GET /api/v1/voice/voices?language=am (am-hamen is default).
- STT: POST /api/v2/stt, multipart: audio (wav/mp3/m4a/webm, max 10 MB, 60 s), request_data='{"language_code":"am"}';
  transcript at data.transcription. OGG/Opus (Telegram voice notes) is not listed, so those go to Groq.
- Paid per use (TTS listed at $0.032 per generated minute). On 15 Nov our key worked but the wallet was empty
  (INSUFFICIENT_CREDITS), so audio generation is NOT yet verified end to end.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import uuid
from pathlib import Path

import httpx

log = logging.getLogger("syly")
BASE = "https://api.addisassistant.com"
LANGS = {"am", "om"}  # TTS used for these two; ti is text only (bot-voice-commands.md §0)
STT_TYPES = {"audio/wav", "audio/x-wav", "audio/wave", "audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/webm"}


def key() -> str:
    return (os.getenv("ADDIS_AI_API_KEY") or "").strip()


def _find_data_url(obj: object) -> str | None:
    if isinstance(obj, str) and obj.startswith("data:audio"):
        return obj
    if isinstance(obj, dict):
        for v in obj.values():
            found = _find_data_url(v)
            if found:
                return found
    return None


async def speak(text: str, language: str, out: Path) -> bool:
    if not key() or language not in LANGS:
        return False
    voice = os.getenv("ADDIS_TTS_VOICE", "am-hamen") if language == "am" else ""
    body = {"text": text[:3000], "language": language, "output_format": "mp3_44100", "client_request_id": f"syly-{uuid.uuid4().hex}"}
    if voice:
        body["voice_id"] = voice
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(f"{BASE}/api/v1/voice/generations", headers={"x-api-key": key()}, json=body)
            data = r.json()
            if r.status_code >= 400 or "error" in data:
                log.warning("Addis AI TTS refused: %s", (data.get("error") or {}).get("code", r.status_code))
                return False
            inline = _find_data_url(data)
            if inline:
                out.write_bytes(base64.b64decode(inline.split(",", 1)[1]))
                return True
            url = (data.get("data") or {}).get("audio_url")
            if not url:
                return False
            audio = await client.get(url)
            audio.raise_for_status()
            out.write_bytes(audio.content)
            return out.stat().st_size > 0
    except (httpx.HTTPError, ValueError, KeyError) as e:
        log.warning("Addis AI TTS failed: %s", type(e).__name__)
        return False


async def transcribe(audio: bytes, filename: str, content_type: str, language: str) -> str | None:
    """Amharic/Afaan Oromo STT for formats Addis accepts; None means "use another service"."""
    if not key() or language not in ("am", "om") or (content_type or "").split(";")[0] not in STT_TYPES:
        return None
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                f"{BASE}/api/v2/stt",
                headers={"x-api-key": key()},
                files={"audio": (filename, audio, content_type)},
                data={"request_data": json.dumps({"language_code": language})},
            )
        data = r.json()
        text = ((data.get("data") or {}).get("transcription") or "").strip()
        if r.status_code >= 400 or not text:
            log.warning("Addis AI STT refused: %s", (data.get("error") or {}).get("code", r.status_code))
            return None
        return text
    except (httpx.HTTPError, ValueError) as e:
        log.warning("Addis AI STT failed: %s", type(e).__name__)
        return None
