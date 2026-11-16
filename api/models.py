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
    # Which registered site the learner came from (the public site key), who accepted it and when, and whether the
    # "nobody has picked this up" reminder was sent. All empty for requests that predate tutor accounts.
    site_key: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    helper_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reminded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


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


class Account(Base):
    """A developer who signed in with Google (never a learner). Only what the portal needs."""

    __tablename__ = "accounts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    google_sub: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(320))
    name: Mapped[str] = mapped_column(String(200), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Site(Base):
    """One website where a developer installs SYLY. No secrets: the public key is meant to be in page source."""

    __tablename__ = "sites"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    public_key: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    allowed_origins: Mapped[list] = mapped_column(JSON, default=list)
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    bot_username: Mapped[str | None] = mapped_column(String(40), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class TutorCode(Base):
    """A 6-digit sign-in code sent to a tutor's e-mail address. Only a hash is stored; it expires and allows 5 tries."""

    __tablename__ = "tutor_codes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(320), index=True)
    code_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class TutorPresence(Base):
    """A signed-in tutor: available or away, and when we last heard from them (a heartbeat while they are really there)."""

    __tablename__ = "tutor_presence"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(80), default="")
    status: Mapped[str] = mapped_column(String(12), default="away")  # available | away
    seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
