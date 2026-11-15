import type { ReactNode } from "react"
import { useEffect } from "react"
import { Parallax, Reveal } from "@/components/motion"

/** Sets the browser tab title for the page (also read out after a route change). */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title
  }, [title])
}

export function Hero({ id = "h1", eyebrow, title, lead, small, children }: { id?: string; eyebrow?: ReactNode; title: string; lead?: string; small?: boolean; children?: ReactNode }) {
  return (
    <section aria-labelledby={id} className="relative isolate overflow-hidden bg-[linear-gradient(180deg,#04122A_0%,#0A2547_100%)] text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <Parallax distance={50} className="absolute inset-0"><div className="hero-grid absolute inset-0" /></Parallax>
        <Parallax distance={120} className="absolute inset-0">
          <div className="orb absolute -top-24 -right-16 size-[26rem] bg-[#3B8DFF]/35" />
          <div className="orb absolute -bottom-32 -left-20 size-[22rem] bg-[#F5A300]/25 [animation-delay:-6s]" />
        </Parallax>
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#F5A300]/70 to-transparent" />
      </div>
      <div className={`mx-auto max-w-6xl px-4 ${small ? "py-12" : "py-16 sm:py-24"}`}>
        {eyebrow ? (
          <p className="glass rise mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold">{eyebrow}</p>
        ) : null}
        <h1 id={id} className={`rise rise-2 mb-5 max-w-4xl leading-[1.08] font-extrabold tracking-tight ${small ? "text-4xl sm:text-5xl" : "text-5xl sm:text-6xl"}`}>
          <span className="gradient-text">{title}</span>
        </h1>
        {lead ? <p className="rise rise-3 max-w-2xl text-lg leading-relaxed text-[#DCE6F2] sm:text-xl">{lead}</p> : null}
        {children ? <div className="rise rise-3">{children}</div> : null}
      </div>
    </section>
  )
}

export function Section({ id, title, sub, alt, children }: { id: string; title: string; sub?: string; alt?: boolean; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className={`py-16 ${alt ? "border-y border-border bg-card/80 backdrop-blur-sm" : ""}`}>
      <div className="mx-auto max-w-6xl px-4">
        <Reveal className="mb-8 max-w-3xl">
          <div aria-hidden="true" className="amber-bar mb-4" />
          <h2 id={id} className="mb-2 text-3xl leading-tight font-extrabold tracking-tight text-foreground sm:text-4xl">{title}</h2>
          {sub ? <p className="text-lg text-muted-foreground">{sub}</p> : null}
        </Reveal>
        {children}
      </div>
    </section>
  )
}
