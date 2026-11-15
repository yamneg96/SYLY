"""
SYLY Assistant - Bilingual Retrieval Engine
File: retrieval.py

Provides unified retrieval across course sections in both Amharic and English:
1. Script Detection: Ethiopic Unicode block (U+1200 to U+137F).
2. Ethiopic (Amharic) Retrieval:
   - Character 3-gram tokenization to handle Amharic agglutinative affixes (ለ-, በ-, -ን, etc.).
   - Dice coefficient overlap between query grams and section text/title/keywords.
   - Heavy keyword substring bonus.
3. English (Latin) Retrieval:
   - Standard word tokenization and stop-word removal.
   - BM25 scoring with 2x title multiplier.
4. Threshold Filtering:
   - Returns (top_section, score) if top_score >= threshold, else None.
"""

from __future__ import annotations
import math
import re
from typing import Any, Dict, List, Optional, Set, Tuple

# Common English stop words
ENGLISH_STOP_WORDS: Set[str] = {
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and',
    'any', 'are', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below',
    'between', 'both', 'but', 'by', 'can', 'could', 'did', 'do', 'does', 'doing',
    'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has',
    'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself',
    'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just',
    'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off',
    'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over',
    'own', 's', 'same', 'she', 'should', 'so', 'some', 'such', 't', 'than', 'that',
    'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these',
    'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very',
    'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom',
    'why', 'will', 'with', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves'
}


def is_ethiopic(text: str) -> bool:
    """Detects if text contains characters from the Ethiopic Unicode block (U+1200 - U+137F)."""
    return bool(re.search(r'[\u1200-\u137F]', text))


def extract_character_3grams(text: str) -> Set[str]:
    """
    Extracts character 3-grams from text.
    If the clean string has length < 3 but > 0, returns the string itself as a single gram.
    """
    # Keep alphanumeric and Ethiopic characters
    clean = re.sub(r'[^\w\u1200-\u137F]', '', text.lower())
    if not clean:
        return set()
    if len(clean) < 3:
        return {clean}
    return {clean[i:i + 3] for i in range(len(clean) - 2)}


def dice_coefficient(set_a: Set[str], set_b: Set[str]) -> float:
    """Computes the Sørensen-Dice coefficient between two sets of n-grams."""
    if not set_a or not set_b:
        return 0.0
    intersection = len(set_a & set_b)
    return (2.0 * intersection) / (len(set_a) + len(set_b))


def score_amharic(query: str, section: Dict[str, Any]) -> float:
    """
    Scores an Amharic query against a section using:
    - Character 3-gram Dice overlap on text, title, and keywords.
    - Heavy bonus when an exact Amharic keyword is a substring of any query word.
    """
    query_words = [w for w in re.split(r'[\s።፣፤፥፦!\?,.\-–—]+', query) if w]
    query_grams: Set[str] = set()
    for word in query_words:
        query_grams.update(extract_character_3grams(word))

    if not query_grams:
        return 0.0

    title_text = section.get('title_am', '')
    body_text = section.get('text_am', '')
    keywords_list = section.get('keywords_am', [])

    title_grams = extract_character_3grams(title_text)
    body_grams = extract_character_3grams(body_text)
    kw_grams = extract_character_3grams(' '.join(keywords_list))

    title_overlap = dice_coefficient(query_grams, title_grams)
    body_overlap = dice_coefficient(query_grams, body_grams)
    kw_overlap = dice_coefficient(query_grams, kw_grams)

    # Heavy bonus if an exact Amharic keyword is a substring of any query word
    keyword_bonus = 0.0
    for kw in keywords_list:
        clean_kw = kw.strip()
        if not clean_kw:
            continue
        # Exact keyword found in query string or inside a query word
        if clean_kw in query or any(clean_kw in word for word in query_words):
            keyword_bonus += 2.0

    # Weighted combination: 2x title multiplier, 1.5x keyword overlap, + exact keyword bonus
    final_score = (2.0 * title_overlap) + (1.0 * body_overlap) + (1.5 * kw_overlap) + keyword_bonus
    return final_score


def tokenize_english(text: str) -> List[str]:
    """Tokenizes English text into lowercase alphabetic terms, stripping stop words."""
    tokens = re.findall(r'\b[a-z0-9]+\b', text.lower())
    filtered = [t for t in tokens if t not in ENGLISH_STOP_WORDS]
    return filtered if filtered else tokens


def compute_bm25_scores(query: str, sections: List[Dict[str, Any]]) -> List[float]:
    """
    Computes BM25 scores for an English query across sections.
    Applies a 2x multiplier for term matches in titles.
    """
    query_terms = tokenize_english(query)
    if not query_terms:
        return [0.0] * len(sections)

    n_docs = len(sections)
    k1 = 1.5
    b = 0.75

    # Document token representations
    doc_title_tokens: List[List[str]] = []
    doc_body_tokens: List[List[str]] = []
    doc_kw_tokens: List[List[str]] = []
    doc_lengths: List[float] = []

    for sec in sections:
        t_tokens = tokenize_english(sec.get('title_en', ''))
        b_tokens = tokenize_english(sec.get('text_en', ''))
        kw_tokens = tokenize_english(' '.join(sec.get('keywords_en', [])))

        doc_title_tokens.append(t_tokens)
        doc_body_tokens.append(b_tokens)
        doc_kw_tokens.append(kw_tokens)

        # Title tokens have 2x weight in effective length
        effective_len = (2.0 * len(t_tokens)) + len(b_tokens) + (1.5 * len(kw_tokens))
        doc_lengths.append(effective_len)

    avg_dl = sum(doc_lengths) / n_docs if n_docs > 0 else 1.0

    # Calculate Document Frequency (DF) for each query term
    df: Dict[str, int] = {}
    for term in query_terms:
        df[term] = 0
        for i in range(n_docs):
            if (term in doc_title_tokens[i] or
                term in doc_body_tokens[i] or
                term in doc_kw_tokens[i]):
                df[term] += 1

    # Compute IDF and BM25 score per document
    scores: List[float] = [0.0] * n_docs
    for term in query_terms:
        term_df = df.get(term, 0)
        if term_df == 0:
            continue

        # Robertson-Spärck Jones / Lucene IDF formulation
        idf = math.log(1.0 + (n_docs - term_df + 0.5) / (term_df + 0.5))

        for i in range(n_docs):
            # Term frequency with 2x multiplier for title matches
            tf = (2.0 * doc_title_tokens[i].count(term) +
                  doc_body_tokens[i].count(term) +
                  1.5 * doc_kw_tokens[i].count(term))

            if tf <= 0:
                continue

            dl = doc_lengths[i]
            numerator = tf * (k1 + 1.0)
            denominator = tf + k1 * (1.0 - b + b * (dl / avg_dl))
            scores[i] += idf * (numerator / denominator)

    return scores


def retrieve(
    query: str,
    sections: List[Dict[str, Any]],
    threshold: float = 0.35
) -> Optional[Tuple[Dict[str, Any], float]]:
    """
    Retrieves the most relevant section for a query.

    Parameters:
        query: User question string (in Amharic or English).
        sections: List of section dicts containing bilingual content and keywords.
        threshold: Minimum score required for a valid match.

    Returns:
        Tuple of (best_matching_section, score) if score >= threshold, else None.
    """
    if not query or not query.strip() or not sections:
        return None

    query_str = query.strip()

    if is_ethiopic(query_str):
        # Amharic 3-gram Dice overlap + keyword substring bonus
        scored = [
            (sec, score_amharic(query_str, sec))
            for sec in sections
        ]
    else:
        # English tokenization + stop-word removal + BM25 with 2x title multiplier
        bm25_scores = compute_bm25_scores(query_str, sections)
        scored = list(zip(sections, bm25_scores))

    if not scored:
        return None

    best_section, best_score = max(scored, key=lambda item: item[1])

    if best_score < threshold:
        return None

    return best_section, best_score


if __name__ == '__main__':
    import json
    from pathlib import Path

    content_path = Path(__file__).parent / 'demo' / 'data' / 'content.json'
    if not content_path.exists():
        content_path = Path('demo/data/content.json')

    with open(content_path, 'r', encoding='utf-8') as f:
        lesson_sections = json.load(f)

    print("=== SYLY Bilingual Retrieval Engine Evaluation ===\n")

    test_queries = [
        # 1. Amharic query targeting AI section
        ("ስለ አርቴፊሻል ኢንተለጀንስ እና አውቶሜሽን ንገረኝ", 0.35, "artificial-intelligence-and-the-future-of-va-work"),
        # 2. English query targeting AI section
        ("How is artificial intelligence affecting the future of virtual assistant work?", 0.35, "artificial-intelligence-and-the-future-of-va-work"),
        # 3. Amharic query targeting client values section
        ("ደንበኞች ከቨርቹዋል ረዳቶች ምን ዓይነት ክህሎት እና አስተማማኝነት ይፈልጋሉ?", 0.35, "what-clients-are-likely-to-value-more-and-more"),
        # 4. English query targeting client values section
        ("What do clients value most in a virtual assistant?", 0.35, "what-clients-are-likely-to-value-more-and-more"),
        # 5. Out-of-scope question that should fail threshold and return None
        ("How do I bake traditional Ethiopian doro wat stew?", 0.35, None),
    ]

    all_passed = True
    for query, threshold, expected_id in test_queries:
        result = retrieve(query, lesson_sections, threshold=threshold)
        if result is None:
            matched_id = None
            score = 0.0
        else:
            matched_sec, score = result
            matched_id = matched_sec['id']

        status = "PASS" if matched_id == expected_id else "FAIL"
        if status == "FAIL":
            all_passed = False

        print(f"Query: '{query}'")
        print(f"  Ethiopic: {is_ethiopic(query)}")
        print(f"  Result ID: {matched_id} (Expected: {expected_id})")
        print(f"  Score: {score:.4f} (Threshold: {threshold})")
        print(f"  Status: [{status}]\n")

    print(f"Overall Result: {'ALL TESTS PASSED' if all_passed else 'SOME TESTS FAILED'}")
