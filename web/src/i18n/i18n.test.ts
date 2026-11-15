import { describe, expect, it } from "vitest"
import am from "./am.json"
import en from "./en.json"
import { translate } from "./index"

const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe("dictionaries", () => {
  it("English and Amharic have exactly the same keys", () => {
    expect(Object.keys(am).sort()).toEqual(Object.keys(en).sort())
  })
  it("no text is empty, and {placeholders} match between languages", () => {
    for (const [k, v] of Object.entries(en)) {
      expect(String(v).trim(), `en ${k}`).not.toBe("")
      expect(String((am as Record<string, string>)[k]).trim(), `am ${k}`).not.toBe("")
      expect(vars((am as Record<string, string>)[k]), k).toEqual(vars(v))
    }
  })
  it("translate fills placeholders and falls back to English, then to the key", () => {
    expect(translate("en", "dashboard.colourOk", { ratio: "7.0" })).toBe("Contrast with white: 7.0:1. Good.")
    expect(translate("am", "dashboard.colourOk", { ratio: "7.0" })).toContain("7.0")
    expect(translate("en", "no.such.key")).toBe("no.such.key")
  })
})
