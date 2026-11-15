import type { ReactElement } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render } from "@testing-library/react"
import { RouterProvider } from "react-router"
import { ThemeProvider } from "@/components/theme-provider"
import { memoryRouter } from "@/router"

export const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })

/** Renders a component inside the providers the app uses (no router). */
export function renderWithProviders(ui: ReactElement) {
  return render(
    <ThemeProvider>
      <QueryClientProvider client={newClient()}>{ui}</QueryClientProvider>
    </ThemeProvider>
  )
}

/** Renders the whole app at a path, inside the real routes. */
export function renderApp(path: string) {
  return render(
    <ThemeProvider>
      <QueryClientProvider client={newClient()}>
        <RouterProvider router={memoryRouter(path)} />
      </QueryClientProvider>
    </ThemeProvider>
  )
}

type Handler = (url: string, init?: RequestInit) => { status?: number; body?: unknown } | undefined

/** A fake fetch: handler gets (url, init) and answers { status, body }. Records every call. */
export function mockFetch(handler: Handler) {
  const calls: { url: string; init?: RequestInit }[] = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init })
    const r = handler(url, init) ?? { status: 404, body: { detail: "not found" } }
    const status = r.status ?? 200
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => r.body ?? {},
    } as Response
  }) as typeof fetch
  return calls
}

export const ACCOUNT = { id: 1, email: "dev@example.org", name: "Test Developer", created_at: "2026-11-16T08:00:00Z" }
export const SITE = {
  id: 7, name: "My College", public_key: "pk_0123456789abcdef01234567", allowed_origins: ["https://college.example"], bot_username: null,
  created_at: "2026-11-16T08:00:00Z", settings: { lang: "am", mode: "panel", position: "end", theme: "auto", primary: "", content_source: "api", content_url: "", content_selector: "", read_page: "auto", voice: false, simple: false },
}
