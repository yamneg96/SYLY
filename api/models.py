"""
SYLY Assistant - SQLAlchemy 2.0 Declarative Models
File: api/models.py

Defines persistent entities:
- Conversation: Learner session with consent status.
- Message: Chat interaction with provider metadata and citation sources JSON.
- Ticket: Human-in-the-loop escalation request.
- Accommodation: Disability/accessibility interview accommodation with encrypted contact.
"""

from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

try:
    from .db import Base
except ImportError:
    from db import Base


def generate_uuid() -> str:
    """Generates a UUID4 string representation."""
    return str(uuid.uuid4())


def utc_now() -> datetime:
    """Returns current datetime in UTC timezone."""
    return datetime.now(timezone.utc)


class Conversation(Base):
    """Represents a learner's conversation session."""
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    language: Mapped[str] = mapped_column(String(10), default="en", nullable=False)
    consent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    messages: Mapped[List["Message"]] = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.id"
    )
    tickets: Mapped[List["Ticket"]] = relationship(
        "Ticket",
        back_populates="conversation"
    )

    def __repr__(self) -> str:
        return f"<Conversation(id='{self.id}', lang='{self.language}', consent={self.consent})>"


class Message(Base):
    """Represents an individual message exchanged in a conversation."""
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    conversation_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # "user", "assistant", "system"
    text: Mapped[str] = mapped_column(Text, nullable=False)
    lang: Mapped[str] = mapped_column(String(10), default="en", nullable=False)
    provider: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # "cloud", "local", "none"
    sources: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="messages")

    def __repr__(self) -> str:
        return f"<Message(id={self.id}, role='{self.role}', lang='{self.lang}', provider='{self.provider}')>"


class Ticket(Base):
    """Represents a human escalation ticket submitted by a learner."""
    __tablename__ = "tickets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    conversation_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("conversations.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    page_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    section: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="waiting", nullable=False)  # "waiting", "open", "resolved"
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    conversation: Mapped[Optional["Conversation"]] = relationship("Conversation", back_populates="tickets")

    def __repr__(self) -> str:
        return f"<Ticket(id='{self.id}', status='{self.status}', url='{self.page_url}')>"


class Accommodation(Base):
    """
    Represents an interview accommodation request for job applicants.
    Contact information is strictly stored as a Fernet-encrypted string (contact_enc)
    to protect applicant privacy.
    """
    __tablename__ = "accommodations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    job_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    needs: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)  # JSON array of strings
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    contact_enc: Mapped[str] = mapped_column(String(512), nullable=False)  # Encrypted contact info
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    def __repr__(self) -> str:
        return f"<Accommodation(id='{self.id}', job_id='{self.job_id}', needs={self.needs})>"
