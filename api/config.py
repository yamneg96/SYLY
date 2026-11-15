"""Settings from the environment (.env). Every value is optional (NFR-K1)."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from pathlib import Path

from cryptography.fernet import Fernet

log = logging.getLogger("syly")

API_DIR = Path(__file__).resolve().parent
REPO_DIR = API_DIR.parent


def _env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


def _first_existing(*paths: str) -> Path:
    for p in paths:
        if p and Path(p).exists():
            return Path(p)
    return Path(paths[-1])


@dataclass
class Settings:
    provider: str = field(default_factory=lambda: _env("PROVIDER", "cloud").lower())
    gemini_key: str = field(default_factory=lambda: _env("GEMINI_API_KEY"))
    gemini_model: str = field(default_factory=lambda: _env("GEMINI_MODEL", "gemini-3.5-flash-lite"))
    groq_key: str = field(default_factory=lambda: _env("GROQ_API_KEY"))
    groq_model: str = field(default_factory=lambda: _env("GROQ_MODEL", "openai/gpt-oss-120b"))
    groq_stt_model: str = field(default_factory=lambda: _env("GROQ_STT_MODEL", "whisper-large-v3"))
    ollama_url: str = field(default_factory=lambda: _env("OLLAMA_URL").rstrip("/"))
    ollama_model: str = field(default_factory=lambda: _env("OLLAMA_MODEL", "llama3.2:3b"))
    provider_timeout: float = field(default_factory=lambda: float(_env("PROVIDER_TIMEOUT", "8")))
    telegram_token: str = field(default_factory=lambda: _env("TELEGRAM_BOT_TOKEN") or _env("BOT_TOKEN"))
    telegram_username: str = field(default_factory=lambda: _env("TELEGRAM_BOT_USERNAME").lstrip("@"))
    helper_key: str = field(default_factory=lambda: _env("HELPER_KEY"))
    host_origins: list[str] = field(
        default_factory=lambda: [o.strip() for o in _env("HOST_ORIGINS", "*").split(",") if o.strip()]
    )
    data_dir: Path = field(default_factory=lambda: Path(_env("DATA_DIR", str(REPO_DIR / "data"))))
    seed_content: Path = field(
        default_factory=lambda: _first_existing(_env("SEED_CONTENT"), str(REPO_DIR / "demo/data/content.json"))
    )
    seed_jobs: Path = field(
        default_factory=lambda: _first_existing(_env("SEED_JOBS"), str(REPO_DIR / "demo/data/jobs.json"))
    )
    threshold_en: float = field(default_factory=lambda: float(_env("THRESHOLD_EN", "1.5")))
    threshold_am: float = field(default_factory=lambda: float(_env("THRESHOLD_AM", "0.35")))

    @property
    def ai_enabled(self) -> bool:
        if self.provider == "cloud":
            return bool(self.gemini_key or self.groq_key)
        if self.provider == "local":
            return bool(self.ollama_url)
        return False

    @property
    def db_url(self) -> str:
        return f"sqlite:///{self.data_dir / 'syly.db'}"


def fernet_key(settings: Settings) -> bytes:
    """FERNET_KEY from env, else one generated once and kept in data/.fernet_key (SDS 2.3)."""
    key = _env("FERNET_KEY")
    if key:
        return key.encode()
    path = settings.data_dir / ".fernet_key"
    if path.exists():
        return path.read_bytes().strip()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    new = Fernet.generate_key()
    path.write_bytes(new)
    log.warning("FERNET_KEY not set: generated one and saved it to %s", path)
    return new


settings = Settings()
