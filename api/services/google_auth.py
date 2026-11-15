"""Check a Google ID token (Sign in with Google). Scopes are openid, email and profile only.

The official google-auth library checks the signature and the expiry; we check the audience, the issuer
and the verified e-mail ourselves as well, so a wrong token fails in words even if the library changes.
"""

from __future__ import annotations

import time

from config import settings

ISSUERS = ("accounts.google.com", "https://accounts.google.com")


class AuthError(Exception):
    """A sign-in problem with a message the developer can read."""

    def __init__(self, message: str, status: int = 401) -> None:
        super().__init__(message)
        self.message, self.status = message, status


def _library_verify(token: str, client_id: str) -> dict:
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token

    return id_token.verify_oauth2_token(token, google_requests.Request(), client_id, clock_skew_in_seconds=10)


def check_claims(claims: dict, client_id: str, now: float | None = None) -> dict:
    aud = claims.get("aud")
    if aud != client_id and not (isinstance(aud, list) and client_id in aud):
        raise AuthError("This sign-in was made for a different application. Please try again from this site.")
    if claims.get("iss") not in ISSUERS:
        raise AuthError("This sign-in does not come from Google.")
    if float(claims.get("exp", 0)) <= (now or time.time()):
        raise AuthError("This sign-in has expired. Please sign in again.")
    if not claims.get("sub"):
        raise AuthError("Google did not send an account id. Please try again.")
    if not claims.get("email") or claims.get("email_verified") is not True:
        raise AuthError("Your Google e-mail address is not verified. Verify it with Google, then sign in again.")
    return claims


def verify(token: str) -> dict:
    """Claims of a valid token for our client id; raises AuthError in words otherwise."""
    if not settings.google_client_id:
        raise AuthError("Sign-in is not configured on this server.", 503)
    try:
        claims = _library_verify(token, settings.google_client_id)
    except ValueError as exc:  # bad signature, wrong audience, expired, malformed
        text = str(exc).lower()
        if "expired" in text or "too early" in text:
            raise AuthError("This sign-in has expired. Please sign in again.") from exc
        if "audience" in text:
            raise AuthError("This sign-in was made for a different application. Please try again from this site.") from exc
        raise AuthError("Google did not accept this sign-in. Please try again.") from exc
    except Exception as exc:  # noqa: BLE001 - certificates could not be fetched, no network
        raise AuthError("Google could not be reached to check the sign-in. Please try again in a moment.", 503) from exc
    return check_claims(claims, settings.google_client_id)
