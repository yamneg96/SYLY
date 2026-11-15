"""
SYLY Assistant - Telegram Bot
File: bot/main.py

Features:
- Built with aiogram 3.x using long polling (getUpdates).
- /start: Explains bot capabilities in English & Amharic.
- /help: Sends POST request to local /api/v1/escalations to open a ticket,
         and replies strictly with: "A tutor will answer here."
- Text handler: Forwards questions to local /api/v1/ask, formats answers with
                sources into clean HTML, and safely splits long replies at
                sentence boundaries (<= 4096 chars).
"""

from __future__ import annotations
import asyncio
import html
import logging
import os
import re
from typing import Any, Dict, List, Optional

import httpx
from aiogram import Bot, Dispatcher, F
from aiogram.enums import ParseMode
from aiogram.filters import Command, CommandStart
from aiogram.types import Message

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("syly-telegram-bot")

# Configuration
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
API_BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
MAX_TELEGRAM_MESSAGE_LENGTH = 4096

# Regex for Ethiopic script detection (Unicode block U+1200 to U+137F)
ETHIOPIC_REGEX = re.compile(r"[\u1200-\u137F]")


def split_long_message(text: str, max_chars: int = MAX_TELEGRAM_MESSAGE_LENGTH) -> List[str]:
    """
    Safely splits a text into chunks that do not exceed max_chars (4096 for Telegram),
    breaking preferentially at sentence boundaries (newlines, Ethiopic '።', periods, etc.).
    Falls back to word boundaries or character slicing if a single sentence exceeds max_chars.
    """
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]

    # Pattern splitting at sentence endings while preserving the delimiter
    # Matches: paragraph breaks, newlines, Ethiopic full stop '።', '.', '!', '?'
    sentence_pattern = re.compile(r'([^.?!።\n]+(?:[.?!።]+|\n+|$))')
    raw_sentences = sentence_pattern.findall(text)
    if not raw_sentences:
        raw_sentences = [text]

    chunks: List[str] = []
    current_chunk = ""

    for s in raw_sentences:
        if not s:
            continue

        # If a single sentence by itself exceeds max_chars, split it on words or characters
        if len(s) > max_chars:
            # First flush what we have so far
            if current_chunk:
                chunks.append(current_chunk)
                current_chunk = ""

            # Split oversized sentence by words
            words = s.split(" ")
            temp_part = ""
            for w in words:
                word_with_space = (w + " ") if temp_part else w
                if len(temp_part) + len(word_with_space) <= max_chars:
                    temp_part += word_with_space
                else:
                    if temp_part:
                        chunks.append(temp_part.rstrip())
                    # If even an individual word exceeds max_chars, hard-slice it
                    if len(w) > max_chars:
                        for i in range(0, len(w), max_chars):
                            chunks.append(w[i:i + max_chars])
                        temp_part = ""
                    else:
                        temp_part = w + " "
            if temp_part:
                chunks.append(temp_part.rstrip())
            continue

        # Check if adding this sentence exceeds chunk budget
        if len(current_chunk) + len(s) <= max_chars:
            current_chunk += s
        else:
            if current_chunk:
                chunks.append(current_chunk)
            current_chunk = s

    if current_chunk:
        chunks.append(current_chunk)

    return chunks


def format_api_response(data: Dict[str, Any], query_lang: str = "en") -> str:
    """
    Formats the /api/v1/ask JSON response into a clean, Telegram-friendly HTML string
    including the answer and clickable citation sources.
    """
    answer = data.get("text") or data.get("answer")
    sources = data.get("sources") or []

    if not answer:
        if query_lang == "am":
            return (
                "ለዚህ ጥያቄ በቂ መረጃ በትምህርቱ ውስጥ አላገኘሁም። "
                "የአስተማሪ እርዳታ ለማግኘት /help ብለው ይላኩ።"
            )
        return (
            "I could not find matching information in the course materials. "
            "To speak with a human tutor, please send /help."
        )

    # Basic markdown bold conversion to HTML <b> tags for Telegram compatibility
    formatted_answer = html.escape(answer)
    formatted_answer = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", formatted_answer)
    formatted_answer = re.sub(r"\*(.+?)\*", r"<i>\1</i>", formatted_answer)

    # Append citation source links if present
    if sources:
        source_header = "<b>📚 ምንጮች / Sources:</b>" if query_lang == "am" else "<b>📚 Sources:</b>"
        source_items = []
        for s in sources:
            title = s.get("title") or "Lesson Section"
            url = s.get("url") or "#"
            safe_title = html.escape(str(title))
            safe_url = html.escape(str(url))
            source_items.append(f'• <a href="{safe_url}">{safe_title}</a>')

        sources_block = f"\n\n{source_header}\n" + "\n".join(source_items)
        return formatted_answer + sources_block

    return formatted_answer


# Initialize aiogram Dispatcher
dp = Dispatcher()


@dp.message(CommandStart())
async def handle_start(message: Message) -> None:
    """Welcomes the user and explains available features."""
    welcome_text = (
        "👋 <b>Welcome to SYLY Assistant! / እንኳን ወደ SYLY በደህና መጡ!</b>\n\n"
        "I am your learning assistant for Virtual Assistant (VA) training.\n"
        "• Send any question in English or Amharic to get lesson-backed answers.\n"
        "• Send /help at any time to connect directly with a human tutor.\n\n"
        "የቨርቹዋል ረዳትነት (VA) ትምህርት ጥያቄዎችዎን በአማርኛ ወይም በእንግሊዝኛ መጠየቅ ይችላሉ። "
        "የአስተማሪ እርዳታ ሲፈልጉ /help ይላኩ።"
    )
    await message.answer(welcome_text, parse_mode=ParseMode.HTML)


@dp.message(Command("help"))
async def handle_help(message: Message) -> None:
    """
    Escalates to human tutor:
    Sends a POST request to local /api/v1/escalations endpoint,
    and replies strictly with 'A tutor will answer here.'
    """
    user = message.from_user
    user_desc = f"Telegram User {user.id}" if user else "Unknown Telegram User"
    if user and user.username:
        user_desc += f" (@{user.username})"

    payload = {
        "conversation": [
            {
                "role": "user",
                "text": f"/help requested via Telegram by {user_desc}"
            }
        ],
        "page_url": f"tg://user?id={user.id}" if user else "telegram://unknown",
        "section": "telegram_help"
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(f"{API_BASE_URL}/api/v1/escalations", json=payload)
            if resp.status_code in (200, 201):
                logger.info("Successfully opened escalation ticket: %s", resp.text)
            else:
                logger.warning("Escalations endpoint returned status %s: %s", resp.status_code, resp.text)
    except Exception as exc:
        logger.error("Failed to connect to escalations API: %s", exc)

    # Strictly reply with required message
    await message.answer("A tutor will answer here.")


@dp.message(F.text)
async def handle_text_message(message: Message) -> None:
    """
    Forwards user's question to the /api/v1/ask endpoint, formats answer,
    and replies safely within the 4096 character limit.
    """
    query = message.text.strip()
    if not query:
        return

    # Language detection
    is_am = bool(ETHIOPIC_REGEX.search(query))
    lang = "am" if is_am else "en"

    payload = {
        "question": query,
        "language": lang
    }

    answer_html = ""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(f"{API_BASE_URL}/api/v1/ask", json=payload)
            if resp.status_code == 200:
                data = resp.json()
                answer_html = format_api_response(data, query_lang=lang)
            else:
                logger.error("Ask API returned error status %s: %s", resp.status_code, resp.text)
                answer_html = (
                    "ስርዓቱ ጥያቄዎን ማስተናገድ አልቻለም። እባክዎ ጥቂት ቆይተው እንደገና ይሞክሩ ወይም /help ይጠቀሙ።"
                    if is_am else
                    "Unable to process question at this time. Please try again or use /help."
                )
    except Exception as exc:
        logger.error("Failed to connect to Ask API: %s", exc)
        answer_html = (
            "የግንኙነት ችግር አጋጥሟል። እባክዎ /help በመጠቀም አስተማሪ ያነጋግሩ።"
            if is_am else
            "Network connection error to assistant service. Please send /help for a tutor."
        )

    # Split message into chunks <= 4096 characters
    chunks = split_long_message(answer_html, max_chars=MAX_TELEGRAM_MESSAGE_LENGTH)
    for chunk in chunks:
        try:
            await message.answer(
                chunk,
                parse_mode=ParseMode.HTML,
                disable_web_page_preview=True
            )
        except Exception as send_err:
            logger.warning("HTML parsing failed in Telegram send (%s); falling back to plain text", send_err)
            # Safe fallback without HTML formatting
            plain_chunk = re.sub(r"<[^>]+>", "", chunk)
            await message.answer(plain_chunk, disable_web_page_preview=True)


async def main() -> None:
    """Starts the bot with long polling."""
    if not TELEGRAM_BOT_TOKEN:
        logger.warning(
            "TELEGRAM_BOT_TOKEN environment variable is not set. "
            "Please provide a valid token to connect to Telegram."
        )
        return

    bot = Bot(token=TELEGRAM_BOT_TOKEN)
    logger.info("Starting Telegram Bot long polling (getUpdates)...")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
