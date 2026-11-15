"""Server text to speech (FR-T8, SDS 2.4): edge-tts with a file cache.

[unverified] edge-tts is an unofficial client of Microsoft's online read-aloud
service: it needs internet and its terms for production use are not checked.
Text leaves the host, so the widget only calls this after consent.
"""

from __future__ import annotations

import hashlib
import logging
from pathlib import Path

from config import settings

log = logging.getLogger("syly")
# Somali voice exists in the online read-aloud voice list [unverified until tested]; om/ti have none (om: Addis AI).
VOICES = {"am": "am-ET-MekdesNeural", "en": "en-US-AriaNeural", "ar": "ar-SA-ZariyahNeural", "so": "so-SO-UbaxNeural"}


def cache_path(text: str, language: str) -> Path:
    h = hashlib.sha256(f"{language}:{text}".encode()).hexdigest()[:32]
    d = settings.data_dir / "tts"
    d.mkdir(parents=True, exist_ok=True)
    return d / f"{h}.mp3"


async def synthesize(text: str, language: str, out: Path | None = None) -> Path | None:
    path = out or cache_path(text, language)
    if path.exists() and path.stat().st_size > 0:
        return path
    try:
        if language not in VOICES:
            raise LookupError(f"no edge-tts voice for {language}")  # never read Tigrinya with an English voice
        import edge_tts  # imported lazily: optional at runtime

        await edge_tts.Communicate(text, VOICES[language]).save(str(path))
        if path.exists() and path.stat().st_size > 0:
            return path
    except Exception as e:  # noqa: BLE001 - any failure means "try the next voice"
        log.warning("edge-tts failed: %s", type(e).__name__)
        if path.exists():
            path.unlink(missing_ok=True)
    # Fallback (SDS 2.4): Addis AI, only when ADDIS_AI_API_KEY is set (paid per use).
    from services import addis

    if await addis.speak(text, language, path):
        return path
    path.unlink(missing_ok=True)
    return None
