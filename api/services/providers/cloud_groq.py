"""Groq-hosted open model: fallback for Gemini (FR-A2)."""

from __future__ import annotations

from config import settings
from services.providers.openai_compat import chat

NAME = "groq"


def available() -> bool:
    return bool(settings.groq_key)


async def complete(system: str, user: str) -> str:
    return await chat("https://api.groq.com/openai/v1", settings.groq_model, system, user, settings.groq_key)
