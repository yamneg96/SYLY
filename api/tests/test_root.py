"""GET /: the API's front door."""

from config import settings


def test_a_browser_gets_a_page_with_the_way_forward(client):
    r = client.get("/", headers={"Accept": "text/html,application/xhtml+xml"})
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/html")
    body = r.text
    assert '<html lang="en">' in body and "<title>SYLY API</title>" in body and "<main>" in body
    for link in ('href="/docs"', 'href="/openapi.json"', 'href="/api/v1/health"'):
        assert link in body, link
    for language in ("English", "አማርኛ", "العربية", "Afaan Oromoo", "ትግርኛ", "Soomaali"):
        assert language in body, language
    assert "Online" in body and "prefers-color-scheme: dark" in body
    assert "__" not in body.replace("__main__", ""), "every placeholder was filled"


def test_a_program_gets_json(client):
    for r in (client.get("/", headers={"Accept": "application/json"}), client.get("/?format=json")):
        assert r.status_code == 200 and r.headers["content-type"].startswith("application/json")
        body = r.json()
        assert body["name"] == "SYLY API" and body["status"] == "ok" and body["docs"] == "/docs" and body["health"] == "/api/v1/health"
        assert body["languages"] == ["en", "am", "ar", "om", "ti", "so"] and body["beta_languages"] == ["om", "ti", "so"]


def test_head_works_and_the_page_is_not_in_the_api_description(client):
    assert client.head("/").status_code == 200
    assert "/" not in client.get("/openapi.json").json()["paths"]


def test_the_page_shows_nothing_private(client, monkeypatch):
    for name, value in (("smtp_pass", "S3CRET-PASS"), ("smtp_host", "relay.secret.example"), ("gemini_key", "KEY-123"), ("helper_key", "HELPER-456"),
                        ("session_secret", "SESSION-789"), ("database_url", "postgresql://u:DBPASS@h/db")):
        monkeypatch.setattr(settings, name, value)
    for r in (client.get("/"), client.get("/?format=json")):
        for secret in ("S3CRET-PASS", "relay.secret.example", "KEY-123", "HELPER-456", "SESSION-789", "DBPASS"):
            assert secret not in r.text, secret


def test_the_site_link_appears_only_for_a_real_address(client, monkeypatch):
    monkeypatch.setattr(settings, "public_base_url", "https://syly.example.org")
    assert 'href="https://syly.example.org"' in client.get("/").text
    monkeypatch.setattr(settings, "public_base_url", "javascript:alert(1)")
    assert "javascript:" not in client.get("/").text
    monkeypatch.setattr(settings, "public_base_url", "")
    assert "The SYLY site" not in client.get("/").text


def test_unknown_addresses_still_answer_in_words(client):
    r = client.get("/no/such/page")
    assert r.status_code == 404 and "does not exist" in r.json()["detail"]
