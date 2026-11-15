"""SQLite via SQLAlchemy 2 (SDS 2.3). One file in the data volume, no database container."""

from __future__ import annotations

from collections.abc import Iterator

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from config import fernet_key, settings

settings.data_dir.mkdir(parents=True, exist_ok=True)
engine = create_engine(settings.db_url, connect_args={"check_same_thread": False})


@event.listens_for(engine, "connect")
def _sqlite_pragmas(dbapi_conn, _record) -> None:  # noqa: ANN001
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA journal_mode=WAL")
    cur.execute("PRAGMA foreign_keys=ON")
    cur.close()


SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    with SessionLocal() as db:
        yield db


_fernet = Fernet(fernet_key(settings))


def encrypt(text: str | None) -> str | None:
    return _fernet.encrypt(text.encode()).decode() if text else None


def decrypt(token: str | None) -> str | None:
    if not token:
        return None
    try:
        return _fernet.decrypt(token.encode()).decode()
    except InvalidToken:
        return None
