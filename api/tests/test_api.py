"""HTTP contract (guide section 5 data contract, section 6 status codes)."""

from services import webhook


def test_ask_cited_and_not_found(client):
    r = client.post("/api/v1/ask", json={"question": "AI ምናባዊ ረዳቶችን ይተካል?", "language": "am"})
    assert r.status_code == 200
    body = r.json()
    assert body["answer"] and body["sources"][0]["url"].startswith("/pages/concept-with-navigation.html#")
    assert body["provider"] == "none" and body["conversation_id"]

    r = client.post("/api/v1/ask", json={"question": "What is the capital of France?", "language": "en"})
    assert r.json()["answer"] is None and r.json()["reason"] == "not_found"


def test_bad_input_is_400_in_words(client):
    r = client.post("/api/v1/ask", json={"question": "", "language": "xx"})
    assert r.status_code == 400 and "question" in r.json()["detail"]


def test_config(client):
    body = client.get("/api/v1/config").json()
    assert body["ai"] is False and body["provider"] == "none"


def test_content_post_and_index(client):
    sec = {"id": "test-sec", "url": "/x.html#test-sec", "title_en": "Zebra care", "text_en": "Zebras eat grass every day."}
    r = client.post("/api/v1/content", json={"sections": [sec]})
    assert r.status_code == 201
    assert client.post("/api/v1/ask", json={"question": "What do zebras eat?", "language": "en"}).json()["sources"]
    # restore the lesson
    from config import REPO_DIR
    import json
    lesson = json.loads((REPO_DIR / "demo/data/content.json").read_text(encoding="utf-8"))["sections"]
    assert client.post("/api/v1/content", json={"sections": lesson}).status_code == 201


def test_escalation_flow_and_webhook(client, monkeypatch):
    fired = []

    async def fake_fire(event, payload):
        fired.append((event, payload))
        return 1

    monkeypatch.setattr(webhook, "fire", fake_fire)
    assert client.post("/api/v1/webhooks", json={"url": "https://example.org/hook"}).status_code == 201
    r = client.post("/api/v1/escalations", json={
        "conversation": [{"role": "learner", "text": "እርዳታ እፈልጋለሁ", "lang": "am"}],
        "page_url": "http://localhost:8080/pages/concept-with-navigation.html", "language": "am",
    })
    assert r.status_code == 201
    t = r.json()
    assert t["ticketId"] and t["helper_online"] is False and t["token"]
    assert fired and fired[0][0] == "ticket.opened" and fired[0][1]["ticketId"] == t["ticketId"]

    waiting = client.get("/api/v1/escalations").json()
    assert any(x["id"] == t["ticketId"] for x in waiting)

    client.post("/api/v1/helper/presence?name=Saron")
    assert client.get("/api/v1/config").json()["helper_online"] is True

    r = client.post(f"/api/v1/escalations/{t['ticketId']}/messages", json={"author": "helper", "name": "Saron", "text": "ሰላም"})
    assert r.status_code == 201
    msgs = client.get(f"/api/v1/escalations/{t['ticketId']}/messages", params={"after": 0, "token": t["token"]}).json()
    assert msgs[-1]["author"] == "helper" and msgs[-1]["name"] == "Saron"
    assert client.get(f"/api/v1/escalations/{t['ticketId']}/messages", params={"token": "wrong"}).status_code == 404
    assert client.get("/api/v1/escalations/99999/messages").status_code == 404


def test_jobs_jsonld(client):
    jobs = client.get("/api/v1/jobs").json()
    assert len(jobs) >= 5
    ld = jobs[0]["jsonld"]
    assert ld["@type"] == "JobPosting" and ld["hiringOrganization"]["name"] and ld["datePosted"]
    assert client.get("/api/v1/jobs/nope").status_code == 404


def test_job_question_has_trust_line(client):
    r = client.post("/api/v1/ask", json={"question": "Does the accountant job need experience?", "language": "en"}).json()
    assert r["sources"][0]["url"].startswith("/pages/jobs.html#job-")
    assert "Never pay to apply" in r["answer"]


def test_sms_route(client):
    r = client.post("/sms/inbound", json={"from": "0911000000", "text": "JOBS accountant"})
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/plain")
    assert len(r.text) <= 160 and "Accountant" in r.text
    for text in ["ASK AI ምናባዊ ረዳቶችን ይተካል?", "Will AI replace virtual assistants?", "HELP", "ALERT accountant", "STOP", "capital of France"]:
        r = client.post("/sms/inbound", json={"from": "+251911000000", "text": text})
        assert r.status_code == 200 and 0 < len(r.text) <= 160, text
    assert client.post("/sms/inbound", json={"from": "12", "text": "hi"}).status_code == 400


def test_alerts_and_accommodation(client):
    r = client.post("/api/v1/alerts", json={"channel": "sms", "address": "0911000000", "keyword": "accountant"})
    assert r.status_code == 201
    assert client.post("/api/v1/alerts", json={"channel": "sms", "address": "123", "keyword": "x"}).status_code == 400
    r = client.post("/api/v1/accommodations", json={"job_id": "accountant-002", "needs": ["interpreter", "extra_time"], "contact_channel": "sms", "contact": "0911000000"})
    assert r.status_code == 201 and "not sent to the employer" in r.json()["message"]
    rows = client.get("/api/v1/accommodations").json()
    assert rows[-1]["contact"] == "+251911000000" and rows[-1]["needs"] == ["interpreter", "extra_time"]


def test_data_export_and_delete(client):
    cid = "test-conversation-1"
    client.post("/api/v1/ask", json={"question": "What skills will clients value?", "language": "en", "conversation_id": cid})
    assert client.get(f"/api/v1/data/{cid}").json()["questions"]
    assert client.delete(f"/api/v1/data/{cid}").json()["deleted_questions"] >= 1
    assert not client.get(f"/api/v1/data/{cid}").json()["questions"]


def test_errors_are_words_never_raw(client, monkeypatch):
    r = client.get("/api/v1/nope")
    assert r.status_code == 404 and "does not exist" in r.json()["detail"]
    r = client.delete("/api/v1/ask")
    assert r.status_code == 405 and "method" in r.json()["detail"].lower()
    r = client.post("/sms/inbound", json={"text": "hi"})  # missing "from"
    assert r.status_code == 400 and r.headers["content-type"].startswith("text/plain") and len(r.text) <= 160
    sec = {"id": "x", "url": "/x#x", "title_en": "X", "text_en": "Y"}
    r = client.post("/api/v1/content", json={"sections": [sec, sec]})
    assert r.status_code == 400 and "Repeated: x" in r.json()["detail"]

    from fastapi.testclient import TestClient
    from sqlalchemy.exc import OperationalError

    import routers.ask as ask_router
    from main import app

    async def boom(*a, **k):
        raise RuntimeError("simulated crash")

    monkeypatch.setattr(ask_router, "answer", boom)
    with TestClient(app, raise_server_exceptions=False) as c:
        r = c.post("/api/v1/ask", json={"question": "hello", "language": "en"})
        assert r.status_code == 500 and "Something went wrong" in r.json()["detail"] and "simulated" not in r.text

        async def db_down(*a, **k):
            raise OperationalError("SELECT 1", {}, Exception("locked"))

        monkeypatch.setattr(ask_router, "answer", db_down)
        r = c.post("/api/v1/ask", json={"question": "hello", "language": "en"})
        assert r.status_code == 503 and "database" in r.json()["detail"]


def _page_sections():
    """The real sections of demo/page-reading.html, read the way the widget reads them (h2 split, aside/hidden skipped)."""
    import re as _re
    from config import REPO_DIR

    html = (REPO_DIR / "demo/page-reading.html").read_text(encoding="utf-8")
    main = html[html.index("<main>"): html.index("</main>")]
    main = _re.sub(r"<div hidden>.*?</div>", "", main, flags=_re.S)
    out = []
    for m in _re.finditer(r'<h2( id="([^"]+)")?>(.*?)</h2>(.*?)(?=<h2|$)', main, _re.S):
        title, text = m.group(3).strip(), " ".join(_re.sub(r"<[^>]+>", " ", m.group(4)).split())
        url = f"/demo/page-reading.html#{m.group(2)}" if m.group(2) else "/demo/page-reading.html#:~:text=" + title.replace(" ", "%20")
        out.append({"id": m.group(2) or f"page-section-{len(out) + 1}", "title": title, "text": text, "url": url, "lang": "en", "source": "page"})
    return out


PAGE = _page_sections()


def test_ask_with_page_sections_cites_them(client):
    r = client.post("/api/v1/ask", json={"question": "Why should I not charge my laptop on a bed?", "language": "en",
                                         "page_url": "http://localhost:8080/demo/page-reading.html", "sections": PAGE})
    body = r.json()
    assert len(PAGE) == 4 and not any("must be skipped" in x["title"] for x in PAGE)
    assert r.status_code == 200 and body["answer"] and "on a bed" in body["answer"]
    assert body["sources"][0]["url"].startswith("/demo/page-reading.html#:~:text=Avoid%20heat")
    r = client.post("/api/v1/ask", json={"question": "How should I store a laptop I do not use?", "language": "en",
                                         "page_url": "http://localhost:8080/demo/page-reading.html", "sections": PAGE})
    assert r.json()["sources"][0]["url"] == "/demo/page-reading.html#storage"
    # the stored lesson is not mixed in for another page: a lesson question is not found here
    r = client.post("/api/v1/ask", json={"question": "What skills will clients value?", "language": "en",
                                         "page_url": "http://localhost:8080/demo/page-reading.html", "sections": PAGE})
    assert r.json()["answer"] is None and r.json()["reason"] == "not_found"


def test_ask_page_sections_are_truncated_and_sanitised(client):
    big = [{"id": f"s{i}", "title": "T" * 500, "text": "battery " * 2000, "url": f"/p.html#s{i}", "lang": "en"} for i in range(80)]
    big.append({"id": "evil", "title": "Evil", "text": "battery " * 20, "url": "javascript:alert(1)", "lang": "en"})
    from schemas import AskIn

    parsed = AskIn(question="battery?", language="en", sections=big)
    assert len(parsed.sections) == 50
    assert all(len(s.text) <= 4000 and len(s.title) <= 300 for s in parsed.sections)
    r = client.post("/api/v1/ask", json={"question": "battery?", "language": "en", "page_url": "/p.html", "sections": big})
    assert r.status_code == 200
    assert all(not s["url"].startswith("javascript") for s in r.json()["sources"])
    from schemas import PageSectionIn

    assert PageSectionIn(id="x", title="x", text="x", url="javascript:alert(1)").url == ""


def test_config_counts_sections_for_the_page(client):
    assert client.get("/api/v1/config", params={"page_url": "http://localhost:8080/pages/concept-with-navigation.html"}).json()["page_sections"] == 5
    assert client.get("/api/v1/config", params={"page_url": "https://nydl.example/lesson"}).json()["page_sections"] == 0


def test_translate_needs_consent_and_uses_the_model(client, monkeypatch):
    from config import settings
    from services import answer as answer_mod

    body = {"text": "The Frontend course teaches React.", "target": "am", "source": "en"}
    r = client.post("/api/v1/translate", json=body).json()
    assert r["text"] is None and r["reason"] == "consent"  # no consent: nothing leaves the server

    class Fake:
        NAME = "fake"

        @staticmethod
        async def complete(system, user):
            assert "Amharic" in system and "React" in user
            return '{"text": "ፊት ለፊት ኮርስ React ያስተምራል።"}'

    monkeypatch.setattr(answer_mod, "chain", lambda: [Fake])
    monkeypatch.setattr(settings, "provider", "cloud")
    monkeypatch.setattr(settings, "gemini_key", "test")
    ok = client.post("/api/v1/translate", json={**body, "allow_ai": True}).json()
    assert ok["text"].endswith("ያስተምራል።") and ok["provider"] == "fake" and ok["reason"] is None

    same = client.post("/api/v1/translate", json={**body, "target": "en", "allow_ai": True}).json()
    assert same["text"] == body["text"]  # nothing to do

    monkeypatch.setattr(answer_mod, "chain", lambda: [])
    none = client.post("/api/v1/translate", json={**body, "allow_ai": True}).json()
    assert none["text"] is None and none["reason"] == "failed"
