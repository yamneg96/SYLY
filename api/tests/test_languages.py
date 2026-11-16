"""Arabic, Afaan Oromo, Tigrinya and Somali beside English and Amharic: questions, reading aloud, listening back."""

import asyncio
import json
from pathlib import Path

import pytest

from config import settings
from services import answer as answer_mod
from services import gemini_tts, tts
from services.i18n import DIR as I18N_DIR
from services.i18n import LANGS, t
from services.stt import gemini_audio
from test_core import IDX, FakeProvider

NEW = ["om", "ti", "so"]
ALL = ["am", "en", "ar", "om", "ti", "so"]


def run(coro):
    return asyncio.run(coro)


# ---------------------------------------------------------------- questions in every language
@pytest.mark.parametrize("lang", ALL)
def test_ask_accepts_every_language(client, lang):
    r = client.post("/api/v1/ask", json={"question": "What is the capital of France?", "language": lang})
    assert r.status_code == 200, r.text  # never a 400: the language list is the same as the widget's and the bot's
    assert r.json()["language"] == lang and r.json()["reason"] == "not_found"


@pytest.mark.parametrize("lang,name", [("om", "Afaan Oromo"), ("ti", "Tigrinya"), ("so", "Somali"), ("ar", "Arabic")])
def test_question_is_translated_for_the_search_and_answered_in_the_language(monkeypatch, lang, name):
    """No lesson text in these languages: the question is translated to English to find the section, then the answer is written in the language."""
    seen = []

    class Model(FakeProvider):
        async def complete(self, system, user):
            seen.append((system, user))
            if "Translate" in system:
                return '{"text": "Will AI replace virtual assistants?"}'
            return '{"answer": "ANSWER IN THE LANGUAGE", "sections": [1]}'

    model = Model("gemini")
    monkeypatch.setattr(answer_mod, "chain", lambda: [model])
    monkeypatch.setattr(settings, "provider", "cloud")
    monkeypatch.setattr(settings, "gemini_key", "test")
    out = run(answer_mod.answer(IDX, "dubbii kee", lang, allow_ai=True))  # the original words do not match anything in English
    assert out.text == "ANSWER IN THE LANGUAGE" and out.language == lang and out.sources
    assert "Translate" in seen[0][0], "the first call translates the question"
    assert name in seen[1][0], f"the answer is requested in {name}"


@pytest.mark.parametrize("lang", NEW)
def test_without_consent_no_model_is_called(monkeypatch, lang):
    model = FakeProvider("gemini", '{"answer": "x", "sections": [1]}')
    monkeypatch.setattr(answer_mod, "chain", lambda: [model])
    out = run(answer_mod.answer(IDX, "Will AI replace virtual assistants?", lang, allow_ai=False))
    assert model.calls == 0 and out.provider == "none"  # the course text is shown instead; nothing leaves the server


# ---------------------------------------------------------------- dictionaries
def test_every_language_has_a_server_dictionary():
    assert set(LANGS) == set(ALL)
    en = json.loads((I18N_DIR / "en.json").read_text(encoding="utf-8"))
    for lang in NEW:
        d = json.loads((Path(I18N_DIR) / f"{lang}.json").read_text(encoding="utf-8"))
        assert set(d) == set(en) and all(d[k].strip() for k in en)
        assert t("notFound", lang) != t("notFound", "en"), f"{lang} is not translated"


# ---------------------------------------------------------------- reading aloud: which voice reads which language
def test_voice_order_edge_then_gemini_then_addis():
    assert {"am", "en", "ar", "so"} <= set(tts.VOICES) and not {"om", "ti"} & set(tts.VOICES)
    assert gemini_tts.LANGS == set(ALL)


@pytest.mark.parametrize("lang", ["om", "ti"])
def test_oromo_and_tigrinya_are_read_by_the_gemini_voice(tmp_path, monkeypatch, lang):
    monkeypatch.setattr(settings, "data_dir", tmp_path)
    called = []

    async def fake_speak(text, language, out):
        called.append(language)
        out.write_bytes(b"RIFF....WAVE")
        return True

    monkeypatch.setattr(gemini_tts, "speak", fake_speak)
    path = run(tts.synthesize("ሰላም", lang))
    assert path and path.suffix == ".wav" and called == [lang]
    assert run(tts.synthesize("ሰላም", lang)) == path and called == [lang], "the second time comes from the cache"


def test_no_voice_at_all_is_a_clear_503(client, monkeypatch):
    async def none(*a, **k):
        return False

    monkeypatch.setattr(gemini_tts, "speak", none)
    from services import addis

    monkeypatch.setattr(addis, "speak", none)
    r = client.post("/api/v1/voice/speak", json={"text": "tijaabo " + "x" * 5, "language": "om"})
    assert r.status_code == 503 and "No voice" in r.json()["detail"]


def test_wav_is_served_with_the_right_type(client, monkeypatch):
    async def fake(text, language, out):
        out.write_bytes(b"RIFF\x00\x00\x00\x00WAVEdata")
        return True

    monkeypatch.setattr(gemini_tts, "speak", fake)
    r = client.post("/api/v1/voice/speak", json={"text": "wav type check qq", "language": "ti"})
    assert r.status_code == 200 and r.headers["content-type"] == "audio/wav"


def test_gemini_voice_refuses_a_non_wav_answer(tmp_path, monkeypatch):
    class R:
        status_code = 200

        def raise_for_status(self):
            pass

        def json(self):
            import base64

            return {"candidates": [{"content": {"parts": [{"inlineData": {"data": base64.b64encode(b"not audio").decode()}}]}}]}

    class C:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, *a, **k):
            return R()

    monkeypatch.setattr(settings, "gemini_key", "k")
    monkeypatch.setattr(gemini_tts.httpx, "AsyncClient", lambda **k: C())
    assert run(gemini_tts.speak("x", "om", tmp_path / "a.wav")) is False and not (tmp_path / "a.wav").exists()


# ---------------------------------------------------------------- listening: the same router for every language
def test_the_listening_model_is_its_own_setting():
    assert settings.gemini_stt_model and settings.gemini_stt_model != ""  # GEMINI_STT_MODEL: can differ from the text model
    assert set(gemini_audio.LANG_NAMES) == set(ALL)


def test_a_voice_model_with_no_quota_is_skipped_for_a_while_and_the_next_is_used(tmp_path, monkeypatch):
    import httpx

    calls = []

    async def fake_one(client, model, text):
        calls.append(model)
        if model == "m1":
            raise httpx.HTTPStatusError("quota", request=httpx.Request("POST", "http://x"), response=httpx.Response(429))
        return b"RIFF....WAVE"

    monkeypatch.setattr(gemini_tts, "_one", fake_one)
    monkeypatch.setattr(settings, "gemini_tts_model", "m1, m2")
    monkeypatch.setattr(settings, "gemini_key", "k")
    gemini_tts._skip_until.clear()
    assert run(gemini_tts.speak("a", "om", tmp_path / "1.wav")) is True and calls == ["m1", "m2"]
    assert run(gemini_tts.speak("b", "om", tmp_path / "2.wav")) is True and calls == ["m1", "m2", "m2"], "m1 is not tried again at once"
    gemini_tts._skip_until.clear()


def test_every_model_failing_gives_false_so_the_next_voice_can_try(tmp_path, monkeypatch):
    async def fake_one(client, model, text):
        raise RuntimeError("down")

    monkeypatch.setattr(gemini_tts, "_one", fake_one)
    monkeypatch.setattr(settings, "gemini_key", "k")
    gemini_tts._skip_until.clear()
    assert run(gemini_tts.speak("a", "ti", tmp_path / "x.wav")) is False


def test_raw_samples_from_an_older_voice_model_are_wrapped_into_a_wav_file():
    import io
    import wave

    pcm = b"\x01\x00" * 2400  # 0.1 second of 16-bit mono at 24 kHz
    wav = gemini_tts.pcm_to_wav(pcm, "audio/L16;codec=pcm;rate=24000")
    with wave.open(io.BytesIO(wav)) as w:
        assert (w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()) == (1, 2, 24000, 2400)
    assert gemini_tts.pcm_to_wav(pcm, "audio/mpeg") is None and gemini_tts.pcm_to_wav(b"", "audio/L16;rate=24000") is None


# ---------------------------------------------------------------- secrets never go into a URL (URLs are logged)
def test_no_api_key_is_sent_in_a_url():
    root = Path(__file__).resolve().parents[1] / "services"
    for path in root.rglob("*.py"):
        text = path.read_text(encoding="utf-8")
        assert 'params={"key"' not in text and "?key=" not in text, f"{path.name} sends a key in the URL: use a header"


def test_request_urls_are_not_logged():
    import logging

    import main  # noqa: F401 - sets the log levels at import

    assert logging.getLogger("httpx").level >= logging.WARNING
