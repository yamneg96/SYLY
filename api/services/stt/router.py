"""Speech-to-text router (bot-voice-commands.md §0, §3.3).

Order per language; each engine gets STT_TIMEOUT seconds; an empty or very short transcript counts as a
failure and the next engine is tried. Audio is never stored.
"""

from __future__ import annotations

import asyncio
import logging
import re

from config import settings
from services.stt import addis as addis_stt
from services.stt import audio as conv
from services.stt import gemini_audio, groq_whisper, mms_local

log = logging.getLogger("syly")
ORDER: dict[str, list[str]] = {
    "am": ["addis", "gemini", "groq"],
    "en": ["groq", "gemini"],
    "om": ["addis", "gemini"],
    "ti": ["gemini", "mms"],
    "so": ["gemini", "groq"],  # spec says Groq first; stt_check 15 Nov: Gemini 23%, Groq Whisper 0% on Somali clips
    "ar": ["groq", "gemini"],
}
BETA = {"om", "ti", "so", "ar"}
_ETH = re.compile(r"[ሀ-፿]")
_ARABIC = re.compile(r"[؀-ۿ]")
_LETTER = re.compile(r"[^\W\d_]", re.UNICODE)


def usable(text: str | None) -> bool:
    """At least 2 letters; anything shorter is treated as 'not understood'."""
    return bool(text) and len(_LETTER.findall(text)) >= 2


def script_language(text: str, fallback: str) -> str:
    if _ETH.search(text or ""):
        return "am"  # Ethiopic script: Amharic or Tigrinya; without a /lang setting we assume Amharic
    if _ARABIC.search(text or ""):
        return "ar"
    return fallback


async def _engine(name: str, audio: bytes, mime: str, language: str) -> str | None:
    if name == "addis" and addis_stt.available(language):
        return await addis_stt.transcribe(audio, mime, language)
    if name == "gemini" and gemini_audio.available(language):
        return await gemini_audio.transcribe(audio, mime, language)
    if name == "groq" and groq_whisper.available(language):
        return (await groq_whisper.transcribe(audio, mime, language))[0]
    if name == "mms" and mms_local.available(language):
        return await mms_local.transcribe(audio, mime, language)
    return None


async def transcribe(audio: bytes, mime: str, language: str | None) -> dict:
    """Returns {"text", "language", "engine", "tried"}; engine "none" and text "" when nothing worked."""
    wav = await conv.to_wav16k(audio)
    if wav:
        audio, mime = wav, "audio/wav"
    tried: list[str] = []
    lang = language if language in ORDER else None

    if lang is None:  # no /lang setting: let Whisper detect the language, then check the script
        if groq_whisper.available(None):
            tried.append("groq")
            try:
                text, detected = await asyncio.wait_for(groq_whisper.transcribe(audio, mime, None), settings.stt_timeout)
                lang = detected if detected in ORDER else script_language(text, "en")
                if usable(text) and ORDER[lang][0] == "groq":
                    return {"text": text, "language": lang, "engine": "groq", "tried": tried}
            except Exception as e:  # noqa: BLE001
                log.warning("stt language detection failed: %s", type(e).__name__)
        lang = lang or "am"

    for name in ORDER[lang]:
        if name in tried:
            continue
        tried.append(name)
        try:
            text = await asyncio.wait_for(_engine(name, audio, mime, lang), settings.stt_timeout)
        except Exception as e:  # noqa: BLE001 - timeout or engine error: try the next engine
            log.warning("stt %s (%s) failed: %s", name, lang, type(e).__name__)
            continue
        if usable(text):
            return {"text": text.strip(), "language": lang, "engine": name, "tried": tried}
    return {"text": "", "language": lang, "engine": "none", "tried": tried}
