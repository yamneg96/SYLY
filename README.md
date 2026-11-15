# SYLY Assistant (`<db-assistant>`)

> Multilingual Tutor, Live Help, and Career Gateway for Accessible Learning (Digital Bridge Accessibility Hackathon — Track 3)

SYLY Assistant is a drop-in, zero-dependency Web Component plugin (`<db-assistant>`) accompanied by a lightweight FastAPI backend and Telegram bot. It delivers high-accessibility AI tutoring, bilingual (Amharic/English) semantic retrieval, human-in-the-loop escalation, and career accommodation assistance designed specifically for learners using assistive tech (NVDA, TalkBack) on low-resource devices and networks.

---

## Documentation

Project specifications and design documents are maintained in the [`docs/`](file:///home/imel/intern/alx-hackathon/SYLY/docs) folder:

- [SRS.md (Software Requirements Specification)](file:///home/imel/intern/alx-hackathon/SYLY/docs/SRS.md) — Product scope, core gate task, detailed functional/non-functional requirements, WCAG 2.2 AA accessibility mandates, and acceptance criteria.
- [SDS.md (Software Design Specification)](file:///home/imel/intern/alx-hackathon/SYLY/docs/SDS.md) — Technical architecture, Web Component Shadow DOM design, dual-mode layout (panel/inline), bilingual 3-gram retrieval algorithm, FastAPI server, provider fallback pipeline, offline audio/TTS, and SQLite data schema.
- [docs/README.md](file:///home/imel/intern/alx-hackathon/SYLY/docs/README.md) — Documentation index and summaries.

---

## Branches

- `main`: Baseline production branch.
- `prototype-1`: Active prototype development branch.
