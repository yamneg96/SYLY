"""Tables (SDS 2.3). Contacts are encrypted; accommodation needs are stored apart."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from db import Base


def now() -> datetime:
    return datetime.now(timezone.utc)


class Section(Base):
    """A citable unit: a lesson section or a job record (FR-T2, FR-T11)."""

    __tablename__ = "sections"
    id: Mapped[str] = mapped_column(String(200), primary_key=True)
    kind: Mapped[str] = mapped_column(String(20), default="lesson")  # lesson | job
    url: Mapped[str] = mapped_column(String(500))
    data: Mapped[dict] = mapped_column(JSON)  # bilingual fields as in content.json


class Question(Base):
    """Minimum record for the teacher view: no name, no contact (FR-AD3)."""

    __tablename__ = "questions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    conversation_id: Mapped[str] = mapped_column(String(64), index=True)
    text: Mapped[str] = mapped_column(Text)
    language: Mapped[str] = mapped_column(String(8))
    section_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    provider: Mapped[str] = mapped_column(String(20))
    consent_ai: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Ticket(Base):
    __tablename__ = "tickets"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    conversation_id: Mapped[str | None] = mapped_column(String(64), index=True, nullable=True)
    channel: Mapped[str] = mapped_column(String(20), default="web")  # web | telegram | sms
    status: Mapped[str] = mapped_column(String(20), default="waiting")  # waiting | active | closed
    language: Mapped[str] = mapped_column(String(8), default="am")
    page_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    section: Mapped[str | None] = mapped_column(String(200), nullable=True)
    screenshot: Mapped[str | None] = mapped_column(Text, nullable=True)  # data URL, test data only
    notify_enc: Mapped[str | None] = mapped_column(Text, nullable=True)  # Telegram chat id, encrypted
    helper_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    # Learner-side secret: ticket ids are sequential, so reads need this token too.
    access_token: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("tickets.id", ondelete="CASCADE"), index=True)
    author: Mapped[str] = mapped_column(String(20))  # learner | assistant | helper | system
    name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    text: Mapped[str] = mapped_column(Text)
    lang: Mapped[str | None] = mapped_column(String(8), nullable=True)
    sources: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Job(Base):
    __tablename__ = "jobs"
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    data: Mapped[dict] = mapped_column(JSON)  # our fields + schema.org JobPosting (jsonld)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Alert(Base):
    __tablename__ = "alerts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    channel: Mapped[str] = mapped_column(String(20))  # telegram | sms
    address_enc: Mapped[str] = mapped_column(Text)  # chat id or +251 phone, encrypted
    address_hash: Mapped[str] = mapped_column(String(64), index=True)
    keyword: Mapped[str] = mapped_column(String(100), default="")
    location: Mapped[str] = mapped_column(String(100), default="")
    language: Mapped[str] = mapped_column(String(8), default="am")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Outbox(Base):
    """Text-route messages waiting for an SMS gateway (none at the hackathon)."""

    __tablename__ = "outbox"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    to_enc: Mapped[str] = mapped_column(Text)
    text: Mapped[str] = mapped_column(String(160))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Accommodation(Base):
    """Interview support needs: stored apart from everything else, helper-only (FR-J4, NFR-S3)."""

    __tablename__ = "accommodations"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_id: Mapped[str] = mapped_column(String(100))
    needs: Mapped[list] = mapped_column(JSON)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    contact_channel: Mapped[str] = mapped_column(String(20), default="none")
    contact_enc: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str] = mapped_column(String(8), default="am")
    status: Mapped[str] = mapped_column(String(20), default="waiting")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Webhook(Base):
    __tablename__ = "webhooks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    url: Mapped[str] = mapped_column(String(1000))
    events: Mapped[list] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class HelperPresence(Base):
    __tablename__ = "helper_presence"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
