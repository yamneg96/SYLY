"""Ollama on the host's own machine (PROVIDER=local, OLLAMA_URL). No container in Compose."""

from __future__ import annotations

from config import settings
from services.providers.openai_compat import chat

NAME = "ollama"


def available() -> bool:
    return bool(settings.ollama_url)


async def complete(system: str, user: str) -> str:
    return await chat(f"{settings.ollama_url}/v1", settings.ollama_model, system, user)
