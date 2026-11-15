"""Text-route replies: plain text, at most 160 characters (FR-CH2).

160 characters is the reply limit we promise. Amharic needs Unicode SMS
(70 characters per segment), so a full Amharic reply is up to 3 segments.
"""

from __future__ import annotations

LIMIT = 160


def fit(text: str, tail: str = "", limit: int = LIMIT) -> str:
    """Shorten text so text + tail fits in limit, cutting at a word and adding an ellipsis."""
    text = " ".join(text.split())
    tail = (" " + tail.strip()) if tail.strip() else ""
    room = limit - len(tail)
    if len(text) > room:
        cut = text[: max(0, room - 1)]
        if " " in cut:
            cut = cut[: cut.rfind(" ")]
        text = cut.rstrip(" ,;:፣።") + "…"
    return (text + tail)[:limit]


def segments(text: str) -> int:
    """GSM-7 for plain ASCII (160/153), otherwise UCS-2 (70/67)."""
    unicode = any(ord(c) > 127 for c in text)
    single, multi = (70, 67) if unicode else (160, 153)
    n = len(text)
    return 1 if n <= single else -(-n // multi)
