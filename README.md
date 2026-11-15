# SYLY Assistant `<db-assistant>`: Track 3, Multilingual assistant and live help

Team SYLY: Lemi, Saron, Yabets, Yamlak. Co-designer: to be confirmed (Sunday 09:00).
Digital Bridge Accessibility Hackathon, ALX, 14 to 15 Nov 2026.

## What it does

A learner asks a question about the lesson they are reading, in Amharic, English or Arabic, by typing or speaking, on the web page, in Telegram or by text message. The assistant answers only from the course, links every answer to the lesson section it came from, and reads it aloud, even on a phone with no Amharic voice. One button, always visible, reaches a real person, and the same parts serve a small career gateway: job answers, job alerts and interview-support requests that go to a person, never straight to the employer.

## The main task we tested

> A blind learner who thinks in Amharic, using TalkBack on a low-cost Android phone, asks a question about the lesson page, hears and reads an answer that links to the lesson section it came from, and reaches a person with one button, with nobody helping.

Status: built and checked automatically (keyboard flow, axe, reflow); **manual tests with TalkBack, NVDA and the co-designer are pending** (see `CONFORMANCE.md` and `docs/testing-plan.md`).

## Run it

```bash
cp .env.example .env          # optional: every value may stay empty (keyword answers only, no bot)
docker compose up --build
```

| Address | What |
| --- | --- |
| http://localhost:8080/pages/concept-with-navigation.html | Savanna lesson page with the assistant |
| http://localhost:8080/pages/homepage-v1-paced.html | Savanna paced homepage |
| http://localhost:8080/pages/homepage-v1-self-paced.html | Savanna self-paced homepage |
| http://localhost:8080/demo/blank.html | Blank page, no Bootstrap: panel and inline mode |
| http://localhost:8080/pages/jobs.html | Demo jobs page (test data, JobPosting JSON-LD) |
| http://localhost:8080/demo/helper.html | Helper (tutor) page |
| http://localhost:8080/demo/install.html | Developer install page (no login) |
| http://localhost:8080/docs | API documentation (Swagger UI) |

Phones need HTTPS for the microphone and screen sharing:

```bash
cloudflared tunnel --url http://localhost:8080      # open the https://….trycloudflare.com address on the phone
```

Put that address in `.env` as `PUBLIC_BASE_URL` so the Telegram bot's links work, then `docker compose up -d bot`.

When finished, always:

```bash
docker compose down
docker builder prune -f
```

Services: `web` (nginx: starter at `/`, module at `/module`, demos at `/demo`, proxies `/api`, `/sms`, `/docs`), `api` (FastAPI + SQLite file in `./data`, no database container), `bot` (Telegram long polling; exits quietly without a token). The encryption key for stored contacts is generated once into `data/.fernet_key` if `FERNET_KEY` is not set.

Without Docker, module only: `python api/scripts/dev_static.py` (same layout on :8080, no API).

## Install, Level 1

Two lines before `</body>`:

```html
<script src="https://your-host/module/db-assistant.js" defer></script>
<db-assistant lang="am" api="https://your-host/api" content="/demo/data/content.json"></db-assistant>
```

Or generate them on `demo/install.html` (live preview, contrast check for a custom colour, copy button).

| Attribute | Values | Default |
| --- | --- | --- |
| `lang` | `am`, `en`, `ar`, or any `module/i18n/<code>.json` | `en` |
| `api` | Server base URL. Empty = works alone with keyword search in the browser | empty |
| `content` | URL of a bilingual `content.json` (sections with `id`, `url`, `title_en/am`, `text_en/am`, `keywords_en/am`) | server content |
| `theme` | `auto` (uses the host's `--bs-primary` only if it passes 4.5:1 with white, else `#002B56`), `light`, `dark` | `auto` |
| `mode` | `panel` (pill on the side edge opens a full-height side panel) or `inline` (ask box in the page flow) | `panel` |
| `position` | `end` (right edge, vertically centred; left in Arabic) or `start` (other edge) | `end` |

Events (all `bubbles: true, composed: true`):

```js
document.addEventListener('db-assistant:question',  e => console.log(e.detail)); // {text, language}
document.addEventListener('db-assistant:escalated', e => console.log(e.detail)); // {ticketId}
document.addEventListener('db-assistant:language',  e => console.log(e.detail)); // {language}
```

Methods on the element: `open()`, `close()`, `ask(text)`, `openAccommodation({id, title})`, `showJobAlerts(keyword)`, `getText(key, lang?)`.

The panel is a real `<dialog>` opened with `showModal()` (guide section 8); Escape closes it and returns focus to the launcher. Source links scroll to the lesson section **and move focus to its heading**. Styles live in a shadow root; the module adds nothing to the host page except `tabindex="-1"` on a heading it moves focus to.

### Starter patch (guide section 12)

The starter has no skip link and the assistant comes after 50+ sidebar links. `savanna/patch/skip-to-assistant.js` (a separate file, loaded only on the three starter pages) adds "Skip to assistant / ወደ ረዳቱ ይዝለሉ" as the first focusable element. Other hosts can wire their own link to `open()`.

### Starter source

`savanna/` is https://github.com/alx-africa/Savanna-static-pages at commit `9e83ac77891708117728ad9fc05301e124cc8ec8` (5 Nov 2026), copied without its `.git` folder. The starter repository has **no licence file**. Our only changes: four lines before `</body>` on the three pages in `savanna/pages/`, the new `savanna/patch/skip-to-assistant.js`, and our own new page `savanna/pages/jobs.html` (generated by `api/scripts/build_jobs_page.py`).

## Install, Level 2

`openapi.yaml` (23 paths, generated with `python api/scripts/export_openapi.py`) and Swagger UI at `/docs`. JSON in and out; 201 for created, 400 with a message in words, 404 not found. Helper-only calls need the `X-Helper-Key` header when `HELPER_KEY` is set.

```bash
B=http://localhost:8080

# Ask (answer + sources; answer is null with reason "not_found" when the course does not cover it)
curl -X POST $B/api/v1/ask -H "Content-Type: application/json" \
  -d '{"question":"Will AI replace virtual assistants?","language":"en","allow_ai":false}'

# Send your lessons to be indexed (bilingual sections)
curl -X POST $B/api/v1/content -H "Content-Type: application/json" \
  -d '{"sections":[{"id":"intro","url":"/lesson.html#intro","title_en":"Intro","text_en":"Text of the section."}]}'
curl $B/api/v1/content

# What the widget needs at start (AI on? helper online?)
curl $B/api/v1/config

# Talk to a person: open a ticket (returns ticketId + token)
curl -X POST $B/api/v1/escalations -H "Content-Type: application/json" \
  -d '{"conversation":[{"role":"learner","text":"I need help","lang":"en"}],"page_url":"/pages/concept-with-navigation.html","language":"en"}'
curl "$B/api/v1/escalations?status=open"                                   # helper list
curl -X POST $B/api/v1/escalations/1/messages -H "Content-Type: application/json" \
  -d '{"author":"helper","name":"Saron","text":"Hello, I am here."}'       # helper reply
curl "$B/api/v1/escalations/1/messages?after=0&token=TOKEN"                 # learner polling
curl -X PATCH $B/api/v1/escalations/1 -H "Content-Type: application/json" -d '{"status":"closed"}'
curl -X POST "$B/api/v1/helper/presence?name=Saron"                         # helper page heartbeat

# Webhook: register a URL; it receives {"event":"ticket.opened","ticketId":…,"page_url":…,"language":…}
curl -X POST $B/api/v1/webhooks -H "Content-Type: application/json" -d '{"url":"https://example.org/syly-hook"}'
#   one-line receiver for a test:  python -m http.server 9000   (or https://webhook.site)

# Text route (no gateway at the hackathon): plain text, at most 160 characters
curl -X POST $B/sms/inbound -H "Content-Type: application/json" -d '{"from":"0911000000","text":"JOBS accountant"}'
curl -X POST $B/sms/inbound -H "Content-Type: application/json" -d '{"from":"0911000000","text":"ASK What skills will clients value?"}'
curl -X POST $B/sms/inbound -H "Content-Type: application/json" -d '{"from":"0911000000","text":"HELP"}'
curl -X POST $B/sms/inbound -H "Content-Type: application/json" -d '{"from":"0911000000","text":"ALERT accountant"}'
curl -X POST $B/sms/inbound -H "Content-Type: application/json" -d '{"from":"0911000000","text":"STOP"}'
curl $B/api/v1/sms/outbox                                                  # alerts waiting for a gateway

# Jobs (JobPosting JSON-LD included), alerts, interview support
curl $B/api/v1/jobs
curl $B/api/v1/jobs/accountant-002
curl -X POST $B/api/v1/jobs -H "Content-Type: application/json" -d '{"id":"test-job-9","title_en":"Accountant","employer":"Test Employer PLC","location_en":"Addis Ababa","date_posted":"2026-11-15","deadline":"2026-12-01","summary_en":"Test job."}'
curl -X POST $B/api/v1/alerts -H "Content-Type: application/json" -d '{"channel":"sms","address":"0911000000","keyword":"accountant"}'
curl -X DELETE $B/api/v1/alerts/1
curl -X DELETE "$B/api/v1/alerts?channel=sms&address=0911000000"
curl -X POST $B/api/v1/accommodations -H "Content-Type: application/json" \
  -d '{"job_id":"accountant-002","needs":["interpreter","extra_time"],"contact_channel":"none"}'
curl $B/api/v1/accommodations                                              # helper only

# Voice
curl -X POST $B/api/v1/voice/speak -H "Content-Type: application/json" -d '{"text":"ሰላም","language":"am"}' -o speak.mp3
curl -X POST $B/api/v1/voice/transcribe -F "file=@voice.ogg" -F "language=am"

# Screen share and screenshot (learner side, with the ticket token)
curl -X POST "$B/api/v1/escalations/1/screenshot?token=TOKEN" -H "Content-Type: application/json" -d '{"screenshot":"data:image/png;base64,…"}'
curl "$B/api/v1/escalations/1/screen" -o frame.jpg                          # helper: latest shared frame

# Learner data and teacher view
curl $B/api/v1/data/CONVERSATION_ID
curl -X DELETE $B/api/v1/data/CONVERSATION_ID
curl "$B/api/v1/stats/questions?min_count=5"
curl $B/api/v1/health
```

### AI providers (server `.env` only, never in the browser)

`PROVIDER=cloud`: Gemini (`gemini-3.5-flash-lite`), then Groq (`openai/gpt-oss-120b`) on error or timeout, then keyword answer. `PROVIDER=local`: Ollama at `OLLAMA_URL`, then keyword answer. `PROVIDER=none`: keyword answer only. Retrieval always runs first; below the threshold the model is never called. The model gets the 2 best sections (English text + Amharic title, to stay inside free-tier token limits), must reply with the section numbers it used, and the server drops any citation it was not given. With no citation, no answer is shown. Model names are configurable: `GEMINI_MODEL`, `GROQ_MODEL`, `OLLAMA_MODEL` (`gemini-2.5-flash` was refused for new keys on 15 Nov, so we pinned the lite model).

### How LTI 1.3 would connect (not built)

1. Register SYLY as an LTI 1.3 tool on the LMS (Moodle, Canvas): client id, deployment id, the platform's JWKS URL, and our OIDC login URL and launch URL.
2. Add two endpoints to `api/`: `/lti/login` (OIDC login initiation, redirects back with state and nonce) and `/lti/launch` (verifies the signed `id_token` with the platform's keys, checks nonce, audience and expiry).
3. From the launch claims use only what we need: the course and resource-link ids (to pick the content) and `launch_presentation.locale` (to set `lang`). The learner's `sub` is opaque; we store no name or email.
4. The launch returns a page that is the same two lines as Level 1 inside the LMS iframe; the lesson content is sent once with `POST /api/v1/content` or through LTI Deep Linking.
5. Grades (AGS) and rosters (NRPS) are not needed for an assistant. Effort: about a day for someone who has done LTI before.

## Install, Level 3

schema.org **JobPosting** JSON-LD: one block per job on `savanna/pages/jobs.html` (and in `GET /api/v1/jobs`). Fields: `title`, `description`, `datePosted`, `validThrough`, `employmentType`, `hiringOrganization`, `jobLocation`, `jobLocationType`/`applicantLocationRequirements` for remote jobs, `experienceRequirements`, and **`jobBenefits` for the accommodations an employer offers**. Check with https://validator.schema.org (paste the page URL from the tunnel, or the page source). Test data only.

## Languages

All interface text is in JSON: `module/i18n/{en,am,ar}.json` (widget; inlined in `db-assistant.js` so one script tag works anywhere), `api/i18n/*.json` (text route, alerts, job notes), `bot/i18n/*.json` (Telegram), `demo/i18n/*.json` (helper and install pages). Tests check that every language has every key. To add a language to the widget: add `module/i18n/<code>.json` with the same keys and use `lang="<code>"` (it is fetched next to the script); run `npm --prefix module run i18n` to refresh the inlined copies after editing en/am/ar.

**Amharic DRAFT – needs native reader check.** The Amharic lesson text in `demo/data/content.json`, the Amharic job text, every Amharic interface string, the pre-generated Amharic audio and the Amharic eval questions were drafted by the team (machine-assisted) and have not yet been checked by a native reader. After corrections run `python api/scripts/gen_audio.py --force` to regenerate the audio.

Arabic: the interface is complete and right-to-left. The lesson has no Arabic text, so Arabic questions are answered when an AI provider is on (the question is translated for search, then answered in Arabic); without AI, Arabic questions get "could not find".

Dates: Ethiopian calendar for Amharic via `Intl.DateTimeFormat('am-ET-u-ca-ethiopic', …)` (job deadlines, with the Gregorian date beside it).

## Offline and slow connection

- `module/db-assistant.js`: 97 KB raw, **28 KB gzipped** (nginx gzip on), no dependencies. Lesson `content.json`: 17 KB raw, 6 KB gzipped. Audio (2.2 MB, 65 small MP3s) loads only when "Listen" is pressed.
- **Slow 3G load time of `demo/blank.html`: to be measured** (Chrome DevTools, Network, Slow 3G).
- Keyword search runs in the browser; the lesson is cached on the phone after the first load, so answers keep working without a connection.
- With no connection, questions the phone cannot answer and requests for a person are kept: "Saved on this phone. It will send when you are online." They are sent on the `online` event.
- "Listen" order: pre-generated Amharic audio (offline) → server voice `/api/v1/voice/speak` (only after consent) → the phone's own voice if it has one → "No Amharic voice available. The answer is shown as text."

## Data and privacy

| What | Where | How long / how to delete |
| --- | --- | --- |
| Questions (text, language, matched section, provider, consent flag) under a random conversation id, no name | SQLite `data/syly.db` | Learner: "Your data" → Download / Delete in the panel, or `GET`/`DELETE /api/v1/data/{id}` |
| Help tickets and messages (conversation so far, page, section, optional screenshot) | SQLite | Deleted with the conversation id; helper can close |
| Screen-share frames | **Memory only**, last frame, dropped after 10 s | Never stored |
| Telegram chat id / phone for alerts or tutor replies | SQLite, **encrypted** (Fernet) | `/stop`, `STOP`, `DELETE /api/v1/alerts` |
| Interview support needs | SQLite table `accommodations`, **apart from everything else**, contact encrypted | Shown only on the helper page, never to an employer; nobody asks for proof or a diagnosis |
| Consent, language, simple mode, conversation id | The learner's own browser (localStorage) | Clearing site data |

- Nothing goes to a third party unless the host configured a provider **and** the learner chose "Allow online answers" (consent card). Without consent: keyword answers, saved audio and the phone's own voice only. Text-route answers never use AI.
- No API key is ever in the browser; keys are only in the server `.env` (`.env` is git-ignored; `.env.example` is committed).
- Helper pages: set `HELPER_KEY` in production (empty = open, for the demo only).
- Test data only: all jobs, employers and phone numbers in this repo are made up.

## Cost to run

**Estimate.** Prices were checked on 15 Nov 2026 on the providers' own pages ([Gemini](https://aistudio.google.com/docs/pricing), [Groq](https://console.groq.com/docs/models), [Addis AI](https://addisassistant.com)); usage is assumed, not measured.

Assumptions: 3,000 learners × 10 questions a month = 30,000 questions; 70% reach the AI = 21,000 calls × about 1,500 input and 200 output tokens = 31.5 M input + 4.2 M output tokens a month. Keyword answers use the free pre-generated audio; server voice is used only for AI answers.

| Item | Price checked | Rough monthly cost (USD) |
| --- | --- | --- |
| Small server for Docker Compose (2 vCPU, 2–4 GB RAM) | provider dependent **[not checked]** | 10 to 20 |
| Gemini 3.5 Flash-Lite (default) | free tier; paid $0.30 in / $2.50 out per 1 M tokens | 0 on the free tier (rate-limited), about **20** on the paid tier |
| Groq `openai/gpt-oss-120b` (fallback) | $0.15 in / $0.60 out per 1 M tokens | about 7 if used for everything |
| Voice notes: Groq `whisper-large-v3` | $0.111 per audio hour | under 1 |
| Server voice: edge-tts | no price; unofficial client, no SLA **[terms: see below]** | 0 |
| Server voice fallback: Addis AI TTS | $0.032 per generated minute | about 3 per 100 minutes listened |
| Telegram bot | free | 0 |
| SMS gateway | depends on the Ethiopian provider; Amharic = 3 segments per 160 characters | not included |
| **Total** | | **about 10 to 40**: 10 to 20 with `PROVIDER=none` |

No feature depends on a paid service: with `PROVIDER=none` everything still works with keyword answers.

**edge-tts terms.** edge-tts (GPL-3.0 client code) talks to the online read-aloud service that Microsoft built for its Edge browser; it is not an official API, has no SLA, and Microsoft already restricts what unofficial clients can send. Fine for the hackathon; for production, ALX should either use Microsoft's paid Azure AI Speech or rely on Addis AI (official API, paid per minute) plus our pre-generated audio. The final legal reading belongs to ALX.

## Finished and not finished

| Item | State |
| --- | --- |
| Script tag on 3 starter pages + blank page; panel (side pill, `showModal()`) and inline modes | Done; automated keyboard/axe/reflow check passes |
| Skip-link patch; source links move focus to the heading; Escape returns focus | Done; automated |
| Bilingual keyword search, "could not find" + person, no-advice guard | Done; 32/32 in-scope, 11/11 out-of-scope on our draft eval set; same algorithm in browser and server (identical scores, tested) |
| AI providers cloud/local/none with grounding guard | Done; Gemini and Groq answered live on 15 Nov; Ollama path written, not run here |
| Consent card, "Online answers" toggle | Done |
| Talk to a person, helper page, honest wait message, polling replies, webhook | Done; API tests pass; end-to-end with a phone pending |
| Screen share (desktop) / screenshot (Android) | Done (frames by polling, no WebRTC); manual test pending |
| Amharic voice: 65 pre-generated MP3s + `/voice/speak` | Done; generated with edge-tts; Amharic DRAFT |
| Mic (browser speech recognition) | Done; Chrome's Amharic recognition quality needs a person to test (testing plan 4.8) |
| Telegram bot (text, voice note, /help, /alerts, /stop, /lang, /consent) | Built; **not tested with a phone**: the team laptop's network cannot reach `api.telegram.org` (connection refused, checked 15 Nov), so the bot logs a clear message and retries. Run it on a network that reaches Telegram, or set `TELEGRAM_PROXY` |
| Text route `/sms/inbound` (≤160 characters) | Done; tests check every reply length |
| Jobs page, JobPosting JSON-LD, job answers with trust line and deadline, alerts, accommodation request | Done; validator.schema.org check pending |
| Data export/delete, teacher view API | Done (teacher view: API only, no page) |
| Install page (no login) | Done; axe clean |
| TalkBack, NVDA, co-designer, Slow 3G time, clean-laptop install | **Pending manual tests** |
| Addis AI (TTS fallback, Amharic STT) | Integrated from the official docs; key valid, but the account had **no credit** on 15 Nov, so audio from Addis is not yet verified. Top up and test |
| Hosted dashboard with login, LTI 1.3 | Not built (hardening sprint; LTI plan above) |

## Development

```bash
python scripts/verify_prototype.py                 # one-command demo check: PASS/FAIL per area (36 checks)
npm --prefix module test                           # i18n parity, search eval, contrast
python -m pytest api                               # API logic and contract (31 tests)
npm --prefix module install                        # dev only: puppeteer-core, axe-core
node module/scripts/a11y-check.mjs                 # browser flow + axe (server on :8080)
npm --prefix module run axe                        # npx @axe-core/cli on every page
python api/scripts/export_openapi.py               # regenerate openapi.yaml
python api/scripts/build_jobs_page.py              # regenerate jobs.html + jobs-content.json from jobs.json
python api/scripts/gen_audio.py [--force]          # regenerate Amharic audio
npm --prefix module run icons                      # re-copy Lucide icons into the module and demo/icons.svg
```

## Libraries and their licences

| Library | Where | Licence |
| --- | --- | --- |
| none at runtime | `module/db-assistant.js` (zero dependencies) | |
| Lucide icons 0.460.0 (32 SVG icons copied into the module by `module/scripts/sync-icons.mjs`; 18 in `demo/icons.svg`) | module, install page | ISC |
| FastAPI, Starlette, Uvicorn, Pydantic, SQLAlchemy, httpx, python-multipart | `api/` | MIT / BSD-3 / BSD-3 / MIT / MIT / BSD-3 / Apache-2.0 |
| cryptography | `api/` | Apache-2.0 or BSD-3 |
| edge-tts | `api/` (voice) | LGPL-3.0 **[online service terms unverified]** |
| aiogram | `bot/` | MIT |
| nginx:alpine, python:3.12-slim | Docker images | BSD-2 / PSF and Debian licences |
| pytest | tests | MIT |
| puppeteer-core, axe-core, lucide-static | dev only | Apache-2.0 / MPL-2.0 / ISC |

## Licence

Licence named at kick-off: **TBD** (see `LICENSE`). We will confirm it with the mentor and replace `LICENSE` with its text.
