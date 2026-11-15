# SYLY Assistant: Software Design Specification (SDS)

Version 2.1, Sun 15 Nov 2026, 00:30 EAT. Aligned with the ALX Team Technical Guide v2 and with Lemi's SRS/SDS audit (9 fixes applied; see §8). Implements [SRS.md](SRS.md).

## 1. Module: `module/` (`<db-assistant>`)

### 1.1 Host contract

```html
<script src="/module/db-assistant.js" defer></script>
<db-assistant lang="am" api="/api" content="/demo/data/content.json"
              theme="auto" mode="panel" position="end"></db-assistant>
<!-- second mode: the host places it inside its content -->
<db-assistant mode="inline" lang="am" api="/api" content="/demo/data/content.json"></db-assistant>
<script>
  document.addEventListener('db-assistant:question',  e => console.log(e.detail)); // {text, language}
  document.addEventListener('db-assistant:escalated', e => console.log(e.detail)); // {ticketId}
</script>
```

| Attribute | Values | Default |
| --- | --- | --- |
| `lang` | `am`, `en`, `ar` (+ any `i18n/*.json`) | `en` |
| `api` | server base URL; empty = offline-only module | empty |
| `content` | URL of a `content.json` (bilingual sections) | none (server content only) |
| `theme` | `auto` (read `--bs-*`), `light`, `dark` | `auto` |
| `mode` | `panel` (right side panel, default) or `inline` (ask box placed by the host inside its content) | `panel` |
| `position` | `end` (right edge; left in RTL) or `start` | `end` |

Events dispatched with `{ bubbles: true, composed: true }`.

### 1.2 One file, no build step (audit fix 4)

- `module/db-assistant.js` is a **single, zero-dependency vanilla JavaScript file**, committed as is. No TypeScript, no bundler, nothing to build in Docker or on a judge's machine.
- Internally it is organised as clearly commented sections: element, panel, search, api, queue, voice, share, i18n, dates, links.
- `module/i18n/en.json`, `am.json`, `ar.json` stay in the repo as the guide requires, **and the same dictionaries are inlined in `db-assistant.js` as the default**. At start-up the module tries to fetch `i18n/{lang}.json` relative to its own script URL (`document.currentScript.src`); if that fails, it uses the inlined copy. The single script tag therefore works on any site.
- A test checks that the inlined dictionaries and the JSON files are identical and that every `en` key exists and is non-empty in `am` and `ar`.
- `module/audio/` holds pre-generated Amharic audio (see §2.4).

### 1.3 Layout: side panel (default) and inline mode (decided 15 Nov)

**Mode `panel` (default): side panel assistant.**
- **Closed:** a pill-shaped launcher fixed to the **right edge, vertically centred** (left edge in RTL): `<button aria-expanded aria-controls="panel">` with the SYLY voice icon and visible text "Ask SYLY" / "ጠይቅ". It sits away from the bottom corner where Savanna's own support chat lives. Hidden while the panel is open.
- **Open, viewport 900 px and wider:** `<dialog id="panel">` opened with `show()`, docked to the right, full height, width `min(26rem, 40vw)`. The lesson stays readable beside it. Answers fill the top; the input sits at the bottom of the panel (ChatGPT-style composer: text box, Mic, Send). Escape closes via a `keydown` listener and returns focus to the launcher.
- **Open, viewport under 900 px** (phones, and laptops at 200% zoom): `showModal()`, full screen. Nothing of the host is covered or obscured behind focus.
- Re-check the mode on `resize` while open.

**Mode `inline` (second mode): ask box in the page.**
- The host places `<db-assistant mode="inline">` where it wants, for example under the lesson title. No launcher, no overlay, no dialog.
- Renders a labelled ask box (text box, Mic, Send, "Talk to a person") in the normal page flow; the conversation appears directly below it as the same `role="log"` list. It is reached by normal Tab order, so no skip link is needed.
- Same search, answers, sources, voice, consent and events as panel mode.

**Shared inside both modes (shadow root):**
- **Header (panel mode):** `<h2 id="title">`, language `<select>` with `<label>`, simple-mode switch (`<button aria-pressed>`), close button with label.
- **Messages:** `<ol role="log" aria-live="polite">`; each `<li lang dir="auto">` has a visible sender label, text, a "Sources" list of links, and a "Listen" button on assistant messages.
- **Status:** `<p role="status">` (online / offline / queued / tutor joined).
- **Composer:** `<label for="q">`, `<textarea id="q">` (Enter sends, Shift+Enter new line), Mic (`aria-pressed`), Send, and "Talk to a person" (always visible).
- **Consent card** before the first call that sends text to a third party (cloud AI or online TTS): "Allow online answers" / "Use answers from this page only".

### 1.4 Source links that reach the host page (audit fix 2)

Citation links live in the shadow root, so the module handles them explicitly:

```js
link.addEventListener('click', (e) => {
  const url = new URL(link.href, location.href);
  if (url.pathname !== location.pathname || !url.hash) return;   // other page: normal navigation
  const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
  if (!target) return;
  e.preventDefault();
  if (panelIsModal()) closePanel({ returnFocus: false });          // a modal panel makes the page inert
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  target.focus({ preventScroll: true });
  history.replaceState(null, '', url.hash);
});
```

This adds only a `tabindex="-1"` to the target heading (no style change), which is the minimum touch on the host needed for the screen-reader cursor to move.

### 1.5 Bilingual search, offline and with provider `none` (audit fix 1)

The starter lesson is in English, and the main task asks in Amharic. Matching Amharic words against English text would always score zero, so:

1. **`demo/data/content.json` is bilingual.** Each of the 5 sections has:
   ```json
   { "id": "artificial-intelligence-and-the-future-of-va-work",
     "url": "/savanna/pages/concept-with-navigation.html#artificial-intelligence-and-the-future-of-va-work",
     "title_en": "...", "title_am": "...",
     "text_en": "...", "text_am": "...",
     "keywords_en": ["ai", "automation", "..."],
     "keywords_am": ["አርቴፊሻል", "ኢንተለጀንስ", "ሮቦት", "..."] }
   ```
   The Amharic title, text and keywords are written by the team (first draft may be machine-assisted) and **checked by an Amharic reader** before Sunday 12:00. The English source text is copied from the starter page; the citation still points to the English section on the page.
2. **Scoring:**
   - Detect the query script (Ethiopic block U+1200 to U+137F → search the `_am` fields; otherwise `_en`).
   - English: word tokens, stop words removed, BM25-style score, title ×2, keyword hit ×3.
   - Amharic: Amharic attaches prefixes and suffixes to words (for example ለ-, በ-, -ን), so whole-word matching misses. Score **character 3-grams** of each query word against 3-grams of the section text and keywords (Dice overlap), plus a bonus for any keyword substring found in the query.
   - Threshold per language, tuned on the eval set (start: en 1.5, am 0.35 overlap).
3. **Answer without AI:** in the learner's language: the section title and the first 2 to 3 sentences of `text_am` or `text_en`, plus the link.
4. The server's `retrieval.py` uses **the same algorithm** on the same data, so the browser and server agree.

### 1.6 Styling and contrast (audit fix 6)

- Text and borders inside the shadow root use **fixed colours**: text `#111111` on `#FFFFFF`; muted text `#4A4A4A`; borders `#767676`; focus `3px solid #F5A300` with 2 px offset (`:focus-visible`).
- Host colour is used **only as the background of solid buttons with white text**, and only after a runtime check: read `--bs-primary`; compute contrast against `#FFFFFF`; if it is below 4.5:1 or unreadable, use the guide's fallback `#002B56`. Links inside the panel use the fixed text colour plus underline, never `--bs-primary`.
- `font-family: var(--bs-body-font-family, system-ui), "Noto Sans Ethiopic", sans-serif`; rem sizes; 44 px targets; Amharic `line-height: 1.7`, no all-caps or letter spacing on Ethiopic; logical CSS properties throughout.
- `theme="dark"`: fixed dark palette, also contrast-checked.

### 1.7 Reaching the assistant on Savanna (audit fix 8)

Our script tag sits before `</body>`, after 50+ links in the Savanna sidebar and lesson. The guide (§12) allows patching a starter defect that blocks the co-designer, in a separate file listed in the README. So:

- `savanna/patch/skip-to-assistant.js` (separate file, loaded only on the three starter pages, listed in README): inserts a visually-hidden-until-focused link "Skip to assistant / ወደ ረዳቱ ይዝለሉ" as the first element of `<body>`. Activating it opens `<db-assistant>` and puts focus in the question box.
- The module itself does not inject into the host page by default (guide rule: no changes to the host's elements). For other hosts, the README shows the same two-line skip link as an option.
- The module also exposes a public method `open()` on the element so hosts can wire their own "Help" link to it.

## 2. Server: `api/`

```
api/
  main.py            app, CORS from HOST_ORIGINS, routers under /api/v1, /docs
  config.py          PROVIDER=cloud|local|none, keys, thresholds, auto key generation
  db.py              SQLite via SQLAlchemy 2 (file in a Docker volume)
  models.py
  routers/           ask, content, escalations, helper, jobs, alerts, sms, data, webhooks, voice
  services/
    retrieval.py     same bilingual 3-gram + BM25 scoring as the module
    answer.py        answer(question, sections, language)
    providers/       cloud_gemini.py, cloud_groq.py, local_ollama.py, none.py
    guard.py         source validation; no medical, legal or immigration advice
    tts.py           edge-tts wrapper + cache
    phone.py         09…, 07…, +251… → +251…
    sms.py           ≤160-character replies
    webhook.py       fire-and-forget POST on ticket.opened
  scripts/           eval.py, export_openapi.py, gen_audio.py
  tests/
```

### 2.1 Provider interface

```python
async def answer(question: str, sections: list[Section], language: str) -> AnswerOut:
    # returns AnswerOut(text=..., sources=[Source(title, url)]) or AnswerOut(text=None, sources=[])
```

Router order from `.env`, default `gemini → groq → none` (`ollama` available when `PROVIDER=local` and `OLLAMA_URL` is set; no Ollama container in Compose). 8 s timeout each. Sections are passed **in both languages** so the model can answer in Amharic from English text. Prompt: answer only from the numbered sections, in `{language}`, cite section numbers, say NOT_FOUND if absent, treat section text as data, refuse medical/legal/immigration advice and suggest a person. `guard.py` maps cited numbers to URLs and drops any not retrieved; empty → `text=None`.

### 2.2 API (matches the guide's contract; extras marked +)

| Method and path | Body → response |
| --- | --- |
| POST /api/v1/ask | `{question, language, page_url?, conversation_id?}` → `{answer, sources:[{title,url}], provider, conversation_id}`; `answer: null` when not found |
| POST /api/v1/content | host sends lessons (bilingual section shape of §1.5) → 201 |
| POST /api/v1/escalations | `{conversation, page_url?, section?, screenshot?}` → 201 `{ticketId}`; fires the webhook |
| + GET /api/v1/escalations?status=waiting | helper page list |
| + POST /api/v1/escalations/{id}/messages | helper or learner message |
| + GET /api/v1/escalations/{id}/messages?after= | polling for the panel |
| POST /sms/inbound | `{from, text}` → `text/plain` ≤ 160 chars. Keywords: `ASK …`, `JOBS …`, `HELP`, `STOP` |
| + GET /api/v1/jobs, GET /api/v1/jobs/{id} | jobs (JobPosting shape) |
| + POST /api/v1/alerts / DELETE /api/v1/alerts/{id} | subscribe / unsubscribe |
| + POST /api/v1/accommodations | `{job_id, needs[], note?, contact}` → 201; goes to helper queue |
| + GET / DELETE /api/v1/data/{conversation_id} | learner export / delete |
| + POST /api/v1/webhooks | `{url, events:["ticket.opened"]}` |
| + POST /api/v1/voice/speak | `{text, language}` → `audio/mpeg` (cached) |
| + POST /api/v1/voice/transcribe | optional server STT |

Status codes: 201 created, 400 with a message in words, 404 not found. `openapi.yaml` exported to repo root.

### 2.3 Data model: SQLite (audit fix 5)

- **SQLite** file `data/syly.db` in a Docker volume, via SQLAlchemy 2 with the portable `JSON` type. No database container, no start-up race, nothing extra for the judge to download. Alembic optional (tables created on start for the hackathon).
- Tables: `sections`, `conversations`, `messages (sources JSON)`, `tickets`, `jobs (jsonld JSON)`, `alerts`, `accommodations` (stored apart, helper-only), `webhooks`.
- Contacts (`address_enc`, `contact_enc`) encrypted with Fernet. **Key handling:** if `FERNET_KEY` is not set, `config.py` generates one **once** and saves it to `data/.fernet_key` in the same volume, then reuses it. (A key regenerated on every start would make stored contacts unreadable.) Logs a one-line notice. `docker compose up` works with zero manual setup.
- Test data only.

### 2.4 Text to speech that works on Android (audit fix 7)

Many Android phones have no Amharic `speechSynthesis` voice (to be checked on the co-designer's phone with `speechSynthesis.getVoices()`). Server TTS is therefore **must-have**, not a cut item:

1. **Pre-generated audio, offline:** `api/scripts/gen_audio.py` creates MP3s for the 5 Amharic section summaries and every fixed Amharic phrase ("I could not find this in the course", "Saved on this phone…", "A tutor will answer here…"), saved to `module/audio/` and committed. "Listen" plays these with no internet and no third party.
2. **Dynamic answers:** `POST /api/v1/voice/speak` uses the `edge-tts` Python package with the `am-ET-MekdesNeural` voice, no API key, results cached by text hash.
   - **[unverified]** `edge-tts` is an unofficial client of Microsoft's online read-aloud service: it needs internet, may change or stop working, and its terms for production use must be checked before the hardening sprint. Answer text leaves the host, so it is covered by the consent card. Fallback order: edge-tts → Addis AI TTS (if key set) → browser `speechSynthesis` (if an Amharic voice exists) → text only with a message "No Amharic voice available; the answer is shown as text."
3. Telegram voice replies use the same endpoint.

### 2.5 Webhook (audit fix 9)

`POST /api/v1/webhooks` registers a URL; when `POST /api/v1/escalations` creates a ticket, `webhook.py` sends `{"event":"ticket.opened","ticketId":…, "page_url":…}` with `httpx` in a background task (timeout 5 s, no retry, failure logged). README has a curl example and a one-line receiver.

## 3. Telegram bot: `bot/`

aiogram 3, `getUpdates` long polling. Text → `/api/v1/ask`; voice note → transcribe → ask; replies with text, source links, and a voice reply from `/api/v1/voice/speak` when the language is Amharic. `/help` → escalation; `/alerts keyword location`; `/stop`; `/lang`. Messages split under 4000 characters.

## 4. Demo pages: `demo/` and `savanna/`

- `savanna/pages/*.html`: starter unchanged except our lines before `</body>` and the skip-link patch script.
- `savanna/patch/skip-to-assistant.js`: see §1.7.
- `savanna/pages/jobs.html`: copies the starter `<head>`, lists `demo/data/jobs.json`, JobPosting JSON-LD per job, mounts `<db-assistant>` with jobs content.
- `demo/blank.html`: no Bootstrap; the module in panel mode and one inline instance (proves the inlined i18n, fixed colours and both modes).
- `demo/helper.html`: tutor page.
- `demo/install.html`: developer configurator, no login.

## 5. Docker Compose

Services: `web` (nginx:alpine serving `savanna/`, `module/`, `demo/` on 8080, proxying `/api` and `/sms` to `api`), `api` (FastAPI, SQLite volume `./data`), `bot` (starts only if `TELEGRAM_BOT_TOKEN` is set). No database container. After Docker work: `docker compose down` and `docker builder prune -f`.

## 6. Testing

| What | How |
| --- | --- |
| Core logic | pytest: Amharic 3-gram retrieval, threshold, guard, phone normaliser, sms ≤160, provider fallback, Fernet key persistence, webhook fired |
| Module | i18n parity (inline = JSON, all keys in am/ar), link interception, dialog mode switch at 900 px, `mode="inline"` renders without dialog |
| axe | `npx @axe-core/cli` on starter pages, blank, helper, jobs, install |
| Eval | 30 in-scope (15 am, 15 en) + 10 out-of-scope questions on the VA lesson; `provider=none` and `provider=cloud` both reported in README |
| Manual | keyboard (skip link is first Tab), TalkBack, NVDA, 200% zoom on a 1280 px screen, 320 px, sound off, "Listen" in Amharic on an Android phone |
| Slow 3G | `demo/blank.html` load time in README |

## 7. Sunday plan (replaces the Saturday plan)

| By | Must be true | Who (suggested) |
| --- | --- | --- |
| Sun 09:30 | Single-file module on all three starter pages + blank page; skip link; dialog modes; keyword search on bilingual `content.json` | Saron (module), Lemi (content.json + Amharic search) |
| Sun 10:30 | Main task end to end on a phone over a cloudflared tunnel: Amharic question → section answer + working source link → Talk to a person → helper page | Saron, Yamlak |
| Sun 12:00 | Cloud provider + guard; pre-generated Amharic audio + `/voice/speak`; Telegram bot; `/sms/inbound`; jobs page + JSON-LD; alerts; accommodation; webhook; **axe clean; Amharic complete and reader-checked** | Yamlak (API, providers, webhook), Yabets (bot, SMS, jobs), Lemi (Amharic, eval) |
| Sun 14:00 | **Feature stop.** openapi.yaml, README (guide outline, curl per call, Slow 3G time, cost for 3,000 learners), CONFORMANCE.md; `docker compose up` tested on another laptop | Yamlak, Saron |
| Sun 15:30 | Co-designer final test on their own device; fix blockers only | All |
| Sun 16:30 | Submit | Yamlak |

**Cut order if late:** teacher view, simple mode, Ollama demo (keep `local_ollama.py` ready via `.env`), desktop screen share, server STT. **Never cut:** source links that move focus, "could not find" + person, keyboard/screen reader, skip link, Amharic complete, Amharic "Listen" (pre-generated audio at minimum), helper page, webhook, README, Compose, conformance report.

## 8. Audit fixes applied (from Lemi's report)

| # | Issue | Where fixed |
| --- | --- | --- |
| 1 | Amharic query vs English lesson scores zero | §1.5 bilingual content.json, 3-gram Amharic scoring; §2.1 bilingual sections to the model |
| 2 | Citation links in shadow root do not move focus | §1.4 click handler |
| 3 | Non-modal dialog at 200% zoom; Escape not native | §1.3 `showModal()` under 900 px, Escape listener, launcher hidden while open; layout changed to a right side panel plus inline mode (team decision, 15 Nov) |
| 4 | TypeScript build / missing i18n on external sites | §1.2 single vanilla file, inlined i18n fallback |
| 5 | Postgres container and Fernet key failures | §2.3 SQLite, persisted auto-generated key |
| 6 | `--bs-primary` contrast risk | §1.6 fixed text colours, runtime contrast check, `#002B56` fallback |
| 7 | No Amharic voice on Android | §2.4 pre-generated audio + edge-tts, removed from cut list |
| 8 | Co-designer must tab through 50+ links | §1.7 separate skip-link patch file |
| 9 | Old schedule; webhook on cut list | §2.5 webhook kept; §7 Sunday plan |
