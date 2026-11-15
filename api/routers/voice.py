"""Voice: server TTS (must-have, FR-T8) and optional STT (FR-A4)."""

from __future__ import annotations

import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from config import settings
from schemas import SpeakIn
from services import addis, tts

router = APIRouter(prefix="/api/v1/voice", tags=["voice"])


@router.post("/speak", response_class=FileResponse, summary="Text to speech: edge-tts, then Addis AI if a key is set (cached). Sends text online: consent first",
             responses={200: {"content": {"audio/mpeg": {}}}, 503: {"description": "No voice service reachable"}})
async def speak(body: SpeakIn) -> FileResponse:
    path = await tts.synthesize(body.text.strip(), body.language)
    if not path:
        raise HTTPException(503, "No voice service is reachable right now. The answer is shown as text.")
    return FileResponse(path, media_type="audio/mpeg")


@router.post("/transcribe", summary="Optional speech to text: Addis AI for Amharic (wav/mp3/m4a/webm), else Groq Whisper. Sends audio online: consent first")
async def transcribe(file: UploadFile = File(...), language: str = Form("am")) -> dict:
    audio = await file.read()
    if len(audio) > 20 * 1024 * 1024:
        raise HTTPException(400, "The voice note is too long. Please send under 20 MB.")
    # Amharic in a format Addis AI accepts: try Addis first (built for Amharic), then Groq Whisper.
    text = await addis.transcribe(audio, file.filename or "voice", file.content_type or "", language)
    if text:
        return {"text": text, "language": language, "service": "addis"}
    if not settings.groq_key:
        raise HTTPException(503, "Speech to text is not configured on this server.")
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {settings.groq_key}"},
            data={"model": settings.groq_stt_model, "language": language, "response_format": "json"},
            files={"file": (file.filename or "voice.ogg", audio, file.content_type or "audio/ogg")},
        )
    if r.status_code != 200:
        raise HTTPException(503, "Speech to text failed. Please type your question.")
    return {"text": r.json().get("text", "").strip(), "language": language, "service": "groq"}
