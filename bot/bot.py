"""SYLY Telegram bot (FR-CH1, FR-T7, FR-J3, FR-J4): long polling, no public URL needed.

Every answer comes from the same API as the web panel. Commands are English slash commands (Telegram only
allows a-z, 0-9 and _), with menu descriptions per language; the same actions also work as phrases typed or
spoken in the chat's language (intents.py) and as keyboard buttons. See .claude/bot-voice-commands.md.
"""

from __future__ import annotations

import asyncio
import html
import json
import logging
import os
import re
import sys
from datetime import date
from pathlib import Path

import httpx
from aiogram import Bot, Dispatcher, F
from aiogram.exceptions import TelegramBadRequest
from aiogram.filters import Command, CommandObject, CommandStart
from aiogram.types import (
    BotCommand, BufferedInputFile, CallbackQuery, ErrorEvent, InlineKeyboardButton, InlineKeyboardMarkup,
    KeyboardButton, Message, ReplyKeyboardMarkup,
)

import api_client as api
import commands
import ethiopian
import intents

logging.basicConfig(level=logging.INFO, format="%(levelname)s bot: %(message)s")
log = logging.getLogger("bot")

PUBLIC = os.getenv("PUBLIC_BASE_URL", "http://localhost:8080").rstrip("/")
STATE_FILE = Path(os.getenv("BOT_STATE", "/app/state/chats.json"))
LIMIT = 4000
MAIN = ("am", "en")
BETA = ("om", "ti", "so", "ar")
LANGS = MAIN + BETA
_I18N = Path(__file__).parent / "i18n"
TEXT = {lang: json.loads((_I18N / f"{lang}.json").read_text(encoding="utf-8")) for lang in LANGS if (_I18N / f"{lang}.json").exists()}
NEEDS = ["interpreter", "extra_time", "written_questions", "accessible_venue", "other"]
MENU = {"menuAsk": "ask", "menuLesson": "lesson", "menuPerson": "person", "menuJobs": "jobs", "menuSettings": "settings"}


def token() -> str:
    return (os.getenv("TELEGRAM_BOT_TOKEN") or os.getenv("BOT_TOKEN") or "").strip()


# ------------------------------------------------------------------ chat state (only what is needed)
chats: dict[str, dict] = {}


def load_state() -> None:
    try:
        chats.update(json.loads(STATE_FILE.read_text(encoding="utf-8")))
    except (OSError, ValueError):
        pass


def save_state() -> None:
    try:
        STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        keep = ("lang", "lang_set", "consent", "simple", "voice")
        STATE_FILE.write_text(json.dumps({k: {f: v.get(f) for f in keep} for k, v in chats.items()}), encoding="utf-8")
    except OSError:
        pass


def chat_id_of(m: Message | CallbackQuery) -> str:
    if isinstance(m, CallbackQuery) or getattr(m, "message", None) is not None and not hasattr(m, "chat"):
        return str(m.message.chat.id)
    return str(m.chat.id)


def chat(m: Message | CallbackQuery) -> dict:
    c = chats.setdefault(chat_id_of(m), {"lang": "am", "lang_set": False, "consent": None, "simple": False, "voice": True})
    c.setdefault("history", [])
    return c


def t(c: dict, key: str, **kw: object) -> str:
    s = TEXT.get(c.get("lang", "am"), {}).get(key) or TEXT["en"][key]
    return s.format(**kw) if kw else s


def cid(m: Message | CallbackQuery) -> str:
    return f"tg-{chat_id_of(m)}"


def lang_label(lang: str) -> str:
    name = TEXT.get(lang, {}).get("langName", lang)
    return f"{name} {TEXT.get(lang, {}).get('beta', '(beta)')}" if lang in BETA else name


# ------------------------------------------------------------------ sending
_PIECES = re.compile(r"[^.?!።\n]+(?:[.?!።]+|\n+|$)")  # sentences and lines, delimiter kept


def split(text: str, limit: int = LIMIT) -> list[str]:
    """Split under Telegram's limit at sentence ends (። . ? !) or new lines; words, then characters, only if needed."""
    parts, cur = [], ""
    for piece in _PIECES.findall(text) or [text]:
        while len(piece) > limit:
            cut = piece.rfind(" ", 0, limit)
            cut = cut if cut > 0 else limit
            if cur:
                parts.append(cur)
                cur = ""
            parts.append(piece[:cut])
            piece = piece[cut:].lstrip()
        if len(cur) + len(piece) > limit:
            parts.append(cur)
            cur = ""
        cur += piece
    if cur.strip():
        parts.append(cur)
    return [p.strip() for p in parts if p.strip()]


async def reply(m: Message, text: str, **kw: object) -> None:
    for part in split(text):
        await m.answer(part, **kw)


async def reply_html(m: Message, plain_body: str, links: list[tuple[str, str]], heading: str) -> None:
    """Answer with tappable source titles; plain text with the URLs if Telegram refuses the HTML."""
    body_parts = split(plain_body, LIMIT - 600)
    tail_html = f"\n\n<b>{html.escape(heading)}:</b>\n" + "\n".join(
        f'• <a href="{html.escape(url, quote=True)}">{html.escape(title)}</a>' for title, url in links)
    tail_plain = f"\n\n{heading}:\n" + "\n".join(f"{title}\n{url}" for title, url in links)
    for i, part in enumerate(body_parts):
        last = i == len(body_parts) - 1
        try:
            await m.answer(html.escape(part) + (tail_html if last else ""), parse_mode="HTML", disable_web_page_preview=True)
        except TelegramBadRequest:
            await m.answer(part + (tail_plain if last else ""), disable_web_page_preview=True)


async def voice_reply(m: Message, c: dict, text: str, language: str) -> None:
    """Voice note (OGG/Opus) when /voice is on and the chat allowed online answers; the text was already sent."""
    if not c.get("voice") or c.get("consent") != "yes":
        return
    try:
        res = await api.speak(text, language)
    except httpx.HTTPError:
        return
    if not res:
        return
    audio, ctype = res
    if "ogg" in ctype:
        await m.answer_voice(BufferedInputFile(audio, filename="answer.ogg"))
    else:
        await m.answer_audio(BufferedInputFile(audio, filename="answer.mp3"))


def abs_url(url: str) -> str:
    return f"{PUBLIC}{url}" if url.startswith("/") else url


def remember(c: dict, role: str, text: str) -> None:
    c["history"].append({"role": role, "text": text[:1000], "lang": c.get("lang")})
    c["history"] = c["history"][-10:]


# ------------------------------------------------------------------ keyboards
def main_menu(c: dict) -> ReplyKeyboardMarkup:
    def b(key: str) -> KeyboardButton:
        return KeyboardButton(text=t(c, key))

    return ReplyKeyboardMarkup(keyboard=[[b("menuAsk"), b("menuLesson")], [b("menuPerson"), b("menuJobs")], [b("menuSettings")]],
                               resize_keyboard=True, is_persistent=True)


def ikb(rows: list[list[tuple[str, str]]]) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text=txt, callback_data=data) for txt, data in row] for row in rows])


def lang_keyboard() -> InlineKeyboardMarkup:
    langs = [lang for lang in LANGS if lang in TEXT]
    return ikb([[(lang_label(lang), f"lang:{lang}") for lang in langs[i:i + 2]] for i in range(0, len(langs), 2)])


def consent_keyboard(c: dict) -> InlineKeyboardMarkup:
    return ikb([[(t(c, "consentYes"), "consent:yes")], [(t(c, "consentNo"), "consent:no")]])


def person_keyboard(c: dict) -> InlineKeyboardMarkup:
    return ikb([[(t(c, "personButton"), "person")]])


def settings_keyboard(c: dict) -> InlineKeyboardMarkup:
    def onoff(v: object) -> str:
        return t(c, "on" if v else "off")

    return ikb([[(t(c, "setLanguage"), "set:lang")],
                [(t(c, "setVoice", state=onoff(c.get("voice"))), "set:voice")],
                [(t(c, "setSimple", state=onoff(c.get("simple"))), "set:simple")],
                [(t(c, "setMyData"), "set:mydata"), (t(c, "setDelete"), "set:delete")]])


def register_menu_phrases() -> None:
    """Keyboard buttons arrive as plain text: teach the matcher every language's label."""
    intents.load()
    for key, intent in MENU.items():
        intents.add_phrases(intent, [d[key] for d in TEXT.values() if d.get(key)])


# ------------------------------------------------------------------ actions (shared by commands, phrases, voice, buttons)
async def do_start(m: Message, c: dict) -> None:
    await reply(m, t(c, "start"), reply_markup=main_menu(c))
    await m.answer(t(c, "chooseLang"), reply_markup=lang_keyboard())


async def do_help(m: Message, c: dict) -> None:
    await reply(m, t(c, "helpText"), reply_markup=person_keyboard(c))


async def ask_api(m: Message, c: dict, question: str) -> None:
    remember(c, "learner", question)
    try:
        res = await api.ask(question, c["lang"], c.get("consent") == "yes", cid(m), bool(c.get("simple")))
    except httpx.HTTPError:
        await reply(m, t(c, "apiDown"))
        return
    if not res.get("answer"):
        await reply(m, t(c, "noAdvice" if res.get("reason") == "no_advice" else "notFound"), reply_markup=person_keyboard(c))
        return
    links = [(s["title"], abs_url(s["url"])) for s in res["sources"]]
    remember(c, "assistant", res["answer"])
    await reply_html(m, res["answer"], links, t(c, "source"))
    await voice_reply(m, c, res["answer"], res.get("language") or c["lang"])


async def do_person(m: Message, c: dict) -> None:
    try:
        res = await api.escalate(c.get("history", []), c["lang"], chat_id_of(m), cid(m))
    except httpx.HTTPError:
        await reply(m, t(c, "apiDown"))
        return
    await reply(m, t(c, "helpOnline" if res.get("helper_online") else "helpLater", id=res["ticketId"]))


async def do_lesson(m: Message, c: dict) -> None:
    try:
        sections = [s for s in await api.content() if s.get("type") not in ("job", "page")]
    except httpx.HTTPError:
        await reply(m, t(c, "apiDown"))
        return
    if not sections:
        await reply(m, t(c, "lessonEmpty"))
        return
    am = c["lang"] == "am"
    rows = [[(((s.get("title_am") if am else None) or s.get("title_en") or s["id"])[:60], f"sec:{s['id']}"[:64])] for s in sections]
    await m.answer(t(c, "lessonPick"), reply_markup=ikb(rows))


async def send_section(m: Message, c: dict, section_id: str) -> None:
    try:
        sections = await api.content()
    except httpx.HTTPError:
        await reply(m, t(c, "apiDown"))
        return
    s = next((x for x in sections if x["id"] == section_id), None)
    if not s:
        await reply(m, t(c, "lessonEmpty"))
        return
    lang = "am" if c["lang"] == "am" and s.get("text_am") else "en"
    title = s.get(f"title_{lang}") or s.get("title_en")
    sentences = re.split(r"(?<=[.!?።])\s+", (s.get(f"text_{lang}") or s.get("text_en") or "").strip())
    summary = " ".join(sentences[: 1 if c.get("simple") else 3])
    await reply_html(m, f"{title}\n{summary}", [(title, abs_url(s["url"]))], t(c, "source"))
    await voice_reply(m, c, f"{title}. {summary}", lang)


def _date(iso: str, lang: str) -> str:
    return f"{iso} ({ethiopian.format_am(iso)})" if lang == "am" else iso


async def do_jobs(m: Message, c: dict, keyword: str) -> None:
    try:
        all_jobs = await api.jobs()
    except httpx.HTTPError:
        await reply(m, t(c, "apiDown"))
        return
    open_jobs = [j for j in all_jobs if j.get("deadline", "") >= date.today().isoformat()]
    kw = keyword.strip().lower()
    if kw:
        def hay(j: dict) -> str:
            return " ".join([j.get("title_en", ""), j.get("title_am", ""), j.get("summary_en", ""), j.get("employer", ""),
                             " ".join(j.get("keywords_en", []) + j.get("keywords_am", []))]).lower()

        found = [j for j in open_jobs if all(w in hay(j) for w in kw.split())]
        if not found:
            await reply(m, t(c, "jobsNone", keyword=keyword.strip()))
            return
        head = t(c, "jobsHeader", keyword=keyword.strip())
    else:
        found, head = open_jobs, t(c, "jobsUsage")
    am = c["lang"] == "am"
    lines = [t(c, "jobLine", title=(j.get("title_am") if am else None) or j["title_en"], employer=j["employer"],
               place=(j.get("location_am") if am else None) or j["location_en"], date=_date(j["deadline"], c["lang"]),
               url=f"{PUBLIC}/pages/jobs.html#job-{j['id']}") for j in found[:5]]
    await reply(m, head + "\n\n" + "\n\n".join(lines) + "\n\n" + t(c, "jobsTrust"), disable_web_page_preview=True)


async def do_alerts(m: Message, c: dict, args: str) -> None:
    words = args.split()
    if not words:
        await reply(m, t(c, "alertsUsage"))
        return
    try:
        await api.subscribe(chat_id_of(m), words[0], " ".join(words[1:]), c["lang"])
    except httpx.HTTPError:
        await reply(m, t(c, "apiDown"))
        return
    await reply(m, t(c, "alertsOn", keyword=words[0]))


async def do_myalerts(m: Message, c: dict) -> None:
    try:
        rows = await api.alerts(chat_id_of(m))
    except httpx.HTTPError:
        await reply(m, t(c, "apiDown"))
        return
    if not rows:
        await reply(m, t(c, "myalertsNone"))
        return
    kb = ikb([[(t(c, "alertStopButton", keyword=(a["keyword"] + (" " + a["location"] if a.get("location") else "")))[:60],
                f"al:{a['id']}")] for a in rows])
    await m.answer(t(c, "myalertsHeader"), reply_markup=kb)


async def do_stop(m: Message, c: dict) -> None:
    try:
        await api.stop_all(chat_id_of(m))
    except httpx.HTTPError:
        await reply(m, t(c, "apiDown"))
        return
    await reply(m, t(c, "stopped"))


async def do_status(m: Message, c: dict) -> None:
    try:
        data = await api.data(cid(m))
    except httpx.HTTPError:
        await reply(m, t(c, "apiDown"))
        return
    open_t = [tk for tk in (data or {}).get("tickets", []) if tk.get("status") != "closed"]
    if not open_t:
        await reply(m, t(c, "statusNone"), reply_markup=person_keyboard(c))
        return
    tk = open_t[-1]
    helper = [x for x in tk.get("messages", []) if x.get("author") == "helper"]
    text = t(c, "statusOpen", id=tk["id"], status=t(c, f"status_{tk.get('status', 'waiting')}"))
    text += "\n" + (t(c, "statusReply", name=helper[-1].get("name") or "", text=helper[-1]["text"]) if helper else t(c, "statusNoReply"))
    await reply(m, text)


async def do_toggle(m: Message, c: dict, field: str) -> None:
    c[field] = not c.get(field)
    save_state()
    on_key, off_key = {"voice": ("voiceOn", "voiceOff"), "simple": ("simpleOn", "simpleOff")}[field]
    await reply(m, t(c, on_key if c[field] else off_key))


async def do_mydata(m: Message, c: dict) -> None:
    try:
        server = await api.data(cid(m))
        alerts = await api.alerts(chat_id_of(m))
    except httpx.HTTPError:
        server, alerts = {"error": "server not reachable"}, []
    payload = {"chat_settings": {k: c.get(k) for k in ("lang", "lang_set", "consent", "simple", "voice")},
               "conversation_in_bot_memory": c.get("history", []), "alerts": alerts, "on_the_server": server}
    doc = BufferedInputFile(json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8"), filename="syly-my-data.json")
    await m.answer_document(doc, caption=t(c, "mydataText"))


async def ask_delete(m: Message, c: dict) -> None:
    await m.answer(t(c, "deleteConfirm"), reply_markup=ikb([[(t(c, "yes"), "del:yes"), (t(c, "no"), "del:no")]]))


async def do_delete(m: Message, c: dict, chat_key: str) -> None:
    try:
        await api.delete_data(f"tg-{chat_key}")
        await api.stop_all(chat_key)
    except httpx.HTTPError:
        await reply(m, t(c, "apiDown"))
        return
    lang = c.get("lang", "am")
    chats.pop(chat_key, None)
    save_state()
    await reply(m, t({"lang": lang}, "deleteDone"))


# interview support (FR-J4): job -> needs -> optional note -> confirm -> a person, never the employer
async def acc_start(m: Message, c: dict) -> None:
    try:
        open_jobs = [j for j in await api.jobs() if j.get("deadline", "") >= date.today().isoformat()]
    except httpx.HTTPError:
        await reply(m, t(c, "apiDown"))
        return
    if not open_jobs:
        await reply(m, t(c, "accNoJobs"))
        return
    c["acc"] = {"step": "job", "job": None, "title": "", "needs": [], "note": None}
    am = c["lang"] == "am"
    rows = [[(((j.get("title_am") if am else None) or j["title_en"])[:60], f"acc:job:{j['id']}"[:64])] for j in open_jobs]
    await m.answer(t(c, "accPickJob"), reply_markup=ikb(rows))


def acc_needs_keyboard(c: dict) -> InlineKeyboardMarkup:
    chosen = c["acc"]["needs"]
    return ikb([[(("✓ " if k in chosen else "") + t(c, f"need_{k}"), f"acc:need:{k}")] for k in NEEDS] + [[(t(c, "accDone"), "acc:done")]])


async def acc_confirm(m: Message, c: dict) -> None:
    a = c["acc"]
    a["step"] = "confirm"
    summary = t(c, "accConfirm", job=a["title"], needs=", ".join(t(c, f"need_{k}") for k in a["needs"]), note=a["note"] or t(c, "accNoNote"))
    await m.answer(summary, reply_markup=ikb([[(t(c, "yes"), "acc:send"), (t(c, "no"), "acc:cancel")]]))


async def _settings(m: Message, c: dict) -> None:
    await m.answer(t(c, "settingsTitle"), reply_markup=settings_keyboard(c))


async def _lang(m: Message, c: dict) -> None:
    await m.answer(t(c, "chooseLang"), reply_markup=lang_keyboard())


async def _ask_prompt(m: Message, c: dict) -> None:
    await reply(m, t(c, "askPrompt"))


INTENT_ACTIONS = {
    "start": do_start,
    "help": do_help,
    "lang": _lang,
    "lesson": do_lesson,
    "ask": _ask_prompt,
    "simple": lambda m, c: do_toggle(m, c, "simple"),
    "person": do_person,
    "status": do_status,
    "jobs": lambda m, c: do_jobs(m, c, ""),
    "myalerts": do_myalerts,
    "stop": do_stop,
    "accommodate": acc_start,
    "voice": lambda m, c: do_toggle(m, c, "voice"),
    "mydata": do_mydata,
    "delete": ask_delete,
    "settings": _settings,
}


# ------------------------------------------------------------------ handlers
dp = Dispatcher()


@dp.error()
async def on_error(event: ErrorEvent) -> bool:
    """Any handler error: log it for the team, tell the learner in words (never silence)."""
    log.exception("handler error: %s", type(event.exception).__name__, exc_info=event.exception)
    msg = event.update.message or (event.update.callback_query.message if event.update.callback_query else None)
    if msg is not None:
        try:
            await msg.answer(t(chats.get(str(msg.chat.id), {"lang": "am"}), "error"))
        except Exception:  # noqa: BLE001 - Telegram itself unreachable: nothing more we can do
            pass
    return True


@dp.message(CommandStart())
async def on_start(m: Message, command: CommandObject) -> None:
    c = chat(m)
    arg = (command.args or "").strip()
    if arg.startswith("t") and "_" in arg:  # deep link from the web panel: tutor replies here too
        ticket_id, _, tok = arg[1:].partition("_")
        try:
            if await api.link_ticket(ticket_id, chat_id_of(m), tok):
                await reply(m, t(c, "ticketLinked", id=ticket_id))
                return
        except httpx.HTTPError:
            pass
    if arg.startswith("alerts_"):
        await do_alerts(m, c, arg[len("alerts_"):].replace("_", " "))
        return
    await do_start(m, c)


@dp.message(Command("help"))
async def on_help(m: Message) -> None:
    await do_help(m, chat(m))


@dp.message(Command("lang"))
async def on_lang(m: Message) -> None:
    await _lang(m, chat(m))


@dp.message(Command("consent"))
async def on_consent(m: Message) -> None:
    c = chat(m)
    await m.answer(t(c, "consentAsk"), reply_markup=consent_keyboard(c))


@dp.message(Command("ask"))
async def on_ask(m: Message, command: CommandObject) -> None:
    c = chat(m)
    if (command.args or "").strip():
        await ask_api(m, c, command.args.strip())
    else:
        await _ask_prompt(m, c)


@dp.message(Command("jobs"))
async def on_jobs(m: Message, command: CommandObject) -> None:
    await do_jobs(m, chat(m), command.args or "")


@dp.message(Command("alerts"))
async def on_alerts(m: Message, command: CommandObject) -> None:
    await do_alerts(m, chat(m), command.args or "")


@dp.message(Command("lesson", "simple", "person", "status", "myalerts", "stop", "accommodate", "voice", "mydata", "delete"))
async def on_simple_command(m: Message, command: CommandObject) -> None:
    await INTENT_ACTIONS[command.command](m, chat(m))


@dp.callback_query()
async def on_callback(q: CallbackQuery) -> None:
    c = chat(q)
    data, m = q.data or "", q.message
    await q.answer()
    kind, _, rest = data.partition(":")
    if kind == "lang" and rest in TEXT:
        c["lang"], c["lang_set"] = rest, True
        save_state()
        await m.answer(t(c, "langSet"), reply_markup=main_menu(c))
        if c.get("consent") is None:
            await m.answer(t(c, "consentAsk"), reply_markup=consent_keyboard(c))
    elif kind == "consent":
        c["consent"] = "yes" if rest == "yes" else "no"
        save_state()
        await m.answer(t(c, "consentSaved"), reply_markup=main_menu(c))
    elif kind == "person":
        await do_person(m, c)
    elif kind == "sec":
        await send_section(m, c, rest)
    elif kind == "al":
        try:
            await api.stop_alert(int(rest))
            await m.answer(t(c, "alertStopped"))
        except (httpx.HTTPError, ValueError):
            await m.answer(t(c, "apiDown"))
    elif kind == "set":
        if rest in ("voice", "simple"):
            await do_toggle(m, c, rest)
        elif rest == "lang":
            await _lang(m, c)
        elif rest == "mydata":
            await do_mydata(m, c)
        elif rest == "delete":
            await ask_delete(m, c)
    elif kind == "del":
        if rest == "yes":
            await do_delete(m, c, chat_id_of(q))
        else:
            await m.answer(t(c, "deleteCancelled"))
    elif kind == "vc":  # voice command confirmation (§3.3)
        pending = c.pop("pending", None) or {}
        if rest == "yes" and pending.get("intent"):
            await INTENT_ACTIONS[pending["intent"]](m, c)
        elif pending.get("text"):
            await ask_api(m, c, pending["text"])
    elif kind == "acc" and c.get("acc"):
        await on_acc_callback(m, c, rest)


async def on_acc_callback(m: Message, c: dict, rest: str) -> None:
    a = c["acc"]
    step, _, value = rest.partition(":")
    if step == "job":
        try:
            job = next((j for j in await api.jobs() if j["id"] == value), None)
        except httpx.HTTPError:
            job = None
        if not job:
            await m.answer(t(c, "apiDown"))
            return
        a.update(step="needs", job=job["id"], title=(job.get("title_am") if c["lang"] == "am" else None) or job["title_en"])
        await m.answer(t(c, "accNeeds"), reply_markup=acc_needs_keyboard(c))
    elif step == "need" and value in NEEDS:
        a["needs"] = [k for k in NEEDS if (k in a["needs"]) != (k == value)]
        try:
            await m.edit_reply_markup(reply_markup=acc_needs_keyboard(c))
        except TelegramBadRequest:
            await m.answer(t(c, "accNeeds"), reply_markup=acc_needs_keyboard(c))
    elif step == "done":
        if not a["needs"]:
            await m.answer(t(c, "accChooseOne"), reply_markup=acc_needs_keyboard(c))
            return
        a["step"] = "note"
        await m.answer(t(c, "accNote"), reply_markup=ikb([[(t(c, "accSkip"), "acc:skip")]]))
    elif step == "skip":
        await acc_confirm(m, c)
    elif step == "send":
        try:
            await api.accommodate(a["job"], a["needs"], a["note"], chat_id_of(m), c["lang"])
            await m.answer(t(c, "accSent"))
        except httpx.HTTPError:
            await m.answer(t(c, "apiDown"))
        c.pop("acc", None)
    elif step == "cancel":
        c.pop("acc", None)
        await m.answer(t(c, "accCancelled"))


@dp.message(F.voice)
async def on_voice(m: Message, bot: Bot) -> None:
    c = chat(m)
    if c.get("consent") != "yes":  # §3.4: audio leaves only after consent
        await reply(m, t(c, "voiceNeedsConsent"))
        return
    if (m.voice.file_size or 0) > 20 * 1024 * 1024:
        await reply(m, t(c, "voiceTooLong"))
        return
    f = await bot.get_file(m.voice.file_id)
    audio = (await bot.download_file(f.file_path)).read()
    await handle_voice(m, c, audio)


async def handle_voice(m: Message, c: dict, audio: bytes) -> None:
    """Transcribe -> 'I heard' -> command (with confirmation when needed) or question (§3.3). Audio is not kept."""
    try:
        res = await api.transcribe(audio, c["lang"] if c.get("lang_set") else "auto")
    except httpx.HTTPError:
        res = {"text": "", "language": c["lang"], "engine": "none"}
    text = (res.get("text") or "").strip()
    lang = res.get("language") or c["lang"]
    if not text:
        msg = t(c, "voiceFailed") + ("\n" + t(c, "voiceBeta") if lang in BETA else "")
        await reply(m, msg, reply_markup=person_keyboard(c))
        return
    await reply(m, t(c, "voiceHeard", text=text))
    intent = intents.match(text)
    if intent in intents.CONFIRM_VOICE:
        c["pending"] = {"intent": intent, "text": text}
        await m.answer(t(c, "confirmIntent", command="/" + intent),
                       reply_markup=ikb([[(t(c, "yes"), "vc:yes")], [(t(c, "noQuestion"), "vc:no")]]))
    elif intent:
        await INTENT_ACTIONS[intent](m, c)
    else:
        await ask_api(m, c, text)


@dp.message(F.text)
async def on_text(m: Message) -> None:
    c = chat(m)
    if (c.get("acc") or {}).get("step") == "note":  # the optional note in the interview-support flow
        c["acc"]["note"] = m.text.strip()[:1000]
        await acc_confirm(m, c)
        return
    if c.get("consent") is None:
        c["consent"] = "no"  # answers from the course until the learner allows more
        await m.answer(t(c, "consentAsk"), reply_markup=consent_keyboard(c))
    intent = intents.match(m.text)
    if intent:
        await INTENT_ACTIONS[intent](m, c)
    else:
        await ask_api(m, c, m.text)


# ------------------------------------------------------------------ start-up
async def set_commands(bot: Bot) -> None:
    """setMyCommands once in English (no language_code), then once per other language with its descriptions."""
    await bot.set_my_commands([BotCommand(command=n, description=d) for n, d in commands.build("en", TEXT)])
    for lang in LANGS:
        if lang != "en" and lang in TEXT:
            await bot.set_my_commands([BotCommand(command=n, description=d) for n, d in commands.build(lang, TEXT)], language_code=lang)


async def main() -> None:
    """Long polling that survives networks where Telegram is blocked or drops: retry, never crash."""
    from aiogram.client.session.aiohttp import AiohttpSession
    from aiogram.exceptions import TelegramNetworkError

    load_state()
    register_menu_phrases()
    proxy = os.getenv("TELEGRAM_PROXY", "").strip()  # e.g. socks5://host:1080 where Telegram is blocked
    bot = Bot(token(), session=AiohttpSession(proxy=proxy) if proxy else None)
    wait = 5
    while True:
        try:
            me = await bot.get_me()
            log.info("bot @%s starting (long polling), API at %s", me.username, api.API)
            await set_commands(bot)
            wait = 5
            await dp.start_polling(bot, handle_signals=False)
            return
        except TelegramNetworkError as e:
            log.warning("cannot reach Telegram (%s). This network may block api.telegram.org: "
                        "use another network or set TELEGRAM_PROXY. Retrying in %s s.", e.message[:120], wait)
            await asyncio.sleep(wait)
            wait = min(wait * 2, 300)


if __name__ == "__main__":
    if not token():
        print("No TELEGRAM_BOT_TOKEN or BOT_TOKEN set; bot not started.")
        sys.exit(0)
    asyncio.run(main())
