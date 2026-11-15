"""Grounding guard (FR-T4, FR-T5, NFR-S6): the model may only cite sections it was given."""

from __future__ import annotations

import json
import re

_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def parse_model_json(raw: str) -> dict | None:
    text = _FENCE.sub("", (raw or "").strip())
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        data = json.loads(text[start : end + 1])
    except ValueError:
        return None
    return data if isinstance(data, dict) else None


def validate(raw: str, given: list[dict]) -> tuple[str, list[dict]] | None:
    """Map cited section numbers (1-based) to the given sections; drop anything else.

    Returns (answer, cited_sections) or None when the answer must not be shown.
    """
    data = parse_model_json(raw)
    if not data:
        return None
    answer = str(data.get("answer") or "").strip()
    if not answer or "NOT_FOUND" in answer.upper():
        return None
    cited: list[dict] = []
    for n in data.get("sections") or []:
        try:
            i = int(n)
        except (TypeError, ValueError):
            continue
        if 1 <= i <= len(given) and given[i - 1] not in cited:
            cited.append(given[i - 1])
    if not cited:  # FR-T5: an answer without a source is not shown
        return None
    return answer, cited
