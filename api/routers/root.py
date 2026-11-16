"""The API's front door, GET /: a small page for people in a browser, JSON for programs (Accept: application/json or ?format=json).

Shows nothing private: no settings, no keys, no counts. Not part of the OpenAPI document.
"""

from __future__ import annotations

import html
from datetime import datetime, timezone

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, JSONResponse, Response
from sqlalchemy import text

from config import settings
from db import SessionLocal

router = APIRouter()

REPO = "https://github.com/yamneg96/SYLY"
LANGUAGES = [("English", "en", False), ("አማርኛ", "am", False), ("العربية", "ar", False), ("Afaan Oromoo", "om", True), ("ትግርኛ", "ti", True), ("Soomaali", "so", True)]
ENDPOINTS = [
    ("POST", "/api/v1/ask", "Answer a question from the course, with sources"),
    ("POST", "/api/v1/escalations", "Talk to a person: open a request"),
    ("POST", "/api/v1/voice/speak", "Read an answer aloud"),
    ("POST", "/api/v1/voice/transcribe", "Turn a recording into text"),
    ("GET", "/api/v1/jobs", "Test jobs with schema.org JobPosting"),
    ("GET", "/api/v1/sites/{key}/config", "The widget settings of a registered site"),
    ("POST", "/sms/inbound", "The text-message route (160 characters)"),
]


def _database_ok() -> bool:
    try:
        with SessionLocal() as db:
            db.execute(text("select 1"))
        return True
    except Exception:  # noqa: BLE001 - a page about status must not crash because the database is down
        return False


def _wants_json(request: Request) -> bool:
    accept = request.headers.get("accept", "")
    return request.query_params.get("format") == "json" or ("application/json" in accept and "text/html" not in accept)


PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SYLY API</title>
<meta name="description" content="The SYLY API: answers learners' questions from the course, with sources, in six languages.">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23002B56'/%3E%3Cpath d='M14 40v-8M24 46V18M34 50V14M44 46V18M54 40v-8' stroke='%23F5A300' stroke-width='5' stroke-linecap='round'/%3E%3C/svg%3E">
<style>
  :root { --navy:#002B56; --deep:#061A33; --amber:#F5A300; --ink:#111111; --muted:#4A5568; --line:#DDE3EC; --canvas:#F5F7FB; --card:#FFFFFF; --soft:#EEF3FA; --ok:#0A7A3D; --link:#002B56; }
  @media (prefers-color-scheme: dark) { :root { --ink:#F2F2F2; --muted:#CBD5E1; --line:#2C3E5C; --canvas:#0B1220; --card:#111B2E; --soft:#1B2A44; --ok:#6EE7A0; --link:#9CC9FF; } }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--canvas); color:var(--ink); font:16px/1.6 system-ui,-apple-system,"Segoe UI","Noto Sans Ethiopic","Noto Sans Arabic",sans-serif; }
  a { color:var(--link); }
  :focus-visible { outline:3px solid var(--amber); outline-offset:2px; border-radius:4px; }
  .hero { background:radial-gradient(40rem 20rem at 85% 0%,rgba(91,164,255,.28),transparent 60%),linear-gradient(180deg,var(--deep),#0A2547); color:#fff; border-bottom:4px solid var(--amber); }
  .wrap { max-width:60rem; margin:0 auto; padding:0 1.25rem; }
  .hero .wrap { padding-top:3rem; padding-bottom:3rem; }
  .brand { display:flex; align-items:center; gap:.75rem; font-weight:800; font-size:1.25rem; letter-spacing:.02em; }
  .mark { width:2.5rem; height:2.5rem; border-radius:.75rem; background:var(--navy); border:1px solid rgba(255,255,255,.25); display:grid; place-items:center; }
  .badge { font-size:.8rem; font-weight:800; padding:.15rem .6rem; border-radius:999px; background:rgba(255,255,255,.14); border:1px solid rgba(255,255,255,.3); }
  h1 { margin:1.25rem 0 .5rem; font-size:clamp(2rem,1.4rem + 3vw,3rem); line-height:1.1; font-weight:800; letter-spacing:-.02em; }
  .lead { margin:0; max-width:40rem; font-size:1.125rem; color:#DCE6F2; }
  .status { display:inline-flex; align-items:center; gap:.5rem; margin-top:1.5rem; padding:.4rem .9rem; border-radius:999px; background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.28); font-weight:700; }
  .dot { width:.7rem; height:.7rem; border-radius:50%; background:#6EE7A0; box-shadow:0 0 0 4px rgba(110,231,160,.25); }
  .dot.bad { background:#FF8A9B; box-shadow:0 0 0 4px rgba(255,138,155,.25); }
  main { padding:2.5rem 0 3rem; }
  h2 { margin:2.25rem 0 .75rem; font-size:1.375rem; }
  h2:first-child { margin-top:0; }
  .grid { display:grid; gap:1rem; grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr)); }
  .card { display:block; background:var(--card); border:1px solid var(--line); border-radius:1rem; padding:1.1rem 1.25rem; text-decoration:none; color:inherit; box-shadow:0 1px 2px rgba(6,26,51,.06); }
  a.card:hover { border-color:var(--navy); transform:translateY(-2px); }
  @media (prefers-reduced-motion: no-preference) { a.card { transition:transform .15s,border-color .15s; } }
  .card b { display:block; color:var(--link); font-size:1.05rem; }
  .card span { color:var(--muted); font-size:.95rem; }
  .chips { display:flex; flex-wrap:wrap; gap:.5rem; padding:0; margin:0; list-style:none; }
  .chips li { padding:.3rem .85rem; border-radius:999px; background:var(--soft); font-weight:700; color:var(--link); }
  .chips small { font-weight:600; color:var(--muted); }
  .table { overflow-x:auto; }
  table { width:100%; border-collapse:collapse; background:var(--card); border:1px solid var(--line); border-radius:.75rem; }
  th,td { text-align:start; padding:.55rem .8rem; border-bottom:1px solid var(--line); vertical-align:top; }
  th { background:var(--soft); }
  code { font-family:ui-monospace,Consolas,"Liberation Mono",monospace; font-size:.9em; }
  .m { font-weight:800; color:var(--link); }
  footer { color:var(--muted); font-size:.9rem; border-top:1px solid var(--line); padding:1.25rem 0 2.5rem; }
</style>
</head>
<body>
<header class="hero"><div class="wrap">
  <div class="brand"><span class="mark" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 64 64" focusable="false"><path d="M14 40v-8M24 46V18M34 50V14M44 46V18M54 40v-8" stroke="#F5A300" stroke-width="6" stroke-linecap="round" fill="none"/></svg></span> SYLY <span class="badge">API __VERSION__</span></div>
  <h1>Answers from the course, with the source.</h1>
  <p class="lead">The server behind the SYLY assistant: it finds the part of the course that matches a learner's question, lets an AI only put it into words when the learner allows it, links every answer to its source, and offers a real person.</p>
  <div class="status" role="status"><span class="dot__DOTCLASS__" aria-hidden="true"></span> __STATUS__</div>
</div></header>
<main><div class="wrap">
  <h2>Start here</h2>
  <div class="grid">
    <a class="card" href="/docs"><b>Interactive documentation</b><span>Try every call in the browser (Swagger).</span></a>
    <a class="card" href="/openapi.json"><b>OpenAPI file</b><span>The machine-readable description of every route.</span></a>
    <a class="card" href="/api/v1/health"><b>Health check</b><span>Answers <code>{"status":"ok"}</code> when the server is up.</span></a>
    __SITE_CARD__
    <a class="card" href="__REPO__"><b>Source code</b><span>The repository, the README and the testing guide.</span></a>
  </div>

  <h2>Languages</h2>
  <ul class="chips" aria-label="Languages">__LANGS__</ul>

  <h2>Main routes</h2>
  <div class="table"><table>
    <caption class="sr" style="position:absolute;left:-9999px">Main routes</caption>
    <thead><tr><th scope="col">Method</th><th scope="col">Route</th><th scope="col">What it does</th></tr></thead>
    <tbody>__ROUTES__</tbody>
  </table></div>
  <p>Errors always come as <code>{"detail": "…in words…"}</code>. For programs, <code>GET /</code> with <code>Accept: application/json</code> returns this page's facts as JSON.</p>
</div></main>
<footer><div class="wrap">Digital Bridge Accessibility Hackathon, ALX, Track 3. A prototype: test data only, no real personal information. Licence to be confirmed.</div></footer>
</body>
</html>
"""


def _page(version: str, ok: bool) -> str:
    langs = "".join(f'<li lang="{c}">{html.escape(n)}{" <small>beta</small>" if beta else ""}</li>' for n, c, beta in LANGUAGES)
    routes = "".join(f'<tr><td class="m">{m}</td><td><code>{html.escape(r)}</code></td><td>{html.escape(d)}</td></tr>' for m, r, d in ENDPOINTS)
    site = (f'<a class="card" href="{html.escape(settings.public_base_url)}"><b>The SYLY site</b><span>The assistant, the developer docs and the dashboard.</span></a>'
            if settings.public_base_url.startswith(("http://", "https://")) else "")
    return (PAGE.replace("__VERSION__", html.escape(version)).replace("__STATUS__", "Online" if ok else "Database unavailable")
            .replace("__DOTCLASS__", "" if ok else " bad").replace("__LANGS__", langs).replace("__ROUTES__", routes)
            .replace("__SITE_CARD__", site).replace("__REPO__", REPO))


@router.api_route("/", methods=["GET", "HEAD"], include_in_schema=False)
def root(request: Request) -> Response:
    version = request.app.version
    ok = _database_ok()
    if _wants_json(request):
        return JSONResponse({
            "name": "SYLY API", "version": version, "status": "ok" if ok else "degraded",
            "docs": "/docs", "openapi": "/openapi.json", "health": "/api/v1/health",
            "languages": [c for _, c, _ in LANGUAGES], "beta_languages": [c for _, c, beta in LANGUAGES if beta],
            "repository": REPO, "time": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }, headers={"Cache-Control": "no-store"})
    return HTMLResponse(_page(version, ok), headers={"Cache-Control": "no-store"})
