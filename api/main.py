"""SYLY db-assistant API: /api/v1, Swagger UI at /docs (guide section 6)."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import models  # noqa: F401 - registers tables
from config import settings
from db import Base, SessionLocal, engine
from routers import ask, data, help, jobs, sms, voice
from services import content

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("syly")


@asynccontextmanager
async def lifespan(_app: FastAPI):  # noqa: ANN201
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        content.seed(db)
    log.info("provider=%s ai_enabled=%s", settings.provider, settings.ai_enabled)
    yield


app = FastAPI(
    title="SYLY db-assistant API",
    version="1.0.0",
    description="Course-grounded multilingual assistant, human help, text route and career gateway (Track 3).",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.host_origins,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "X-Helper-Key"],
)


@app.exception_handler(RequestValidationError)
async def bad_request(_req: Request, exc: RequestValidationError) -> JSONResponse:
    """Guide section 6: 400 with a message in words."""
    parts = []
    for err in exc.errors():
        field = ".".join(str(x) for x in err.get("loc", []) if x not in ("body", "query", "path"))
        parts.append(f"{field}: {err.get('msg')}" if field else str(err.get("msg")))
    return JSONResponse(status_code=400, content={"detail": "Bad input. " + "; ".join(parts)})


@app.get("/api/v1/health", tags=["assistant"])
def health() -> dict[str, str]:
    return {"status": "ok"}


for r in (ask.router, help.router, jobs.router, sms.router, voice.router, data.router):
    app.include_router(r)
