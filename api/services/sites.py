"""Developer sites: validation (in words, per field), site keys, origin check, public widget config."""

from __future__ import annotations

import re
import secrets
import time
from urllib.parse import urlsplit

MAX_SITES = 20
MAX_ORIGINS = 20
LANGS = ("am", "en", "ar", "om", "ti", "so")
BETA_LANGS = ("om", "ti", "so")
_HTTPS = re.compile(r"^https://[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(:\d{1,5})?$")
_LOCAL = re.compile(r"^http://(localhost|127\.0\.0\.1)(:(\d{1,5}|\*))?$")
_HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
_BOT = re.compile(r"^[A-Za-z][A-Za-z0-9_]{3,30}[Bb][Oo][Tt]$")


class FieldError(Exception):
    """Validation errors: one message in words per field."""

    def __init__(self, fields: dict[str, str]) -> None:
        super().__init__("; ".join(fields.values()))
        self.fields = fields


def new_key() -> str:
    return "pk_" + secrets.token_hex(12)


# ---------------------------------------------------------------- colour
def _luminance(hex_colour: str) -> float:
    channels = []
    for i in (1, 3, 5):
        c = int(hex_colour[i:i + 2], 16) / 255
        channels.append(c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]


def contrast_with_white(hex_colour: str) -> float:
    return 1.05 / (_luminance(hex_colour) + 0.05)


# ---------------------------------------------------------------- origins
def parse_origin(text: str) -> str | None:
    """Normalised origin (lower case, no trailing slash) or None when it is not a valid origin."""
    o = text.strip().rstrip("/").lower()
    return o if (_HTTPS.match(o) or _LOCAL.match(o)) else None


def origin_allowed(origin: str | None, allowed: list[str]) -> bool:
    if not origin:
        return False
    o = origin.strip().rstrip("/").lower()
    for a in allowed:
        if a == o:
            return True
        if a.endswith(":*") and o.startswith(a[:-1]) and o[len(a) - 1:].isdigit():  # http://localhost:* = any port
            return True
    return False


# ---------------------------------------------------------------- settings
def _bool(value) -> bool:  # noqa: ANN001
    return value is True or str(value).lower() in ("true", "on", "1", "yes")


def clean(data: dict) -> dict:
    """Validate a create or edit request. Returns {name, allowed_origins, settings, bot_username} or raises FieldError."""
    errors: dict[str, str] = {}

    name = str(data.get("name") or "").strip()
    if not name:
        errors["name"] = "Enter a name for this site, for example your college's name."
    elif len(name) > 80:
        errors["name"] = "The name is too long. Use 80 characters or fewer."

    raw = data.get("allowed_origins") or []
    if isinstance(raw, str):
        raw = raw.splitlines()
    origins: list[str] = []
    bad: list[str] = []
    for line in raw:
        if not str(line).strip():
            continue
        o = parse_origin(str(line))
        if o is None:
            bad.append(str(line).strip())
        elif o not in origins:
            origins.append(o)
    if bad:
        errors["allowed_origins"] = (
            f"“{bad[0]}” is not a valid origin. Write the address without a path, for example https://college.example "
            "(https only; http://localhost or http://localhost:* is allowed for testing)."
        )
    elif not origins:
        errors["allowed_origins"] = "Enter at least one origin, one per line, for example https://college.example."
    elif len(origins) > MAX_ORIGINS:
        errors["allowed_origins"] = f"Too many origins. Use {MAX_ORIGINS} or fewer."

    lang = str(data.get("lang") or "en")
    if lang not in LANGS:
        errors["lang"] = "Choose one of the listed languages."
    mode = str(data.get("mode") or "panel")
    if mode not in ("panel", "inline"):
        errors["mode"] = "Choose panel or inline."
    position = str(data.get("position") or "end")
    if position not in ("end", "start"):
        errors["position"] = "Choose end or start."
    theme = str(data.get("theme") or "auto")
    if theme not in ("auto", "light", "dark"):
        errors["theme"] = "Choose auto, light or dark."

    primary = str(data.get("primary") or "").strip()
    if primary:
        if not _HEX.match(primary):
            errors["primary"] = "Write the colour as six hex digits after a #, for example #1A5FB4."
        else:
            ratio = contrast_with_white(primary)
            if ratio < 4.5:
                errors["primary"] = (
                    f"This colour is too light: its contrast with white text is {ratio:.1f}:1 and the minimum is 4.5:1. "
                    "Try a darker shade, or leave it empty to use the default."
                )
    source = str(data.get("content_source") or "api")
    if source not in ("file", "api", "page"):
        errors["content_source"] = "Choose a content file, the API, or page reading."
    content_url = str(data.get("content_url") or "").strip()
    if source == "file":
        parts = urlsplit(content_url)
        if parts.scheme not in ("http", "https") or not parts.netloc:
            errors["content_url"] = "Enter the full address of your content file, starting with https://."
        elif len(content_url) > 500:
            errors["content_url"] = "The address is too long."
    selector = str(data.get("content_selector") or "").strip()
    if len(selector) > 200 or any(ch in selector for ch in "<>{}"):
        errors["content_selector"] = "Use a plain CSS selector such as main or #lesson (200 characters or fewer)."
    read_page = str(data.get("read_page") or "auto")
    if read_page not in ("auto", "always", "off"):
        errors["read_page"] = "Choose auto, always or off."

    bot = str(data.get("bot_username") or "").strip().lstrip("@")
    if bot and not _BOT.match(bot):
        errors["bot_username"] = "A Telegram bot name is 5 to 32 letters, digits or underscores and ends with “bot”, for example MyCollegeHelpBot."

    if errors:
        raise FieldError(errors)
    return {
        "name": name,
        "allowed_origins": origins,
        "bot_username": bot or None,
        "settings": {
            "lang": lang, "mode": mode, "position": position, "theme": theme, "primary": primary,
            "content_source": source, "content_url": content_url if source == "file" else "",
            "content_selector": selector if source == "page" else "", "read_page": read_page,
            "voice": _bool(data.get("voice")), "simple": _bool(data.get("simple")),
        },
    }


def public_config(site) -> dict:  # noqa: ANN001
    """What the widget needs, nothing private. Keys are the widget's attribute names."""
    s = site.settings or {}
    cfg = {"key": site.public_key, "name": site.name, "lang": s.get("lang", "en"), "mode": s.get("mode", "panel"),
           "position": s.get("position", "end"), "theme": s.get("theme", "auto"), "simple": bool(s.get("simple")),
           "voice": bool(s.get("voice"))}
    if s.get("primary"):
        cfg["primary"] = s["primary"]
    if s.get("content_source") == "file" and s.get("content_url"):
        cfg["content"] = s["content_url"]
    if s.get("content_source") == "page":
        cfg["read_page"] = s.get("read_page", "auto")
        if s.get("content_selector"):
            cfg["content_selector"] = s["content_selector"]
    if site.bot_username:
        cfg["bot_username"] = site.bot_username
    return cfg


def view(site) -> dict:  # noqa: ANN001
    return {"id": site.id, "name": site.name, "public_key": site.public_key, "allowed_origins": site.allowed_origins,
            "settings": site.settings, "bot_username": site.bot_username, "created_at": site.created_at.isoformat()}


# ---------------------------------------------------------------- origin lookup cache (30 s)
_cache: dict[str, tuple[float, list[str] | None]] = {}


def invalidate(key: str | None = None) -> None:
    _cache.pop(key, None) if key else _cache.clear()


def allowed_origins_for(db, key: str) -> list[str] | None:  # noqa: ANN001
    """Allowed origins of a site key, or None when the key is unknown."""
    hit = _cache.get(key)
    now = time.monotonic()
    if hit and hit[0] > now:
        return hit[1]
    from models import Site

    site = db.query(Site).filter(Site.public_key == key).first()
    origins = list(site.allowed_origins) if site else None
    _cache[key] = (now + 30, origins)
    return origins
