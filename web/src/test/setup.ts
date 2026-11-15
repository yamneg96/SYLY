import "@testing-library/jest-dom/vitest"
import { afterEach, expect } from "vitest"
import { cleanup, configure } from "@testing-library/react"
import * as axeMatchers from "vitest-axe/matchers"

expect.extend(axeMatchers)
// The first visit to a lazy page imports its code, which can take over a second on a slow machine.
configure({ asyncUtilTimeout: 8000 })

// jsdom has no matchMedia or scrollTo; the app uses both
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })) as typeof window.matchMedia
}
// framer-motion's scroll reveals need IntersectionObserver; report everything as visible
window.IntersectionObserver = function (cb: IntersectionObserverCallback) {
  return {
    observe(el: Element) {
      cb([{ isIntersecting: true, target: el, intersectionRatio: 1 } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
    },
    unobserve() {},
    disconnect() {},
    takeRecords: () => [],
    root: null,
    rootMargin: "",
    thresholds: [],
  }
} as unknown as typeof IntersectionObserver
window.scrollTo = (() => {}) as typeof window.scrollTo
// axe asks jsdom for a canvas to measure colour; jsdom has none and says so in the log
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext

afterEach(() => {
  cleanup()
  localStorage.clear()
  document.documentElement.lang = "en"
})



