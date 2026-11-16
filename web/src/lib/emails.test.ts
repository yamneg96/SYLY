import { describe, expect, it } from "vitest"
import { parseEmails } from "@/lib/emails"
import { emptySiteForm, formFromSite, renderIssue, siteFormSchema, siteSchema, toPayload, type Site } from "@/lib/schemas"
import { translate } from "@/i18n"

const site: Site = siteSchema.parse({
  id: 1, name: "College", public_key: "pk_0123456789abcdef01234567", allowed_origins: ["https://college.example"], bot_username: null,
  created_at: "2026-11-16T08:00:00Z", settings: { lang: "am" },
})
const NL = "\n"

describe("tutor e-mail addresses (same rules as the server)", () => {
  it.each([
    ["tutors@college.example", ["tutors@college.example"]],
    [`A@College.example${NL}b@college.example`, ["a@college.example", "b@college.example"]],
    ["a@x.org, b@x.org; c@x.org", ["a@x.org", "b@x.org", "c@x.org"]],
    [`a@x.org${NL}A@X.ORG${NL}${NL}`, ["a@x.org"]],
    ["", []],
  ])("%j -> %j", (raw, expected) => expect(parseEmails(raw)).toEqual({ emails: expected, bad: null }))

  it.each(["not-an-address", "a@b", "a b@x.org", "<a@x.org>", "@x.org", "a@@x.org"])("%j is named as the bad one", (bad) => {
    expect(parseEmails(`ok@x.org${NL}${bad}`).bad).toBe(bad)
  })

  it("the form accepts none, accepts good ones, and says in words what is wrong", () => {
    const base = { ...emptySiteForm, name: "College", origins: "https://college.example" }
    const messages = (tutorEmails: string) => {
      const r = siteFormSchema.safeParse({ ...base, tutorEmails })
      return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), renderIssue((k, v) => translate("en", k, v), i.message)]))
    }
    expect(messages("")).toEqual({})
    expect(messages("tutors@college.example")).toEqual({})
    expect(messages(`tutors@college.example${NL}oops`).tutorEmails).toMatch(/“oops” is not a valid e-mail address/)
    expect(messages(Array.from({ length: 6 }, (_, i) => `t${i}@x.org`).join(NL)).tutorEmails).toMatch(/Too many addresses. Use 5 or fewer/)
  })

  it("they go to the API as a list, and come back into the form one per line", () => {
    const values = siteFormSchema.parse({ ...emptySiteForm, name: "College", origins: "https://college.example", tutorEmails: "A@x.org, b@x.org" })
    expect(toPayload(values).tutor_emails).toEqual(["a@x.org", "b@x.org"])
    const stored: Site = { ...site, settings: { ...site.settings, tutor_emails: ["a@x.org", "b@x.org"] } }
    expect(formFromSite(stored).tutorEmails).toBe(`a@x.org${NL}b@x.org`)
  })
})
