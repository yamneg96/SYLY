"""Ethiopian phone numbers: accept 09…, 07…, +251…, 251…; store +251… (FR-CH3)."""

from __future__ import annotations

import re


def normalize(raw: str) -> str | None:
    digits = re.sub(r"[\s\-().]", "", raw or "")
    if digits.startswith("+"):
        digits = digits[1:]
    if re.fullmatch(r"0[79]\d{8}", digits):
        return "+251" + digits[1:]
    if re.fullmatch(r"251[79]\d{8}", digits):
        return "+" + digits
    if re.fullmatch(r"[79]\d{8}", digits):
        return "+251" + digits
    return None
