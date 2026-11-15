import os
import sys
import tempfile
from pathlib import Path

BOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BOT))
os.environ["BOT_STATE"] = str(Path(tempfile.mkdtemp(prefix="syly-bot-")) / "chats.json")
os.environ.setdefault("TELEGRAM_BOT_TOKEN", "")
