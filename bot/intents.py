"""Understanding commands in any language, typed or spoken (bot-voice-commands.md §3).

Rules: a message starting with "/" is a slash command (handled by aiogram). Otherwise normalise; only short
messages (5 words or fewer, 40 characters or fewer) can be commands; exact phrase match wins; else a fuzzy
character 3-gram Dice match (same helper idea as SDS §1.5) above THRESHOLD, and only when one intent clearly
wins (best minus second >= MARGIN). Anything else is a question.
"""

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

THRESHOLD = 0.6
MARGIN = 0.1
MAX_WORDS, MAX_CHARS = 5, 40
# Voice-triggered intents that must be confirmed ("Yes" / "No, it was a question"), §3.3.
CONFIRM_VOICE = {"delete", "stop"}

_PHRASES: dict[str, list[str]] = {}  # intent -> normalised phrases (all languages)


def _ethiopic_fold(text: str) -> str:
    """Fold Amharic homophone letter series so spelling variants match (ሠ→ሰ, ሐ/ኀ→ሀ, ዐ→አ, ፀ→ጸ)."""
    out = []
    for ch in text:
        o = ord(ch)
        for start, target in ((0x1220, 0x1230), (0x1210, 0x1200), (0x1280, 0x1200), (0x12D0, 0x12A0), (0x1340, 0x1338)):
            if start <= o < start + 8:
                ch = chr(target + (o - start))
                break
        out.append(ch)
    return "".join(out)


def normalise(text: str) -> str:
    """Lowercase, NFC, Ethiopic folding; strip punctuation, emoji and Ethiopic punctuation; keep letters/digits."""
    t = _ethiopic_fold(unicodedata.normalize("NFC", text or "").lower())
    t = re.sub(r"[^\w\s]|_", " ", t)  # Ethiopic letters are \w; ፡ ። ፣ ? ! and emoji are not
    return " ".join(t.split())


def is_short(text: str) -> bool:
    n = normalise(text)
    return bool(n) and len(n.split()) <= MAX_WORDS and len(n) <= MAX_CHARS


def _grams(text: str) -> set[str]:
    g: set[str] = set()
    for w in text.split():
        g.update([w] if len(w) < 3 else (w[i : i + 3] for i in range(len(w) - 2)))
    return g


def dice(a: str, b: str) -> float:
    ga, gb = _grams(a), _grams(b)
    return 2 * len(ga & gb) / (len(ga) + len(gb)) if ga and gb else 0.0


def load(path: Path | None = None) -> dict[str, list[str]]:
    data = json.loads((path or Path(__file__).with_name("intents.json")).read_text(encoding="utf-8"))
    _PHRASES.clear()
    for intent, per_lang in data.items():
        if intent.startswith("_"):
            continue
        for phrases in per_lang.values():
            add_phrases(intent, phrases)
    return _PHRASES


def add_phrases(intent: str, phrases: list[str]) -> None:
    """Also used for keyboard button labels, so a tapped button is recognised in every language."""
    bucket = _PHRASES.setdefault(intent, [])
    for p in phrases:
        n = normalise(p)
        if n and n not in bucket:
            bucket.append(n)


def match(text: str) -> str | None:
    """The intent of a short message, or None (= treat it as a question)."""
    if not _PHRASES:
        load()
    if not text or text.strip().startswith("/") or not is_short(text):
        return None
    n = normalise(text)
    exact = [i for i, ps in _PHRASES.items() if n in ps]
    if len(exact) == 1:
        return exact[0]
    if len(exact) > 1:
        return None  # the same phrase in two intents: ambiguous, so it is a question
    scores = sorted(((max(dice(n, p) for p in ps), i) for i, ps in _PHRASES.items() if ps), reverse=True)
    if not scores or scores[0][0] < THRESHOLD:
        return None
    second = scores[1][0] if len(scores) > 1 else 0.0
    return scores[0][1] if scores[0][0] - second >= MARGIN else None
