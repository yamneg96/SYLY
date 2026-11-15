"""
SYLY Assistant - Accommodations Router
File: api/routers/accommodations.py

Handles:
- POST /api/v1/accommodations: Submits an interview accommodation request with
  contact information strictly encrypted via Fernet.
- GET /api/v1/accommodations: Lists submitted accommodations for helper/tutor triage.
"""

from __future__ import annotations
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

try:
    from ..config import get_fernet
    from ..db import get_db
    from ..models import Accommodation
except (ImportError, ValueError):
    try:
        from api.config import get_fernet
        from api.db import get_db
        from api.models import Accommodation
    except ImportError:
        from config import get_fernet
        from db import get_db
        from models import Accommodation

router = APIRouter(prefix="/accommodations", tags=["accommodations"])


class AccommodationCreate(BaseModel):
    job_id: str
    needs: List[str]
    note: Optional[str] = None
    contact: str  # Plain text from user; encrypted before DB storage


class AccommodationOut(BaseModel):
    id: str
    job_id: str
    needs: List[str]
    note: Optional[str] = None
    contact: str  # Decrypted for helper view
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


@router.post("", status_code=status.HTTP_201_CREATED)
def submit_accommodation(
    payload: AccommodationCreate,
    db: Session = Depends(get_db)
):
    """
    Submits an accommodation request for an inclusive job opportunity.
    Encrypts applicant contact information with Fernet before database persistence.
    """
    if not payload.job_id or not payload.contact:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="job_id and contact are required fields."
        )

    fernet = get_fernet()
    encrypted_contact = fernet.encrypt(payload.contact.strip().encode("utf-8")).decode("utf-8")

    rec_id = str(uuid.uuid4())
    record = Accommodation(
        id=rec_id,
        job_id=payload.job_id.strip(),
        needs=payload.needs,
        note=payload.note.strip() if payload.note else None,
        contact_enc=encrypted_contact
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "id": rec_id,
        "job_id": record.job_id,
        "status": "received",
        "message": "Accommodation request securely recorded."
    }


@router.get("", response_model=List[AccommodationOut])
def list_accommodations(
    db: Session = Depends(get_db)
):
    """
    Lists accommodation requests with decrypted contacts for tutor triage.
    """
    fernet = get_fernet()
    records = db.scalars(select(Accommodation).order_by(Accommodation.created_at.desc())).all()

    result = []
    for r in records:
        try:
            decrypted_contact = fernet.decrypt(r.contact_enc.encode("utf-8")).decode("utf-8")
        except Exception:
            decrypted_contact = "[Decryption Failed]"

        result.append(
            AccommodationOut(
                id=r.id,
                job_id=r.job_id,
                needs=r.needs or [],
                note=r.note,
                contact=decrypted_contact,
                created_at=r.created_at
            )
        )
    return result
