"""OpenAI-style chat endpoint, shared by Groq (cloud) and Ollama (local)."""

from __future__ import annotations

import httpx

from config import settings


async def chat(base_url: str, model: str, system: str, user: str, key: str = "") -> str:
    headers = {"Authorization": f"Bearer {key}"} if key else {}
    body = {
        "model": model,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
    }
    async with httpx.AsyncClient(timeout=settings.provider_timeout) as client:
        r = await client.post(f"{base_url}/chat/completions", headers=headers, json=body)
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"] or ""
