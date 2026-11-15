"""Course and job content: the one index every door searches (FR-T2, FR-T11, FR-AD1)."""

from __future__ import annotations

import json
import logging
from datetime import date

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from config import settings
from models import Job, Section
from services.jobs_format import job_to_section  # noqa: F401 - re-exported
from services.retrieval import Index

log = logging.getLogger("syly")
_index: Index | None = None


def same_page(section_url: str, page_url: str) -> bool:
    """True when a section's link points at the page (path only; host and #fragment ignored)."""
    from urllib.parse import urlparse

    return bool(section_url) and urlparse(section_url).path.rstrip("/") == urlparse(page_url).path.rstrip("/")


def page_to_section(sec: dict) -> dict:
    """A page section (FR-AD4) in the bilingual index shape; Amharic page text goes to the _am fields."""
    am = (sec.get("lang") or "").lower().startswith("am")
    return {
        "id": sec.get("id") or "page-section",
        "url": sec["url"],
        "type": "page",
        "source": "page",
        "title_en": "" if am else sec.get("title", ""),
        "text_en": "" if am else sec.get("text", ""),
        "title_am": sec.get("title", "") if am else "",
        "text_am": sec.get("text", "") if am else "",
        "keywords_en": [],
        "keywords_am": [],
    }


def _load_json(path) -> dict:  # noqa: ANN001
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        log.warning("Could not read %s: %s", path, e)
        return {}


def seed(db: Session) -> None:
    """First start: load demo content and test jobs if the tables are empty."""
    if db.scalar(select(Section).limit(1)) is None:
        data = _load_json(settings.seed_content)
        replace_lessons(db, data.get("sections") or [])
    if db.scalar(select(Job).limit(1)) is None:
        for job in _load_json(settings.seed_jobs).get("jobs") or []:
            upsert_job(db, job, notify=False)
    db.commit()
    rebuild(db)


def replace_lessons(db: Session, sections: list[dict]) -> int:
    db.execute(delete(Section).where(Section.kind == "lesson"))
    for s in sections:
        db.add(Section(id=s["id"], kind="lesson", url=s["url"], data=s))
    return len(sections)


def upsert_job(db: Session, job: dict, notify: bool = True) -> bool:
    """Returns True if the job is new."""
    existing = db.get(Job, job["id"])
    if existing:
        existing.data = job
    else:
        db.add(Job(id=job["id"], data=job))
    sec = job_to_section(job)
    row = db.get(Section, sec["id"])
    if row:
        row.data, row.url = sec, sec["url"]
    else:
        db.add(Section(id=sec["id"], kind="job", url=sec["url"], data=sec))
    return existing is None


def rebuild(db: Session) -> Index:
    global _index
    sections = [row.data for row in db.scalars(select(Section)).all()]
    _index = Index(sections, settings.threshold_en, settings.threshold_am)
    return _index


def index(db: Session) -> Index:
    return _index or rebuild(db)


def deadline_passed(section: dict, today: date | None = None) -> bool:
    d = section.get("deadline")
    if not d:
        return False
    try:
        return date.fromisoformat(d) < (today or date.today())
    except ValueError:
        return False
