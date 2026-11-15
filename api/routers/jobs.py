"""Career gateway: jobs (JobPosting), alerts, interview accommodations (FR-J1..J4)."""

from __future__ import annotations

import hashlib

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from db import decrypt, encrypt, get_db
from models import Accommodation, Alert, Job, Outbox
from routers.help import require_helper
from schemas import AccommodationIn, AlertIn, Created, JobIn
from services import content, notify, phone
from services.jobs_format import jsonld
from services.i18n import t
from services.sms import fit

router = APIRouter(prefix="/api/v1", tags=["career gateway"])


def address_hash(channel: str, address: str) -> str:
    return hashlib.sha256(f"{channel}:{address}".encode()).hexdigest()


def matches(alert: Alert, job: dict) -> bool:
    hay = " ".join(str(job.get(k, "")) for k in ("title_en", "title_am", "summary_en", "summary_am", "employer")).lower()
    hay += " " + " ".join(job.get("keywords_en", []) + job.get("keywords_am", [])).lower()
    place = f"{job.get('location_en', '')} {job.get('location_am', '')}".lower()
    kw_ok = not alert.keyword or all(w in hay for w in alert.keyword.lower().split())
    loc_ok = not alert.location or alert.location.lower() in place or (job.get("remote") and alert.location.lower() == "remote")
    return kw_ok and loc_ok


async def send_alerts(job: dict) -> int:
    from db import SessionLocal

    sent = 0
    with SessionLocal() as db:
        for alert in db.scalars(select(Alert)).all():
            if not matches(alert, job):
                continue
            lang = alert.language
            title = job.get(f"title_{lang}") or job["title_en"]
            place = job.get(f"location_{lang}") or job["location_en"]
            url = f"/pages/jobs.html#job-{job['id']}"
            text = t("alertJob", lang, title=title, place=place, date=job["deadline"], url=url)
            address = decrypt(alert.address_enc) or ""
            if alert.channel == "telegram":
                sent += await notify.telegram(address, text)
            else:  # no SMS gateway at the hackathon: queue it
                db.add(Outbox(to_enc=alert.address_enc, text=fit(text)))
                sent += 1
        db.commit()
    return sent


@router.get("/jobs", summary="Test jobs, each with its JobPosting JSON-LD")
def list_jobs(db: Session = Depends(get_db)) -> list[dict]:
    return [{**j.data, "jsonld": jsonld(j.data)} for j in db.scalars(select(Job)).all()]


@router.get("/jobs/{job_id}", summary="One job with its JobPosting JSON-LD")
def get_job(job_id: str, db: Session = Depends(get_db)) -> dict:
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(404, f"Job {job_id} not found.")
    return {**job.data, "jsonld": jsonld(job.data)}


@router.post("/jobs", status_code=201, response_model=Created, summary="Add or update a job; matching alerts are sent",
             dependencies=[Depends(require_helper)])
def add_job(body: JobIn, tasks: BackgroundTasks, db: Session = Depends(get_db)) -> Created:
    job = body.model_dump()
    new = content.upsert_job(db, job)
    db.commit()
    content.rebuild(db)
    if new:
        tasks.add_task(send_alerts, job)
    return Created(id=job["id"], message="Job added; matching alerts are being sent." if new else "Job updated.")


@router.post("/alerts", status_code=201, response_model=Created, summary="Subscribe to job alerts (Telegram or text)")
def subscribe(body: AlertIn, db: Session = Depends(get_db)) -> Created:
    address = body.address.strip()
    if body.channel == "sms":
        normalized = phone.normalize(address)
        if not normalized:
            raise HTTPException(400, "Phone number not recognised. Use 09…, 07… or +251….")
        address = normalized
    alert = Alert(
        channel=body.channel,
        address_enc=encrypt(address) or "",
        address_hash=address_hash(body.channel, address),
        keyword=body.keyword.strip(),
        location=body.location.strip(),
        language=body.language,
    )
    db.add(alert)
    db.commit()
    return Created(id=alert.id, message="Alert saved. Send STOP (text) or /stop (Telegram) to unsubscribe.")


@router.get("/alerts", summary="Alerts of one Telegram chat or phone (for the bot's /myalerts)")
def list_alerts(channel: str, address: str, db: Session = Depends(get_db)) -> list[dict]:
    if channel == "sms":
        address = phone.normalize(address) or address
    rows = db.scalars(select(Alert).where(Alert.address_hash == address_hash(channel, address))).all()
    return [{"id": a.id, "keyword": a.keyword, "location": a.location, "language": a.language} for a in rows]


@router.delete("/alerts/{alert_id}", status_code=204, response_class=Response, summary="Unsubscribe one alert")
def unsubscribe(alert_id: int, db: Session = Depends(get_db)) -> None:
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(404, f"Alert {alert_id} not found.")
    db.delete(alert)
    db.commit()


@router.delete("/alerts", status_code=200, response_model=Created, summary="Unsubscribe every alert for an address (STOP)")
def unsubscribe_all(channel: str, address: str, db: Session = Depends(get_db)) -> Created:
    if channel == "sms":
        address = phone.normalize(address) or address
    res = db.execute(delete(Alert).where(Alert.address_hash == address_hash(channel, address)))
    db.commit()
    return Created(id=res.rowcount or 0, message=f"{res.rowcount or 0} alerts removed.")


@router.post("/accommodations", status_code=201, response_model=Created, summary="Interview support request: goes to a person")
def request_accommodation(body: AccommodationIn, db: Session = Depends(get_db)) -> Created:
    if not db.get(Job, body.job_id):
        raise HTTPException(404, f"Job {body.job_id} not found.")
    contact = body.contact.strip() if body.contact else None
    if body.contact_channel != "none" and not contact:
        raise HTTPException(400, "Please give a contact for the copy, or choose no copy.")
    if body.contact_channel == "sms" and contact:
        contact = phone.normalize(contact)
        if not contact:
            raise HTTPException(400, "Phone number not recognised. Use 09…, 07… or +251….")
    row = Accommodation(
        job_id=body.job_id,
        needs=list(body.needs),
        note=body.note,
        contact_channel=body.contact_channel,
        contact_enc=encrypt(contact),
        language=body.language,
    )
    db.add(row)
    db.commit()
    return Created(id=row.id, message="Request sent to a career helper. It is not sent to the employer.")


@router.get("/accommodations", summary="Helper only: interview support requests", dependencies=[Depends(require_helper)])
def list_accommodations(db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(Accommodation).order_by(Accommodation.created_at)).all()
    return [
        {
            "id": r.id, "job_id": r.job_id, "needs": r.needs, "note": r.note, "language": r.language,
            "contact_channel": r.contact_channel, "contact": decrypt(r.contact_enc), "status": r.status,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


@router.get("/sms/outbox", summary="Helper only: text messages waiting for a gateway", dependencies=[Depends(require_helper)])
def outbox(db: Session = Depends(get_db)) -> list[dict]:
    return [{"id": o.id, "to": decrypt(o.to_enc), "text": o.text} for o in db.scalars(select(Outbox)).all()]
