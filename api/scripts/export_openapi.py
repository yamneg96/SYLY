"""Write openapi.yaml at the repo root from the FastAPI app.

Run from the repo root:  python api/scripts/export_openapi.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

API_DIR = Path(__file__).resolve().parents[1]
ROOT = API_DIR.parent
sys.path.insert(0, str(API_DIR))

from main import app  # noqa: E402

HEADER = "# Generated from the FastAPI app: python api/scripts/export_openapi.py\n"

spec = app.openapi()
try:
    import yaml

    body = yaml.safe_dump(spec, sort_keys=False, allow_unicode=True)
except ImportError:  # JSON is valid YAML 1.2
    body = json.dumps(spec, indent=2, ensure_ascii=False) + "\n"

(ROOT / "openapi.yaml").write_text(HEADER + body, encoding="utf-8")
print(f"openapi.yaml: {len(spec['paths'])} paths")
