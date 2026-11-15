"""Optional local Meta MMS (facebook/mms-1b-all) for Tigrinya. OFF unless MMS_ENABLED=true.

Licence: CC-BY-NC 4.0 (non-commercial only). About 1B parameters: slow on a CPU laptop.
Needs `pip install transformers torch` (deliberately not in requirements.txt).
"""

from __future__ import annotations

import asyncio
import io
import logging
import os
import wave

log = logging.getLogger("syly")
NAME = "mms"
LANGS = {"ti": "tir"}
_model = None


def enabled() -> bool:
    return os.getenv("MMS_ENABLED", "false").strip().lower() == "true"


def available(language: str | None) -> bool:
    return enabled() and language in LANGS


def _load():  # noqa: ANN202
    global _model
    if _model is None:
        from transformers import AutoProcessor, Wav2Vec2ForCTC  # noqa: PLC0415 - optional dependency

        _model = (AutoProcessor.from_pretrained("facebook/mms-1b-all"), Wav2Vec2ForCTC.from_pretrained("facebook/mms-1b-all"))
    return _model


def _run(wav: bytes, language: str) -> str:
    import torch  # noqa: PLC0415 - optional dependency

    proc, model = _load()
    proc.tokenizer.set_target_lang(LANGS[language])
    model.load_adapter(LANGS[language])
    with wave.open(io.BytesIO(wav)) as w:
        samples = torch.frombuffer(bytearray(w.readframes(w.getnframes())), dtype=torch.int16).float() / 32768
    inputs = proc(samples, sampling_rate=16000, return_tensors="pt")
    with torch.no_grad():
        ids = torch.argmax(model(**inputs).logits, dim=-1)[0]
    return proc.decode(ids)


async def transcribe(audio: bytes, mime: str, language: str) -> str | None:
    if "wav" not in mime:
        return None  # MMS needs the 16 kHz WAV made by ffmpeg
    try:
        return await asyncio.to_thread(_run, audio, language)
    except Exception as e:  # noqa: BLE001 - optional engine: any failure means "next engine"
        log.warning("MMS failed: %s", type(e).__name__)
        return None
