"""The email the tutors get when a learner asks for a person and nobody is online.

HTML written the way email clients need it (tables, inline styles, 600 px wide, a button that is a link in a table cell), with a
plain-text twin for clients that do not show HTML. Everything that came from a learner or a developer is escaped, and the page link
is only a link when it is http or https. Light and dark colours (clients that support it switch by themselves).
"""

from __future__ import annotations

import html
from urllib.parse import urlsplit

NAVY, AMBER, INK, MUTED, PAPER, CANVAS, SOFT = "#002B56", "#F5A300", "#111111", "#4A5568", "#FFFFFF", "#F5F7FB", "#F2F6FC"
LANG_NAMES = {
    "am": "Amharic · አማርኛ", "en": "English", "ar": "Arabic · العربية",
    "om": "Afaan Oromoo", "ti": "Tigrinya · ትግርኛ", "so": "Somali · Soomaali",
}
LANG_NAMES_EN = {"am": "Amharic", "en": "English", "ar": "Arabic", "om": "Afaan Oromoo", "ti": "Tigrinya", "so": "Somali"}


def language_name(code: str, native: bool = True) -> str:
    return (LANG_NAMES if native else LANG_NAMES_EN).get(code, code)


def _e(text: object) -> str:
    return html.escape(str(text), quote=True)


def _safe_link(url: str | None) -> str | None:
    if not url:
        return None
    parts = urlsplit(url)
    return url if parts.scheme in ("http", "https") and parts.netloc else None


def subject(ticket_id: int, language: str) -> str:
    return f"SYLY: new request {ticket_id} ({language_name(language, native=False)})"


def text(ticket_id: int, language: str, page_url: str | None, question: str, has_screenshot: bool, site_name: str | None, helper_url: str) -> str:
    q = " ".join((question or "").split())[:400] or "(no question was written)"
    lines = [f"A learner asked for a person and no tutor is online. Request {ticket_id}, language {language}."]
    if site_name:
        lines.append(f"Site: {site_name}")
    lines += ["", f"Question: {q}", f"Page: {page_url or 'unknown'}"]
    if has_screenshot:
        lines.append("A screenshot is attached to the request: open it on the helper page.")
    lines += ["", f"Open the waiting requests: {helper_url}", "The learner sees your reply on the page, or on Telegram if they chose it."]
    return chr(10).join(lines)


def html_body(ticket_id: int, language: str, page_url: str | None, question: str, has_screenshot: bool, site_name: str | None,
              helper_url: str, own_addresses: bool = False) -> str:
    q = " ".join((question or "").split())[:400] or "(no question was written)"
    link = _safe_link(page_url)
    page_html = (f'<a href="{_e(link)}" style="color:{NAVY};word-break:break-all;" class="link">{_e(link)}</a>' if link
                 else f'<span style="color:{MUTED};" class="muted">{_e(page_url or "unknown")}</span>')
    chips = [f'<span style="display:inline-block;margin:0 6px 6px 0;padding:4px 12px;border-radius:999px;background:{SOFT};color:{NAVY};font-size:13px;font-weight:700;" class="chip">{_e(language_name(language))}</span>']
    if site_name:
        chips.append(f'<span style="display:inline-block;margin:0 6px 6px 0;padding:4px 12px;border-radius:999px;background:{SOFT};color:{NAVY};font-size:13px;font-weight:700;" class="chip">{_e(site_name)}</span>')
    if has_screenshot:
        chips.append(f'<span style="display:inline-block;margin:0 6px 6px 0;padding:4px 12px;border-radius:999px;background:{AMBER};color:{INK};font-size:13px;font-weight:700;">Screenshot on the request</span>')
    why = ("You are listed as a tutor address for this site in the SYLY dashboard." if own_addresses
           else "You get this because you are on the SYLY team's tutor list.")
    helper = _e(helper_url)
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>{_e(subject(ticket_id, language))}</title>
<style>
  @media (prefers-color-scheme: dark) {{
    .canvas {{ background:#0B1220 !important; }}
    .card {{ background:#111B2E !important; }}
    .ink {{ color:#F2F2F2 !important; }}
    .muted {{ color:#CBD5E1 !important; }}
    .quote {{ background:#1B2A44 !important; color:#F2F2F2 !important; }}
    .chip {{ background:#1B2A44 !important; color:#9CC9FF !important; }}
    .link {{ color:#9CC9FF !important; }}
    .rule {{ border-color:#2C3E5C !important; }}
  }}
  @media only screen and (max-width: 620px) {{ .wrap {{ width:100% !important; }} .pad {{ padding:20px !important; }} }}
</style>
</head>
<body style="margin:0;padding:0;background:{CANVAS};" class="canvas">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:{CANVAS};">Request {ticket_id}: {_e(q[:90])}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{CANVAS};" class="canvas">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="wrap" style="width:600px;max-width:100%;">
    <tr><td style="background:{NAVY};border-radius:16px 16px 0 0;padding:22px 28px;border-bottom:4px solid {AMBER};" class="pad">
      <div style="font:800 22px/1.2 Arial,Helvetica,sans-serif;color:#FFFFFF;letter-spacing:.5px;">SYLY</div>
      <div style="font:400 14px/1.4 Arial,Helvetica,sans-serif;color:#C9D6E8;margin-top:4px;">A learner asked for a person</div>
    </td></tr>
    <tr><td style="background:{PAPER};padding:28px;border-radius:0 0 16px 16px;font-family:Arial,Helvetica,sans-serif;" class="card pad">
      <div style="font:800 26px/1.2 Arial,Helvetica,sans-serif;color:{INK};" class="ink">Request {ticket_id}</div>
      <div style="margin:14px 0 4px 0;">{''.join(chips)}</div>

      <div style="font:700 12px/1.4 Arial,Helvetica,sans-serif;letter-spacing:1px;text-transform:uppercase;color:{MUTED};margin:20px 0 8px 0;" class="muted">The question</div>
      <div style="background:{SOFT};border-left:4px solid {AMBER};border-radius:8px;padding:14px 16px;font:400 16px/1.6 Arial,Helvetica,sans-serif;color:{INK};" class="quote" dir="auto">{_e(q)}</div>

      <div style="font:700 12px/1.4 Arial,Helvetica,sans-serif;letter-spacing:1px;text-transform:uppercase;color:{MUTED};margin:20px 0 8px 0;" class="muted">Where they asked</div>
      <div style="font:400 15px/1.5 Arial,Helvetica,sans-serif;color:{INK};" class="ink">{page_html}</div>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px 0;"><tr>
        <td align="center" bgcolor="{AMBER}" style="border-radius:10px;background:{AMBER};">
          <a href="{helper}" style="display:inline-block;padding:14px 26px;font:800 16px/1 Arial,Helvetica,sans-serif;color:{INK};text-decoration:none;border-radius:10px;">Open the waiting requests</a>
        </td>
      </tr></table>
      <div style="font:400 13px/1.5 Arial,Helvetica,sans-serif;color:{MUTED};" class="muted">Press <strong>Start helping</strong> on that page, accept the request and write your reply. The learner sees it on the page, or on Telegram if they chose it.</div>

      <hr style="border:0;border-top:1px solid #DDE3EC;margin:26px 0 16px 0;" class="rule">
      <div style="font:400 12px/1.6 Arial,Helvetica,sans-serif;color:{MUTED};" class="muted">{_e(why)} Test data only: no real personal information should be in a request. If you do not know why you got this, reply to the sender and ask to be removed.</div>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>
"""
