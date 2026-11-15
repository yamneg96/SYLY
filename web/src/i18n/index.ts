// Text for every page: src/i18n/en.json and am.json (the Amharic is a draft that needs a native reader check).
// A test checks that both files have exactly the same keys.
import { useCallback } from "react"
import am from "./am.json"
import en from "./en.json"
import { useLang, type Lang } from "@/store/lang"

export type Key = keyof typeof en
export type Vars = Record<string, string | number>

const dictionaries: Record<Lang, Record<string, string>> = { en, am }

export function translate(lang: Lang, key: string, vars?: Vars): string {
  const text = dictionaries[lang][key] ?? dictionaries.en[key] ?? key
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (vars && k in vars ? String(vars[k]) : m))
}

export type TFunction = (key: Key | (string & {}), vars?: Vars) => string

export function useT(): TFunction {
  const lang = useLang((s) => s.lang)
  return useCallback((key, vars) => translate(lang, key, vars), [lang])
}

export const dictionaryKeys = { en: Object.keys(en), am: Object.keys(am) }
