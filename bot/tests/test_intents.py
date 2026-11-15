"""Intent matching (bot-voice-commands.md §3.1, §3.2, §5)."""

import json
from pathlib import Path

import pytest

import intents

DATA = json.loads((Path(intents.__file__).with_name("intents.json")).read_text(encoding="utf-8"))
MAIN = ("am", "en")


def setup_module():
    intents.load()


@pytest.mark.parametrize("intent,lang,phrase", [
    (i, lang, p) for i, per in DATA.items() if not i.startswith("_") for lang, ps in per.items() if lang in MAIN for p in ps
])
def test_every_am_en_phrase_maps_to_its_intent(intent, lang, phrase):
    assert intents.match(phrase) == intent, f"{lang} {phrase!r}"


def test_each_intent_has_3_to_8_phrases_per_main_language():
    for intent, per in DATA.items():
        if intent.startswith("_"):
            continue
        for lang in MAIN:
            assert 3 <= len(per[lang]) <= 8, (intent, lang, len(per[lang]))


@pytest.mark.parametrize("text", [
    "how do I get help with AI tools?",
    "Can you tell me where the lesson about virtual assistants starts?",
    "ስለ ምናባዊ ረዳቶች ትምህርቱ የት እንደሚጀምር ንገረኝ እባክህ",
    "I want to delete the draft email I wrote for my client yesterday",
])
def test_long_sentences_are_never_commands(text):
    assert intents.match(text) is None


def test_ties_go_to_question(monkeypatch):
    monkeypatch.setattr(intents, "_PHRASES", {"a": ["shared phrase"], "b": ["shared phrase"]})
    assert intents.match("shared phrase") is None  # exact in two intents
    monkeypatch.setattr(intents, "_PHRASES", {"a": ["abcdef"], "b": ["abcdeg"]})
    assert intents.match("abcdex") is None  # fuzzy: best minus second < MARGIN


def test_ethiopic_normalisation():
    assert intents.normalise("ሥራዎች!") == intents.normalise("ስራዎች")       # ሠ series folds to ሰ
    assert intents.normalise("ሐኪም፣") == intents.normalise("ሀኪም")           # ሐ folds to ሀ, ፣ removed
    assert intents.normalise("ዐማርኛ።") == intents.normalise("አማርኛ")         # ዐ folds to አ, ። removed
    assert intents.normalise("📖  ትምህርት ") == "ትምህርት"                   # emoji and spaces stripped
    assert intents.match("ሥራ") == "jobs" and intents.match("ስራ።") == "jobs"


def test_slash_and_empty_are_not_phrases():
    assert intents.match("/help") is None
    assert intents.match("") is None
    assert intents.match("   ") is None
