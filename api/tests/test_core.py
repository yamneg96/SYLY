"""Core logic (SDS 6): retrieval, threshold, guard, providers, phone, SMS, key, webhook, i18n."""

import asyncio
import json
from pathlib import Path

import pytest

from config import REPO_DIR, fernet_key, settings
from services import answer as answer_mod
from services import guard, phone, sms
from services.i18n import DIR as I18N_DIR
from services.retrieval import Index

CONTENT = json.loads((REPO_DIR / "demo/data/content.json").read_text(encoding="utf-8"))
EVAL = json.loads((REPO_DIR / "api/scripts/eval_questions.json").read_text(encoding="utf-8"))
IDX = Index(CONTENT["sections"])


@pytest.mark.parametrize("lang", ["en", "am"])
def test_eval_in_scope(lang):
    rows = [x for x in EVAL["in_scope"] if x["lang"] == lang]
    ok = sum(1 for x in rows if (r := IDX.search(x["q"])).found and r.best.section["id"] in x["expect"])
    assert ok / len(rows) >= 0.8


@pytest.mark.parametrize("lang", ["en", "am"])
def test_eval_out_of_scope(lang):
    rows = [x for x in EVAL["out_of_scope"] if x["lang"] == lang]
    assert sum(1 for x in rows if not IDX.search(x["q"]).found) / len(rows) >= 0.8


def test_amharic_trigrams_match_affixed_words():
    r = IDX.search("ለደንበኞች የሚጠቅሙ ክህሎቶች")
    # "ለደንበኞች" (prefix ለ-) must still match "ደንበኞች"; sections 1 and 3 both cover valued skills.
    assert r.lang == "am" and r.found
    assert r.best.section["id"] in ("what-clients-are-likely-to-value-more-and-more", "what-is-shaping-the-future-of-va-work")


class FakeProvider:
    def __init__(self, name, reply=None, fail=False):
        self.NAME, self.reply, self.fail, self.calls = name, reply, fail, 0

    def available(self):
        return True

    async def complete(self, system, user):
        self.calls += 1
        if self.fail:
            raise TimeoutError
        return self.reply


def run(coro):
    return asyncio.run(coro)


def test_below_threshold_model_not_called(monkeypatch):
    fake = FakeProvider("gemini", '{"answer": "x", "sections": [1]}')
    monkeypatch.setattr(answer_mod, "chain", lambda: [fake])
    monkeypatch.setattr(settings, "provider", "cloud")
    monkeypatch.setattr(settings, "gemini_key", "test")
    out = run(answer_mod.answer(IDX, "What is the capital of France?", "en", allow_ai=True))
    assert out.text is None and out.reason == "not_found" and fake.calls == 0


def test_fallback_gemini_to_groq_and_guard(monkeypatch):
    g = FakeProvider("gemini", fail=True)
    q = FakeProvider("groq", '{"answer": "AI changes VA work; people still matter.", "sections": [1, 7]}')
    monkeypatch.setattr(answer_mod, "chain", lambda: [g, q])
    monkeypatch.setattr(settings, "provider", "cloud")
    monkeypatch.setattr(settings, "gemini_key", "test")
    out = run(answer_mod.answer(IDX, "Will AI replace virtual assistants?", "en", allow_ai=True))
    assert g.calls == 1 and q.calls == 1 and out.provider == "groq"
    assert len(out.sources) == 1  # section 7 was never given: dropped by the guard


def test_no_consent_no_model(monkeypatch):
    fake = FakeProvider("gemini", '{"answer": "x", "sections": [1]}')
    monkeypatch.setattr(answer_mod, "chain", lambda: [fake])
    out = run(answer_mod.answer(IDX, "Will AI replace virtual assistants?", "en", allow_ai=False))
    assert fake.calls == 0 and out.provider == "none" and out.sources


def test_model_not_found_falls_back_to_keyword(monkeypatch):
    fake = FakeProvider("gemini", '{"answer": "NOT_FOUND", "sections": []}')
    monkeypatch.setattr(answer_mod, "chain", lambda: [fake])
    monkeypatch.setattr(settings, "provider", "cloud")
    monkeypatch.setattr(settings, "gemini_key", "test")
    out = run(answer_mod.answer(IDX, "Will AI replace virtual assistants?", "am", allow_ai=True))
    assert out.provider == "none" and out.text and out.audio and out.audio[0].endswith("title.am.mp3")


def test_no_advice():
    out = run(answer_mod.answer(IDX, "Which medicine should I take?", "en", allow_ai=False))
    assert out.text is None and out.reason == "no_advice"


def test_guard_rejects_uncited_and_injection():
    given = [{"id": "a", "url": "/a"}]
    assert guard.validate('{"answer": "hi", "sections": []}', given) is None
    assert guard.validate("not json", given) is None
    assert guard.validate('```json\n{"answer": "ok", "sections": ["1"]}\n```', given) == ("ok", given)


@pytest.mark.parametrize("raw,want", [
    ("0911000000", "+251911000000"), ("0711000000", "+251711000000"), ("+251 911 000 000", "+251911000000"),
    ("251911000000", "+251911000000"), ("12345", None), ("0811000000", None),
])
def test_phone(raw, want):
    assert phone.normalize(raw) == want


def test_sms_fit_and_segments():
    long_am = "ምናባዊ ረዳት " * 60
    out = sms.fit(long_am, "የትምህርቱ ክፍል 2")
    assert len(out) <= 160 and out.endswith("የትምህርቱ ክፍል 2")
    assert sms.segments("a" * 160) == 1 and sms.segments("ሀ" * 160) == 3


def test_fernet_key_persisted(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "data_dir", tmp_path)
    k1 = fernet_key(settings)
    k2 = fernet_key(settings)
    assert k1 == k2 and (tmp_path / ".fernet_key").exists()


def test_server_i18n_parity():
    en = json.loads((I18N_DIR / "en.json").read_text(encoding="utf-8"))
    for f in Path(I18N_DIR).glob("*.json"):
        d = json.loads(f.read_text(encoding="utf-8"))
        assert set(d) == set(en), f.name
        for k in en:
            assert d[k].strip(), f"{f.name}:{k}"
            assert sorted(__import__("re").findall(r"\{\w+\}", d[k])) == sorted(__import__("re").findall(r"\{\w+\}", en[k])), f"{f.name}:{k}"


def test_bot_i18n_parity_and_audio_present():
    bot = REPO_DIR / "bot" / "i18n"
    en = json.loads((bot / "en.json").read_text(encoding="utf-8"))
    assert set(json.loads((bot / "am.json").read_text(encoding="utf-8"))) == set(en)  # main language: complete
    for f in bot.glob("*.json"):  # beta languages: never unknown keys (complete in bot/tests once shipped)
        assert set(json.loads(f.read_text(encoding="utf-8"))) <= set(en), f.name
    audio = REPO_DIR / "module" / "audio"
    for sec in CONTENT["sections"]:
        assert (audio / "sections" / sec["id"] / "title.am.mp3").exists()
    assert (audio / "phrases" / "notFound.am.mp3").exists()
