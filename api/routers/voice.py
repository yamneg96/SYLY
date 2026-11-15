"""
SYLY Assistant - Voice Router
File: api/routers/voice.py

Handles:
- POST /api/v1/voice/speak: Synthesizes text to speech using edge-tts with caching,
  returning an audio/mpeg StreamingResponse.
"""

from __future__ import annotations
import io
from typing import Optional
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

try:
    from ..services.tts import synthesize_speech
except (ImportError, ValueError):
    try:
        from api.services.tts import synthesize_speech
    except ImportError:
        from services.tts import synthesize_speech

router = APIRouter(prefix="/voice", tags=["voice"])


class SpeakRequest(BaseModel):
    text: str
    language: Optional[str] = "am"


@router.post("/speak")
async def speak(req: SpeakRequest):
    """
    Synthesizes speech audio from text using edge-tts.
    Cached by text hash; streams audio/mpeg.
    """
    if not req.text or not req.text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Text cannot be empty for speech synthesis."
        )

    try:
        audio_bytes = await synthesize_speech(
            text=req.text,
            language=req.language or "am"
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Speech synthesis failed: {str(exc)}"
        )

    return StreamingResponse(
        io.BytesIO(audio_bytes),
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": 'inline; filename="speech.mp3"',
            "Cache-Control": "public, max-age=86400"
        }
    )
