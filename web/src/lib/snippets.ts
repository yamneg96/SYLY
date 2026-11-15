// The install code the dashboard generates for a site (developer-portal.md section E).
import type { Site } from "@/lib/schemas"

export const CDN_SCRIPT = "https://cdn.jsdelivr.net/gh/yamneg96/SYLY@v1.0.0/module/db-assistant.js"

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
const tag = (attrs: [string, string][]) =>
  "<db-assistant" + attrs.map(([k, v]) => ` ${k}="${esc(v)}"`).join("") + "></db-assistant>"
const script = (src: string) => `<script src="${esc(src)}" defer></script>`

/** Attributes written on the tag in the "explicit" variant: only what differs from the widget's defaults. */
function explicitAttrs(site: Site, origin: string): [string, string][] {
  const s = site.settings
  const a: [string, string][] = [
    ["site", site.public_key],
    ["api", origin + "/api"],
    ["lang", s.lang || "en"],
  ]
  if (s.mode === "inline") a.push(["mode", "inline"])
  else if (s.position === "start") a.push(["position", "start"])
  if (s.theme && s.theme !== "auto") a.push(["theme", s.theme])
  if (s.primary) a.push(["primary", s.primary])
  if (s.content_source === "file" && s.content_url) a.push(["content", s.content_url])
  if (s.content_source === "page") {
    if (s.content_selector) a.push(["content-selector", s.content_selector])
    if (s.read_page && s.read_page !== "auto") a.push(["read-page", s.read_page])
  }
  return a
}

export interface Snippets {
  short: string
  full: string
  cdn: string
  npm: { install: string; importLine: string; tag: string }
}

/** origin: the address of the server that runs SYLY, for example https://syly.example.org */
export function buildSnippets(site: Site, origin: string): Snippets {
  const base = origin.replace(/\/+$/, "")
  const shortTag = tag([
    ["site", site.public_key],
    ["api", base + "/api"],
  ])
  const own = base + "/module/db-assistant.js"
  return {
    short: script(own) + "\n" + shortTag,
    full: script(own) + "\n" + tag(explicitAttrs(site, base)),
    cdn: script(CDN_SCRIPT) + "\n" + shortTag,
    npm: { install: "npm i syly-db-assistant", importLine: "import 'syly-db-assistant/db-assistant.js';", tag: shortTag },
  }
}

export function botLink(site: Pick<Site, "bot_username">): string | null {
  const n = (site.bot_username ?? "").replace(/^@/, "").trim()
  return n ? `https://t.me/${n}` : null
}
