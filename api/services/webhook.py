"""
SYLY Assistant - Ticket Webhook Service
File: api/services/webhook.py

Provides fire-and-forget async webhook notifications when tickets are opened.
"""

from __future__ import annotations
import logging
from typing import Optional
import httpx

logger = logging.getLogger("syly.webhook")


async def fire_ticket_webhook(
    ticket_id: str,
    page_url: Optional[str],
    webhook_url: Optional[str]
) -> None:
    """
    Sends an asynchronous HTTP POST notification when an escalation ticket is opened.

    Parameters:
        ticket_id: The UUID string of the created escalation ticket.
        page_url: Host page URL where the learner requested escalation.
        webhook_url: Target URL registered by the host to receive ticket events.
    """
    if not webhook_url or not webhook_url.strip():
        logger.debug("No webhook URL provided; skipping webhook dispatch.")
        return

    target_url = webhook_url.strip()
    payload = {
        "event": "ticket.opened",
        "ticketId": ticket_id,
        "page_url": page_url or ""
    }

    try:
        # Fire-and-forget: 5.0s timeout, no retry, non-blocking
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(target_url, json=payload)
            logger.info("Fired ticket.opened webhook to %s (Status: %d)", target_url, resp.status_code)
    except Exception as exc:
        logger.warning(
            "Fire-and-forget webhook notification failed for ticket '%s' to '%s': %s",
            ticket_id,
            target_url,
            exc
        )
