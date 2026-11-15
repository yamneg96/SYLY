"""SYLY demo-readiness check: one command, PASS/FAIL per area, non-zero exit on any failure.

    python scripts/verify_prototype.py

Idea and first version by Lemi (prototype-1, scripts/verify_prototype.py); rewritten for our
structure (one api/ package, nginx layout, SMS <= 160 characters, static JobPosting JSON-LD).
Runs the API in-process with a temporary database and PROVIDER=none: no AI calls, no network,
your data/ folder is not touched. It complements, not replaces, `pytest api` and the browser checks.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))
os.environ["DATA_DIR"] = tempfile.mkdtemp(prefix="syly-verify-")
os.environ["PROVIDER"] = "none"
for k in ("GEMINI_API_KEY", "GROQ_API_KEY", "TELEGRAM_BOT_TOKEN", "BOT_TOKEN", "HELPER_KEY", "ADDIS_AI_API_KEY", "FERNET_KEY"):
    os.environ[k] = ""

results: list[tuple[str, bool, str]] = []


def check(area: str, ok: bool, detail: str = "") -> None:
    results.append((area, ok, detail))
    print(f"  {'PASS' if ok else 'FAIL'}  {area}{': ' + detail if detail else ''}")


def section(title: str) -> None:
    print(f"\n[{title}]")


def main() -> int:
    from fastapi.testclient import TestClient

    from main import app

    with TestClient(app) as client:
        section("1. Server")
        r = client.get("/api/v1/health")
        check("health", r.status_code == 200 and r.json().get("status") == "ok")
        cfg = client.get("/api/v1/config").json()
        check("config (PROVIDER=none, no AI)", cfg.get("ai") is False and cfg.get("provider") == "none")

        section("2. Grounded answers (FR-T2..T6)")
        a = client.post("/api/v1/ask", json={"question": "AI ምናባዊ ረዳቶችን ይተካል?", "language": "am"}).json()
        check("Amharic answer has a lesson source", bool(a.get("answer")) and a["sources"][0]["url"].startswith("/pages/concept-with-navigation.html#"),
              (a.get("sources") or [{}])[0].get("url", ""))
        check("Amharic answer carries offline audio paths", bool(a.get("audio")))
        nf = client.post("/api/v1/ask", json={"question": "What is the capital of France?", "language": "en"}).json()
        check("out of scope -> not found, no answer", nf.get("answer") is None and nf.get("reason") == "not_found")
        na = client.post("/api/v1/ask", json={"question": "Which medicine should I take?", "language": "en"}).json()
        check("medical question -> refused", na.get("answer") is None and na.get("reason") == "no_advice")
        bad = client.post("/api/v1/ask", json={"question": "", "language": "xx"})
        check("bad input -> 400 in words", bad.status_code == 400 and "question" in bad.json().get("detail", ""))

        section("3. Search quality (eval set)")
        from services.retrieval import Index

        content = json.loads((ROOT / "demo/data/content.json").read_text(encoding="utf-8"))
        ev = json.loads((ROOT / "api/scripts/eval_questions.json").read_text(encoding="utf-8"))
        ix = Index(content["sections"])
        for lang in ("en", "am"):
            ins = [x for x in ev["in_scope"] if x["lang"] == lang]
            outs = [x for x in ev["out_of_scope"] if x["lang"] == lang]
            hit = sum(1 for x in ins if (res := ix.search(x["q"])).found and res.best.section["id"] in x["expect"])
            rej = sum(1 for x in outs if not ix.search(x["q"]).found)
            check(f"{lang}: in-scope {hit}/{len(ins)}, out-of-scope refused {rej}/{len(outs)}",
                  hit / len(ins) >= 0.8 and rej / len(outs) >= 0.8)
        node = shutil.which("node")
        if node:
            p = subprocess.run([node, "--test", "tests/search.test.mjs"], cwd=ROOT / "module", capture_output=True, text=True, encoding="utf-8")
            check("browser search tests (same algorithm as server)", p.returncode == 0)
        else:
            print("  SKIP  browser search tests (node not installed)")

        section("4. Talk to a person (FR-H1..H3, FR-AD2)")
        t = client.post("/api/v1/escalations", json={"conversation": [{"role": "learner", "text": "ሰው እፈልጋለሁ", "lang": "am"}],
                                                       "page_url": "/pages/concept-with-navigation.html", "language": "am"})
        tk = t.json()
        check("ticket opened (201, id + token)", t.status_code == 201 and tk.get("ticketId") and tk.get("token"))
        check("no helper online -> honest 'may take until morning'", tk.get("helper_online") is False)
        client.post("/api/v1/helper/presence?name=Saron")
        client.post(f"/api/v1/escalations/{tk['ticketId']}/messages", json={"author": "helper", "name": "Saron", "text": "ሰላም"})
        msgs = client.get(f"/api/v1/escalations/{tk['ticketId']}/messages", params={"after": 0, "token": tk["token"]}).json()
        check("tutor reply reaches the learner (polling)", msgs[-1]["author"] == "helper")
        check("wrong token cannot read the ticket", client.get(f"/api/v1/escalations/{tk['ticketId']}/messages", params={"token": "x"}).status_code == 404)
        check("helper online now reported", client.get("/api/v1/config").json().get("helper_online") is True)

        section("5. Text route /sms/inbound (FR-CH2, FR-CH3)")
        sms_cases = [("0911000000", "JOBS accountant"), ("0711000000", "ASK AI ምናባዊ ረዳቶችን ይተካል?"),
                     ("+251911000000", "Will AI replace virtual assistants?"), ("0911000000", "HELP"),
                     ("0911000000", "ALERT accountant"), ("0911000000", "STOP"), ("0911000000", "capital of France")]
        for sender, text in sms_cases:
            r = client.post("/sms/inbound", json={"from": sender, "text": text})
            check(f"'{text}' from {sender}", r.status_code == 200 and r.headers["content-type"].startswith("text/plain") and 0 < len(r.text) <= 160,
                  f"{len(r.text)} chars")
        check("unknown phone format -> 400", client.post("/sms/inbound", json={"from": "12", "text": "hi"}).status_code == 400)

        section("6. Career gateway (FR-J1..J5)")
        page = (ROOT / "savanna/pages/jobs.html").read_text(encoding="utf-8")
        blocks = [json.loads(b) for b in re.findall(r'<script type="application/ld\+json">(.*?)</script>', page, re.S)]
        check(f"jobs.html has static JobPosting JSON-LD ({len(blocks)} blocks)",
              len(blocks) >= 5 and all(b.get("@type") == "JobPosting" and b.get("hiringOrganization") and b.get("datePosted") for b in blocks))
        check("accommodations in jobBenefits", all(b.get("jobBenefits") for b in blocks))
        ja = client.post("/api/v1/ask", json={"question": "Does the accountant job need experience?", "language": "en"}).json()
        check("job answer links the job and warns 'never pay to apply'",
              ja["sources"][0]["url"].startswith("/pages/jobs.html#job-") and "Never pay to apply" in ja["answer"])
        acc = client.post("/api/v1/accommodations", json={"job_id": "accountant-002", "needs": ["interpreter"], "contact_channel": "sms", "contact": "0911000000"})
        check("interview support request goes to a person", acc.status_code == 201 and "not sent to the employer" in acc.json()["message"])
        from db import SessionLocal
        from models import Accommodation

        with SessionLocal() as db:
            row = db.query(Accommodation).order_by(Accommodation.id.desc()).first()
        check("contact stored encrypted, shown decrypted to the helper",
              row.contact_enc and "0911000000" not in row.contact_enc and client.get("/api/v1/accommodations").json()[-1]["contact"] == "+251911000000")

        section("7. Learner data (NFR-S4)")
        cid = "verify-conv-1"
        client.post("/api/v1/ask", json={"question": "What skills will clients value?", "language": "en", "conversation_id": cid})
        check("export", bool(client.get(f"/api/v1/data/{cid}").json()["questions"]))
        client.delete(f"/api/v1/data/{cid}")
        check("delete", not client.get(f"/api/v1/data/{cid}").json()["questions"])

    section("8. Languages and audio (NFR-E1, NFR-E5, FR-T8)")
    for folder in ("module/i18n", "api/i18n", "bot/i18n"):
        en = json.loads((ROOT / folder / "en.json").read_text(encoding="utf-8"))
        files = sorted(p.stem for p in (ROOT / folder).glob("*.json") if p.stem != "en")
        keys = {lang: set(json.loads((ROOT / folder / f"{lang}.json").read_text(encoding="utf-8"))) for lang in files}
        ok = keys.get("am") == set(en) and all(k <= set(en) for k in keys.values())
        check(f"{folder}: am has every en key, no language has extra keys ({', '.join(files)})", ok)
    from services.retrieval import split_sentences

    missing = [f"{s['id']}/{i}" for s in content["sections"] for i, _ in enumerate(split_sentences(s["text_am"]))
               if not (ROOT / "module/audio/sections" / s["id"] / f"{i}.am.mp3").exists()]
    check("pre-generated Amharic audio for every sentence", not missing, f"missing {missing[:3]}" if missing else "")

    section("9. Bot (optional: needs aiogram)")
    try:
        sys.path.insert(0, str(ROOT / "bot"))
        import bot as tgbot  # noqa: PLC0415

        text = ("Virtual Assistant work is changing. " * 60) + "\n" + ("የቨርቹዋል ረዳትነት ሥራ እየተለወጠ ነው። " * 60)
        parts = tgbot.split(text, 800)
        check(f"Telegram splitter: {len(parts)} parts, all <= 800, cut at sentence ends",
              all(len(p) <= 800 for p in parts) and all(p.rstrip()[-1] in ".።?!" for p in parts))
    except ImportError:
        print("  SKIP  bot checks (aiogram not installed here; it is installed in the bot container)")

    section("10. Secrets and privacy (NFR-S1)")
    js = (ROOT / "module/db-assistant.js").read_text(encoding="utf-8")
    check("no API key patterns in the browser script", not re.search(r"AIza[0-9A-Za-z_-]{20,}|gsk_[0-9A-Za-z]{20,}|\d{8,10}:[0-9A-Za-z_-]{30,}", js))
    try:
        ignored = subprocess.run(["git", "check-ignore", "-q", ".env"], cwd=ROOT).returncode == 0
        check(".env is git-ignored", ignored)
    except FileNotFoundError:
        print("  SKIP  git not installed")

    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)} passed, {len(failed)} failed")
    if failed:
        print("FAILED: " + "; ".join(a for a, _, _ in failed))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
