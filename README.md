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

### Publish it (Vercel or Cloudflare Pages + Render + Neon)

No server to manage: the static side (portal, widget, demo pages) goes on **Vercel** (or Cloudflare Pages), the API on **Render** (Docker, `render.yaml`), the data in **Neon** (`DATABASE_URL`). `vercel.json` forwards `/api`, `/sms` and `/docs` to Render so the sign-in cookie works. The Telegram bot needs an always-on process (a paid Render worker, a VPS, or a team laptop). Step by step: `docs/deployment.md`, option D. **Not deployed yet**, and the Cloudflare Pages path is untested.

### Deploy on a server

On an Ubuntu server with Docker and a domain pointing to it:

```bash
cp .env.example .env     # set keys, HELPER_KEY, HOST_ORIGINS (exact origins), PUBLIC_BASE_URL
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

`docker-compose.prod.yml` keeps port 8080 on 127.0.0.1 and restarts services after a crash or reboot. Put an HTTPS reverse proxy in front, for example Caddy with `syly.example.com { reverse_proxy 127.0.0.1:8080 }`. Back up `data/` (the SQLite database and `data/.fernet_key`; without the key, stored contacts cannot be decrypted).

### Errors

Every error is shown in words, in the learner's language: the widget shows a message for content that cannot load, a blocked microphone, failed screen sharing or screenshot, a server that cannot be reached, and any unexpected error. The API answers `{"detail": "…"}` (400, 404, 405, 503, 500, never a stack trace; `/sms/inbound` answers in plain text). The bot replies with a message in the learner's language and logs the error.

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
| `content-selector` | CSS selector of the lesson on the page, for page reading, e.g. `#lesson` | `main`, `article`, `[role=main]`, then `body` |
| `read-page` | empty or `always` (the page is read and added to any content file), `fallback` (only when there is no other content), `off` | always |

Events (all `bubbles: true, composed: true`):

```js
document.addEventListener('db-assistant:question',  e => console.log(e.detail)); // {text, language}
document.addEventListener('db-assistant:escalated', e => console.log(e.detail)); // {ticketId}
document.addEventListener('db-assistant:language',  e => console.log(e.detail)); // {language}
```

Methods on the element: `open()`, `close()`, `ask(text)`, `openAccommodation({id, title})`, `showJobAlerts(keyword)`, `getText(key, lang?)`.

The panel is a real `<dialog>` opened with `showModal()` (guide section 8); Escape closes it and returns focus to the launcher. Source links scroll to the lesson section **and move focus to its heading**. Styles live in a shadow root; the module adds nothing to the host page except `tabindex="-1"` on a heading it moves focus to.

### How SYLY gets course content

Three sources, in this order (FR-AD4):

1. **A content file**: the `content` attribute points to a bilingual `content.json` (sections with `title_en/am`, `text_en/am`, `keywords_en/am`, `url`). This is what the Savanna pages and the demos use.
2. **The server**: lessons sent once with `POST /api/v1/content`; `/api/v1/ask` searches them.
3. **Page reading** (fallback): if there is no content file and the server has no sections for this page (or cannot be reached), the widget reads the lesson already on screen, in the learner's own browser. It reads only the page it is mounted on, never changes it, and re-reads it when the page changes (3 seconds after the last change).

What page reading reads: the element matching `content-selector`, else `main`, `article` or `[role=main]`, else the whole page. It skips `nav`, `header`, `footer`, `aside`, forms, scripts, hidden content and the assistant itself. Each `h2`/`h3` starts a section (at most 50 sections, 4,000 characters each; sections under 40 characters are skipped). Source links use the heading's `id`, or a text fragment (`#:~:text=…`) when the heading has none; activating a link moves focus to that heading.

```html
<!-- the lesson is inside <div id="lesson"> on this site -->
<db-assistant lang="en" api="https://syly.example.com/api" content-selector="#lesson"></db-assistant>
```

Limits:
- An English page cannot be matched by an Amharic question offline (there is no Amharic text). The learner then gets "I could not find this in the course" and "Talk to a person". Online, after "Allow online answers", the AI receives the English sections and answers in Amharic.
- Page sections are sent to the server only after the learner allows online answers, and the server never stores them.
- Very short pages (one or two sections) can fall under the search threshold, which was tuned on full lessons.
- `read-page="off"` turns it off; `read-page="fallback"` reads the page only when there is no other content. The "Try one of these" questions come from the headings of the page being read.

Try it: `/demo/page-reading.html` (test content, no content file).

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

## Telegram bot

Start it with `docker compose up -d bot` (needs `TELEGRAM_BOT_TOKEN` in `.env`). The bot sets its command menu once at start (`setMyCommands`): English by default, plus one menu per language (`language_code` am, om, ti, so, ar). Every command also works by tapping the menu below the text box (Ask, Lesson, Talk to a person, Jobs, Settings), by typing a short phrase, or by sending a voice note.

| Command | What it does | Example phrases (en / am) |
| --- | --- | --- |
| `/start` | Welcome, choose language, consent card | start, hello / ጀምር, ሰላም |
| `/help` | What the bot can do, the menu | help, menu / እርዳታ, ምናሌ |
| `/ask` | Ask a question about the lesson (any longer message is a question too) | question / ጥያቄ አለኝ |
| `/lesson` | The lesson parts as buttons; tap one to read it (and hear it) | lesson / ትምህርት |
| `/person` | Talk to a real person (a tutor); the tutor's reply comes back here | talk to a person / ከሰው ጋር አገናኘኝ |
| `/status` | Your request to a person: waiting or answered | my request / ጥያቄዬ |
| `/jobs` | Current jobs, deadline in Ethiopian calendar for Amharic | jobs / ሥራ |
| `/alerts` | Job alerts: subscribe | alerts / ማሳወቂያዎች |
| `/myalerts` | The alerts you have, with a Stop button each | my alerts / ማሳወቂያዎቼ |
| `/stop` | Stop every job alert | stop / አቁም |
| `/accommodate` | Ask for interview support (goes to a person, never straight to the employer) | interview support / የቃለ መጠይቅ ድጋፍ |
| `/lang` | Change language | language / ቋንቋ |
| `/simple` | Simple answers on or off | simple / ቀላል |
| `/voice` | Voice replies on or off | voice / ድምፅ |
| `/consent` | Allow online answers, or answers from this page only | |
| `/mydata` | Everything stored about you, as a file | my data / መረጃዬ |
| `/delete` | Delete everything (asks first) | delete my data / መረጃዬን ሰርዝ |

All phrases are in `bot/intents.json` (3 to 8 per command and language). A message is treated as a command only if it is short (5 words or fewer, 40 characters or fewer) and matches a phrase exactly or closely (letter-trigram similarity 0.6 or more, with a clear lead over the next command). Everything else is a question. Spoken "delete" and "stop" always ask first: "Yes" or "No, it was a question".

**Voice notes.** The bot downloads the note (up to 20 MB), converts it to 16 kHz WAV with ffmpeg (inside the Docker image), and sends it to the speech-to-text engines below in order, 15 seconds each (`STT_TIMEOUT`). It replies "I heard: «…»" and then acts on it. Audio leaves the server only after the learner allows online answers (`/consent`). If every engine fails, the bot says so and offers "Talk to a person". The same router is at `POST /api/v1/voice/transcribe` (returns `text`, `language`, `engine`). With `/voice` on, answers also come back as a voice note (OGG/Opus).

| Language | Status | Speech-to-text, in order | Measured word accuracy (`scripts/stt_check.py`, 5 synthetic edge-tts clips each, 15 Nov; real phones will score lower) | Voice replies |
| --- | --- | --- | --- | --- |
| English (en) | Done | Groq Whisper → Gemini | 5/5 clips 100% (Groq) | Microsoft neural voice (edge-tts) |
| Amharic (am) | Done, **weak speech-to-text** | Addis AI → Gemini → Groq Whisper | 9 to 13% word accuracy (Gemini; Groq Whisper 0%; Addis had no credit). Typed Amharic works fully; spoken Amharic needs Addis credit and a real-phone test | edge-tts, Addis AI fallback |
| Afaan Oromo (om) | Beta | Addis AI → Gemini | **Untested**: Addis had no credit and there is no synthetic Oromo voice; needs self-recorded clips | Addis AI (no credit, so text only for now) |
| Tigrinya (ti) | Beta | Gemini (Meta MMS optional, off) | **Untested**: no synthetic Tigrinya voice; needs self-recorded clips | none (text only) |
| Somali (so) | Beta, **weak speech-to-text** | Gemini → Groq Whisper (swapped from the spec after measuring) | Gemini 20 to 23%, Groq Whisper 0% (wrote Somali sounds in English spelling) | edge-tts (so-SO-UbaxNeural) |
| Arabic (ar) | Beta | Groq Whisper → Gemini | 90% (4 of 5 clips exact, Groq) | edge-tts |

Beta means: the interface text and phrases are machine-assisted drafts (**needs native reader check**) and the speech engines have not been tested with real speakers. Meta MMS (`MMS_ENABLED=true`) runs locally but its weights are **CC-BY-NC 4.0 (non-commercial)**; it is off by default. Engine licences: Groq, Gemini and Addis AI are paid or free-tier online APIs under their own terms **[unverified for this use]**.

**Add a language:** add its phrases to `bot/intents.json` (with `"_draft": {"xx": true}` until a native reader checks them), copy `bot/i18n/en.json` to `bot/i18n/xx.json` and translate every value, add `xx` to `LANGS` in `bot/bot.py` and to `ORDER` in `api/services/stt/router.py` with the engines that support it, add a voice to `VOICES` in `api/services/tts.py` if there is one, then run `python -m pytest bot api` and `python scripts/stt_check.py xx` with a few self-recorded clips.

## Developer portal

A small website for the people who add SYLY to their sites. It is a **React app in `web/`** (Vite, React 19, TypeScript, Tailwind 4 and [shadcn/ui](https://ui.shadcn.com) with the `b0` preset; TanStack Query and Table, Zod, Zustand, React Hook Form, React Router; tests with Vitest, Testing Library and axe). `docker compose up --build` builds it into the `web` image, and the same nginx serves it at `/`; the learner pages (`/pages/...`, `/demo/...`, `/module/...`) are unchanged and the Savanna starter's own index is at `/starter`. It uses test data only and everything in it is optional: with no `GOOGLE_CLIENT_ID`, sign-in and the dashboard say "Sign-in is not configured on this server" and every other page works. `docker compose up` needs no new setting.

| Page | What it is |
| --- | --- |
| `/` | Home: what SYLY is, who it is for, the three levels, how it works, a live demo (our own `<db-assistant mode="inline">` answering about SYLY from `web/public/data/content.json`), team and licence |
| `/documentation` | Install (server, CDN, npm), attributes, events, REST API, content sources, Telegram bot, bring your own bot, accessibility, privacy. Our own assistant is on this page and reads it (`read-page="always"`) |
| `/privacy` | What is stored for learners and for developers, how to delete |
| `/signin` | Sign in with Google (developers only, never learners) |
| `/dashboard` | Your sites: create, edit, delete, get the install code, download or delete your data |
| `/demo/install.html` | The configurator with a live preview (unchanged, now linked from Home) |

All page text is in `web/src/i18n/en.json` and `am.json` (the Amharic is a **draft, needs a native reader check**); a test fails if the two files do not have the same keys. A page language picker and a light/dark button are in the header. There is no single-key keyboard shortcut (WCAG 2.1.4). Work on it with `npm --prefix web run dev` (http://localhost:5173, forwards `/api`, `/module` and `/demo` to the stack on :8080); `npm --prefix web test` runs the tests (**in PowerShell on Windows**: Git Bash's lower-case `d:` makes Vitest load twice).

### Sites and site keys

A developer signs in, adds a **site** (name, allowed origins, default language, layout, theme, one optional primary colour with the 4.5:1 check against white, content source, a Telegram bot's public username), and gets a public key `pk_…` plus the code to paste:

```html
<script src="https://your-host/module/db-assistant.js" defer></script>
<db-assistant site="pk_0123456789abcdef01234567" api="https://your-host/api"></db-assistant>
```

- With `site`, the widget first fetches `GET /api/v1/sites/{key}/config` (public, cacheable, nothing private) and applies it. **Attributes written on the tag always win.** If the fetch fails, it uses the attributes and the defaults and keeps working.
- Every API call from that widget carries `X-Site-Key`. A request with a key is accepted only from the site's **allowed origins** (in addition to `HOST_ORIGINS`); an unknown key or another origin gets a 403 in words.
- Settings that are stored but not applied yet: "voice replies on by default" (the web assistant has no automatic voice).
- The dashboard does not show usage counts yet (optional in the spec; not built).

### Google sign-in setup (for the team lead)

1. In Google Cloud Console, create an **OAuth client ID** of type *Web application* (APIs & Services → Credentials). The consent screen needs only the default scopes (`openid`, `email`, `profile`).
2. Add the **stable HTTPS address** of the deployed site and `http://localhost:8080` under *Authorized JavaScript origins*.
3. Put the client ID in `.env` as `GOOGLE_CLIENT_ID`, then `docker compose up -d api`.

**A quick-tunnel address (`trycloudflare.com`) changes every restart, so Google sign-in needs the stable deployed address (deployment option B or C in `docs/deployment.md`).** The client ID is public (the sign-in page needs it); there is no client secret in this flow.

How it works: Google Identity Services gives the page an ID token; the page sends it to `POST /api/v1/auth/google`; the server checks signature, audience, issuer, expiry and a verified e-mail with the official `google-auth` library, creates or updates the account (`google_sub`, e-mail, name), and sets one cookie: **HttpOnly, SameSite=Lax, Secure when the request is HTTPS, signed with `SESSION_SECRET`, 7 days**. `SESSION_SECRET` is generated once into `data/.session_secret` if you leave it empty; set it yourself on a host with no persistent disk. Every state-changing call (`POST`, `PATCH`, `DELETE`) must carry `X-Requested-With: syly`. A site belongs to one account: another account gets 404.

**Accessibility of the sign-in page:** the Google button is Google's own iframe. The page gives a plain-text explanation, a link that skips the button, and an ordinary button ("Open Google's quick sign-in prompt") as a keyboard and screen-reader route. **Manual test with NVDA and the keyboard is pending**; if the Google button cannot be reached by keyboard, that is a third-party limitation and is recorded in `CONFORMANCE.md` with the workaround.

### Database: SQLite by default, Neon Postgres when you set `DATABASE_URL`

Tables are created and updated by **Alembic** migrations (`api/migrations/`), run automatically when the API starts (`python api/migrate.py` does it by hand). An older database made before migrations existed is adopted in place, with its data (tested). With `DATABASE_URL` empty the API uses `data/syly.db` as before. For a hosted database, for example [Neon](https://neon.tech):

```
DATABASE_URL=postgresql://USER:PASSWORD@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

`postgres://` and `postgresql://` URLs are accepted (psycopg 3 is the driver). Neon pauses idle databases, so connections are tested before use. To change a table: edit `api/models.py`, run `alembic revision -m "what changed"` in `api/`, write the change in the new file in `api/migrations/versions/`, and run the tests (one test fails if models and migrations disagree). **Not yet tested against a real Neon database**: the migrations are tested on SQLite, and every table and index is checked to compile for the Postgres dialect.

## Bring your own Telegram bot

The host runs our stack with **their own** Telegram bot. SYLY never receives the token and stores none.

1. Open @BotFather in Telegram, send `/newbot`, choose a name and a username that ends in `bot`.
2. Copy the token.
3. Put it in **your** server's `.env` as `TELEGRAM_BOT_TOKEN`.
4. `docker compose up -d bot`.
5. Optional: `/setuserpic` and `/setdescription` with BotFather, to show your logo and a description.
6. The commands and phrases register themselves when the bot starts.

**Never paste your bot token into a website or a chat. Keep it only in your server's `.env`.** The dashboard has an optional field for the bot's public username (for example `@MyCollegeHelpBot`), which is not secret and only shows the right link in your generated code. There is no token field anywhere.

## CDN and npm

**CDN (jsDelivr, from the public GitHub repository, pinned to a tag):**

```html
<script src="https://cdn.jsdelivr.net/gh/yamneg96/SYLY@v1.0.0/module/db-assistant.js" defer></script>
<db-assistant lang="en" api="https://your-host/api" content="https://your-host/content.json"></db-assistant>
```

The module loads `i18n/*.json` next to its own script address and falls back to the copies inlined in the file, so it works from the CDN. **`api` and `content` must be full `https://` addresses** when the script comes from a CDN. The tag `v1.0.0` must exist on GitHub first (`git tag v1.0.0` then `git push origin v1.0.0`; the team lead pushes it).

**npm:** the package is `syly-db-assistant` (the name was free on 15 Nov; `npm view syly-db-assistant` answered 404). Its folder is `module/`; it ships only `db-assistant.js`, `i18n/`, `audio/`, `README.md` and `LICENSE`, has no dependencies, and is **not published yet**. Use after publishing:

```bash
npm i syly-db-assistant
```

```js
import 'syly-db-assistant/db-assistant.js';   // import on the client only; the component needs a browser
```

or `<script src="/node_modules/syly-db-assistant/db-assistant.js" defer></script>`. Publishing needs the team lead's npm account: from `module/`, run `npm pack --dry-run` to see the files (72 files, 1.9 MB with the audio), then `npm publish`.

## Languages

All interface text is in JSON: `module/i18n/{en,am,ar}.json` (widget; inlined in `db-assistant.js` so one script tag works anywhere), `api/i18n/*.json` (text route, alerts, job notes), `bot/i18n/*.json` (Telegram), `demo/i18n/*.json` (helper and install pages). Tests check that every language has every key. To add a language to the widget: add `module/i18n/<code>.json` with the same keys and use `lang="<code>"` (it is fetched next to the script); run `npm --prefix module run i18n` to refresh the inlined copies after editing en/am/ar.

**Amharic DRAFT – needs native reader check.** The Amharic lesson text in `demo/data/content.json`, the Amharic job text, every Amharic interface string, the pre-generated Amharic audio and the Amharic eval questions were drafted by the team (machine-assisted) and have not yet been checked by a native reader. After corrections run `python api/scripts/gen_audio.py --force` to regenerate the audio.

### Voice in every language

The widget, the API and the Telegram bot offer the same six languages: English, Amharic, Arabic and, as **beta** (machine-assisted drafts: **needs a native reader check**), Afaan Oromo (`om`), Tigrinya (`ti`) and Somali (`so`). The language list at the top of the panel shows all six, in their own names.

| Language | Panel text | Reading aloud (Listen) | Microphone in the widget | Voice notes in Telegram | Measured (16 Nov, synthetic clips) |
| --- | --- | --- | --- | --- | --- |
| English | Done | Online read-aloud voice (Aria) | Chrome's own recognition | Groq, then Gemini | voice to text and back 100% |
| Amharic | Draft | Online voice (Mekdes) and pre-recorded MP3s | Chrome (`am-ET`); on failure, recorded and sent to the server | Addis AI, Gemini, Groq | voice works; listening 5 to 16% (Addis AI has no credit) |
| Arabic | Done, right to left | Online voice (Zariyah) | Chrome (`ar-SA`); on failure, recorded | Groq, then Gemini | voice to text and back 90% |
| Somali (beta) | Draft | Online voice (Ubax) | Chrome (`so-SO`, unverified); on failure, recorded | Gemini, then Groq | voice works; listening 20 to 27% |
| Afaan Oromo (beta) | Draft | **Gemini voice** (no voice in the online list) | **Recorded and sent to the server** (Chrome has no recognition for it) | Addis AI, then Gemini | voice produced; pronunciation unverified; listening untested (Addis AI has no credit) |
| Tigrinya (beta) | Draft | **Gemini voice** | **Recorded and sent to the server** | Gemini | voice produced; pronunciation unverified; listening 0 to 33% |

How the microphone chooses: English, Amharic, Arabic and Somali use Chrome's recognition (free, needs the network). Afaan Oromo and Tigrinya, a browser without recognition (Firefox, Safari), and any language Chrome refuses are **recorded for up to 30 seconds and sent to `POST /api/v1/voice/transcribe`**. That sends audio to an online service, so it needs the learner's consent ("Online answers"); without it the panel says so in words and opens no microphone. The text goes into the question box and is **not sent** until the learner presses Send.

Questions: the lesson text is English and Amharic. A question in Arabic, Afaan Oromo, Tigrinya or Somali is translated to English for the search (needs consent), and the answer is written in the learner's language. Without consent those languages get the English or Amharic course text, or "could not find".

Reading aloud for Afaan Oromo and Tigrinya uses Gemini's text-to-speech (`gemini-3.8-flash-tts`, then the lite and preview models in `GEMINI_TTS_MODEL`). **The free Gemini voice has small quotas** (a model answers 429 when used up; it is skipped for 5 minutes and the next one is tried), and a native speaker must still judge the pronunciation. If no voice can be made, the panel says "No voice is available for this answer. It is shown as text." and the bot says it in the chat's language: never silence. `python scripts/voice_roundtrip.py` and `npm --prefix module run voice` test this (testing guide Y2.5, Y2.6).

Dates: Ethiopian calendar for Amharic via `Intl.DateTimeFormat('am-ET-u-ca-ethiopic', …)` (job deadlines, with the Gregorian date beside it).

## Offline and slow connection

- `module/db-assistant.js`: 109 KB raw, **32 KB gzipped** (nginx gzip on), no dependencies. Lesson `content.json`: 17 KB raw, 6 KB gzipped. Audio (2.2 MB, 65 small MP3s) loads only when "Listen" is pressed.
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
| Telegram bot: 17 commands, menu buttons, phrases, voice notes (am/en), voice replies, /mydata, /delete | Built on branch `new-feature-bot`; bot and API tests pass with a fake Telegram; **not tested with a phone**: the team laptop's network cannot reach `api.telegram.org`, so run it on a network that reaches Telegram or set `TELEGRAM_PROXY`. Amharic speech-to-text weak (see Telegram bot) |
| Text route `/sms/inbound` (≤160 characters) | Done; tests check every reply length |
| Jobs page, JobPosting JSON-LD, job answers with trust line and deadline, alerts, accommodation request | Done; validator.schema.org check pending |
| Data export/delete, teacher view API | Done (teacher view: API only, no page) |
| Install page (no login) | Done; axe clean |
| Page reading fallback (FR-AD4) | Done on branch `new-feature`; unit, API and browser tests pass; manual screen-reader test pending |
| TalkBack, NVDA, co-designer, Slow 3G time, clean-laptop install | **Pending manual tests** |
| Addis AI (TTS fallback, Amharic STT) | Integrated from the official docs; key valid, but the account had **no credit** on 15 Nov, so audio from Addis is not yet verified. Top up and test |
| Developer portal: Home, Docs, Privacy (A) | Done on `main`, as a React app (`web/`); 42 unit and component tests, axe clean in en and am, skip link and 320 px checked in a real browser; manual screen-reader test pending; Amharic draft |
| Bring your own Telegram bot (B) | Done (guide on Install, Docs, README and in the dashboard); no token is stored anywhere |
| CDN and npm (C) | CDN: documented, **needs the git tag `v1.0.0` pushed**. npm: package `syly-db-assistant` ready (`npm pack` checked), **not published** (needs the team lead's npm account) |
| Google sign-in (D) | Built and tested with a mocked verifier; **not tried with a real `GOOGLE_CLIENT_ID`** (needs a Google OAuth client and a stable HTTPS address) |
| Dashboard (E) | Built: sites, settings, site keys, install code, account export/delete; checked in a browser with a seeded session. Usage counts not built. "Voice on by default" is stored but not applied. Manual NVDA test pending |
| Database: Alembic migrations, Neon (`DATABASE_URL`) | Migrations tested on SQLite (including adopting an older database); Postgres DDL compiles; **not tested against a real Neon database** |
| LTI 1.3 | Not built (hardening sprint; LTI plan above) |

## Development

```bash
python scripts/verify_prototype.py                 # one-command demo check: PASS/FAIL per area (37 checks)
python -m pytest bot                               # bot commands, phrases, voice flow, /delete (fake Telegram)
node module/scripts/site-check.mjs                # portal pages: axe en+am, skip link, 320 px, home demo, dashboard (SESSION_COOKIE seeds a signed-in run)
python api/migrate.py                              # run the database migrations by hand (the API also does it at start-up)
python scripts/stt_check.py --make-clips am en     # synthetic speech clips (edge-tts) into data/stt-clips
python scripts/stt_check.py am en                  # speech-to-text engine and word accuracy per clip
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
| aiogram, aiohttp-socks | `bot/` | MIT / Apache-2.0 |
| Alembic, google-auth, requests | `api/` (migrations, Google sign-in) | MIT / Apache-2.0 / Apache-2.0 |
| psycopg 3 (binary) | `api/` (Postgres driver, only used with `DATABASE_URL`) | LGPL-3.0 |
| ffmpeg (Debian package in the API image) | voice note conversion | LGPL-2.1+ (GPL parts not used) **[unverified build flags]** |
| Meta MMS weights (optional, off) | `api/services/stt/mms_local.py` | CC-BY-NC 4.0, non-commercial |
| nginx:alpine, python:3.12-slim | Docker images | BSD-2 / PSF and Debian licences |
| pytest | tests | MIT |
| puppeteer-core, axe-core, lucide-static | dev only | Apache-2.0 / MPL-2.0 / ISC |

## Licence

Licence named at kick-off: **TBD** (see `LICENSE`). We will confirm it with the mentor and replace `LICENSE` with its text.
