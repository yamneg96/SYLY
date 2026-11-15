// Allowed origins: https only, or http://localhost (any port: http://localhost:*) for testing.
// Same rules as api/services/sites.py, so the form can say what is wrong before the server does.
const HTTPS = /^https:\/\/[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(:\d{1,5})?$/
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:(\d{1,5}|\*))?$/

export const MAX_ORIGINS = 20

/** Normalised origin (lower case, no trailing slash) or null when it is not a valid origin. */
export function parseOrigin(text: string): string | null {
  const o = text.trim().replace(/\/+$/, "").toLowerCase()
  return HTTPS.test(o) || LOCAL.test(o) ? o : null
}

/** The lines of the textarea that are not empty. */
export function originLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
}
