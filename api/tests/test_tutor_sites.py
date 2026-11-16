"""Tutor e-mail addresses per site (the developer enters them in the dashboard), the fallback to the SYLY team, the HTML email,
and the limit on alerts."""

import asyncio
import smtplib

import pytest
from email.message import EmailMessage

from config import settings
from db import SessionLocal
from models import Account, Site
from routers import help as help_router
from services import email_template as tpl
from services import mailer, notify, sites

ESCALATION = {
    "conversation": [{"role": "learner", "text": "Where is week 3?", "lang": "en"}],
    "page_url": "https://college.example/lesson.html", "language": "am", "conversation_id": "c9",
}


def run(coro):
    return asyncio.run(coro)


# ---------------------------------------------------------------- the addresses a developer enters
@pytest.mark.parametrize("raw,expected", [
    ("tutors@college.example", ["tutors@college.example"]),
    ("A@College.example\nb@college.example", ["a@college.example", "b@college.example"]),
    ("a@x.org, b@x.org; c@x.org", ["a@x.org", "b@x.org", "c@x.org"]),
    ("a@x.org\nA@X.ORG\n\n", ["a@x.org"]),
    ("", []), (None, []), (["a@x.org"], ["a@x.org"]),
])
def test_addresses_are_cleaned(raw, expected):
    assert sites.parse_emails(raw) == (expected, None)


@pytest.mark.parametrize("bad", ["not-an-address", "a@b", "a b@x.org", "<a@x.org>", "a@x.org, nope", "@x.org", "a@@x.org"])
def test_a_bad_address_is_named(bad):
    emails, wrong = sites.parse_emails(bad)
    assert wrong is not None


def _form(**over):
    base = {"name": "College", "allowed_origins": ["https://college.example"]}
    base.update(over)
    return base


def test_the_site_form_keeps_addresses_and_explains_a_bad_one():
    assert sites.clean(_form(tutor_emails="Tutors@College.example"))["settings"]["tutor_emails"] == ["tutors@college.example"]
    assert sites.clean(_form())["settings"]["tutor_emails"] == []
    with pytest.raises(sites.FieldError) as e:
        sites.clean(_form(tutor_emails="ok@x.org\nbroken"))
    assert "“broken” is not a valid e-mail address" in e.value.fields["tutor_emails"]
    with pytest.raises(sites.FieldError) as e:
        sites.clean(_form(tutor_emails=",".join(f"t{i}@x.org" for i in range(6))))
    assert "Too many" in e.value.fields["tutor_emails"]


def _site(key, emails, name="My College"):
    with SessionLocal() as db:
        acc = Account(google_sub=f"s-{key}", email="dev@x.org", name="Dev")
        db.add(acc)
        db.flush()
        db.add(Site(account_id=acc.id, name=name, public_key=key, allowed_origins=["http://localhost:*"], settings={"tutor_emails": emails}))
        db.commit()


def test_tutor_addresses_never_reach_the_public_config():
    _site("pk_privacycheck000000000001", ["secret@college.example"])
    with SessionLocal() as db:
        site = db.query(Site).filter_by(public_key="pk_privacycheck000000000001").one()
        assert "secret@college.example" not in str(sites.public_config(site)), "the widget config is public: addresses are private"
        assert sites.view(site)["settings"]["tutor_emails"] == ["secret@college.example"], "the owner sees them in the dashboard"


# ---------------------------------------------------------------- who gets the alert
def test_a_request_from_a_site_with_addresses_goes_to_them(client, monkeypatch):
    _site("pk_site_with_mail_0000000001", ["tutors@college.example"], name="Addis College")
    told = []

    async def record(*args):
        told.append(args)

    monkeypatch.setattr(notify, "tutors", record)
    monkeypatch.setattr(help_router, "helper_online", lambda db: False)
    r = client.post("/api/v1/escalations", json=ESCALATION, headers={"X-Site-Key": "pk_site_with_mail_0000000001"})
    assert r.status_code == 201
    assert told[-1][5:] == ("Addis College", ["tutors@college.example"])


def test_a_site_without_addresses_or_a_request_without_a_key_uses_the_team(client, monkeypatch):
    _site("pk_site_no_mail_000000000001", [], name="No Mail College")
    told = []

    async def record(*args):
        told.append(args)

    monkeypatch.setattr(notify, "tutors", record)
    monkeypatch.setattr(help_router, "helper_online", lambda db: False)
    client.post("/api/v1/escalations", json=ESCALATION, headers={"X-Site-Key": "pk_site_no_mail_000000000001"})
    assert told[-1][5:] == ("No Mail College", [])
    client.post("/api/v1/escalations", json=ESCALATION)
    assert told[-1][5:] == (None, [])
    client.post("/api/v1/escalations", json=ESCALATION, headers={"X-Site-Key": "pk_unknown_key_000000000000"})
    assert told[-1][5:] == (None, [])


def test_site_addresses_get_the_email_and_the_team_group_does_not(monkeypatch):
    sent = {"mail": [], "tg": []}

    async def em(to, subject, body, html=None):
        sent["mail"].append((to, html))
        return True

    async def tg(chat, text):
        sent["tg"].append(chat)
        return True

    monkeypatch.setattr(settings, "tutor_emails", ["team@syly.example"])
    monkeypatch.setattr(settings, "tutor_telegram_chat", "-100999")
    monkeypatch.setattr(mailer, "send", em)
    monkeypatch.setattr(notify, "telegram", tg)
    notify._recent.clear()
    out = run(notify.tutors(5, "en", "https://c.example/p", "Q?", False, "Addis College", ["tutors@college.example"]))
    assert out == {"telegram": False, "email": True}
    assert sent["mail"][0][0] == ["tutors@college.example"] and sent["tg"] == [], "another college's learners are not shown to the SYLY team's group"
    assert "Addis College" in sent["mail"][0][1] and "listed as a tutor address for this site" in sent["mail"][0][1]

    notify._recent.clear()
    out = run(notify.tutors(6, "en", "https://c.example/p", "Q?", False, "No Mail College", []))
    assert out == {"telegram": True, "email": True}
    assert sent["mail"][1][0] == ["team@syly.example"] and sent["tg"] == ["-100999"], "no addresses: the SYLY team is the fallback"
    assert "SYLY team&#x27;s tutor list" in sent["mail"][1][1]  # the apostrophe is escaped in HTML


# ---------------------------------------------------------------- the limit
def test_at_most_20_alerts_an_hour_per_target():
    notify._recent.clear()
    assert all(notify.allow_alert("site-a", now=1000.0 + i) for i in range(20))
    assert notify.allow_alert("site-a", now=1030.0) is False, "the 21st within the hour is skipped (the request is still on the helper page)"
    assert notify.allow_alert("site-b", now=1030.0) is True, "another site is not affected"
    assert notify.allow_alert("site-a", now=1000.0 + 3601) is True, "an hour later it is allowed again"


def test_an_alert_over_the_limit_is_not_sent(monkeypatch):
    sent = []

    async def em(to, subject, body, html=None):
        sent.append(to)
        return True

    monkeypatch.setattr(settings, "tutor_emails", ["team@syly.example"])
    monkeypatch.setattr(settings, "tutor_telegram_chat", "")
    monkeypatch.setattr(mailer, "send", em)
    notify._recent.clear()
    for i in range(25):
        run(notify.tutors(i, "en", None, "q"))
    assert len(sent) == 20
    notify._recent.clear()


# ---------------------------------------------------------------- the email itself
def test_the_html_email_has_the_parts_a_tutor_needs():
    page = tpl.html_body(12, "am", "https://college.example/lesson.html#week-3", "Where is week 3?", True, "Addis College", "https://syly.example.org/demo/helper.html")
    for needle in ("Request 12", "Amharic · አማርኛ", "Addis College", "Screenshot on the request", "Where is week 3?",
                   'href="https://college.example/lesson.html#week-3"', 'href="https://syly.example.org/demo/helper.html"', "Open the waiting requests",
                   'lang="en"', "prefers-color-scheme: dark", "Start helping"):
        assert needle in page, needle
    assert "token" not in page.lower() and "chat id" not in page.lower()


def test_what_a_learner_wrote_cannot_inject_html_or_a_bad_link():
    evil = '<script>alert(1)</script><img src=x onerror=alert(2)> "quoted" & more'
    page = tpl.html_body(1, "en", "javascript:alert(3)", evil, False, '<b>Site</b>', "https://syly.example.org/demo/helper.html")
    assert "<script>" not in page and "<img src=x" not in page and "<b>Site</b>" not in page
    assert "&lt;script&gt;" in page and "&quot;quoted&quot;" in page and "&amp; more" in page
    assert 'href="javascript:' not in page, "a page address that is not http or https is never a link"


def test_a_long_question_is_cut_and_an_empty_one_is_said():
    page = tpl.html_body(1, "en", None, "word " * 500, False, None, "https://x/h")
    assert ("word " * 80).strip() in page and ("word " * 81) not in page, "400 characters are kept, no more"
    assert "(no question was written)" in tpl.html_body(1, "en", None, "   ", False, None, "https://x/h")
    assert "(no question was written)" in tpl.text(1, "en", None, "", False, None, "https://x/h")


def test_the_message_is_plain_text_plus_html_and_from_syly(monkeypatch):
    got = {}

    class Smtp:
        def __init__(self, *a, **k): ...
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def starttls(self): ...
        def login(self, *a): ...
        def send_message(self, msg: EmailMessage): got["msg"] = msg

    monkeypatch.setattr(smtplib, "SMTP", Smtp)
    for name, value in (("smtp_host", "h"), ("smtp_user", "u"), ("smtp_pass", "p"), ("sender_email", "sender@college.example")):
        monkeypatch.setattr(settings, name, value)
    assert run(mailer.send(["t@x.org"], "Subject", "Plain words", "<p>Html words</p>")) is True
    msg = got["msg"]
    assert msg["From"] == "SYLY <sender@college.example>"
    assert "Plain words" in msg.get_body(preferencelist=("plain",)).get_content()
    assert "Html words" in msg.get_body(preferencelist=("html",)).get_content()
    assert msg.is_multipart()
