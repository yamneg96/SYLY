"""One webhook (FR-AD2, SDS 2.5): fire-and-forget POST on ticket.opened."""

from __future__ import annotations

import logging

import httpx
from sqlalchemy import select

from db import SessionLocal
from models import Webhook

log = logging.getLogger("syly")


async def fire(event: str, payload: dict) -> int:
    with SessionLocal() as db:
        urls = [w.url for w in db.scalars(select(Webhook)).all() if event in (w.events or [])]
    sent = 0
    async with httpx.AsyncClient(timeout=5) as client:
        for url in urls:
            try:
                r = await client.post(url, json={"event": event, **payload})
                sent += 1
                log.info("webhook %s -> %s %s", event, url, r.status_code)
            except httpx.HTTPError as e:
                log.warning("webhook %s -> %s failed: %s", event, url, type(e).__name__)
    return sent
