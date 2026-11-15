"""Bot behaviour with a fake Telegram and a fake API (bot-voice-commands.md §5)."""

import asyncio
import json
from types import SimpleNamespace

import pytest

import api_client
import bot
import commands
import ethiopian
import intents


class FakeMsg:
    def __init__(self, chat_id=111, text=""):
        self.chat = SimpleNamespace(id=chat_id)
        self.text = text
        self.sent = []

    async def answer(self, text, **kw):
        self.sent.append(("text", text, kw))

    async def answer_document(self, doc, **kw):
        self.sent.append(("document", doc, kw))

    async def answer_voice(self, voice, **kw):
        self.sent.append(("voice", voice, kw))

    async def answer_audio(self, audio, **kw):
        self.sent.append(("audio", audio, kw))

    async def edit_reply_markup(self, **kw):
        self.sent.append(("edit", None, kw))

    def texts(self):
        return [s[1] for s in self.sent if s[0] == "text"]

    def buttons(self):
        out = []
        for s in self.sent:
            kb = s[2].get("reply_markup")
            if kb is not None and hasattr(kb, "inline_keyboard"):
                out += [b.callback_data for row in kb.inline_keyboard for b in row]
        return out


class FakeQuery:
    def __init__(self, msg, data):
        self.message, self.data = msg, data

    async def answer(self, *a, **k):
        pass


def run(coro):
    return asyncio.run(coro)


@pytest.fixture(autouse=True)
def fresh(monkeypatch):
    bot.chats.clear()
    bot.register_menu_phrases()
    yield


# ---------------------------------------------------------------- setMyCommands
@pytest.mark.parametrize("lang", ["en", "am"])
def test_set_my_commands_payload_is_valid(lang):
    payload = commands.build(lang, bot.TEXT)
    assert commands.valid(payload)
    names = [n for n, _ in payload]
    assert {"start", "help", "lang", "alerts", "stop", "lesson", "ask", "simple", "person", "status", "jobs",
            "myalerts", "accommodate", "voice", "mydata", "delete"} <= set(names)
    if lang == "am":
        assert dict(payload)["person"] == bot.TEXT["am"]["cmd_person"]  # translated description


def test_set_commands_called_once_per_language():
    calls = []

    class FakeBot:
        async def set_my_commands(self, cmds, language_code=None):
            calls.append((language_code, [(c.command, c.description) for c in cmds]))

    run(bot.set_commands(FakeBot()))
    codes = [c for c, _ in calls]
    assert codes[0] is None and "am" in codes and "en" not in codes  # English = default, no language_code
    assert all(commands.valid(p) for _, p in calls)


# ---------------------------------------------------------------- /delete confirmation flow
def test_delete_needs_confirmation_then_deletes(monkeypatch):
    called = []

    async def fake_delete(cid):
        called.append(("data", cid))
        return {"deleted_questions": 1, "deleted_tickets": 0}

    async def fake_stop_all(chat_id):
        called.append(("alerts", chat_id))

    monkeypatch.setattr(api_client, "delete_data", fake_delete)
    monkeypatch.setattr(api_client, "stop_all", fake_stop_all)
    m = FakeMsg(222)
    c = bot.chat(m)
    c["lang"] = "en"
    run(bot.INTENT_ACTIONS["delete"](m, c))
    assert "del:yes" in m.buttons() and "del:no" in m.buttons()
    assert called == []  # nothing deleted before confirming

    run(bot.on_callback(FakeQuery(m, "del:no")))
    assert called == [] and bot.TEXT["en"]["deleteCancelled"] in m.texts()

    run(bot.on_callback(FakeQuery(m, "del:yes")))
    assert ("data", "tg-222") in called and ("alerts", "222") in called
    assert "222" not in bot.chats and bot.TEXT["en"]["deleteDone"] in m.texts()


def test_delete_phrase_in_amharic_asks_first():
    m = FakeMsg(333, "ሰርዝ")
    bot.chat(m)["consent"] = "no"
    run(bot.on_text(m))
    assert "del:yes" in m.buttons()


# ---------------------------------------------------------------- voice flow (§3.3, §3.5)
def test_voice_without_consent_is_refused():
    m = FakeMsg(444)
    m.voice = SimpleNamespace(file_size=1000, file_id="x")
    c = bot.chat(m)
    c.update(lang="en", consent="no")
    run(bot.on_voice(m, bot=None))
    assert m.texts() == [bot.TEXT["en"]["voiceNeedsConsent"]]


def test_voice_failure_offers_a_person_and_beta_note(monkeypatch):
    async def fake_transcribe(audio, language):
        return {"text": "", "language": "so", "engine": "none"}

    monkeypatch.setattr(api_client, "transcribe", fake_transcribe)
    m = FakeMsg(555)
    c = bot.chat(m)
    c.update(lang="en", consent="yes")
    run(bot.handle_voice(m, c, b"OggS..."))
    assert bot.TEXT["en"]["voiceFailed"] in m.texts()[0] and bot.TEXT["en"]["voiceBeta"] in m.texts()[0]
    assert "person" in m.buttons()


def test_voice_command_needing_confirmation(monkeypatch):
    async def fake_transcribe(audio, language):
        return {"text": "ሰርዝ", "language": "am", "engine": "addis"}

    monkeypatch.setattr(api_client, "transcribe", fake_transcribe)
    m = FakeMsg(666)
    c = bot.chat(m)
    c.update(lang="am", lang_set=True, consent="yes")
    run(bot.handle_voice(m, c, b"OggS..."))
    assert m.texts()[0] == bot.TEXT["am"]["voiceHeard"].format(text="ሰርዝ")
    assert set(m.buttons()) >= {"vc:yes", "vc:no"} and c["pending"]["intent"] == "delete"


def test_voice_command_without_confirmation_runs(monkeypatch):
    async def fake_transcribe(audio, language):
        return {"text": "Simple.", "language": "en", "engine": "groq"}

    monkeypatch.setattr(api_client, "transcribe", fake_transcribe)
    m = FakeMsg(777)
    c = bot.chat(m)
    c.update(lang="en", lang_set=True, consent="yes", simple=False)
    run(bot.handle_voice(m, c, b"OggS..."))
    assert c["simple"] is True and bot.TEXT["en"]["simpleOn"] in m.texts()


def test_spoken_question_goes_to_ask(monkeypatch):
    asked = []

    async def fake_transcribe(audio, language):
        return {"text": "Will AI replace virtual assistants in the future?", "language": "en", "engine": "groq"}

    async def fake_ask(q, lang, allow_ai, cid, simple):
        asked.append(q)
        return {"answer": "No.", "sources": [{"title": "AI", "url": "/pages/x.html#ai"}], "language": "en"}

    monkeypatch.setattr(api_client, "transcribe", fake_transcribe)
    monkeypatch.setattr(api_client, "ask", fake_ask)
    monkeypatch.setattr(api_client, "speak", lambda *a: asyncio.sleep(0, result=None))
    m = FakeMsg(888)
    c = bot.chat(m)
    c.update(lang="en", lang_set=True, consent="yes")
    run(bot.handle_voice(m, c, b"OggS..."))
    assert asked == ["Will AI replace virtual assistants in the future?"]


# ---------------------------------------------------------------- text splitting, jobs, dictionaries
def test_split_under_4000_and_at_sentence_ends():
    text = ("Virtual Assistant work is changing. " * 300) + "\n" + ("የቨርቹዋል ረዳትነት ሥራ እየተለወጠ ነው። " * 300)
    parts = bot.split(text)
    assert len(parts) > 1 and all(len(p) <= 4000 for p in parts)
    assert all(p.rstrip()[-1] in ".።?!" for p in parts)
    assert bot.split("x" * 9000, 4000) == ["x" * 4000, "x" * 4000, "x" * 1000]


def test_ethiopian_dates():
    assert ethiopian.format_am("2026-09-11") == "መስከረም 1 ቀን 2019 ዓ.ም."
    assert ethiopian.format_am("2026-11-23") == "ኅዳር 14 ቀን 2019 ዓ.ም."
    assert ethiopian.format_am("2027-01-07") == "ታኅሣሥ 29 ቀን 2019 ዓ.ም."


def test_am_and_en_dictionaries_are_complete():
    en, am = bot.TEXT["en"], bot.TEXT["am"]
    assert set(am) == set(en)
    assert all(str(v).strip() for v in am.values())
    for lang in bot.TEXT:  # beta files may be partial in phase 1, but never have unknown keys
        assert set(bot.TEXT[lang]) <= set(en), lang


def test_menu_buttons_are_recognised_in_every_language():
    for lang, d in bot.TEXT.items():
        if d.get("menuLesson"):
            assert intents.match(d["menuLesson"]) == "lesson", lang
