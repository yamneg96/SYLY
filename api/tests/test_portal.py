"""Developer portal: Google sign-in (mocked), session cookie, CSRF, sites scoped to the account, origins, contrast,
public widget config, the disabled state, and the database migrations (docs: .claude/developer-portal.md §G)."""

import os
import subprocess
import sys
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from config import Settings, settings
from services import google_auth, session, sites

API = Path(__file__).resolve().parents[1]
CSRF = {"X-Requested-With": "syly"}
CLIENT_ID = "test-client.apps.googleusercontent.com"


def claims(sub="g-1", email="dev@example.org", **over):
    base = {"aud": CLIENT_ID, "iss": "https://accounts.google.com", "exp": time.time() + 3600, "sub": sub,
            "email": email, "email_verified": True, "name": "Test Developer"}
    base.update(over)
    return base


@pytest.fixture
def portal(client, monkeypatch):
    """Google sign-in switched on, the library call mocked, a fresh cache."""
    monkeypatch.setattr(settings, "google_client_id", CLIENT_ID)
    sites.invalidate()
    state = {"claims": claims(), "error": None}

    def fake(token, client_id):
        if state["error"]:
            raise ValueError(state["error"])
        return state["claims"]

    monkeypatch.setattr(google_auth, "_library_verify", fake)
    from main import app

    def new_browser():
        return TestClient(app)

    def sign_in(browser, sub="g-1", email="dev@example.org"):
        state["claims"] = claims(sub=sub, email=email)
        r = browser.post("/api/v1/auth/google", json={"credential": "x" * 40}, headers=CSRF)
        assert r.status_code == 200, r.text
        return r

    return type("P", (), {"state": state, "browser": staticmethod(new_browser), "sign_in": staticmethod(sign_in)})


def site_body(**over):
    body = {"name": "My College", "allowed_origins": ["https://college.example"], "lang": "am", "mode": "panel",
            "position": "end", "theme": "auto", "primary": "", "content_source": "api", "bot_username": ""}
    body.update(over)
    return body


# ---------------------------------------------------------------- disabled state
def test_disabled_without_google_client_id(client, monkeypatch):
    monkeypatch.setattr(settings, "google_client_id", "")
    cfg = client.get("/api/v1/auth/config").json()
    assert cfg["enabled"] is False and cfg["client_id"] is None and "not configured" in cfg["message"]
    r = client.post("/api/v1/auth/google", json={"credential": "x" * 40}, headers=CSRF)
    assert r.status_code == 503 and "not configured" in r.json()["detail"]
    assert client.get("/api/v1/me").status_code == 401
    assert client.get("/api/v1/health").json() == {"status": "ok"}  # everything else keeps working


# ---------------------------------------------------------------- Google token checks (mocked verifier)
def test_valid_token_signs_in_and_creates_the_account_once(portal):
    b = portal.browser()
    r = portal.sign_in(b)
    assert r.json()["account"]["email"] == "dev@example.org"
    assert b.get("/api/v1/me").json()["account"]["email"] == "dev@example.org"
    portal.sign_in(b)  # same Google account again: updated, not duplicated
    export = b.get("/api/v1/account/export").json()
    assert export["account"]["email"] == "dev@example.org"


@pytest.mark.parametrize("error,fragment", [
    ("Wrong recipient, payload audience != required audience", "different application"),
    ("Token expired, 1700000000 < 1800000000", "expired"),
    ("Could not verify token signature.", "did not accept"),
])
def test_library_rejections_are_answered_in_words(portal, error, fragment):
    portal.state["error"] = error
    r = portal.browser().post("/api/v1/auth/google", json={"credential": "x" * 40}, headers=CSRF)
    assert r.status_code == 401 and fragment in r.json()["detail"]
    assert "set-cookie" not in r.headers


@pytest.mark.parametrize("over,fragment", [
    ({"aud": "someone-else"}, "different application"),
    ({"iss": "https://evil.example"}, "not come from Google"),
    ({"exp": time.time() - 5}, "expired"),
    ({"email_verified": False}, "not verified"),
    ({"sub": ""}, "account id"),
])
def test_our_own_claim_checks(portal, over, fragment):
    portal.state["claims"] = claims(**over)
    r = portal.browser().post("/api/v1/auth/google", json={"credential": "x" * 40}, headers=CSRF)
    assert r.status_code == 401 and fragment in r.json()["detail"]


# ---------------------------------------------------------------- cookie and CSRF
def test_session_cookie_flags(portal):
    r = portal.sign_in(portal.browser())
    cookie = r.headers["set-cookie"].lower()
    assert "syly_session=" in cookie and "httponly" in cookie and "samesite=lax" in cookie and "max-age=604800" in cookie
    assert "secure" not in cookie  # plain http (localhost)
    r = portal.browser().post("/api/v1/auth/google", json={"credential": "x" * 40}, headers={**CSRF, "X-Forwarded-Proto": "https"})
    assert "secure" in r.headers["set-cookie"].lower()  # behind an HTTPS proxy or tunnel


def test_session_cookie_is_signed_and_expires():
    good = session.make(7)
    assert session.read(good) == 7
    assert session.read(good[:-2] + "xx") is None and session.read("garbage") is None and session.read(None) is None
    assert session.read(good, now=time.time() + session.MAX_AGE + 5) is None


def test_state_changing_calls_need_the_csrf_header(portal):
    b = portal.browser()
    assert b.post("/api/v1/auth/google", json={"credential": "x" * 40}).status_code == 403
    portal.sign_in(b)
    assert b.post("/api/v1/sites", json=site_body()).status_code == 403
    assert b.post("/api/v1/sites", json=site_body(), headers=CSRF).status_code == 201
    assert b.delete("/api/v1/account").status_code == 403
    assert b.post("/api/v1/auth/logout").status_code == 403


def test_logout_and_unauthenticated_calls(portal):
    b = portal.browser()
    assert b.get("/api/v1/sites").status_code == 401
    portal.sign_in(b)
    assert b.post("/api/v1/auth/logout", headers=CSRF).status_code == 200
    b.cookies.clear()
    assert b.get("/api/v1/me").status_code == 401


# ---------------------------------------------------------------- sites, scoped to the account
def test_sites_crud_is_scoped_to_the_signed_in_account(portal):
    a, other = portal.browser(), portal.browser()
    portal.sign_in(a, "g-a", "a@example.org")
    portal.sign_in(other, "g-b", "b@example.org")
    created = a.post("/api/v1/sites", json=site_body(), headers=CSRF).json()["site"]
    sid = created["id"]
    assert created["public_key"].startswith("pk_") and created["allowed_origins"] == ["https://college.example"]
    assert [s["id"] for s in a.get("/api/v1/sites").json()["sites"]] == [sid]
    assert other.get("/api/v1/sites").json()["sites"] == []
    # another account gets 404, exactly like a missing site
    assert other.get(f"/api/v1/sites/{sid}").status_code == 404
    assert other.patch(f"/api/v1/sites/{sid}", json=site_body(name="Mine now"), headers=CSRF).status_code == 404
    assert other.delete(f"/api/v1/sites/{sid}", headers=CSRF).status_code == 404
    assert a.get(f"/api/v1/sites/{sid}").json()["site"]["name"] == "My College"
    # the owner can edit and delete
    edited = a.patch(f"/api/v1/sites/{sid}", json=site_body(name="Renamed"), headers=CSRF).json()["site"]
    assert edited["name"] == "Renamed" and edited["public_key"] == created["public_key"]
    assert a.delete(f"/api/v1/sites/{sid}", headers=CSRF).status_code == 204
    assert a.get(f"/api/v1/sites/{sid}").status_code == 404


def test_delete_account_removes_sites_and_the_key(portal):
    b = portal.browser()
    portal.sign_in(b, "g-del", "del@example.org")
    key = b.post("/api/v1/sites", json=site_body(), headers=CSRF).json()["site"]["public_key"]
    assert b.get(f"/api/v1/sites/{key}/config").status_code == 200
    assert b.delete("/api/v1/account", headers=CSRF).status_code == 204
    assert b.get(f"/api/v1/sites/{key}/config").status_code == 404
    assert b.get("/api/v1/me").status_code == 401


# ---------------------------------------------------------------- validation in words
@pytest.mark.parametrize("text,ok", [
    ("https://college.example", True), ("https://college.example/", True), ("HTTPS://College.Example", True),
    ("https://a.b.example:8443", True), ("http://localhost", True), ("http://localhost:3000", True), ("http://localhost:*", True),
    ("http://college.example", False), ("https://college.example/path", False), ("college.example", False),
    ("https://*.college.example", False), ("https://", False), ("javascript:alert(1)", False), ("https://exa mple.com", False),
])
def test_origin_validation(text, ok):
    assert (sites.parse_origin(text) is not None) is ok


def test_origin_matching_including_any_localhost_port():
    allowed = ["https://college.example", "http://localhost:*"]
    assert sites.origin_allowed("https://college.example", allowed)
    assert sites.origin_allowed("http://localhost:5173", allowed)
    assert not sites.origin_allowed("http://localhost", allowed)
    assert not sites.origin_allowed("https://evil.example", allowed)
    assert not sites.origin_allowed("https://college.example.evil.com", allowed)
    assert not sites.origin_allowed(None, allowed)


def test_form_errors_come_back_per_field_in_words(portal):
    b = portal.browser()
    portal.sign_in(b)
    r = b.post("/api/v1/sites", json=site_body(name="", allowed_origins=["http://college.example"], bot_username="notabot!"), headers=CSRF)
    assert r.status_code == 400
    fields = r.json()["fields"]
    assert set(fields) == {"name", "allowed_origins", "bot_username"} and "https" in fields["allowed_origins"]
    r = b.post("/api/v1/sites", json=site_body(content_source="file", content_url="not a url"), headers=CSRF)
    assert "content_url" in r.json()["fields"]


@pytest.mark.parametrize("colour,ok", [("#1A5FB4", True), ("#000000", True), ("#767676", True), ("#FFFF00", False), ("#AAAAAA", False), ("#F5A300", False)])
def test_primary_colour_needs_4_5_to_1_against_white(portal, colour, ok):
    b = portal.browser()
    portal.sign_in(b)
    r = b.post("/api/v1/sites", json=site_body(primary=colour), headers=CSRF)
    assert (r.status_code == 201) is ok
    if not ok:
        assert "4.5:1" in r.json()["fields"]["primary"] and "too light" in r.json()["fields"]["primary"]
    else:
        assert sites.contrast_with_white(colour) >= 4.5


def test_contrast_matches_the_known_values():
    assert round(sites.contrast_with_white("#000000"), 1) == 21.0 and round(sites.contrast_with_white("#FFFFFF"), 1) == 1.0
    assert round(sites.contrast_with_white("#767676"), 2) == 4.54  # the lightest grey that passes on white


def test_bot_username_is_stored_without_the_at_sign(portal):
    b = portal.browser()
    portal.sign_in(b)
    site = b.post("/api/v1/sites", json=site_body(bot_username="@MyCollegeHelpBot"), headers=CSRF).json()["site"]
    assert site["bot_username"] == "MyCollegeHelpBot"


# ---------------------------------------------------------------- public config and the origin check
def test_public_config_has_only_widget_settings(portal):
    b = portal.browser()
    portal.sign_in(b)
    body = site_body(lang="en", mode="inline", position="start", theme="light", primary="#1A5FB4", content_source="page",
                     content_selector="main", read_page="always", simple=True, bot_username="MyCollegeHelpBot")
    key = b.post("/api/v1/sites", json=body, headers=CSRF).json()["site"]["public_key"]
    r = portal.browser().get(f"/api/v1/sites/{key}/config")  # no cookie: public
    assert r.status_code == 200 and "max-age=300" in r.headers["cache-control"]
    cfg = r.json()
    assert cfg == {"key": key, "name": "My College", "lang": "en", "mode": "inline", "position": "start", "theme": "light",
                   "simple": True, "voice": False, "primary": "#1A5FB4", "read_page": "always", "content_selector": "main",
                   "bot_username": "MyCollegeHelpBot"}
    assert "email" not in r.text and "allowed_origins" not in r.text
    assert portal.browser().get("/api/v1/sites/pk_doesnotexist/config").status_code == 404


def test_config_for_a_content_file(portal):
    b = portal.browser()
    portal.sign_in(b)
    key = b.post("/api/v1/sites", json=site_body(content_source="file", content_url="https://college.example/lesson.json"),
                 headers=CSRF).json()["site"]["public_key"]
    assert b.get(f"/api/v1/sites/{key}/config").json()["content"] == "https://college.example/lesson.json"


def test_requests_with_a_site_key_only_from_allowed_origins(portal):
    b = portal.browser()
    portal.sign_in(b)
    key = b.post("/api/v1/sites", json=site_body(allowed_origins=["https://college.example", "http://localhost:*"]), headers=CSRF).json()["site"]["public_key"]
    anon = portal.browser()
    ok = anon.get("/api/v1/health", headers={"X-Site-Key": key, "Origin": "https://college.example"})
    assert ok.status_code == 200
    assert anon.get("/api/v1/health", headers={"X-Site-Key": key, "Origin": "http://localhost:9000"}).status_code == 200
    no = anon.get("/api/v1/health", headers={"X-Site-Key": key, "Origin": "https://evil.example"})
    assert no.status_code == 403 and "not on the list" in no.json()["detail"]
    assert no.headers.get("access-control-allow-origin") in ("*", "https://evil.example")  # readable by the widget
    assert anon.get("/api/v1/health", headers={"X-Site-Key": "pk_unknown", "Origin": "https://college.example"}).status_code == 403
    # no key, or no Origin (not a browser cross-site call): not affected
    assert anon.get("/api/v1/health", headers={"Origin": "https://evil.example"}).status_code == 200
    assert anon.get("/api/v1/health", headers={"X-Site-Key": key}).status_code == 200


def test_editing_origins_takes_effect_at_once(portal):
    b = portal.browser()
    portal.sign_in(b)
    made = b.post("/api/v1/sites", json=site_body(), headers=CSRF).json()["site"]
    hdr = {"X-Site-Key": made["public_key"], "Origin": "https://new.example"}
    assert b.get("/api/v1/health", headers=hdr).status_code == 403
    b.patch(f"/api/v1/sites/{made['id']}", json=site_body(allowed_origins=["https://new.example"]), headers=CSRF)
    assert b.get("/api/v1/health", headers=hdr).status_code == 200


# ---------------------------------------------------------------- database layer and migrations
def test_database_url_is_normalised_for_psycopg():
    assert Settings(database_url="postgres://u:p@h.neon.tech/db?sslmode=require").db_url == "postgresql+psycopg://u:p@h.neon.tech/db?sslmode=require"
    assert Settings(database_url="postgresql://u:p@h/db").db_url.startswith("postgresql+psycopg://")
    assert Settings(database_url="").db_url.startswith("sqlite:///") and Settings(database_url="").is_sqlite


def test_every_table_compiles_for_postgres():
    from sqlalchemy.dialects import postgresql
    from sqlalchemy.schema import CreateIndex, CreateTable

    import models  # noqa: F401
    from db import Base

    for table in Base.metadata.sorted_tables:
        assert str(CreateTable(table).compile(dialect=postgresql.dialect()))
        for ix in table.indexes:
            assert str(CreateIndex(ix).compile(dialect=postgresql.dialect()))


def test_migrations_match_the_models(client):
    """The migrated database has every table and column the models declare (a model change needs a new migration)."""
    from sqlalchemy import inspect

    import models  # noqa: F401
    from db import Base, engine

    insp = inspect(engine)
    for table in Base.metadata.sorted_tables:
        assert insp.has_table(table.name), table.name
        have = {c["name"] for c in insp.get_columns(table.name)}
        assert {c.name for c in table.columns} == have, table.name
    assert insp.has_table("alembic_version")


def _run(code: str, data_dir: Path) -> subprocess.CompletedProcess:
    env = {**os.environ, "DATA_DIR": str(data_dir), "DATABASE_URL": "", "PYTHONPATH": str(API)}
    return subprocess.run([sys.executable, "-c", code], cwd=API, env=env, capture_output=True, text=True, timeout=120)


def test_an_older_database_is_adopted_without_losing_data(tmp_path):
    """A database made by the previous version (tables created on start-up, no alembic_version) is upgraded in place."""
    legacy = (
        "import models\n"
        "from db import Base, engine, SessionLocal\n"
        "legacy = [t for n, t in Base.metadata.tables.items() if n not in ('accounts', 'sites')]\n"
        "Base.metadata.create_all(engine, tables=legacy)\n"
        "with SessionLocal() as db:\n"
        "    db.add(models.Webhook(url='https://hook.example/x', events=['ticket']))\n"
        "    db.commit()\n"
    )
    r = _run(legacy, tmp_path)
    assert r.returncode == 0, r.stderr
    r = _run("from migrate import upgrade_to_head; upgrade_to_head()", tmp_path)
    assert r.returncode == 0, r.stderr
    check = (
        "import models\n"
        "from sqlalchemy import inspect\n"
        "from db import engine, SessionLocal\n"
        "i = inspect(engine)\n"
        "assert i.has_table('accounts') and i.has_table('sites') and i.has_table('alembic_version')\n"
        "with SessionLocal() as db:\n"
        "    assert db.query(models.Webhook).count() == 1\n"
        "print('adopted')\n"
    )
    r = _run(check, tmp_path)
    assert r.returncode == 0 and "adopted" in r.stdout, r.stderr
    again = _run("from migrate import upgrade_to_head; upgrade_to_head()", tmp_path)  # running twice changes nothing
    assert again.returncode == 0, again.stderr
