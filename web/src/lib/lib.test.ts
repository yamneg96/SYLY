import { describe, expect, it } from "vitest"
import { contrastWithWhite, isHex } from "@/lib/contrast"
import { originLines, parseOrigin } from "@/lib/origins"
import { emptySiteForm, formFromSite, renderIssue, siteFormSchema, siteSchema, toPayload, type Site } from "@/lib/schemas"
import { botLink, buildSnippets } from "@/lib/snippets"
import { translate } from "@/i18n"

const site: Site = siteSchema.parse({
  id: 1, name: "College", public_key: "pk_0123456789abcdef01234567", allowed_origins: ["https://college.example"], bot_username: null,
  created_at: "2026-11-16T08:00:00Z", settings: { lang: "am" },
})
const ORIGIN = "https://syly.example.org"

describe("colour rule (4.5:1 against white, same numbers as the server)", () => {
  it("computes the known values", () => {
    expect(contrastWithWhite("#000000").toFixed(1)).toBe("21.0")
    expect(contrastWithWhite("#FFFFFF").toFixed(1)).toBe("1.0")
    expect(contrastWithWhite("#767676").toFixed(2)).toBe("4.54")
    expect(contrastWithWhite("#F5A300")).toBeLessThan(4.5)
    expect(contrastWithWhite("#1A5FB4")).toBeGreaterThanOrEqual(4.5)
  })
  it("knows what a hex colour is", () => {
    expect(isHex("#1A5FB4")).toBe(true)
    expect(isHex("1A5FB4")).toBe(false)
    expect(isHex("#12345")).toBe(false)
  })
})

describe("origins", () => {
  it.each([
    ["https://college.example", true], ["https://college.example/", true], ["HTTPS://College.Example", true], ["https://a.b.example:8443", true],
    ["http://localhost", true], ["http://localhost:3000", true], ["http://localhost:*", true],
    ["http://college.example", false], ["https://college.example/path", false], ["college.example", false],
    ["https://*.college.example", false], ["https://", false], ["javascript:alert(1)", false], ["https://exa mple.com", false],
  ])("%s -> %s", (text, ok) => expect(parseOrigin(text) !== null).toBe(ok))
  it("splits the textarea into non-empty lines", () => expect(originLines("a\r\n\n b \n")).toEqual(["a", "b"]))
})

describe("install code", () => {
  it("short variant: site key and api only", () => {
    expect(buildSnippets(site, ORIGIN + "/").short).toBe(
      '<script src="https://syly.example.org/module/db-assistant.js" defer></script>\n' +
        '<db-assistant site="pk_0123456789abcdef01234567" api="https://syly.example.org/api"></db-assistant>'
    )
  })
  it("explicit variant writes the chosen attributes and leaves out the defaults", () => {
    const s: Site = { ...site, settings: { ...site.settings, lang: "en", mode: "inline", theme: "dark", primary: "#1A5FB4", content_source: "page", content_selector: "main", read_page: "always" } }
    expect(buildSnippets(s, ORIGIN).full.split("\n")[1]).toBe(
      '<db-assistant site="pk_0123456789abcdef01234567" api="https://syly.example.org/api" lang="en" mode="inline" theme="dark" primary="#1A5FB4" content-selector="main" read-page="always"></db-assistant>'
    )
    expect(buildSnippets(site, ORIGIN).full.split("\n")[1]).not.toMatch(/mode=|position=|theme=|primary=|content=|read-page=/)
  })
  it("CDN is pinned to a version; npm is the package name", () => {
    const s = buildSnippets(site, ORIGIN)
    expect(s.cdn).toMatch(/^<script src="https:\/\/cdn\.jsdelivr\.net\/gh\/yamneg96\/SYLY@v1\.0\.0\/module\/db-assistant\.js" defer><\/script>/)
    expect(s.npm.install).toBe("npm i syly-db-assistant")
  })
  it("escapes values so a site cannot break out of the tag", () => {
    const s: Site = { ...site, settings: { ...site.settings, content_source: "file", content_url: 'https://c.example/a"><script>alert(1)</script>' } }
    const out = buildSnippets(s, ORIGIN).full
    expect(out).not.toContain('"><script>alert')
    expect(out).toContain("&quot;&gt;&lt;script&gt;")
  })
  it("the bot link uses the public username only", () => {
    expect(botLink({ bot_username: "@MyCollegeHelpBot" })).toBe("https://t.me/MyCollegeHelpBot")
    expect(botLink({ bot_username: null })).toBeNull()
  })
})

describe("site form schema", () => {
  const ok = { ...emptySiteForm, name: "My College", origins: "https://college.example" }
  const messages = (values: object) => {
    const r = siteFormSchema.safeParse({ ...ok, ...values })
    return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), renderIssue((k, v) => translate("en", k, v), i.message)]))
  }
  it("accepts a valid form and turns it into the API payload", () => {
    const r = siteFormSchema.parse({ ...ok, origins: "https://college.example\nhttp://localhost:*", primary: "#1A5FB4", bot: "@MyCollegeHelpBot" })
    expect(toPayload(r)).toMatchObject({ name: "My College", allowed_origins: ["https://college.example", "http://localhost:*"], primary: "#1A5FB4", bot_username: "@MyCollegeHelpBot", content_source: "api" })
  })
  it("says what is wrong, in words, per field", () => {
    const m = messages({ name: "", origins: "http://college.example", primary: "#FFFF00", bot: "notabot!" })
    expect(Object.keys(m).sort()).toEqual(["bot", "name", "origins", "primary"])
    expect(m.origins).toMatch(/“http:\/\/college\.example” is not a valid origin.*https/)
    expect(m.primary).toMatch(/too light.*1\.\d:1.*4\.5:1/)
  })
  it("needs at least one origin", () => expect(messages({ origins: "  \n" }).origins).toMatch(/at least one origin/))
  it("a content file needs a full address; a selector must be plain", () => {
    expect(messages({ source: "file", contentUrl: "not a url" }).contentUrl).toMatch(/full address/)
    expect(messages({ source: "file", contentUrl: "https://c.example/l.json" }).contentUrl).toBeUndefined()
    expect(messages({ source: "page", selector: "<script>" }).selector).toMatch(/plain CSS selector/)
  })
  it("a form can be made from a stored site and back", () => {
    const v = formFromSite({ ...site, bot_username: "MyCollegeHelpBot" })
    expect(v.lang).toBe("am")
    expect(v.bot).toBe("@MyCollegeHelpBot")
    expect(siteFormSchema.safeParse(v).success).toBe(true)
  })
})
