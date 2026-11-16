"""Reading aloud, then listening back: does each language make a round trip? (text -> voice -> text)

    python scripts/voice_roundtrip.py              # all six languages
    python scripts/voice_roundtrip.py ar so ti     # some of them

For each language it takes the test sentences (scripts/stt_sentences.json), makes speech with the same code the
server uses for "Listen" (api/services/tts.py), sends that audio through the same speech-to-text router the
microphone and the Telegram bot use (api/services/stt/router.py), and prints what came back with a word accuracy.
Needs the keys in .env (Groq, Gemini; Addis AI for Oromo). Test sentences only: never learner audio.

Reading it: a language "works" when both halves work. Speech made by a machine voice is clean, so real phones score
lower; and a score near 0% for a language with no voice means the voice half is missing, not the listening half.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import sys
import tempfile
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SENTENCES = json.loads((ROOT / "scripts" / "stt_sentences.json").read_text(encoding="utf-8"))
LANGS = ["en", "am", "ar", "so", "ti", "om"]


def load_env() -> None:
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


def words(text: str) -> list[str]:
    return re.findall(r"[^\W_]+", unicodedata.normalize("NFC", text or "").lower())


def accuracy(expected: str, got: str) -> float:
    a, b = words(expected), words(got)
    if not a:
        return 0.0
    d = list(range(len(b) + 1))
    for i, wa in enumerate(a, 1):
        prev, d[0] = d[0], i
        for j, wb in enumerate(b, 1):
            prev, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prev + (wa != wb))
    return max(0.0, 1 - d[len(b)] / len(a))


async def main(langs: list[str]) -> int:
    os.environ["DATA_DIR"] = tempfile.mkdtemp(prefix="roundtrip-")
    load_env()
    sys.path.insert(0, str(ROOT / "api"))
    from services import tts
    from services.stt import router

    summary = []
    for lang in langs:
        print(f"\n{lang}  voice: {tts.VOICES.get(lang) or ('(Addis AI only)' if lang == 'om' else 'none')}")
        spoken, scores = 0, []
        for sentence in SENTENCES[lang]:
            path = await tts.synthesize(sentence, lang)
            if not path:
                print(f"  no voice: {sentence[:40]!r}")
                continue
            spoken += 1
            out = await router.transcribe(path.read_bytes(), "audio/mpeg", lang)
            acc = accuracy(sentence, out["text"])
            scores.append(acc)
            print(f"  {acc:4.0%}  {out['engine']:<6} said {sentence[:34]!r}  heard {out['text'][:40]!r}")
        mean = sum(scores) / len(scores) if scores else None
        summary.append((lang, spoken, len(SENTENCES[lang]), mean))
    print("\nSummary (sentences spoken / total, mean word accuracy after the round trip)")
    for lang, spoken, total, mean in summary:
        print(f"  {lang}: voice {spoken}/{total}" + (f", round trip {mean:.0%}" if mean is not None else ", NO VOICE: reading aloud is not available for this language"))
    return 0


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:] or LANGS))
