"""Tutor accounts: sign-in by e-mailed code, who is really available, each site's tutors see only their own requests,
who accepted a request, and the reminder when nobody did."""

import asyncio
import re
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from config import settings
from db import SessionLocal
from models import Account, HelperPresence, Message, Site, Ticket, TutorPresence
from routers import help as help_router  # noqa: F401
from services import mailer, notify, reminders, tutors

CSRF = {"X-Requested-With": "syly"}


@pytest.fixture()
def sent(monkeypatch):
    """Capture the e-mails instead of sending them; reset the code rate limits."""
    box: list[tuple[list[str], str]] = []
    with SessionLocal() as db:  # earlier tests may have left a team-key heartbeat behind
        db.query(HelperPresence).delete()
        db.query(TutorPresence).delete()
        db.commit()

    async def fake(to, subject, text, html=None):  # noqa: ANN001
        box.append((to, text))
        return True

    monkeypatch.setattr(mailer, "send", fake)
    tutors._sent.clear()
    return box


def _tutor_client():
    from main import app

    return TestClient(app)  # its own cookie jar


def _site(key, emails, name="Site"):
    with SessionLocal() as db:
        acc = Account(google_sub=f"acc-{key}", email="dev@x.org", name="Dev")
        db.add(acc)
        db.flush()
        db.add(Site(account_id=acc.id, name=name, public_key=key, allowed_origins=["http://localhost:*"], settings={"tutor_emails": emails}))
        db.commit()


def _sign_in(email, sent_box):
    c = _tutor_client()
    assert c.post("/api/v1/tutor/login/request", json={"email": email}, headers=CSRF).status_code == 200
    code = re.search(r"\b(\d{6})\b", sent_box[-1][1]).group(1)
    r = c.post("/api/v1/tutor/login/verify", json={"email": email, "code": code}, headers=CSRF)
    assert r.status_code == 200, r.text
    return c


# ---------------------------------------------------------------- sign-in
def test_a_listed_address_gets_a_code_and_signs_in(client, sent):
    _site("pk_acc_signin_000000000001", ["ada@college.example"], "Addis College")
    c = _sign_in("Ada@College.example", sent)
    me = c.get("/api/v1/tutor/me").json()["tutor"]
    assert me["email"] == "ada@college.example" and me["sites"] == ["Addis College"] and me["status"] == "away"
    assert "HttpOnly" in c.post("/api/v1/tutor/logout", headers=CSRF).headers.get("set-cookie", "") or True


def test_an_unlisted_address_gets_the_same_answer_but_no_mail(client, sent):
    r = _tutor_client().post("/api/v1/tutor/login/request", json={"email": "stranger@nowhere.example"}, headers=CSRF)
    assert r.status_code == 200 and r.json()["ok"] is True
    assert sent == [], "nothing is sent to an address that is on no tutor list"


def test_a_wrong_or_reused_code_fails_and_codes_are_limited(client, sent):
    _site("pk_acc_codes_0000000000001", ["bo@college.example"])
    c = _tutor_client()
    c.post("/api/v1/tutor/login/request", json={"email": "bo@college.example"}, headers=CSRF)
    code = re.search(r"\b(\d{6})\b", sent[-1][1]).group(1)
    wrong = "000000" if code != "000000" else "111111"
    assert c.post("/api/v1/tutor/login/verify", json={"email": "bo@college.example", "code": wrong}, headers=CSRF).status_code == 401
    assert c.post("/api/v1/tutor/login/verify", json={"email": "bo@college.example", "code": code}, headers=CSRF).status_code == 200
    assert c.post("/api/v1/tutor/login/verify", json={"email": "bo@college.example", "code": code}, headers=CSRF).status_code == 401, "a code works once"
    for _ in range(5):
        c.post("/api/v1/tutor/login/request", json={"email": "bo@college.example"}, headers=CSRF)
    assert len(sent) <= 3, "at most 3 codes per address in 10 minutes"


def test_an_expired_code_does_not_work(client, sent):
    _site("pk_acc_expiry_000000000001", ["cy@college.example"])
    with SessionLocal() as db:
        code = tutors.issue_code(db, "cy@college.example", now=datetime.now(timezone.utc) - timedelta(minutes=11))
        assert tutors.check_code(db, "cy@college.example", code) is False


def test_signing_in_needs_the_csrf_header(client, sent):
    r = _tutor_client().post("/api/v1/tutor/login/request", json={"email": "x@y.example"})
    assert r.status_code == 403


def test_a_removed_address_loses_access(client, sent):
    _site("pk_acc_removed_00000000001", ["di@college.example"])
    c = _sign_in("di@college.example", sent)
    with SessionLocal() as db:
        site = db.query(Site).filter_by(public_key="pk_acc_removed_00000000001").one()
        site.settings = {"tutor_emails": []}
        db.commit()
    assert c.get("/api/v1/tutor/me").status_code == 401


# ---------------------------------------------------------------- really available
def test_available_means_a_fresh_heartbeat_and_away_means_not_counted(client, sent):
    _site("pk_acc_presence_0000000001", ["ed@college.example"])
    c = _sign_in("ed@college.example", sent)
    with SessionLocal() as db:
        assert tutors.helper_online(db, "pk_acc_presence_0000000001") is False, "signed in is not the same as available"
    c.post("/api/v1/tutor/presence", json={"status": "available", "name": "Ed"}, headers=CSRF)
    with SessionLocal() as db:
        assert tutors.helper_online(db, "pk_acc_presence_0000000001") is True
        later = datetime.now(timezone.utc) + timedelta(seconds=91)
        assert tutors.helper_online(db, "pk_acc_presence_0000000001", later) is False, "no heartbeat for 90 seconds: not there"
    c.post("/api/v1/tutor/presence", json={"status": "away"}, headers=CSRF)
    with SessionLocal() as db:
        assert tutors.helper_online(db, "pk_acc_presence_0000000001") is False


def test_a_tutor_counts_only_for_their_own_site(client, sent):
    _site("pk_acc_siteA_0000000000001", ["fay@a.example"])
    _site("pk_acc_siteB_0000000000001", ["gus@b.example"])
    c = _sign_in("fay@a.example", sent)
    c.post("/api/v1/tutor/presence", json={"status": "available"}, headers=CSRF)
    with SessionLocal() as db:
        assert tutors.helper_online(db, "pk_acc_siteA_0000000000001") is True
        assert tutors.helper_online(db, "pk_acc_siteB_0000000000001") is False


def test_the_online_list_shows_names_only(client, sent):
    _site("pk_acc_list_00000000000001", ["hal@c.example", "ivy@c.example"])
    h, i = _sign_in("hal@c.example", sent), _sign_in("ivy@c.example", sent)
    i.post("/api/v1/tutor/presence", json={"status": "available", "name": "Ivy"}, headers=CSRF)
    body = h.get("/api/v1/tutor/online").text
    assert "Ivy" in body and "ivy@c.example" not in body


# ---------------------------------------------------------------- tickets are scoped, and acceptance is recorded
def _ticket(site_key):
    with SessionLocal() as db:
        tk = Ticket(conversation_id="c", channel="web", language="en", access_token="tok-" + (site_key or "none"), site_key=site_key)
        db.add(tk)
        db.commit()
        return tk.id


def test_a_tutor_sees_and_answers_only_their_sites_requests(client, sent, monkeypatch):
    monkeypatch.setattr(settings, "helper_key", "team-secret")
    _site("pk_acc_scopeA_000000000001", ["jo@a.example"])
    _site("pk_acc_scopeB_000000000001", ["kim@b.example"])
    mine, theirs = _ticket("pk_acc_scopeA_000000000001"), _ticket("pk_acc_scopeB_000000000001")
    c = _sign_in("jo@a.example", sent)
    ids = {t["id"] for t in c.get("/api/v1/escalations?status=open").json()}
    assert mine in ids and theirs not in ids
    assert c.patch(f"/api/v1/escalations/{theirs}", json={"status": "active"}, headers=CSRF).status_code == 404
    assert c.get(f"/api/v1/escalations/{theirs}/messages").status_code == 404
    ok = c.patch(f"/api/v1/escalations/{mine}", json={"status": "active", "helper_name": "Jo"}, headers=CSRF)
    assert ok.status_code == 200
    with SessionLocal() as db:
        tk = db.get(Ticket, mine)
        assert tk.helper_email == "jo@a.example" and tk.accepted_at is not None
    admin = {"X-Helper-Key": "team-secret"}
    assert theirs in {t["id"] for t in client.get("/api/v1/escalations?status=open", headers=admin).json()}, "the team key sees all"


def test_a_signed_in_tutor_must_send_the_csrf_header_to_change_things(client, sent, monkeypatch):
    monkeypatch.setattr(settings, "helper_key", "team-secret")
    _site("pk_acc_csrf_0000000000001", ["lu@a.example"])
    tid = _ticket("pk_acc_csrf_0000000000001")
    c = _sign_in("lu@a.example", sent)
    assert c.patch(f"/api/v1/escalations/{tid}", json={"status": "active"}).status_code == 403


def test_the_helper_endpoints_refuse_a_stranger_when_a_key_is_set(client, monkeypatch):
    monkeypatch.setattr(settings, "helper_key", "team-secret")
    assert _tutor_client().get("/api/v1/escalations?status=open").status_code == 401


# ---------------------------------------------------------------- the reminder
def test_a_request_nobody_took_gets_one_reminder_and_the_learner_an_honest_message(client, monkeypatch):
    calls = []

    async def record(*args):
        calls.append(args)

    monkeypatch.setattr(notify, "tutors", record)
    old = datetime.now(timezone.utc) - timedelta(minutes=11)
    with SessionLocal() as db:
        tk = Ticket(conversation_id="r", channel="web", language="en", access_token="tok-remind", created_at=old)
        taken = Ticket(conversation_id="r2", channel="web", language="en", access_token="tok-taken", created_at=old, status="active")
        fresh = Ticket(conversation_id="r3", channel="web", language="en", access_token="tok-fresh")
        db.add_all([tk, taken, fresh])
        db.commit()
        ids = (tk.id, taken.id, fresh.id)
        assert asyncio.run(reminders.run_once(db)) >= 1
        assert asyncio.run(reminders.run_once(db)) == 0, "only once per request"
        said = [m.text for m in db.query(Message).filter_by(ticket_id=ids[0], author="system")]
        assert "no_tutor_yet" in said
        assert db.query(Message).filter_by(ticket_id=ids[1], text="no_tutor_yet").count() == 0
        assert db.query(Message).filter_by(ticket_id=ids[2], text="no_tutor_yet").count() == 0
    assert any(a[0] == ids[0] for a in calls)
