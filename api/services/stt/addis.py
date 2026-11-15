"""Addis AI speech to text: Amharic (documented), Afaan Oromo [unverified]. Wraps services.addis."""

from __future__ import annotations

from services import addis

NAME = "addis"
LANGS = {"am", "om"}


def available(language: str | None) -> bool:
    return bool(addis.key()) and language in LANGS


async def transcribe(audio: bytes, mime: str, language: str) -> str | None:
    ext = "wav" if "wav" in mime else "webm"
    return await addis.transcribe(audio, f"voice.{ext}", mime, language)
