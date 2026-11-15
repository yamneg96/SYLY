// A block of code with a Copy button. The result is written next to the button and announced, never colour alone.
import { useRef, useState } from "react"
import { CopyIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useT } from "@/i18n"
import { useAnnounce } from "@/store/announce"

/** A clipboard promise that never settles (locked-down browser) must still end in a message. */
function writeWithTimeout(text: string): Promise<void> {
  const write = navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject(new Error("no clipboard"))
  const slow = new Promise<never>((_, no) => setTimeout(() => no(new Error("slow")), 2000))
  return Promise.race([write, slow])
}

export function CodeBlock({ code, label }: { code: string; label: string }) {
  const t = useT()
  const announce = useAnnounce((s) => s.announce)
  const [result, setResult] = useState<"" | "copied" | "failed">("")
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  function copy() {
    setResult("")
    writeWithTimeout(code).then(
      () => done("copied"),
      () => done("failed")
    )
  }
  function done(r: "copied" | "failed") {
    setResult(r)
    announce(t(r === "copied" ? "docs.copied" : "docs.copyFailed"))
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setResult(""), 5000)
  }

  return (
    <div className="my-3">
      {/* tabIndex: a scrollable region must be reachable by keyboard */}
      <pre tabIndex={0} className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0B1220] p-5 text-sm leading-relaxed text-[#E2E8F0] shadow-lg ring-1 ring-[#F5A300]/20">
        <code>{code}</code>
      </pre>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={copy} aria-label={`${t("docs.copy")}: ${label}`}>
          <CopyIcon aria-hidden="true" />
          {t("docs.copy")}
        </Button>
        <span className={result === "failed" ? "font-semibold text-destructive" : "font-semibold text-success"}>
          {result === "copied" ? t("docs.copied") : result === "failed" ? t("docs.copyFailed") : ""}
        </span>
      </div>
    </div>
  )
}
