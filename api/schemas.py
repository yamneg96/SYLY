"""Pydantic models for every request and response (OpenAPI is generated from these)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl

Lang = Literal["am", "en", "ar"]


class Source(BaseModel):
    title: str
    url: str


class AskIn(BaseModel):
    question: str = Field(min_length=1, max_length=1000, examples=["AI ምናባዊ ረዳቶችን ይተካል?"])
    language: Lang = "am"
    page_url: str | None = Field(default=None, max_length=1000)
    conversation_id: str | None = Field(default=None, max_length=64)
    allow_ai: bool = Field(default=False, description="Learner consented to online AI answers (NFR-S2)")
    simple: bool = False


class AskOut(BaseModel):
    answer: str | None = Field(description="null when not found in the course or refused")
    sources: list[Source]
    provider: str = Field(description="gemini | groq | ollama | none")
    language: str
    conversation_id: str
    reason: Literal["not_found", "no_advice"] | None = None
    audio: list[str] = Field(default_factory=list, description="Pre-generated audio paths under /module/audio/")


class SectionIn(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str = Field(min_length=1, max_length=200)
    url: str = Field(min_length=1, max_length=500)
    title_en: str
    text_en: str
    title_am: str | None = None
    text_am: str | None = None
    keywords_en: list[str] = []
    keywords_am: list[str] = []


class ContentIn(BaseModel):
    sections: list[SectionIn] = Field(min_length=1)


class ContentOut(BaseModel):
    sections: list[dict]


class Created(BaseModel):
    id: int | str
    message: str


class ConfigOut(BaseModel):
    ai: bool = Field(description="An AI provider is configured; the widget shows the consent card")
    provider: str
    helper_online: bool
    telegram_bot: str | None = None


class ConversationLine(BaseModel):
    role: Literal["learner", "assistant", "tutor", "helper", "system"] = "learner"
    text: str = Field(max_length=4000)
    lang: str | None = None


class EscalationIn(BaseModel):
    conversation: list[ConversationLine] = Field(default_factory=list, max_length=50)
    page_url: str | None = Field(default=None, max_length=1000)
    section: str | None = Field(default=None, max_length=200)
    language: Lang = "am"
    conversation_id: str | None = Field(default=None, max_length=64)
    screenshot: str | None = Field(default=None, max_length=3_000_000, description="data:image/... URL (Android fallback)")
    channel: Literal["web", "telegram", "sms"] = "web"
    notify_telegram_chat: str | None = Field(default=None, max_length=40)


class EscalationOut(BaseModel):
    ticketId: int  # noqa: N815 - guide's contract name
    helper_online: bool
    token: str = Field(description="Send as ?token= to read or post this ticket's messages")
    telegram_link: str | None = Field(default=None, description="Open to get tutor replies on Telegram")


class MessageIn(BaseModel):
    author: Literal["learner", "helper", "system"] = Field(
        default="learner", description='"system" with text "screen_request" asks the learner to share (helper only)'
    )
    text: str = Field(min_length=1, max_length=4000)
    name: str | None = Field(default=None, max_length=80)
    lang: str | None = None


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    author: str
    name: str | None
    text: str
    lang: str | None
    sources: list = []
    created_at: datetime


class TicketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    channel: str
    status: str
    language: str
    page_url: str | None
    section: str | None
    has_screenshot: bool = False
    helper_name: str | None
    created_at: datetime
    waiting_minutes: int = 0


class TicketUpdate(BaseModel):
    status: Literal["waiting", "active", "closed"]
    helper_name: str | None = Field(default=None, max_length=80)


class WebhookIn(BaseModel):
    url: HttpUrl
    events: list[Literal["ticket.opened"]] = ["ticket.opened"]


class JobIn(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9-]+$")
    title_en: str
    title_am: str | None = None
    employer: str
    location_en: str
    location_am: str | None = None
    employment_type: str = "FULL_TIME"
    remote: bool = False
    date_posted: str
    deadline: str
    summary_en: str
    summary_am: str | None = None


class AlertIn(BaseModel):
    channel: Literal["telegram", "sms"]
    address: str = Field(min_length=3, max_length=40, description="Telegram chat id or phone (09…, 07…, +251…)")
    keyword: str = Field(default="", max_length=100)
    location: str = Field(default="", max_length=100)
    language: Lang = "am"


class AccommodationIn(BaseModel):
    job_id: str = Field(max_length=100)
    needs: list[Literal["interpreter", "extra_time", "written_questions", "accessible_venue", "other"]] = Field(min_length=1)
    note: str | None = Field(default=None, max_length=1000)
    contact_channel: Literal["none", "telegram", "sms", "email"] = "none"
    contact: str | None = Field(default=None, max_length=120)
    language: Lang = "am"


class ScreenshotIn(BaseModel):
    screenshot: str = Field(max_length=3_000_000, description="data:image/... URL")


class SpeakIn(BaseModel):
    text: str = Field(min_length=1, max_length=3000)
    language: Lang = "am"
