"""Talk to a person with nobody online: the tutors are told (Telegram group, email); the learner's request never fails because of it."""

import asyncio
import logging
import smtplib

import pytest

from config import settings
from routers import help as help_router
from services import mailer, notify


def run(coro):
    return asyncio.run(coro)


ESCALATION = {
    "conversation": [{"role": "learner", "text": "Will AI replace virtual assistants?", "lang": "en"}],
    "page_url": "https://college.example/lesson.html", "language": "en", "conversation_id": "c1",
}


# ---------------------------------------------------------------- when the tutors are told
def test_tutors_are_told_only_when_nobody_is_online(client, monkeypatch):
    told = []

    async def record(ticket_id, language, page_url, question, has_screenshot=False, site_name=None, emails=None):
        told.append((ticket_id, language, page_url, question, has_screenshot))

    monkeypatch.setattr(notify, "tutors", record)
    monkeypatch.setattr(help_router, "helper_online", lambda db, site_key=None: False)
    r = client.post("/api/v1/escalations", json=ESCALATION)
    assert r.status_code == 201 and r.json()["helper_online"] is False
    assert told == [(r.json()["ticketId"], "en", "https://college.example/lesson.html", "Will AI replace virtual assistants?", False)]

    monkeypatch.setattr(help_router, "helper_online", lambda db, site_key=None: True)
    r = client.post("/api/v1/escalations", json=ESCALATION)
    assert r.json()["helper_online"] is True and len(told) == 1, "a tutor is already watching the helper page: no extra alert"


def test_a_screenshot_sent_with_the_request_is_mentioned(client, monkeypatch):
    told = []

    async def record(*args):
        told.append(args)

    monkeypatch.setattr(notify, "tutors", record)
    monkeypatch.setattr(help_router, "helper_online", lambda db, site_key=None: False)
    client.post("/api/v1/escalations", json={**ESCALATION, "screenshot": "data:image/jpeg;base64,AAAA"})
    assert told[-1][4] is True  # has_screenshot


def test_the_request_succeeds_even_if_every_alert_channel_breaks(client, monkeypatch):
    async def boom(*a, **k):
        raise RuntimeError("down")

    monkeypatch.setattr(settings, "tutor_telegram_chat", "-100123")
    monkeypatch.setattr(settings, "tutor_emails", ["tutors@college.example"])
    monkeypatch.setattr(notify, "telegram", boom)
    monkeypatch.setattr(mailer, "send", boom)
    monkeypatch.setattr(help_router, "helper_online", lambda db, site_key=None: False)
    r = client.post("/api/v1/escalations", json=ESCALATION)
    assert r.status_code == 201 and r.json()["ticketId"]


# ---------------------------------------------------------------- what the tutors read
def test_the_alert_has_what_a_tutor_needs_and_nothing_private(monkeypatch):
    monkeypatch.setattr(settings, "public_base_url", "https://syly.example.org")
    subject, body = notify.tutor_text(12, "am", "https://college.example/lesson.html#x", "x " * 400, True)
    assert subject == "SYLY: new request 12 (Amharic)"
    for needle in ("Request 12", "language am", "https://college.example/lesson.html#x", "https://syly.example.org/demo/helper.html", "screenshot"):
        assert needle in body, needle
    assert len(body.split("Question: ")[1].splitlines()[0]) <= 400 + 1, "a long question is cut"
    assert "token" not in body.lower() and "chat" not in body.lower()


def test_without_a_public_address_the_link_points_to_localhost(monkeypatch):
    monkeypatch.setattr(settings, "public_base_url", "")
    assert notify.helper_link() == "http://localhost:8080/demo/helper.html"


# ---------------------------------------------------------------- the two channels
def test_telegram_group_and_email_both_get_the_alert(monkeypatch):
    sent = {"telegram": [], "email": []}

    async def tg(chat, text):
        sent["telegram"].append((chat, text))
        return True

    async def em(to, subject, body, html=None):
        sent["email"].append((to, subject, body))
        return True

    monkeypatch.setattr(settings, "tutor_telegram_chat", "-100123")
    monkeypatch.setattr(settings, "tutor_emails", ["a@college.example", "b@college.example"])
    monkeypatch.setattr(notify, "telegram", tg)
    monkeypatch.setattr(mailer, "send", em)
    assert run(notify.tutors(7, "en", "https://c.example/p", "Question?")) == {"telegram": True, "email": True}
    assert sent["telegram"][0][0] == "-100123" and "request 7" in sent["telegram"][0][1]
    assert sent["email"][0][0] == ["a@college.example", "b@college.example"] and sent["email"][0][1] == "SYLY: new request 7 (English)"


def test_one_channel_failing_does_not_stop_the_other(monkeypatch):
    async def tg(chat, text):
        return False

    sent = []

    async def em(to, subject, body, html=None):
        sent.append(to)
        return True

    monkeypatch.setattr(settings, "tutor_telegram_chat", "-100123")
    monkeypatch.setattr(settings, "tutor_emails", ["a@college.example"])
    monkeypatch.setattr(notify, "telegram", tg)
    monkeypatch.setattr(mailer, "send", em)
    assert run(notify.tutors(1, "en", None, "q")) == {"telegram": False, "email": True} and sent


def test_nothing_configured_nothing_sent(monkeypatch):
    async def never(*a, **k):
        raise AssertionError("must not be called")

    monkeypatch.setattr(settings, "tutor_telegram_chat", "")
    monkeypatch.setattr(settings, "tutor_emails", [])
    monkeypatch.setattr(notify, "telegram", never)
    monkeypatch.setattr(mailer, "send", never)
    assert run(notify.tutors(1, "en", None, "q")) == {"telegram": False, "email": False}


# ---------------------------------------------------------------- the email itself
class FakeSMTP:
    log: list = []

    def __init__(self, host, port, timeout=None):
        FakeSMTP.log.append(("connect", host, port))

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def starttls(self):
        FakeSMTP.log.append(("starttls",))

    def login(self, user, password):
        FakeSMTP.log.append(("login", user, password))

    def send_message(self, msg):
        FakeSMTP.log.append(("send", msg["From"], msg["To"], msg["Subject"], msg.get_content()))


@pytest.fixture
def smtp(monkeypatch):
    FakeSMTP.log = []
    monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)
    for name, value in (("smtp_host", "smtp-relay.example"), ("smtp_port", 587), ("smtp_user", "user@relay"), ("smtp_pass", "S3CRET-pass"), ("sender_email", "sender@college.example")):
        monkeypatch.setattr(settings, name, value)
    return FakeSMTP


def test_the_email_is_sent_over_starttls_with_the_login(smtp):
    assert run(mailer.send(["tutors@college.example"], "Subject", "Body text")) is True
    kinds = [e[0] for e in smtp.log]
    assert kinds == ["connect", "starttls", "login", "send"], "encrypted before the password is sent"
    assert smtp.log[0][1:] == ("smtp-relay.example", 587)
    assert smtp.log[2][1:] == ("user@relay", "S3CRET-pass")
    assert smtp.log[3][1:4] == ("SYLY <sender@college.example>", "tutors@college.example", "Subject") and "Body text" in smtp.log[3][4]


def test_without_a_relay_nothing_is_attempted(monkeypatch):
    monkeypatch.setattr(smtplib, "SMTP", lambda *a, **k: (_ for _ in ()).throw(AssertionError("must not connect")))
    monkeypatch.setattr(settings, "smtp_host", "")
    assert mailer.configured() is False and run(mailer.send(["a@b.c"], "s", "b")) is False
    monkeypatch.setattr(settings, "smtp_host", "h")
    assert run(mailer.send([], "s", "b")) is False


def test_a_refused_login_returns_false_and_the_password_never_reaches_the_log(smtp, monkeypatch, caplog):
    def refuse(self, user, password):
        raise smtplib.SMTPAuthenticationError(535, b"bad login for S3CRET-pass")

    monkeypatch.setattr(FakeSMTP, "login", refuse)
    with caplog.at_level(logging.DEBUG):
        assert run(mailer.send(["a@b.c"], "s", "b")) is False
    assert "S3CRET-pass" not in caplog.text and "SMTPAuthenticationError" in caplog.text


def test_an_unreachable_relay_returns_false(smtp, monkeypatch):
    def down(self, host, port, timeout=None):
        raise OSError("no route")

    monkeypatch.setattr(FakeSMTP, "__init__", down)
    assert run(mailer.send(["a@b.c"], "s", "b")) is False
