"""Dev-only static server with the same layout as nginx in docker-compose.yml.

    python api/scripts/dev_static.py            # http://localhost:8080

/module/* -> module/, /demo/* -> demo/, then site/ (the portal), then savanna/ (the starter).
/api and /sms are not served here (use docker compose for the API).
"""

import functools
import http.server
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MOUNTS = {"/module/": ROOT / "module", "/demo/": ROOT / "demo"}


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        clean = path.split("?", 1)[0].split("#", 1)[0]
        for prefix, base in MOUNTS.items():
            if clean.startswith(prefix):
                return str(base / clean[len(prefix):])
        rel = clean.lstrip("/") or "index.html"
        if clean.endswith("/"):
            rel += "index.html"
        for base in (ROOT / "site", ROOT / "savanna"):  # same order as nginx: portal first, then the starter
            if (base / rel).is_file():
                return str(base / rel)
        return str(ROOT / "savanna" / rel)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    os.chdir(ROOT)
    handler = functools.partial(Handler, directory=str(ROOT))
    Handler.extensions_map[".json"] = "application/json"
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as srv:
        print(f"Serving on http://localhost:{port}")
        srv.serve_forever()
