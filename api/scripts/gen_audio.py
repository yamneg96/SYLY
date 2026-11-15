"""Pre-generate Amharic audio for offline "Listen" (FR-T8, SDS 2.4).

    pip install edge-tts
    python api/scripts/gen_audio.py            # writes module/audio/

Creates, with the am-ET-MekdesNeural voice:
  module/audio/sections/<section-id>/title.am.mp3   the section title, read as "From the section ..."
  module/audio/sections/<section-id>/<n>.am.mp3     sentence n of text_am (same split as the module)
  module/audio/phrases/<key>.am.mp3                 fixed phrases from module/i18n/am.json

[unverified] edge-tts uses Microsoft's online read-aloud service; check its terms before production.
The Amharic text is a DRAFT that needs a native reader check: regenerate after corrections.
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "api"))

from services.retrieval import split_sentences  # noqa: E402

VOICE = "am-ET-MekdesNeural"
OUT = ROOT / "module" / "audio"
PHRASES = ["notFound", "notFoundOffer", "noAdvice", "escalatedOnline", "escalatedLater", "queued", "escalateQueued"]


async def say(text: str, path: Path, force: bool) -> bool:
    import edge_tts

    if path.exists() and path.stat().st_size > 0 and not force:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(3):
        try:
            await edge_tts.Communicate(text, VOICE).save(str(path))
            return True
        except Exception as e:  # noqa: BLE001 - the service sometimes drops a request
            last = e
            await asyncio.sleep(1 + attempt)
    path.unlink(missing_ok=True)
    print(f"FAILED {path.relative_to(ROOT)}: {type(last).__name__}: {text[:60]}")
    return False


async def main(force: bool = False) -> None:
    content = json.loads((ROOT / "demo/data/content.json").read_text(encoding="utf-8"))
    am = json.loads((ROOT / "module/i18n/am.json").read_text(encoding="utf-8"))
    jobs = []
    for sec in content["sections"]:
        d = OUT / "sections" / sec["id"]
        jobs.append((am["fromSection"].replace("{title}", sec["title_am"]), d / "title.am.mp3"))
        for i, sentence in enumerate(split_sentences(sec["text_am"])):
            jobs.append((sentence, d / f"{i}.am.mp3"))
    for key in PHRASES:
        jobs.append((am[key], OUT / "phrases" / f"{key}.am.mp3"))
    made = 0
    for text, path in jobs:
        made += await say(text, path, force)
    size = sum(p.stat().st_size for p in OUT.rglob("*.mp3"))
    print(f"{made} new files, {len(jobs)} total, {size / 1024:.0f} KB in {OUT}")


if __name__ == "__main__":
    asyncio.run(main(force="--force" in sys.argv))
