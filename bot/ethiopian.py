"""Gregorian to Ethiopian calendar (NFR-E3) for job deadlines in the bot. Pure Python, no dependencies."""

from __future__ import annotations

from datetime import date

MONTHS_AM = ["መስከረም", "ጥቅምት", "ኅዳር", "ታኅሣሥ", "ጥር", "የካቲት", "መጋቢት", "ሚያዝያ", "ግንቦት", "ሰኔ", "ሐምሌ", "ነሐሴ", "ጳጉሜን"]
_EPOCH = 1723856  # Julian Day Number offset of the Ethiopian era (Amete Mihret), counted in 4-year cycles


def to_ethiopian(d: date) -> tuple[int, int, int]:
    """(year, month 1-13, day)."""
    jdn = d.toordinal() + 1721425  # proleptic Gregorian ordinal -> Julian Day Number
    r = (jdn - _EPOCH) % 1461
    n = r % 365 + 365 * (r // 1460)
    year = 4 * ((jdn - _EPOCH) // 1461) + r // 365 - r // 1460
    return year, n // 30 + 1, n % 30 + 1


def format_am(iso: str) -> str:
    """'2026-11-23' -> 'ኅዳር 14 ቀን 2019 ዓ.ም.'"""
    y, m, dd = to_ethiopian(date.fromisoformat(iso))
    return f"{MONTHS_AM[m - 1]} {dd} ቀን {y} ዓ.ም."
