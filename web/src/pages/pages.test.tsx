import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"
import { describe, expect, it, beforeEach } from "vitest"
import { useLang } from "@/store/lang"
import { ACCOUNT, mockFetch, renderApp, SITE } from "@/test/utils"

beforeEach(() => useLang.setState({ lang: "en" }))

const AUTH_ON = { enabled: true, client_id: "test-client.apps.googleusercontent.com", message: null }
const AUTH_OFF = { enabled: false, client_id: null, message: "Sign-in is not configured on this server." }

describe("public pages", () => {
  it("Home: heading, demo assistant, and no axe violations", async () => {
    const { container } = renderApp("/")
    expect(await screen.findByRole("heading", { level: 1, name: /accessible, multilingual assistant/i })).toBeInTheDocument()
    expect(container.querySelector("db-assistant[mode='inline'][content='/data/content.json']")).not.toBeNull()
    expect(await axe(container)).toHaveNoViolations()
  })

  it("Docs: tables, code blocks reachable by keyboard, our assistant reads the page, no axe violations", async () => {
    const { container } = renderApp("/documentation")
    expect(await screen.findByRole("heading", { level: 1, name: "Documentation" })).toBeInTheDocument()
    expect(container.querySelector("db-assistant[read-page='always']")).not.toBeNull()
    expect(screen.getByRole("columnheader", { name: "Attribute" })).toBeInTheDocument()
    for (const pre of container.querySelectorAll("pre")) expect(pre).toHaveAttribute("tabindex", "0")
    expect(await axe(container)).toHaveNoViolations()
  })

  it("Privacy and the not-found page", async () => {
    const { container, unmount } = renderApp("/privacy")
    expect(await screen.findByRole("heading", { level: 1, name: "Privacy" })).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
    unmount()
    renderApp("/no/such/page")
    expect(await screen.findByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument()
  })

  it("the page language switch changes the text and the html lang", async () => {
    renderApp("/")
    const user = userEvent.setup()
    await screen.findByRole("heading", { level: 1 })
    await user.selectOptions(screen.getByLabelText(/page language/i), "am")
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/[ሀ-፿]/))
    expect(document.documentElement.lang).toBe("am")
  })

  it("the skip link and the main landmark exist", async () => {
    renderApp("/")
    expect(await screen.findByRole("link", { name: /skip to main content/i })).toHaveAttribute("href", "#main")
    expect(screen.getByRole("main")).toHaveAttribute("tabindex", "-1")
  })
})

describe("sign in and dashboard when sign-in is not configured", () => {
  it("the sign-in page says why in words", async () => {
    mockFetch((url) => (url.endsWith("/auth/config") ? { body: AUTH_OFF } : undefined))
    renderApp("/signin")
    expect(await screen.findByText(/Sign-in is not configured on this server/)).toBeInTheDocument()
  })

  it("the dashboard says why in words", async () => {
    mockFetch((url) => (url.endsWith("/auth/config") ? { body: AUTH_OFF } : undefined))
    renderApp("/dashboard")
    expect(await screen.findByText(/Sign-in is not configured on this server/)).toBeInTheDocument()
  })
})

describe("sign in when configured", () => {
  it("shows the explanation, the skip link and the prompt button (no axe violations)", async () => {
    mockFetch((url) => (url.endsWith("/auth/config") ? { body: AUTH_ON } : url.endsWith("/me") ? { status: 401, body: { detail: "Please sign in first." } } : undefined))
    const { container } = renderApp("/signin")
    expect(await screen.findByRole("link", { name: "Skip the Google button" })).toHaveAttribute("href", "#after")
    expect(screen.getByRole("button", { name: /quick sign-in prompt/i })).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe("dashboard", () => {
  function api(state: { sites: unknown[] }) {
    return mockFetch((url, init) => {
      const method = init?.method ?? "GET"
      if (url.endsWith("/auth/config")) return { body: AUTH_ON }
      if (url.endsWith("/api/v1/me")) return { body: { account: ACCOUNT } }
      if (url.endsWith("/api/v1/sites") && method === "GET") return { body: { sites: state.sites } }
      if (url.endsWith("/api/v1/sites") && method === "POST") {
        const body = JSON.parse(String(init?.body))
        state.sites = [{ ...SITE, name: body.name, allowed_origins: body.allowed_origins }]
        return { status: 201, body: { site: state.sites[0] } }
      }
      if (/\/api\/v1\/sites\/7$/.test(url) && method === "DELETE") {
        state.sites = []
        return { status: 204 }
      }
      return undefined
    })
  }

  it("signed out: asks to sign in", async () => {
    mockFetch((url) => (url.endsWith("/auth/config") ? { body: AUTH_ON } : url.endsWith("/api/v1/me") ? { status: 401, body: { detail: "Please sign in first." } } : undefined))
    renderApp("/dashboard")
    expect(await screen.findByText(/Please sign in to see your sites/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Go to sign in" })).toHaveAttribute("href", "/signin")
  })

  it("lists sites in a real table and has no axe violations", async () => {
    api({ sites: [SITE] })
    const { container } = renderApp("/dashboard")
    expect(await screen.findByText(/Signed in as Test Developer/)).toBeInTheDocument()
    const table = await screen.findByRole("table", { name: "Your sites" })
    expect(within(table).getByText("My College")).toBeInTheDocument()
    expect(within(table).getByText("pk_0123456789abcdef01234567")).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it("add a site: errors in words next to the fields, focus on the first, then the code appears", async () => {
    const calls = api({ sites: [] })
    const user = userEvent.setup()
    renderApp("/dashboard")
    await user.click(await screen.findByRole("button", { name: /add a site/i }))
    expect(await screen.findByRole("heading", { name: "Add a site" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Save site" }))
    expect(await screen.findByText(/Enter a name for this site/)).toBeInTheDocument()
    expect(screen.getByText(/Enter at least one origin/)).toBeInTheDocument()
    expect(screen.getByLabelText("Site name")).toHaveFocus()
    expect(screen.getByLabelText("Site name")).toHaveAttribute("aria-invalid", "true")
    expect(calls.some((c) => c.init?.method === "POST")).toBe(false) // nothing is sent while the form is wrong

    await user.type(screen.getByLabelText("Site name"), "My College")
    await user.type(screen.getByLabelText(/Allowed origins/), "http://college.example")
    await user.type(screen.getByLabelText(/Primary colour/), "#FFFF00")
    expect(await screen.findByText(/This colour is too light/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Save site" }))
    expect(await screen.findByText(/is not a valid origin/)).toBeInTheDocument()

    await user.clear(screen.getByLabelText(/Allowed origins/))
    await user.type(screen.getByLabelText(/Allowed origins/), "https://college.example")
    await user.clear(screen.getByLabelText(/Primary colour/))
    await user.type(screen.getByLabelText(/Primary colour/), "#1A5FB4")
    await user.click(screen.getByRole("button", { name: "Save site" }))

    expect(await screen.findByRole("heading", { name: /Code for My College/ })).toBeInTheDocument()
    const post = calls.find((c) => c.init?.method === "POST" && c.url.endsWith("/api/v1/sites"))!
    expect(post.init?.headers).toMatchObject({ "X-Requested-With": "syly" }) // the CSRF header
    expect(JSON.parse(String(post.init?.body))).toMatchObject({ name: "My College", allowed_origins: ["https://college.example"], primary: "#1A5FB4" })
    expect(screen.getAllByText(/site="pk_0123456789abcdef01234567"/)[0]).toBeInTheDocument()
  })

  it("delete asks first; the safe answer has focus; Escape cancels; Yes deletes", async () => {
    const calls = api({ sites: [SITE] })
    const user = userEvent.setup()
    renderApp("/dashboard")
    const del = (await screen.findAllByRole("button", { name: "Delete: My College" }))[0]
    await user.click(del)
    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByRole("button", { name: "No, keep it" })).toHaveFocus()
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
    expect(calls.some((c) => c.init?.method === "DELETE")).toBe(false)

    await user.click(screen.getAllByRole("button", { name: "Delete: My College" })[0])
    await user.click(await screen.findByRole("button", { name: "Yes, delete" }))
    await waitFor(() => expect(calls.some((c) => c.init?.method === "DELETE" && c.url.endsWith("/api/v1/sites/7"))).toBe(true))
    expect(await screen.findByText(/You have no sites yet/)).toBeInTheDocument()
  })
})

