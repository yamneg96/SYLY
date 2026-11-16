"""Developer portal API: Google sign-in, sites, account. Developers only, never learners.

Everything is optional: with no GOOGLE_CLIENT_ID the sign-in and dashboard calls answer in words that
sign-in is not configured, and the learner-facing API is not affected.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from config import settings
from db import get_db
from models import Account, Site
from services import google_auth, session, sites

router = APIRouter(prefix="/api/v1", tags=["developer portal"])

NOT_CONFIGURED = "Sign-in is not configured on this server."


# ---------------------------------------------------------------- guards
def csrf(request: Request) -> None:
    """State-changing calls must carry X-Requested-With: syly (a cross-site form cannot add it), plus SameSite=Lax."""
    if request.headers.get(session.CSRF_HEADER) != session.CSRF_VALUE:
        raise HTTPException(403, "This request was not sent from the SYLY dashboard. Reload the page and try again.")


def account_or_401(request: Request, db: Session = Depends(get_db)) -> Account:
    aid = session.read(request.cookies.get(session.COOKIE))
    account = db.get(Account, aid) if aid else None
    if not account:
        raise HTTPException(401, "Please sign in first.")
    return account


def _secure(request: Request) -> bool:
    return request.headers.get("x-forwarded-proto", request.url.scheme) == "https"


def _account_view(a: Account) -> dict:
    return {"id": a.id, "email": a.email, "name": a.name, "created_at": a.created_at.isoformat()}


# ---------------------------------------------------------------- auth
@router.get("/auth/config", summary="Is Google sign-in set up? The client id is public")
def auth_config() -> dict:
    return {"enabled": settings.auth_enabled, "client_id": settings.google_client_id or None,
            "message": None if settings.auth_enabled else NOT_CONFIGURED}


class GoogleIn(BaseModel):
    credential: str = Field(min_length=20, max_length=4096, description="The ID token from Sign in with Google")


@router.post("/auth/google", summary="Sign in: verify the Google ID token and set a session cookie", dependencies=[Depends(csrf)])
def auth_google(body: GoogleIn, request: Request, response: Response, db: Session = Depends(get_db)) -> dict:
    try:
        claims = google_auth.verify(body.credential)
    except google_auth.AuthError as exc:
        raise HTTPException(exc.status, exc.message) from exc
    account = db.query(Account).filter(Account.google_sub == str(claims["sub"])).first()
    if account:
        account.email, account.name = str(claims["email"])[:320], str(claims.get("name") or "")[:200]
    else:
        account = Account(google_sub=str(claims["sub"]), email=str(claims["email"])[:320], name=str(claims.get("name") or "")[:200])
        db.add(account)
    db.commit()
    response.set_cookie(session.COOKIE, session.make(account.id), max_age=session.MAX_AGE, httponly=True,
                        secure=_secure(request), samesite="lax", path="/")
    return {"account": _account_view(account)}


@router.post("/auth/logout", summary="Sign out", dependencies=[Depends(csrf)])
def auth_logout(response: Response) -> dict:
    response.delete_cookie(session.COOKIE, path="/")
    return {"ok": True}


@router.get("/me", summary="The signed-in developer")
def me(account: Account = Depends(account_or_401)) -> dict:
    return {"account": _account_view(account)}


# ---------------------------------------------------------------- sites
class SiteIn(BaseModel):
    """Loose types on purpose: the rules and the messages in words live in services/sites.py."""

    name: Any = ""
    allowed_origins: Any = []
    lang: Any = "en"
    mode: Any = "panel"
    position: Any = "end"
    theme: Any = "auto"
    primary: Any = ""
    content_source: Any = "api"
    content_url: Any = ""
    content_selector: Any = ""
    read_page: Any = "auto"
    voice: Any = False
    simple: Any = False
    bot_username: Any = ""
    tutor_emails: Any = []


def _own_site(db: Session, account: Account, site_id: int) -> Site:
    site = db.query(Site).filter(Site.id == site_id, Site.account_id == account.id).first()
    if not site:  # another account's site looks exactly like a missing one
        raise HTTPException(404, "This site does not exist.")
    return site


@router.get("/sites", summary="Your sites")
def list_sites(account: Account = Depends(account_or_401), db: Session = Depends(get_db)) -> dict:
    rows = db.query(Site).filter(Site.account_id == account.id).order_by(Site.id).all()
    return {"sites": [sites.view(s) for s in rows]}


@router.post("/sites", status_code=201, summary="Add a site", dependencies=[Depends(csrf)])
def create_site(body: SiteIn, account: Account = Depends(account_or_401), db: Session = Depends(get_db)) -> dict:
    if db.query(Site).filter(Site.account_id == account.id).count() >= sites.MAX_SITES:
        raise HTTPException(400, f"You can have up to {sites.MAX_SITES} sites. Delete one first.")
    data = sites.clean(body.model_dump())
    site = Site(account_id=account.id, public_key=sites.new_key(), name=data["name"], allowed_origins=data["allowed_origins"],
                settings=data["settings"], bot_username=data["bot_username"])
    db.add(site)
    db.commit()
    return {"site": sites.view(site)}


@router.get("/sites/{site_id}", summary="One of your sites")
def get_site(site_id: int, account: Account = Depends(account_or_401), db: Session = Depends(get_db)) -> dict:
    return {"site": sites.view(_own_site(db, account, site_id))}


@router.patch("/sites/{site_id}", summary="Change a site", dependencies=[Depends(csrf)])
def edit_site(site_id: int, body: SiteIn, account: Account = Depends(account_or_401), db: Session = Depends(get_db)) -> dict:
    site = _own_site(db, account, site_id)
    data = sites.clean(body.model_dump())
    site.name, site.allowed_origins, site.settings, site.bot_username = data["name"], data["allowed_origins"], data["settings"], data["bot_username"]
    db.commit()
    sites.invalidate(site.public_key)
    return {"site": sites.view(site)}


@router.delete("/sites/{site_id}", status_code=204, summary="Delete a site", dependencies=[Depends(csrf)])
def delete_site(site_id: int, account: Account = Depends(account_or_401), db: Session = Depends(get_db)) -> Response:
    site = _own_site(db, account, site_id)
    key = site.public_key
    db.delete(site)
    db.commit()
    sites.invalidate(key)
    return Response(status_code=204)


@router.get("/sites/{key}/config", summary="Public widget settings for a site key (cacheable, nothing private)")
def site_config(key: str, response: Response, db: Session = Depends(get_db)) -> dict:
    site = db.query(Site).filter(Site.public_key == key).first()
    if not site:
        raise HTTPException(404, "This site key is not known.")
    response.headers["Cache-Control"] = "public, max-age=300"
    return sites.public_config(site)


# ---------------------------------------------------------------- account
@router.get("/account/export", summary="Download my data (JSON)")
def export_account(account: Account = Depends(account_or_401), db: Session = Depends(get_db)) -> dict:
    rows = db.query(Site).filter(Site.account_id == account.id).order_by(Site.id).all()
    return {"account": _account_view(account), "sites": [sites.view(s) for s in rows]}


@router.delete("/account", status_code=204, summary="Delete my account and sites", dependencies=[Depends(csrf)])
def delete_account(account: Account = Depends(account_or_401), db: Session = Depends(get_db)) -> Response:
    for s in db.query(Site).filter(Site.account_id == account.id).all():
        sites.invalidate(s.public_key)
    db.query(Site).filter(Site.account_id == account.id).delete(synchronize_session=False)
    db.delete(account)
    db.commit()
    out = Response(status_code=204)
    out.delete_cookie(session.COOKIE, path="/")
    return out
