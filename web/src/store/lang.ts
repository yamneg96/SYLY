// Page language (English or Amharic), remembered in this browser only. Zustand store.
import { create } from "zustand"
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware"

export type Lang = "en" | "am"

// localStorage can be missing or throw (private windows, blocked site data): never let that break the page.
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value)
    } catch {
      /* keep it in memory */
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name)
    } catch {
      /* nothing to remove */
    }
  },
}

function browserLang(): Lang {
  return typeof navigator !== "undefined" && /^am/i.test(navigator.language || "") ? "am" : "en"
}

interface LangState {
  lang: Lang
  setLang: (lang: Lang) => void
}

export const useLang = create<LangState>()(
  persist(
    (set) => ({
      lang: browserLang(),
      setLang: (lang) => set({ lang }),
    }),
    { name: "syly-site-lang-v2", storage: createJSONStorage(() => safeStorage) }
  )
)
