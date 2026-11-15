import os
import sys
import tempfile
from pathlib import Path

API = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API))

_tmp = tempfile.mkdtemp(prefix="syly-test-")
os.environ["DATA_DIR"] = _tmp
os.environ["PROVIDER"] = "none"
os.environ.pop("FERNET_KEY", None)
for k in ("GEMINI_API_KEY", "GROQ_API_KEY", "TELEGRAM_BOT_TOKEN", "BOT_TOKEN", "HELPER_KEY", "OLLAMA_URL"):
    os.environ[k] = ""

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(scope="session")
def client():
    from main import app

    with TestClient(app) as c:
        yield c
