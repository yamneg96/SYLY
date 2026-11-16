"""SYLY db-assistant API: /api/v1, Swagger UI at /docs (guide section 6)."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse, Response
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

import models  # noqa: F401 - registers tables
from config import settings
from db import SessionLocal
from migrate import upgrade_to_head
from routers import ask, data, help, jobs, portal, root, sms, tutors, voice
from services import content, reminders, sites

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
for noisy in ("httpx", "httpcore"):  # these log every request URL at INFO: keep URLs (and anything in them) out of the logs
    logging.getLogger(noisy).setLevel(logging.WARNING)
log = logging.getLogger("syly")


@asynccontextmanager
async def lifespan(_app: FastAPI):  # noqa: ANN201
    upgrade_to_head()  # Alembic: creates or updates the tables (SQLite file, or DATABASE_URL such as Neon)
    with SessionLocal() as db:
        content.seed(db)
    log.info("provider=%s ai_enabled=%s", settings.provider, settings.ai_enabled)
    task = asyncio.create_task(reminders.loop())
    try:
        yield
    finally:
        task.cancel()


app = FastAPI(
    title="SYLY db-assistant API",
    version="1.0.0",
    description="Course-grounded multilingual assistant, human help, text route and career gateway (Track 3).",
    lifespan=lifespan,
)


@app.middleware("http")
async def site_origin_check(req: Request, call_next):  # noqa: ANN001, ANN201
    """A request that carries a site key (the widget sends X-Site-Key) is accepted only from that site's
    allowed origins, in addition to HOST_ORIGINS. Calls without a key, and the key's own config call, are not affected.
    Added before the CORS middleware, so the refusal still carries CORS headers and the widget can read the words."""
    key = req.headers.get("x-site-key")
    origin = req.headers.get("origin")
    if key and origin and req.method != "OPTIONS":
        with SessionLocal() as db:
            allowed = sites.allowed_origins_for(db, key)
        if allowed is None:
            return JSONResponse(status_code=403, content={"detail": "This site key is not known."})
        if not sites.origin_allowed(origin, allowed):
            return JSONResponse(status_code=403, content={"detail": "This website is not on the list of sites allowed to use this key."})
    return await call_next(req)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.host_origins,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "X-Helper-Key", "X-Site-Key", "X-Requested-With"],
)


def _reply(req: Request, status: int, message: str) -> Response:
    """Errors in words (guide section 6). The text route answers phones in plain text, at most 160 characters."""
    if req.url.path.startswith("/sms"):
        return PlainTextResponse(message[:160], status_code=status)
    return JSONResponse(status_code=status, content={"detail": message})


@app.exception_handler(RequestValidationError)
async def bad_request(req: Request, exc: RequestValidationError) -> Response:
    """Guide section 6: 400 with a message in words."""
    parts = []
    for err in exc.errors():
        field = ".".join(str(x) for x in err.get("loc", []) if x not in ("body", "query", "path"))
        parts.append(f"{field}: {err.get('msg')}" if field else str(err.get("msg")))
    if req.url.path.startswith("/sms"):
        return _reply(req, 400, "Send JSON with \"from\" (a phone number) and \"text\".")
    return _reply(req, 400, "Bad input. " + "; ".join(parts))


_WORDS = {
    404: "This address does not exist. The API is under /api/v1; see /docs for every call.",
    405: "This method is not allowed here. See /docs for the right method.",
    413: "The request is too large.",
}


@app.exception_handler(StarletteHTTPException)
async def http_error(req: Request, exc: StarletteHTTPException) -> Response:
    """Our own HTTPExceptions already carry words; framework defaults ("Not Found") get replaced."""
    detail = exc.detail if isinstance(exc.detail, str) else None
    if not detail or detail in ("Not Found", "Method Not Allowed", "Request Entity Too Large"):
        detail = _WORDS.get(exc.status_code, "The request could not be completed.")
    resp = _reply(req, exc.status_code, detail)
    for k, v in (exc.headers or {}).items():
        resp.headers[k] = v
    return resp


@app.exception_handler(sites.FieldError)
async def field_error(req: Request, exc: sites.FieldError) -> Response:
    """Portal forms: one message in words per field."""
    return JSONResponse(status_code=400, content={"detail": "Please fix the marked fields.", "fields": exc.fields})


@app.exception_handler(SQLAlchemyError)
async def db_error(req: Request, exc: SQLAlchemyError) -> Response:
    log.error("database error on %s %s: %s", req.method, req.url.path, type(exc).__name__)
    return _reply(req, 503, "The database is busy or unavailable. Please try again in a moment.")


@app.exception_handler(Exception)
async def unexpected(req: Request, exc: Exception) -> Response:
    """Last line: never show a stack trace; log it and answer in words."""
    log.exception("unexpected error on %s %s", req.method, req.url.path)
    if req.url.path.startswith("/sms"):
        return _reply(req, 500, "Sorry, something went wrong. Please try again, or send HELP.")
    return _reply(req, 500, "Something went wrong on the server. It has been logged. Please try again.")


@app.get("/api/v1/health", tags=["assistant"])
def health() -> dict[str, str]:
    return {"status": "ok"}


for r in (root.router, ask.router, help.router, jobs.router, sms.router, voice.router, data.router, portal.router, tutors.router):
    app.include_router(r)
