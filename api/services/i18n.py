"""Server-side strings (SMS, Telegram, job notes) live in api/i18n/*.json."""

from __future__ import annotations

import json
from functools import cache
from pathlib import Path

DIR = Path(__file__).resolve().parents[1] / "i18n"
LANGS = ("en", "am", "ar")


@cache
def _dict(lang: str) -> dict[str, str]:
    path = DIR / f"{lang}.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def t(key: str, lang: str = "en", **kw: object) -> str:
    text = _dict(lang).get(key) or _dict("en").get(key) or key
    return text.format(**kw) if kw else text
