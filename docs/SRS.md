# SYLY Assistant: Software Requirements Specification (SRS)

| Item | Value |
| --- | --- |
| Product | `<db-assistant>`: multilingual tutor, live help and career gateway (Track 3) |
| Team | SYLY: Lemi, Saron, Yabets, Yamlak + co-designer |
| Event | Digital Bridge Accessibility Hackathon, ALX Tech Hub, Lideta, 14 to 15 Nov 2026 |
| Version | 2.1, Sun 15 Nov 2026, 00:30 EAT. Aligned with the ALX **Team Technical Guide v2** (14 Nov) and Lemi's SRS/SDS audit |
| Submit by | Sun 15 Nov 2026, 16:30: code, README, Docker Compose, CONFORMANCE.md |

Sources: opening presentation (14 Nov), Team Technical Guide v2 (14 Nov), digitalbridge.et, SYLY research report v1, live checks of Savanna, eHub, GeezJobs and Afriwork (14 Nov). Unverified items are marked **[unverified]**. Where this document and the Technical Guide disagree, **the guide wins**.

---

## 1. The main task (the sentence the gate tests)

> **A blind learner who thinks in Amharic, using TalkBack on a low-cost Android phone, asks a question about the lesson page, hears and reads an answer that links to the lesson section it came from, and reaches a person with one button, with nobody helping.**

The team confirms or rewrites this sentence with the co-designer before coding further. **Co-designer not assigned yet (14 Nov 15:10):** ask the mentor or registration desk; until then test with keyboard only, TalkBack with eyes closed, and sound off. It must also work with keyboard only, NVDA, 200% zoom and sound off.

## 2. Purpose and scope

### 2.1 Problem

21 October co-design session: most of 40+ participants could not finish registering, following a lesson, getting help and applying for a job; help was English-only and job boards broke under a screen reader. Track 3: "learners get stuck in English, with no tutor in their language and no one to see their screen."

### 2.2 Product: a module, not an app

`<db-assistant>` is one web component that a host adds with one script tag and one element. A small FastAPI server (shipped in Docker Compose) adds Levels 2 and 3. Doors:

1. **Web panel** on all three Savanna starter pages and on a blank page (Level 1).
2. **REST API** `/api/v1/...` with `openapi.yaml` and Swagger UI at `/docs` (Level 2).
3. **Telegram bot** (long polling, same `answer()` function).
4. **Text route** `POST /sms/inbound` returning plain text of at most 160 characters (no SMS gateway at the hackathon; shown with curl).
5. **schema.org/JobPosting** JSON-LD on the demo jobs page (Level 3).

### 2.3 Out of scope

LTI 1.3 (README gets an honest "how LTI would connect" section), Open Badges, live SMS gateway, live job-board data, fine-tuning.

### 2.4 Definitions

| Term | Meaning |
| --- | --- |
| Host | The page that installs the module (the Savanna starter, a blank page, any other site) |
| Section | A part of the lesson split by its heading anchor; the unit we cite |
| Provider | `cloud`, `local` (Ollama) or `none` (keyword search only) behind one `answer()` function |
| Ticket | A "Talk to a person" escalation with the conversation so far |
| Gate | Co-designer completes the main task unaided with NVDA, TalkBack, keyboard only, 200% zoom, sound off; axe-core zero critical and zero serious; WCAG 2.2 AA conformance report |

## 3. Users and context

| User | Needs |
| --- | --- |
| Blind / low-vision learner | Announced messages (`role="log"`), keyboard and screen reader, readable at 200% zoom |
| Deaf / hard-of-hearing learner | Everything works with sound off; every spoken reply also shown as text |
| Learner with a physical disability | 44 px targets (minimum 24), no drag, no time-outs |
| Learner who thinks in Amharic, Tigrinya, Afaan Oromo, Somali or Arabic | Complete Amharic; Arabic right-to-left; adding a language = one JSON file |
| Refugee / low-literacy learner | Simple mode, no ID, minimal data |
| Learner on a low-cost Android phone on 3G or offline | Light script, offline keyword search, queued messages |
| Helper / tutor | A simple page listing waiting learners, transcript, reply |
| Teacher | Anonymous top questions |
| Host engineer / judge | Installs from README in under one hour |
| Job seeker | Job answers, alerts by Telegram and text route, interview-accommodation request to a person |

### 3.1 Facts about the host

- The starter (`github.com/alx-africa/Savanna-static-pages`) is three frozen pages: `homepage-v1-paced.html`, `homepage-v1-self-paced.html`, `concept-with-navigation.html`. No server, no login, no API; links inert; about 1.5 MB of Bootstrap 5 CSS.
- **Course content is in the starter.** The lesson on the concept page has section anchors we cite: `#what-is-shaping-the-future-of-va-work`, `#artificial-intelligence-and-the-future-of-va-work`, `#what-clients-are-likely-to-value-more-and-more`, `#what-this-means-for-aspiring-virtual-assistants`, `#so-is-the-future-of-va-promising`.
- Starter defects we must not copy: menu button is a `<div>` with a click handler, course switcher the same, no skip link, some image alt text is a file name.
- Live Savanna already loads a third-party support chat (seen as "Chidi" / "Ask LEA", `trinketsofcody.com/cody-widget.js`) focused on login, payment and enrolment, not lesson content.
- Mic, camera, screen share and service workers need HTTPS or localhost: phones use a tunnel (cloudflared or ngrok).

### 3.2 Facts about job platforms

Six of seven checked platforms route users to Telegram; GeezJobs pages carry JobPosting JSON-LD; Afriwork posts include Amharic and some posts state gender or age preferences; no platform checked offered an interview-accommodation request; fake job posts have been reported on Ethiopian portals.

## 4. Functional requirements

Priority: **M** must, **S** should (extra points), **C** could.

### 4.1 Install and host contract (Level 1)

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-L1 | Host adds `<script src=".../module/db-assistant.js" defer></script>` and `<db-assistant lang="am" api="..." content="/content.json"></db-assistant>`; nothing else. | M |
| FR-L2 | Configured only by attributes: `lang`, `api`, `content`, `theme`, `mode`, `position`. Host never edits our JS. | M |
| FR-L10 | Two layouts: `mode="panel"` (default): a launcher pill on the right edge opens a full-height right side panel with answers above a ChatGPT-style input (text, mic, send); `mode="inline"`: an ask box the host places inside its content, answers shown below it. | M (panel) / S (inline) |
| FR-L3 | Emits `db-assistant:question {text, language}` and `db-assistant:escalated {ticketId}` with `bubbles: true, composed: true`. | M |
| FR-L4 | Works and looks right on all three starter pages (before `</body>`) and on `demo/blank.html` with no Bootstrap. | M |
| FR-L5 | Shadow root; reads `--bs-primary`, `--bs-body-font-family`, `--bs-body-color` with fallbacks; no globals, no changes to `window`, `document.body` or host elements; never edits host files. | M |
| FR-L6 | Launcher fixed to the right edge (vertically centred, left in RTL) and must not cover the page's own controls at 200% zoom. The launcher is hidden while the panel is open; the panel is modal (full screen) below 900 px CSS width, which includes a 1280 px laptop at 200% zoom. | M |
| FR-L8 | Keyboard and screen-reader users reach the assistant on the first Tab: a separate patch file adds a "Skip to assistant / ወደ ረዳቱ ይዝለሉ" link at the top of the three starter pages (guide §12, listed in README). The element exposes `open()` so any host can wire its own help link. | M |
| FR-L9 | `module/db-assistant.js` is one zero-dependency vanilla JS file with no build step, and carries the en/am/ar dictionaries inline as a fallback when `module/i18n/*.json` cannot be fetched. | M |
| FR-L7 | Under 500 KB on first load (target under 100 KB, excluding optional audio files); one script file. | M |

### 4.2 Tutor

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-T1 | Learner asks by text in Amharic or English. | M |
| FR-T2 | **No-AI search first:** split the lesson by headings, score sections against the question, show the best section with its link. This is offline mode and the fallback when no AI is configured. Because the lesson is in English and learners ask in Amharic, `content.json` holds each section in **English and Amharic** (title, text, keywords; Amharic reader-checked), and Amharic queries are matched with character 3-grams so prefixes and suffixes do not block a match. | M |
| FR-T3 | With a provider configured, send the model only the retrieved sections and instruct it to answer only from them, in the learner's language. | M |
| FR-T4 | If nothing scores above the threshold, do **not** call the model; say "I could not find this in the course" (in the learner's language) and offer a person. | M |
| FR-T5 | Every answer links to the section(s) it came from. An answer without a source link is not shown. Activating a source link scrolls to the section on the host page **and moves focus to its heading**, so screen-reader users land there. | M |
| FR-T6 | The assistant gives no medical, legal or immigration advice; it points to a person. | M |
| FR-T7 | Voice: microphone button (browser speech recognition, `am-ET` / `en-US`; MediaRecorder voice note as fallback; server STT optional). The recognised text is shown and editable before sending. | M |
| FR-T8 | Every spoken reply is also text; every text reply has a "Listen" button that **speaks Amharic on a phone with no Amharic system voice**: pre-generated audio for the 5 section summaries and fixed phrases (works offline), and server TTS (`edge-tts`, `am-ET-MekdesNeural`, **[unverified]** terms) for other answers; browser `speechSynthesis` only when the phone has the voice. | M |
| FR-T9 | Simple mode: shorter, plainer answers. | S |
| FR-T10 | Session-only conversation context for follow-ups. | S |
| FR-T11 | Jobs file is a second content source, so the assistant answers about jobs too. | M |

### 4.3 Pluggable AI layer

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-A1 | One function: `answer(question, sections, language) -> { text, sources: [{title, url}] }` or `{ text: null }`. | M |
| FR-A2 | Providers: `cloud` (Gemini Flash default, Groq-hosted open model fallback, server-side only), `local` (Ollama, OpenAI-style endpoint on the host's machine), `none` (keyword search). Host chooses in configuration. | M |
| FR-A3 | The module is fully useful with `none`. No feature depends on a paid service the host cannot replace. | M |
| FR-A4 | Server TTS is **must-have** (see FR-T8): edge-tts, then Addis AI if a key is set, then browser voice, then text only with a message. Server STT (Addis AI, then Groq Whisper) is optional. | M (TTS) / S (STT) |

### 4.4 Chat behaviour

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-C1 | Message list `role="log"` `aria-live="polite"`; no focus stealing. | M |
| FR-C2 | Every message `dir="auto"` and correct `lang`; Arabic right-to-left via logical CSS. | M |
| FR-C3 | Enter sends; Escape closes and returns focus to the launcher; visible 3 px focus outline. | M |
| FR-C4 | Panel is a real `<dialog>`; survives 200% zoom and 320 px width. | M |
| FR-C5 | Offline: typed messages are kept and sent later, with "Saved on this phone. It will send when you are online." | M |
| FR-C6 | No time-outs, flashing or self-moving content; respects reduced motion. | M |

### 4.5 Human help

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-H1 | "Talk to a person": one button, always visible; opens a ticket with the conversation so far (`POST /api/v1/escalations`). | M |
| FR-H2 | Honest next step in words, by time of day: helper online → "A tutor is joining"; no helper → "A tutor will answer here. It may take until morning." plus option to be contacted on Telegram. | M |
| FR-H3 | Helper page lists waiting learners, shows transcript, replies appear in the learner's panel and are announced. | M |
| FR-H4 | Learner-controlled screen share with `getDisplayMedia()`: learner starts it, sees "You are sharing your screen" bar, Stop button. | M (desktop) |
| FR-H5 | Android fallback (getDisplayMedia does not work in Chrome on Android): ticket includes current page URL and lesson section; learner can attach a screenshot. | M |

### 4.6 Channels

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-CH1 | Telegram bot via BotFather, `getUpdates` long polling, calls the same `answer()`; ask, voice note, `/help` (ticket), `/alerts`, `/stop`. | M |
| FR-CH2 | `POST /sms/inbound {from, text}` → plain-text reply ≤ 160 characters; README documents how a gateway would call it, with curl. Note: Amharic needs Unicode SMS (70 characters per segment), so a 160-character Amharic reply is three segments. | M |
| FR-CH3 | Phone numbers accepted as 09…, 07…, +251…; stored as +251…. | M |

### 4.7 Career gateway (reuses the assistant)

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-J1 | Demo page `savanna/pages/jobs.html` with test jobs from `demo/data/jobs.json`; each job embedded as schema.org JobPosting JSON-LD (Level 3). Accommodations offered go in `jobBenefits`. | M |
| FR-J2 | Assistant answers questions about a job only from its record, links to it, and says if the deadline has passed. | M |
| FR-J3 | Job alerts through the Telegram bot and the text endpoint (keyword, location, language); `/stop` and `STOP` unsubscribe. | M |
| FR-J4 | "I need an accommodation for my interview": short accessible request that goes to a **person** (career helper), never directly to the employer; no diagnosis or proof; learner gets a confirmation. | M |
| FR-J5 | Trust line in job answers: "Check on the employer's own site. Never pay to apply." | S |

### 4.8 Teacher, admin and webhook

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-AD1 | `POST /api/v1/content`: host sends lessons to be indexed. Content also loadable from the `content` attribute (`/content.json`). | M |
| FR-AD2 | One webhook: host registers a URL; server posts when a ticket is opened. Kept (not cut): it earns Level 2 adoption points. | M |
| FR-AD3 | Teacher view of most-asked questions, counts only, shown when asked at least 5 times. | S |

## 5. Non-functional requirements

### 5.1 Accessibility (gate)

| ID | Requirement |
| --- | --- |
| NFR-A1 | WCAG 2.2 AA, including 2.4.11, 2.5.7, 2.5.8, 3.2.6, 3.3.7, 3.3.8. |
| NFR-A2 | axe-core zero critical / zero serious on starter pages with the module, `demo/blank.html`, helper page, jobs page; as a script anyone can run (`npx @axe-core/cli`). |
| NFR-A3 | Real elements only (`<button>`, `<a href>`, `<input>`, `<dialog>`); labels and `aria-describedby` targets in the same shadow root; no positive tabindex; sizes in rem. Escape closes the panel in both modal and non-modal modes. |
| NFR-A5 | Contrast: text and borders in the panel use fixed colours that pass 4.5:1; the host's `--bs-primary` is used only as a solid button background after a runtime contrast check against white, with `#002B56` as the fallback. |
| NFR-A4 | Co-designer passes the main task unaided on their own device over HTTPS. |

### 5.2 Built for Ethiopia

| ID | Requirement |
| --- | --- |
| NFR-E1 | Amharic complete: every string, error and button, checked by an Amharic reader. |
| NFR-E2 | Noto Sans Ethiopic or system font; Amharic line height about 1.7; no all-caps or letter spacing. |
| NFR-E3 | Ethiopian calendar via `Intl.DateTimeFormat('am-ET-u-ca-ethiopic', …)` for dates and deadlines. |
| NFR-E4 | Slow 3G load time of `demo/blank.html` measured and written in the README. |
| NFR-E5 | New language = one new JSON file in `module/i18n/`. |

### 5.3 Quality, privacy, running

| ID | Requirement |
| --- | --- |
| NFR-S1 | No API key in the browser; paid calls go through our server. |
| NFR-S2 | Nothing leaves the host for a third party unless the host configured it and the learner agreed (consent card); consent recorded. |
| NFR-S3 | Minimum data; test data only; support/accommodation needs stored apart from any profile and never shown to an employer. |
| NFR-S4 | Learner can see, export and delete their data (`GET`/`DELETE` by conversation or subscription). |
| NFR-S5 | Voice and screen share off until the learner starts them, clearly shown while on. |
| NFR-S6 | Prompt-injection hardening: lesson and job text are data; sources validated server-side. |
| NFR-S7 | A few automated tests on core logic plus the axe script. |
| NFR-K1 | `docker compose up` on a clean laptop with **zero manual setup**: SQLite file database (no database container); encryption key auto-generated once and persisted if not set; `.env.example` committed, real keys never. |
| NFR-K2 | README states rough monthly cost for 3,000 learners. |
| NFR-K3 | Open licence named at kick-off; every library and licence listed. |

## 6. Acceptance tests (demo script)

1. Judge opens `savanna/pages/concept-with-navigation.html` (module already added before `</body>`) and `demo/blank.html`; launcher shows on both.
2. Keyboard only: first Tab reaches "Skip to assistant", Enter, ask in Amharic about the future of VA work; NVDA announces the answer; it links to `#artificial-intelligence-and-the-future-of-va-work` (or the right section); activating the link moves focus to that heading; "Listen" speaks the answer in Amharic on an Android phone.
3. Out-of-scope question: "I could not find this in the course", offer a person; model not called.
4. Switch provider to `none` in config: same question still answered with the best section and link.
5. "Talk to a person": helper page shows the ticket; reply announced in the panel. After hours, the honest "may take until morning" message.
6. Arabic message renders right-to-left.
7. Telegram: voice note in, text answer with link out.
8. `curl -X POST /sms/inbound -d '{"from":"0911000000","text":"JOBS accountant"}'` returns ≤160 characters.
9. `savanna/pages/jobs.html`: JSON-LD validates as JobPosting; accommodation request reaches the helper page.
10. axe: zero critical, zero serious on every page above.

## 7. Constraints

- Time (Sunday): 10:30 main task end to end on a phone over HTTPS; 12:00 must-haves, axe clean, Amharic complete and reader-checked; 14:00 feature stop; 15:30 final co-designer test; 16:30 submit. See [SDS.md](SDS.md) §7.
- Team laptop: i7-1355U, 16 GB RAM, no dedicated GPU. Ollama with a small model (1B to 4B class) runs on CPU but slowly; cloud is the default demo provider.
- **[unverified]**: Addis AI terms and price; edge-tts terms and stability; phones' Amharic TTS voices; Chrome's Amharic speech recognition quality.

## 8. Traceability to score

| Score | Covered by |
| --- | --- |
| Works for its users (30) | §1 main task, FR-T*, FR-C*, FR-H*, NFR-A4 |
| Can be adopted (25) | FR-L*, Level 2 API, FR-J1, README |
| Built for Ethiopia (15) | NFR-E*, FR-CH*, FR-C2 |
| Quality, security, privacy (15) | FR-T5, FR-T6, NFR-S* |
| Can be kept running (15) | FR-A3, NFR-K* |
