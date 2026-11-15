"""Slash commands and their menu descriptions per language (bot-voice-commands.md §2).

Telegram rules: command names are 1-32 characters of lowercase English letters, digits and underscores
(at most 100 commands); descriptions are 1-256 characters. Names stay English in every language; only the
descriptions are translated (setMyCommands with language_code).
"""

from __future__ import annotations

import re

COMMANDS = [
    "start", "help", "ask", "lesson", "person", "status", "jobs", "alerts", "myalerts", "stop",
    "accommodate", "lang", "simple", "voice", "consent", "mydata", "delete",
]
NAME_RE = re.compile(r"^[a-z0-9_]{1,32}$")


def build(lang: str, text: dict[str, dict[str, str]]) -> list[tuple[str, str]]:
    """[(command, description)] for one language; missing descriptions fall back to English."""
    out = []
    for name in COMMANDS:
        desc = (text.get(lang, {}).get(f"cmd_{name}") or text["en"][f"cmd_{name}"]).strip()
        out.append((name, desc[:256]))
    return out


def valid(payload: list[tuple[str, str]]) -> bool:
    return len(payload) <= 100 and all(NAME_RE.match(n) and 1 <= len(d) <= 256 for n, d in payload)
