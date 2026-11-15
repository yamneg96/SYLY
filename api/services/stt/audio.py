"""Audio conversion with ffmpeg (installed in the api Docker image). Without ffmpeg, audio passes through unchanged."""

from __future__ import annotations

import asyncio
import shutil

FFMPEG = shutil.which("ffmpeg")


async def _run(args: list[str], data: bytes) -> bytes | None:
    if not FFMPEG:
        return None
    proc = await asyncio.create_subprocess_exec(
        FFMPEG, "-hide_banner", "-loglevel", "error", *args,
        stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
    )
    out, _ = await asyncio.wait_for(proc.communicate(data), timeout=30)
    return out if proc.returncode == 0 and out else None


async def to_wav16k(data: bytes) -> bytes | None:
    """Any input (Telegram OGG/Opus, WebM, MP3) -> 16 kHz mono WAV, or None without ffmpeg."""
    return await _run(["-i", "pipe:0", "-ac", "1", "-ar", "16000", "-f", "wav", "pipe:1"], data)


async def to_ogg_opus(data: bytes) -> bytes | None:
    """MP3 -> OGG/Opus (what Telegram needs for a voice note), or None without ffmpeg."""
    return await _run(["-i", "pipe:0", "-c:a", "libopus", "-b:a", "32k", "-f", "ogg", "pipe:1"], data)
