# SYLY Documentation

This directory contains the formal requirements and design specifications for the **SYLY Assistant** (`<db-assistant>`) project.

## Document Index

- [SRS.md](file:///home/imel/intern/alx-hackathon/SYLY/docs/SRS.md) — **Software Requirements Specification (Version 2.1)**
  - Problem Statement, Gate Task, and User Personas
  - Host Contract & Web Component Functional Requirements (FR-L1–FR-L10)
  - Pedagogical AI Tutor & Bilingual Retrieval Requirements (FR-T1–FR-T11)
  - Pluggable AI / Fallback Architecture (FR-A1–FR-A4)
  - Accessible Chat UX, Real Dialog, Screen-reader & TalkBack behavior (FR-C1–FR-C6)
  - Human Escalation / Help Desk & Screen Sharing (FR-H1–FR-H5)
  - Multi-channel Integrations: Telegram Bot & SMS Gateway (FR-CH1–FR-CH3)
  - Career Gateway, Job Board & Interview Accommodations (FR-J1–FR-J5)
  - Non-Functional Requirements: WCAG 2.2 AA, axe-core clean, Ethiopian localization, privacy & zero-setup Docker Compose (NFR-*)

- [SDS.md](file:///home/imel/intern/alx-hackathon/SYLY/docs/SDS.md) — **Software Design Specification (Version 2.1)**
  - Web Component Architectural Specification (`module/db-assistant.js`, Shadow DOM, Custom Events, zero-build delivery)
  - Dual Layout System: Modal/Slide Panel Mode vs Embedded Inline Mode
  - Accessibility Implementation: Screen Reader Focus Traps, Skip Links, Focus-Safe Citation Links
  - Client-Side & Server-Side Bilingual Retrieval (Amharic Character 3-Gram Dice Overlap + English Token BM25)
  - Backend Architecture (`api/` FastAPI, SQLite + SQLAlchemy 2, Fernet encryption with persisted key)
  - Provider Integration Pipeline: Cloud (Gemini Flash / Groq) -> Local (Ollama) -> None (pure retrieval) with Server-side Guard
  - Multi-tiered TTS Strategy: Pre-generated offline audio -> Edge-TTS (`am-ET-MekdesNeural`) -> Browser SpeechSynthesis
  - Telegram Bot (`bot/` aiogram 3) & Webhook Event Emitters
