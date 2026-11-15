"""
SYLY Assistant - Guardrail & Citation Parser
File: api/services/guard.py

Processes LLM output to:
1. Detect NOT_FOUND and medical/legal/immigration refusals.
2. Extract [Section X] citations and map them back to original retrieved sections.
3. Validate and filter citations, dropping out-of-bounds hallucinations.
4. Enforce source citation requirement (suppress ungrounded answers).
"""

from __future__ import annotations
import re
from typing import Any, Dict, List, Optional, Set


def process_llm_response(
    raw_text: str,
    original_sections: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Validates and parses raw text from the LLM.

    Parameters:
        raw_text: Raw string response from LLM provider.
        original_sections: The exact list of section dicts provided to the LLM.

    Returns:
        Dict: {"text": str | None, "sources": [{"title": str, "url": str}]}
    """
    if not raw_text or not raw_text.strip():
        return {"text": None, "sources": []}

    cleaned_text = raw_text.strip()

    # 1. If raw_text contains 'NOT_FOUND' or indicates a refusal
    if "NOT_FOUND" in cleaned_text:
        return {"text": None, "sources": []}

    refusal_keywords = [
        "medical advice",
        "legal advice",
        "immigration advice",
        "consult a doctor",
        "consult a lawyer",
        "consult an attorney"
    ]
    lower_text = cleaned_text.lower()
    if any(phrase in lower_text for phrase in refusal_keywords):
        return {"text": None, "sources": []}

    # 2. Use regex to find all [Section X] citations in the text
    citation_pattern = r'\[Section\s*(\d+)\]'
    matches = re.findall(citation_pattern, cleaned_text, re.IGNORECASE)

    # 3 & 4. Map matched numbers back to original_sections and drop invalid ones
    sources: List[Dict[str, str]] = []
    seen_indices: Set[int] = set()

    for m in matches:
        sec_num = int(m)
        # Check if corresponding to a valid section provided in prompt (1-based index)
        if 1 <= sec_num <= len(original_sections):
            if sec_num not in seen_indices:
                seen_indices.add(sec_num)
                sec = original_sections[sec_num - 1]
                title = sec.get("title_en") or sec.get("title_am") or sec.get("title", f"Section {sec_num}")
                url = sec.get("url") or f"#{sec.get('id', '')}"
                sources.append({"title": title, "url": url})

    # If no valid sources could be verified, do not show ungrounded response
    if not sources:
        return {"text": None, "sources": []}

    # 5. Return cleaned text and verified sources
    return {
        "text": cleaned_text,
        "sources": sources
    }
