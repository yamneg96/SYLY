import { useAnnounce } from "@/store/announce"

/** One polite live region for the whole app, so status messages are read without moving focus. */
export function LiveRegion() {
  const text = useAnnounce((s) => s.text)
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {text}
    </p>
  )
}
