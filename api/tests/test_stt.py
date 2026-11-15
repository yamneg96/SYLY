"""Speech-to-text router (bot-voice-commands.md §0, §3.3, §5) with mocked engines."""

import asyncio

import pytest

from config import settings
from services.stt import router


def run(coro):
    return asyncio.run(coro)


@pytest.fixture
def engines(monkeypatch):
    """Every engine available; each returns what the test puts in `replies` (str, Exception or a sleep)."""
    calls, replies = [], {}

    async def fake(name, audio, mime, language):
        calls.append(name)
        r = replies.get(name, "")
        if isinstance(r, Exception):
            raise r
        if isinstance(r, float):
            await asyncio.sleep(r)
            return "too late"
        return r

    async def no_wav(data):
        return None

    monkeypatch.setattr(router, "_engine", fake)
    monkeypatch.setattr(router.conv, "to_wav16k", no_wav)
    monkeypatch.setattr(router.groq_whisper, "available", lambda language: False)  # no auto-detect unless a test sets it
    return calls, replies


@pytest.mark.parametrize("lang,order", list(router.ORDER.items()))
def test_fallback_order_per_language(engines, lang, order):
    calls, replies = engines
    replies[order[-1]] = "ሰላም hello سلام"
    out = run(router.transcribe(b"audio", "audio/ogg", lang))
    assert calls == order and out["engine"] == order[-1] and out["language"] == lang


def test_first_engine_wins(engines):
    calls, replies = engines
    replies.update(addis="ሰላም ልጆች", gemini="should not be used")
    out = run(router.transcribe(b"a", "audio/ogg", "am"))
    assert out == {"text": "ሰላም ልጆች", "language": "am", "engine": "addis", "tried": ["addis"]}


def test_errors_and_timeouts_fall_through(engines, monkeypatch):
    calls, replies = engines
    monkeypatch.setattr(settings, "stt_timeout", 0.05)
    replies.update(addis=RuntimeError("no credit"), gemini=1.0, groq="ሰላም")
    out = run(router.transcribe(b"a", "audio/ogg", "am"))
    assert calls == ["addis", "gemini", "groq"] and out["engine"] == "groq"


def test_empty_or_tiny_transcript_counts_as_failure(engines):
    calls, replies = engines
    replies.update(groq=" . ", gemini="a")
    out = run(router.transcribe(b"a", "audio/ogg", "en"))
    assert out["text"] == "" and out["engine"] == "none" and calls == ["groq", "gemini"]


def test_auto_language_uses_whisper_detection_then_script(engines, monkeypatch):
    calls, replies = engines

    async def detect(audio, mime, language):
        return "ሰላም ለሁላችሁ", None  # Whisper did not name the language: the Ethiopic script decides

    monkeypatch.setattr(router.groq_whisper, "available", lambda language: True)
    monkeypatch.setattr(router.groq_whisper, "transcribe", detect)
    replies["addis"] = "ሰላም ለሁላችሁ"
    out = run(router.transcribe(b"a", "audio/ogg", None))
    assert out["language"] == "am" and out["engine"] == "addis" and out["tried"][0] == "groq"


def test_transcribe_endpoint_shape(client, monkeypatch):
    async def fake(audio, mime, language):
        return {"text": "hello", "language": language or "en", "engine": "groq", "tried": ["groq"]}

    monkeypatch.setattr(router, "transcribe", fake)
    r = client.post("/api/v1/voice/transcribe", files={"file": ("v.ogg", b"OggS", "audio/ogg")}, data={"language": "en"})
    assert r.status_code == 200 and r.json() == {"text": "hello", "language": "en", "engine": "groq", "beta": False}
    r = client.post("/api/v1/voice/transcribe", files={"file": ("v.ogg", b"", "audio/ogg")}, data={"language": "en"})
    assert r.status_code == 400
