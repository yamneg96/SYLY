"""
SYLY Assistant - Database Connection & Session Management
File: api/db.py

Configures SQLAlchemy 2.0 engine, declarative base, and session generator.
"""

from __future__ import annotations
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session

try:
    from .config import DATABASE_URL, DATA_DIR
except ImportError:
    from config import DATABASE_URL, DATA_DIR

# Ensure parent directory for SQLite file exists
if DATABASE_URL.startswith("sqlite"):
    DATA_DIR.mkdir(parents=True, exist_ok=True)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a scoped database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
