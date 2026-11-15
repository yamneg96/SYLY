// "Sign in with Google" (Google Identity Services). Loaded only when the server says sign-in is configured.
// The ID token goes straight to POST /api/v1/auth/google; nothing is kept here.
import { useEffect, useEffectEvent, useRef, useState } from "react"

interface GoogleId {
  initialize: (config: { client_id: string; callback: (r: { credential: string }) => void; auto_select?: boolean; cancel_on_tap_outside?: boolean }) => void
  renderButton: (el: HTMLElement, options: Record<string, unknown>) => void
  prompt: () => void
}
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } }
  }
}

const SRC = "https://accounts.google.com/gsi/client"
let loading: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script")
    s.src = SRC
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      loading = null
      reject(new Error("Google script blocked or offline"))
    }
    document.head.appendChild(s)
  })
  return loading
}

export function useGoogleIdentity(clientId: string | null | undefined, locale: string, onCredential: (credential: string) => void) {
  const button = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<"idle" | "ready" | "failed">("idle")
  const handle = useEffectEvent(onCredential)

  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    loadScript()
      .then(() => {
        const g = window.google?.accounts?.id
        if (!g) throw new Error("no google id")
        g.initialize({ client_id: clientId, callback: (r) => handle(r.credential), auto_select: false, cancel_on_tap_outside: false })
        if (button.current) {
          button.current.textContent = ""
          g.renderButton(button.current, { theme: "filled_blue", size: "large", text: "signin_with", shape: "rectangular", locale })
        }
        if (!cancelled) setStatus("ready")
      })
      .catch(() => {
        if (!cancelled) setStatus("failed")
      })
    return () => {
      cancelled = true
    }
  }, [clientId, locale])

  return { button, status, prompt: () => window.google?.accounts?.id?.prompt() }
}
