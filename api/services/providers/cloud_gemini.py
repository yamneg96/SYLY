"""
SYLY Assistant - Gemini Cloud LLM Provider
File: api/services/providers/cloud_gemini.py

Uses the official google-genai SDK to call Gemini Flash with strict system instructions,
source citation requirements, and guardrail instructions against hallucinations
and medical/legal/immigration queries.
"""

from __future__ import annotations
import logging
import os
from typing import Any, Dict, List
from google import genai
from google.genai import types

logger = logging.getLogger("syly.gemini")


async def answer(question: str, sections: List[Dict[str, Any]], language: str) -> str:
    """
    Calls the Gemini Flash model with numbered course sections.

    Parameters:
        question: The learner's question.
        sections: List of section dicts retrieved for the question.
        language: Requested answer language code (e.g., 'en', 'am').

    Returns:
        Raw string output from the LLM, or 'NOT_FOUND'.
    """
    if not sections:
        return "NOT_FOUND"

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.warning("GEMINI_API_KEY environment variable is not configured.")
        return "NOT_FOUND"

    # 3. Format the sections array into a numbered string to pass to the model
    formatted_sections: List[str] = []
    for idx, sec in enumerate(sections, 1):
        title_en = sec.get("title_en") or sec.get("title", "")
        title_am = sec.get("title_am", "")
        text_en = sec.get("text_en") or sec.get("text", "")
        text_am = sec.get("text_am", "")
        kw_en = ", ".join(sec.get("keywords_en") or [])
        kw_am = ", ".join(sec.get("keywords_am") or [])

        formatted_sections.append(
            f"[Section {idx}]\n"
            f"Title (EN): {title_en}\n"
            f"Title (AM): {title_am}\n"
            f"Content (EN): {text_en}\n"
            f"Content (AM): {text_am}\n"
            f"Keywords: {kw_en} | {kw_am}\n"
        )

    sections_str = "\n".join(formatted_sections)

    # 2. Strict system prompt
    system_instruction = (
        "You are a helpful, empathetic tutor helping a learner understand their lesson.\n"
        f"You must answer the question strictly and solely using the provided numbered sections.\n"
        f"You must answer in the '{language}' language requested.\n"
        "Cite the section used by writing '[Section X]' at the end of the relevant sentence.\n"
        "If the answer cannot be completely derived from the provided sections, reply exactly with the string 'NOT_FOUND'.\n"
        "Do not invent information or cite sections that do not exist.\n"
        "Absolutely refuse to give medical, legal, or immigration advice, and instead advise them to speak to a person."
    )

    user_content = (
        f"Numbered Sections:\n{sections_str}\n\n"
        f"Learner Question: {question}\n"
        f"Requested Language: {language}\n"
        "Answer:"
    )

    try:
        client = genai.Client(api_key=api_key)
        model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.2,
        )

        response = await client.aio.models.generate_content(
            model=model_name,
            contents=user_content,
            config=config,
        )

        return (response.text or "").strip()
    except Exception as exc:
        logger.error("Error invoking Gemini model (%s): %s", os.getenv("GEMINI_MODEL", "gemini-2.5-flash"), exc)
        return "NOT_FOUND"
