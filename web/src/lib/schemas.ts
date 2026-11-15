// Zod schemas: what the API sends (checked on arrival) and what the site form accepts (checked as you type).
// Form error messages are i18n keys with optional parameters, written with msg() and shown with renderIssue().
import { z } from "zod"
import { contrastWithWhite, isHex, MIN_CONTRAST } from "@/lib/contrast"
import { MAX_ORIGINS, originLines, parseOrigin } from "@/lib/origins"

/* ---------------------------------------------------------------- API responses */
export const accountSchema = z.object({ id: z.number(), email: z.string(), name: z.string(), created_at: z.string() })
export type Account = z.infer<typeof accountSchema>

export const siteSettingsSchema = z.object({
  lang: z.string().default("en"),
  mode: z.string().default("panel"),
  position: z.string().default("end"),
  theme: z.string().default("auto"),
  primary: z.string().default(""),
  content_source: z.string().default("api"),
  content_url: z.string().default(""),
  content_selector: z.string().default(""),
  read_page: z.string().default("auto"),
  voice: z.boolean().default(false),
  simple: z.boolean().default(false),
})
export const siteSchema = z.object({
  id: z.number(),
  name: z.string(),
  public_key: z.string(),
  allowed_origins: z.array(z.string()),
  settings: siteSettingsSchema,
  bot_username: z.string().nullable(),
  created_at: z.string(),
})
export type Site = z.infer<typeof siteSchema>

export const authConfigSchema = z.object({ enabled: z.boolean(), client_id: z.string().nullable(), message: z.string().nullable().optional() })
export const meSchema = z.object({ account: accountSchema })
export const sitesSchema = z.object({ sites: z.array(siteSchema) })
export const oneSiteSchema = z.object({ site: siteSchema })
export const exportSchema = z.object({ account: accountSchema, sites: z.array(siteSchema) })

/* ---------------------------------------------------------------- form errors as keys */
export const msg = (key: string, params?: Record<string, string | number>) => JSON.stringify({ key, params })
export function renderIssue(t: (key: string, vars?: Record<string, string | number>) => string, message: string | undefined): string {
  if (!message) return ""
  try {
    const { key, params } = JSON.parse(message) as { key: string; params?: Record<string, string | number> }
    return t(key, params)
  } catch {
    return message // a message from the server, already in words
  }
}

/* ---------------------------------------------------------------- the site form */
export const LANGS = ["am", "en", "ar", "om", "ti", "so"] as const
export const BETA_LANGS = ["om", "ti", "so"] as const

export const siteFormSchema = z
  .object({
    name: z.string().trim().min(1, msg("dashboard.errName")).max(80, msg("dashboard.errNameLong")),
    origins: z.string(),
    lang: z.enum(LANGS),
    mode: z.enum(["panel", "inline"]),
    position: z.enum(["end", "start"]),
    theme: z.enum(["auto", "light", "dark"]),
    primary: z.string().trim(),
    source: z.enum(["api", "file", "page"]),
    contentUrl: z.string().trim(),
    selector: z.string().trim().max(200, msg("dashboard.errSelector")),
    readPage: z.enum(["auto", "always", "off"]),
    voice: z.boolean(),
    simple: z.boolean(),
    bot: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    const add = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message })

    const lines = originLines(v.origins)
    const bad = lines.find((l) => parseOrigin(l) === null)
    if (bad !== undefined) add("origins", msg("dashboard.errOriginBad", { value: bad }))
    else if (lines.length === 0) add("origins", msg("dashboard.errOrigins"))
    else if (new Set(lines.map((l) => parseOrigin(l))).size > MAX_ORIGINS) add("origins", msg("dashboard.errOriginsMany", { max: MAX_ORIGINS }))

    if (v.primary) {
      if (!isHex(v.primary)) add("primary", msg("dashboard.colourInvalid"))
      else {
        const ratio = contrastWithWhite(v.primary)
        if (ratio < MIN_CONTRAST) add("primary", msg("dashboard.colourBad", { ratio: ratio.toFixed(1) }))
      }
    }
    if (v.source === "file") {
      try {
        const u = new URL(v.contentUrl)
        if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("scheme")
      } catch {
        add("contentUrl", msg("dashboard.errFileUrl"))
      }
    }
    if (/[<>{}]/.test(v.selector)) add("selector", msg("dashboard.errSelector"))
    if (v.bot && !/^@?[A-Za-z][A-Za-z0-9_]{3,30}[Bb][Oo][Tt]$/.test(v.bot)) add("bot", msg("dashboard.errBot"))
  })

export type SiteFormValues = z.infer<typeof siteFormSchema>

export const emptySiteForm: SiteFormValues = {
  name: "", origins: "", lang: "am", mode: "panel", position: "end", theme: "auto", primary: "",
  source: "api", contentUrl: "", selector: "", readPage: "auto", voice: false, simple: false, bot: "",
}

export function formFromSite(site: Site): SiteFormValues {
  const s = site.settings
  return {
    name: site.name,
    origins: site.allowed_origins.join("\n"),
    lang: (LANGS as readonly string[]).includes(s.lang) ? (s.lang as SiteFormValues["lang"]) : "am",
    mode: s.mode === "inline" ? "inline" : "panel",
    position: s.position === "start" ? "start" : "end",
    theme: s.theme === "light" || s.theme === "dark" ? s.theme : "auto",
    primary: s.primary,
    source: s.content_source === "file" || s.content_source === "page" ? s.content_source : "api",
    contentUrl: s.content_url,
    selector: s.content_selector,
    readPage: s.read_page === "always" || s.read_page === "off" ? s.read_page : "auto",
    voice: s.voice,
    simple: s.simple,
    bot: site.bot_username ? "@" + site.bot_username : "",
  }
}

/** The body the API expects (snake_case). */
export function toPayload(v: SiteFormValues) {
  return {
    name: v.name,
    allowed_origins: originLines(v.origins),
    lang: v.lang, mode: v.mode, position: v.position, theme: v.theme, primary: v.primary,
    content_source: v.source, content_url: v.contentUrl, content_selector: v.selector, read_page: v.readPage,
    voice: v.voice, simple: v.simple, bot_username: v.bot,
  }
}

/** Server field names to form field names, for the messages the server sends back in words. */
export const SERVER_FIELD: Record<string, keyof SiteFormValues> = {
  name: "name", allowed_origins: "origins", lang: "lang", mode: "mode", position: "position", theme: "theme", primary: "primary",
  content_source: "source", content_url: "contentUrl", content_selector: "selector", read_page: "readPage", bot_username: "bot",
}
