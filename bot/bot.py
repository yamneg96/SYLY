"""SYLY Telegram bot (FR-CH1, FR-J3): getUpdates long polling, no public URL needed.

Every answer comes from the same API as the web panel (/api/v1/ask), with source links.
Text -> /ask. Voice note -> /voice/transcribe -> /ask (needs consent). Amharic answers also
get a voice reply from /voice/speak (needs consent). /help opens a ticket; tutor replies
arrive here. /alerts <word> [place], /stop, /lang, /consent.
"""

from __future__ import annotations

import html
import json
import logging
import os
import re
import sys
from pathlib import Path

import httpx
from aiogram import Bot, Dispatcher, F
from aiogram.exceptions import TelegramBadRequest
from aiogram.filters import Command, CommandObject, CommandStart
from aiogram.types import BufferedInputFile, ErrorEvent, CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message

logging.basicConfig(level=logging.INFO, format="%(levelname)s bot: %(message)s")
log = logging.getLogger("bot")

API = os.getenv("API_URL", "http://localhost:8000").rstrip("/")
PUBLIC = os.getenv("PUBLIC_BASE_URL", "http://localhost:8080").rstrip("/")
STATE_FILE = Path(os.getenv("BOT_STATE", "/app/state/chats.json"))
LIMIT = 4000
LANGS = {"am": "አማርኛ", "en": "English", "ar": "العربية"}
TEXT = {lang: json.loads((Path(__file__).parent / "i18n" / f"{lang}.json").read_text(encoding="utf-8")) for lang in LANGS}


def token() -> str:
    return (os.getenv("TELEGRAM_BOT_TOKEN") or os.getenv("BOT_TOKEN") or "").strip()


# Per chat: language, consent, last few lines (for /help). Only what is needed.
chats: dict[str, dict] = {}


def load_state() -> None:
    try:
        chats.update(json.loads(STATE_FILE.read_text(encoding="utf-8")))
    except (OSError, ValueError):
        pass


def save_state() -> None:
    try:
        STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        slim = {k: {"lang": v.get("lang", "am"), "consent": v.get("consent")} for k, v in chats.items()}
        STATE_FILE.write_text(json.dumps(slim), encoding="utf-8")
    except OSError:
        pass


def chat(m: Message | CallbackQuery) -> dict:
    cid = str(m.chat.id if isinstance(m, Message) else m.message.chat.id)
    return chats.setdefault(cid, {"lang": "am", "consent": None, "history": []})


def t(c: dict, key: str, **kw: object) -> str:
    s = TEXT.get(c.get("lang", "am"), TEXT["en"]).get(key) or TEXT["en"][key]
    return s.format(**kw) if kw else s


_PIECES = re.compile(r"[^.?!።\n]+(?:[.?!።]+|\n+|$)")  # sentences and lines, delimiter kept (idea from Lemi's bot)


def split(text: str, limit: int = LIMIT) -> list[str]:
    """Split under Telegram's limit at sentence ends (። . ? !) or new lines; words, then characters, only if needed."""
    parts, cur = [], ""
    for piece in _PIECES.findall(text) or [text]:
        while len(piece) > limit:  # one very long sentence: cut at a space if possible
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
    """Answer with tappable source titles (TalkBack reads "<title>, link" instead of a long URL).
    Falls back to plain text with the URLs if Telegram refuses the HTML (idea from Lemi's bot)."""
    body_parts = split(plain_body, LIMIT - 600)
    tail_html = f"\n\n<b>{html.escape(heading)}:</b>\n" + "\n".join(
        f'• <a href="{html.escape(url, quote=True)}">{html.escape(title)}</a>' for title, url in links)
    tail_plain = f"\n\n{heading}:\n" + "\n".join(f"{title}\n{url}" for title, url in links)
    for i, part in enumerate(body_parts):
        last = i == len(body_parts) - 1
        try:
            await m.answer(html.escape(part) + (tail_html if last else ""), parse_mode="HTML", disable_web_page_preview=True)
        except TelegramBadRequest:
            log.warning("Telegram refused the HTML message; sending plain text")
            await m.answer(part + (tail_plain if last else ""), disable_web_page_preview=True)


def remember(c: dict, role: str, text: str) -> None:
    c.setdefault("history", []).append({"role": role, "text": text[:1000], "lang": c.get("lang")})
    c["history"] = c["history"][-10:]


def consent_keyboard(c: dict) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=t(c, "consentYes"), callback_data="consent:yes")],
        [InlineKeyboardButton(text=t(c, "consentNo"), callback_data="consent:no")],
    ])


async def ask_api(m: Message, c: dict, question: str) -> None:
    remember(c, "learner", question)
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(f"{API}/api/v1/ask", json={
                "question": question, "language": c["lang"], "allow_ai": c.get("consent") == "yes",
                "conversation_id": f"tg-{m.chat.id}",
            })
            r.raise_for_status()
            res = r.json()
    except httpx.HTTPError:
        await reply(m, t(c, "apiDown"))
        return
    if not res.get("answer"):
        await reply(m, t(c, "noAdvice" if res.get("reason") == "no_advice" else "notFound"))
        return
    links = [(s["title"], f"{PUBLIC}{s['url']}" if s["url"].startswith("/") else s["url"]) for s in res["sources"]]
    remember(c, "assistant", res["answer"])
    await reply_html(m, res["answer"], links, t(c, "source"))
    if res.get("language") == "am" and c.get("consent") == "yes":
        await voice_reply(m, res["answer"])


async def voice_reply(m: Message, text: str) -> None:
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(f"{API}/api/v1/voice/speak", json={"text": text[:3000], "language": "am"})
        if r.status_code == 200:
            await m.answer_audio(BufferedInputFile(r.content, filename="answer.mp3"))
    except httpx.HTTPError:
        pass  # text answer already sent; voice is extra


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
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.post(f"{API}/api/v1/escalations/{ticket_id}/telegram", params={"chat_id": str(m.chat.id), "token": tok})
            if r.status_code == 204:
                await reply(m, t(c, "ticketLinked", id=ticket_id))
                return
        except httpx.HTTPError:
            pass
    if arg.startswith("alerts_"):
        await subscribe(m, c, arg[len("alerts_"):].replace("_", " "), "")
        return
    await reply(m, t(c, "start"))
    await m.answer(t(c, "chooseLang"), reply_markup=lang_keyboard())


def lang_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text=v, callback_data=f"lang:{k}") for k, v in LANGS.items()]])


@dp.message(Command("lang"))
async def on_lang(m: Message) -> None:
    await m.answer(t(chat(m), "chooseLang"), reply_markup=lang_keyboard())


@dp.message(Command("consent"))
async def on_consent(m: Message) -> None:
    c = chat(m)
    await m.answer(t(c, "consentAsk"), reply_markup=consent_keyboard(c))


@dp.callback_query(F.data.startswith("lang:"))
async def on_lang_pick(q: CallbackQuery) -> None:
    c = chat(q)
    c["lang"] = q.data.split(":", 1)[1] if q.data.split(":", 1)[1] in LANGS else "am"
    save_state()
    await q.answer()
    await q.message.answer(t(c, "langSet"))
    if c.get("consent") is None:
        await q.message.answer(t(c, "consentAsk"), reply_markup=consent_keyboard(c))


@dp.callback_query(F.data.startswith("consent:"))
async def on_consent_pick(q: CallbackQuery) -> None:
    c = chat(q)
    c["consent"] = "yes" if q.data.endswith("yes") else "no"
    save_state()
    await q.answer()
    await q.message.answer(t(c, "consentSaved"))


@dp.message(Command("help"))
async def on_help(m: Message) -> None:
    c = chat(m)
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(f"{API}/api/v1/escalations", json={
                "conversation": c.get("history", []), "language": c["lang"], "channel": "telegram",
                "notify_telegram_chat": str(m.chat.id), "conversation_id": f"tg-{m.chat.id}",
            })
            r.raise_for_status()
            res = r.json()
    except httpx.HTTPError:
        await reply(m, t(c, "apiDown"))
        return
    await reply(m, t(c, "helpOnline" if res.get("helper_online") else "helpLater", id=res["ticketId"]))


async def subscribe(m: Message, c: dict, keyword: str, location: str) -> None:
    if not keyword.strip():
        await reply(m, t(c, "alertsUsage"))
        return
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(f"{API}/api/v1/alerts", json={
                "channel": "telegram", "address": str(m.chat.id), "keyword": keyword.strip(), "location": location, "language": c["lang"],
            })
            r.raise_for_status()
    except httpx.HTTPError:
        await reply(m, t(c, "apiDown"))
        return
    await reply(m, t(c, "alertsOn", keyword=keyword.strip()))


@dp.message(Command("alerts"))
async def on_alerts(m: Message, command: CommandObject) -> None:
    c = chat(m)
    words = (command.args or "").split()
    # "/alerts accountant Addis Ababa": first word is the keyword, the rest the place.
    await subscribe(m, c, words[0] if words else "", " ".join(words[1:]))


@dp.message(Command("stop"))
async def on_stop(m: Message) -> None:
    c = chat(m)
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.delete(f"{API}/api/v1/alerts", params={"channel": "telegram", "address": str(m.chat.id)})
    except httpx.HTTPError:
        await reply(m, t(c, "apiDown"))
        return
    await reply(m, t(c, "stopped"))


@dp.message(F.voice)
async def on_voice(m: Message, bot: Bot) -> None:
    c = chat(m)
    if c.get("consent") != "yes":
        await reply(m, t(c, "voiceNeedsConsent"))
        return
    f = await bot.get_file(m.voice.file_id)
    data = await bot.download_file(f.file_path)
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(f"{API}/api/v1/voice/transcribe", data={"language": c["lang"]},
                                  files={"file": ("voice.ogg", data.read(), "audio/ogg")})
        text = r.json().get("text", "").strip() if r.status_code == 200 else ""
    except httpx.HTTPError:
        text = ""
    if not text:
        await reply(m, t(c, "voiceFailed"))
        return
    await reply(m, t(c, "voiceHeard", text=text))  # show what was heard (recognition makes mistakes)
    await ask_api(m, c, text)


@dp.message(F.text)
async def on_text(m: Message) -> None:
    c = chat(m)
    if c.get("consent") is None:
        c["consent"] = "no"  # answers from the course until the learner allows more
        await m.answer(t(c, "consentAsk"), reply_markup=consent_keyboard(c))
    await ask_api(m, c, m.text)


async def main() -> None:
    """Long polling that survives networks where Telegram is blocked or drops: retry, never crash."""
    import asyncio

    from aiogram.client.session.aiohttp import AiohttpSession
    from aiogram.exceptions import TelegramNetworkError

    load_state()
    proxy = os.getenv("TELEGRAM_PROXY", "").strip()  # e.g. socks5://host:1080 where Telegram is blocked
    bot = Bot(token(), session=AiohttpSession(proxy=proxy) if proxy else None)
    wait = 5
    while True:
        try:
            me = await bot.get_me()
            log.info("bot @%s starting (long polling), API at %s", me.username, API)
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
    import asyncio

    asyncio.run(main())
