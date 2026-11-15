"""
SYLY Assistant - Text to Speech Service
File: api/services/tts.py

Generates speech audio using edge-tts:
- Amharic: am-ET-MekdesNeural
- English: en-US-AriaNeural
- Arabic: ar-SA-ZariyahNeural
Implements SHA256 file-based caching in data/cache/tts.
"""

from __future__ import annotations
import hashlib
import logging
from pathlib import Path
from typing import Optional
import edge_tts

try:
    from ..config import DATA_DIR
except (ImportError, ValueError):
    try:
        from api.config import DATA_DIR
    except ImportError:
        from config import DATA_DIR

logger = logging.getLogger("syly.tts")

TTS_CACHE_DIR = DATA_DIR / "cache" / "tts"
TTS_CACHE_DIR.mkdir(parents=True, exist_ok=True)

VOICE_MAP = {
    "am": "am-ET-MekdesNeural",
    "en": "en-US-AriaNeural",
    "ar": "ar-SA-ZariyahNeural",
}
DEFAULT_VOICE = "en-US-AriaNeural"


def get_voice(language: Optional[str]) -> str:
    """Returns the neural voice name for the requested language code."""
    if not language:
        return DEFAULT_VOICE
    lang_clean = language.strip().lower()
    return VOICE_MAP.get(lang_clean, DEFAULT_VOICE)


async def synthesize_speech(text: str, language: str = "am") -> bytes:
    """
    Synthesizes speech audio using edge-tts with persistent file-based caching.

    Parameters:
        text: Input string to speak.
        language: Language code ('am', 'en', 'ar').

    Returns:
        MP3 audio bytes.
    """
    if not text or not text.strip():
        raise ValueError("Text cannot be empty for speech synthesis.")

    cleaned_text = text.strip()
    voice = get_voice(language)

    # Compute deterministic cache key
    cache_key = hashlib.sha256(f"{voice}:{cleaned_text}".encode("utf-8")).hexdigest()
    cache_path = TTS_CACHE_DIR / f"{cache_key}.mp3"

    # Serve from cache if available
    if cache_path.exists() and cache_path.stat().st_size > 0:
        logger.debug("Serving audio from cache: %s", cache_path)
        return cache_path.read_bytes()

    logger.info("Generating new speech with voice '%s' (%d chars)", voice, len(cleaned_text))
    communicate = edge_tts.Communicate(cleaned_text, voice)
    audio_data = bytearray()
    async for chunk in communicate.stream():
        if chunk.get("type") == "audio" and "data" in chunk:
            audio_data.extend(chunk["data"])

    if not audio_data:
        raise RuntimeError("edge-tts stream completed with no audio bytes generated.")

    result_bytes = bytes(audio_data)

    # Persist to disk cache
    try:
        cache_path.write_bytes(result_bytes)
    except Exception as e:
        logger.warning("Failed to write TTS cache file %s: %s", cache_path, e)

    return result_bytes
