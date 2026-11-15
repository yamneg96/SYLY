"""
SYLY Assistant - Configuration & Security Bootstrapping
File: api/config.py

Handles environment settings, database paths, and Fernet encryption key persistence.
"""

from __future__ import annotations
import os
from pathlib import Path
from typing import Optional
from cryptography.fernet import Fernet

# Base directory for the repository root
BASE_DIR = Path(__file__).resolve().parent.parent

# Data directory and paths (data/syly.db and data/.fernet_key)
DATA_DIR_PATH = os.getenv("DATA_DIR")
if DATA_DIR_PATH:
    DATA_DIR = Path(DATA_DIR_PATH).resolve()
else:
    DATA_DIR = BASE_DIR / "data"

KEY_FILE = DATA_DIR / ".fernet_key"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR}/syly.db")

_fernet_instance: Optional[Fernet] = None


def init_security() -> Fernet:
    """
    Initializes the Fernet encryption cipher:
    1. Checks for the `FERNET_KEY` environment variable.
    2. If not set, checks for an existing `data/.fernet_key` file.
    3. If neither exists, generates a new valid Fernet key, persists it to
       `data/.fernet_key` (so data survives restarts), and loads it into memory.
    4. Returns the initialized Fernet instance.
    """
    global _fernet_instance
    if _fernet_instance is not None:
        return _fernet_instance

    # Ensure data directory exists
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    env_key = os.getenv("FERNET_KEY")
    if env_key and env_key.strip():
        key_bytes = env_key.strip().encode("utf-8")
        print("[SECURITY] Loaded Fernet key from FERNET_KEY environment variable.")
    elif KEY_FILE.exists():
        key_bytes = KEY_FILE.read_text(encoding="utf-8").strip().encode("utf-8")
        print(f"[SECURITY] Loaded existing Fernet key from {KEY_FILE}")
    else:
        key_bytes = Fernet.generate_key()
        KEY_FILE.write_text(key_bytes.decode("utf-8"), encoding="utf-8")
        try:
            KEY_FILE.chmod(0o600)
        except OSError:
            pass
        print(f"[SECURITY] Generated new Fernet key and persisted to {KEY_FILE}")

    _fernet_instance = Fernet(key_bytes)
    return _fernet_instance


def get_fernet() -> Fernet:
    """
    Returns the initialized cryptography.fernet.Fernet instance.
    Calls init_security() on demand if not yet initialized.
    """
    global _fernet_instance
    if _fernet_instance is None:
        return init_security()
    return _fernet_instance
