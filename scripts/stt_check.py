"""Measure speech-to-text quality per language (bot-voice-commands.md §5).

    python scripts/stt_check.py --make-clips am en      # synthetic test clips with edge-tts (no learner audio)
    python scripts/stt_check.py am en so ar             # transcribe every clip through the router and score it

Clips live in data/stt-clips/<lang>/NN.<ext> with the expected sentence in NN.txt (data/ is git-ignored).
The team can add real self-recorded clips the same way (e.g. 06.ogg + 06.txt). Never use learner audio.
Synthetic clips are clean studio speech, so real phones will score lower: treat these numbers as an upper bound.
Calls the engines directly (needs the keys in .env); prints engine, transcript and word accuracy per clip.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CLIPS = ROOT / "data" / "stt-clips"
SENTENCES = json.loads((Path(__file__).with_name("stt_sentences.json")).read_text(encoding="utf-8"))
MIME = {".wav": "audio/wav", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".webm": "audio/webm", ".m4a": "audio/mp4"}


def load_env() -> None:
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


def words(text: str) -> list[str]:
    t = unicodedata.normalize("NFC", text or "").lower()
    return re.findall(r"[^\W_]+", t)


def accuracy(expected: str, got: str) -> float:
    """1 - word error rate (Levenshtein over words), floored at 0."""
    a, b = words(expected), words(got)
    if not a:
        return 0.0
    d = list(range(len(b) + 1))
    for i, wa in enumerate(a, 1):
        prev, d[0] = d[0], i
        for j, wb in enumerate(b, 1):
            prev, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prev + (wa != wb))
    return max(0.0, 1 - d[len(b)] / len(a))


async def make_clips(langs: list[str]) -> None:
    sys.path.insert(0, str(ROOT / "api"))
    from services.tts import VOICES  # noqa: PLC0415
    import edge_tts  # noqa: PLC0415

    for lang in langs:
        if lang not in VOICES:
            print(f"{lang}: no edge-tts voice, record clips yourself (NN.ogg + NN.txt) in {CLIPS / lang}")
            continue
        out = CLIPS / lang
        out.mkdir(parents=True, exist_ok=True)
        for i, sentence in enumerate(SENTENCES[lang], 1):
            mp3 = out / f"{i:02d}.mp3"
            if not mp3.exists():
                await edge_tts.Communicate(sentence, VOICES[lang]).save(str(mp3))
            (out / f"{i:02d}.txt").write_text(sentence, encoding="utf-8")
        print(f"{lang}: {len(SENTENCES[lang])} synthetic clips in {out}")


async def check(langs: list[str]) -> None:
    sys.path.insert(0, str(ROOT / "api"))
    os.environ.setdefault("DATA_DIR", str(ROOT / "data"))
    from services.stt import router  # noqa: PLC0415

    for lang in langs:
        folder = CLIPS / lang
        clips = sorted(p for p in folder.glob("*") if p.suffix in MIME) if folder.exists() else []
        if not clips:
            print(f"\n{lang}: no clips in {folder}")
            continue
        print(f"\n{lang} (engine order: {' -> '.join(router.ORDER[lang])})")
        scores, engines = [], {}
        for clip in clips:
            expected = clip.with_suffix(".txt").read_text(encoding="utf-8").strip() if clip.with_suffix(".txt").exists() else ""
            out = await router.transcribe(clip.read_bytes(), MIME[clip.suffix], lang)
            acc = accuracy(expected, out["text"])
            scores.append(acc)
            engines[out["engine"]] = engines.get(out["engine"], 0) + 1
            print(f"  {clip.name}: {out['engine']:<6} acc={acc:4.0%}  heard: {out['text'][:70]!r}  tried: {','.join(out['tried'])}")
        print(f"  => mean word accuracy {sum(scores) / len(scores):.0%}; answered by {engines}")


if __name__ == "__main__":
    load_env()
    args = sys.argv[1:]
    if args and args[0] == "--make-clips":
        asyncio.run(make_clips(args[1:] or ["am", "en"]))
    else:
        asyncio.run(check(args or ["am", "en"]))
