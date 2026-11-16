// Tutor e-mail addresses a developer enters for a site. The same rules as api/services/sites.py (parse_emails).
export const MAX_TUTOR_EMAILS = 5
const EMAIL = /^[^@\s,;<>"']+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/

/** The addresses (lower case, no duplicates, one per line or separated by commas or semicolons) and the first bad one, if any. */
export function parseEmails(raw: string): { emails: string[]; bad: string | null } {
  const emails: string[] = []
  for (const item of raw.split(/[\n,;]+/)) {
    const e = item.trim().toLowerCase()
    if (!e) continue
    if (e.length > 254 || !EMAIL.test(e)) return { emails, bad: item.trim() }
    if (!emails.includes(e)) emails.push(e)
  }
  return { emails, bad: null }
}
