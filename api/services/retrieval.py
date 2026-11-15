"""Bilingual keyword retrieval: same algorithm as module/db-assistant.js (SDS 1.5).

English: BM25 over title x2 + text + keywords x3, light stemming.
Amharic: IDF-weighted character 3-gram containment + keyword substring bonus.
"""

from __future__ import annotations

import math
import re
import unicodedata
from dataclasses import dataclass
from typing import Any

EN_STOP = set(
    (
        "a an and are as at be been but by can could did do does for from had has have how i if in "
        "into is it its me my of on or our so that the their them then there these they this to too us was we were what "
        "when where which who why will with would you your about more most than also just not no yes any some much many "
        "should shall may might must going get gets"
    ).split()
)
AM_STOP = set(
    (
        "ነው ናቸው ነበር ምን ምንድን ምንድነው ምንድናቸው እንዴት ለምን የት መቼ ማን ይህ ያ እነዚህ እና ወይም ግን ላይ ውስጥ "
        "ጋር ስለ አለ አለበት አሉ ይሆናል ነገር እኔ እርስዎ እኛ"
    ).split()
)
NO_ADVICE = re.compile(
    r"\b(visa|immigration|asylum|refugee status|lawyer|lawsuit|legal advice|court|medicine|medical|doctor|"
    r"diagnos\w*|prescription|symptom\w*)\b|ቪዛ|ኢሚግሬሽን|ስደተኛ ፈቃድ|ጠበቃ|ፍርድ ቤት|ሐኪም|ሀኪም|መድኃኒት|መድሃኒት|ሕክምና|ህክምና|"
    r"تأشيرة|هجرة|لجوء|محام|محكمة|طبيب|دواء|علاج",
    re.IGNORECASE,
)
_WORD = re.compile(r"[^\W_]+", re.UNICODE)
_ETH = re.compile(r"[ሀ-፿]")
_LAT = re.compile(r"[A-Za-z]")
_ARABIC = re.compile(r"[؀-ۿ]")
_LATIN_WORD = re.compile(r"^[a-z0-9]+$")
_SENT = re.compile(r"(?<=[.!?።])\s+")
_STEM = re.compile(r"(ies|es|s|ed|ing|ly|e)$")


def ethiopic_share(s: str) -> float:
    eth = len(_ETH.findall(s))
    lat = len(_LAT.findall(s))
    return eth / (eth + lat) if eth + lat else 0.0


def detect_lang(s: str, fallback: str = "en") -> str:
    if _ARABIC.search(s):
        return "ar"
    if ethiopic_share(s) >= 0.5:
        return "am"
    return "en" if _LAT.search(s) else fallback


def words_of(s: Any) -> list[str]:
    return _WORD.findall(unicodedata.normalize("NFC", str(s or "")).lower())


def stem(w: str) -> str:
    return w if len(w) <= 4 else _STEM.sub("", w, count=1)


def tokens_en(s: Any) -> list[str]:
    return [stem(w) for w in words_of(s) if len(w) > 1 and w not in EN_STOP]


def words_am(s: Any) -> list[str]:
    return [w for w in words_of(s) if w not in AM_STOP]


def grams(w: str) -> list[str]:
    if len(w) < 3:
        return [w]
    return [w[i : i + 3] for i in range(len(w) - 2)]


def split_sentences(text: Any) -> list[str]:
    return [p for p in _SENT.split(re.sub(r"\s+", " ", str(text or "")).strip()) if p]


@dataclass
class Hit:
    section: dict
    score: float


@dataclass
class Result:
    lang: str
    ranked: list[Hit]
    found: bool

    @property
    def best(self) -> Hit | None:
        return self.ranked[0] if self.ranked else None


class Index:
    def __init__(self, sections: list[dict], threshold_en: float = 1.5, threshold_am: float = 0.35) -> None:
        self.sections = sections
        self.threshold = {"en": threshold_en, "am": threshold_am}
        self.en = [
            tokens_en(s.get("title_en")) * 2
            + tokens_en(s.get("text_en"))
            + tokens_en(" ".join(s.get("keywords_en") or [])) * 3
            for s in sections
        ]
        self.avg = sum(len(d) for d in self.en) / max(1, len(self.en))
        self.df: dict[str, int] = {}
        for doc in self.en:
            for t in set(doc):
                self.df[t] = self.df.get(t, 0) + 1
        self.am: list[set[str]] = []
        for s in sections:
            g: set[str] = set()
            for w in words_am(s.get("title_am")) + words_am(s.get("text_am")) + words_am(" ".join(s.get("keywords_am") or [])):
                g.update(grams(w))
            self.am.append(g)
        self.gdf: dict[str, int] = {}
        for g in self.am:
            for x in g:
                self.gdf[x] = self.gdf.get(x, 0) + 1

    def score_en(self, q: str) -> list[float]:
        n, k1, b = len(self.sections), 1.2, 0.75
        terms = list(dict.fromkeys(tokens_en(q)))
        out = []
        for doc in self.en:
            tf: dict[str, int] = {}
            for t in doc:
                tf[t] = tf.get(t, 0) + 1
            total = 0.0
            for t in terms:
                if not tf.get(t):
                    continue
                df = self.df.get(t, 0)
                idf = math.log(1 + (n - df + 0.5) / (df + 0.5))
                total += idf * (tf[t] * (k1 + 1)) / (tf[t] + k1 * (1 - b + b * len(doc) / self.avg))
            out.append(total)
        return out

    def score_am(self, q: str) -> list[float]:
        n = len(self.sections)
        qg: list[str] = []
        for w in words_am(q):
            if _ETH.search(w):
                for x in grams(w):
                    if x not in qg:
                        qg.append(x)
        latin = {w for w in words_of(q) if _LATIN_WORD.match(w)}
        ql = q.lower()
        weights = {x: math.log(1 + n / (self.gdf.get(x, 0) or 0.5)) for x in qg}
        total = sum(weights.values())
        out = []
        for i, g in enumerate(self.am):
            hit = sum(weights[x] for x in qg if x in g)
            score = hit / total if total else 0.0
            bonus = 0.0
            for k in self.sections[i].get("keywords_am") or []:
                k = str(k).lower()
                if len(k) >= 2 and ((k in latin) if _LATIN_WORD.match(k) else (k in ql)):
                    bonus += 0.15
            out.append(score + min(bonus, 0.45))
        return out

    def search(self, q: str) -> Result:
        lang = "am" if ethiopic_share(q) >= 0.5 else "en"
        scores = self.score_am(q) if lang == "am" else self.score_en(q)
        ranked = sorted((Hit(s, scores[i]) for i, s in enumerate(self.sections)), key=lambda h: -h.score)
        found = bool(ranked) and ranked[0].score >= self.threshold[lang]
        return Result(lang=lang, ranked=ranked, found=found)

    def excerpt(self, q: str, section: dict, lang: str, n: int) -> str:
        parts = split_sentences(section.get(f"text_{lang}") or section.get("text_en"))
        return " ".join(parts[i] for i in self.excerpt_indices(q, section, lang, n))

    def excerpt_indices(self, q: str, section: dict, lang: str, n: int) -> list[int]:
        """Indices of the n best-matching sentences, in page order (pre-generated audio uses them)."""
        parts = split_sentences(section.get(f"text_{lang}") or section.get("text_en"))
        if lang == "am":
            qg = {x for w in words_am(q) for x in grams(w)}
            scores = [float(len(qg & {x for w in words_am(p) for x in grams(w)})) for p in parts]
        else:
            terms = set(tokens_en(q))
            big_n = len(self.sections)
            scores = [
                sum(math.log(1 + (big_n + 0.5) / (self.df.get(t, 0) + 0.5)) for t in dict.fromkeys(tokens_en(p)) if t in terms)
                for p in parts
            ]
        scores = [sc * 0.3 if len(words_of(parts[i])) < 5 else sc for i, sc in enumerate(scores)]
        order = sorted((i for i in range(len(parts)) if scores[i] > 0), key=lambda i: (-scores[i], i))[:n]
        return sorted(order) or list(range(min(n, len(parts))))
