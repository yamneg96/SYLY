// A polite live region for status messages ("Copied", "Site saved", the page name after a route change).
import { create } from "zustand"

interface AnnounceState {
  text: string
  /** Announces a message. The same text twice in a row is still read, because the region is cleared first. */
  announce: (text: string) => void
}

let timer: ReturnType<typeof setTimeout> | undefined

export const useAnnounce = create<AnnounceState>((set) => ({
  text: "",
  announce: (text) => {
    clearTimeout(timer)
    set({ text: "" })
    timer = setTimeout(() => set({ text }), 50)
  },
}))
