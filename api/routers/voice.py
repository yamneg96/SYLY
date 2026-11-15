"""Voice: server TTS (must-have, FR-T8) and speech to text through the router (FR-T7, FR-CH1)."""

from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response

from schemas import SpeakIn
from services import tts
from services.stt import audio as conv
from services.stt import router as stt

router = APIRouter(prefix="/api/v1/voice", tags=["voice"])


@router.post("/speak", summary="Text to speech: edge-tts, then Addis AI if a key is set (cached). Sends text online: consent first",
             responses={200: {"content": {"audio/mpeg": {}, "audio/ogg": {}}}, 503: {"description": "No voice for this language"}})
async def speak(body: SpeakIn) -> Response:
    path = await tts.synthesize(body.text.strip(), body.language)
    if not path:
        raise HTTPException(503, "No voice is available for this language right now. The answer is shown as text.")
    if body.format == "ogg":
        ogg = await conv.to_ogg_opus(path.read_bytes())
        if ogg:
            return Response(ogg, media_type="audio/ogg")
    return FileResponse(path, media_type="audio/mpeg")


@router.post("/transcribe", summary="Speech to text through the router (Addis AI, Gemini audio, Groq Whisper). Sends audio online: consent first")
async def transcribe(file: UploadFile = File(...), language: str = Form("auto", description="am, en, om, ti, so, ar, or auto")) -> dict:
    audio = await file.read()
    if not audio:
        raise HTTPException(400, "The voice note is empty. Please record again.")
    if len(audio) > 20 * 1024 * 1024:
        raise HTTPException(400, "The voice note is too long. Please send under 20 MB.")
    out = await stt.transcribe(audio, file.content_type or "audio/ogg", None if language == "auto" else language)
    return {"text": out["text"], "language": out["language"], "engine": out["engine"], "beta": out["language"] in stt.BETA}
