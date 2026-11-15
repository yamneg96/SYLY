import { Link } from "react-router"
import { BriefcaseIcon, CodeIcon, EyeIcon, LanguagesIcon, ServerIcon, SparklesIcon, WifiOffIcon } from "lucide-react"
import type { ComponentType, ReactNode } from "react"
import { Reveal } from "@/components/motion"
import { InlineAssistant } from "@/components/assistant-embed"
import { Hero, Section, useDocumentTitle } from "@/components/page-hero"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useT, type Key } from "@/i18n"
import { cn } from "@/lib/utils"

function Feature({ icon: Icon, title, text }: { icon: ComponentType<{ "aria-hidden"?: boolean; className?: string }>; title: string; text: string }) {
  return (
    <Card className="card-lift h-full border border-transparent">
      <CardContent>
        <span className="mb-3 inline-grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-[#002B56] to-[#0B4A8F] text-[#FFD27A] shadow-md dark:from-[#1B2A44] dark:to-[#2C4A7A]">
          <Icon aria-hidden={true} className="size-6" />
        </span>
        <h3 className="mb-1.5 text-xl font-bold text-foreground">{title}</h3>
        <p className="leading-relaxed text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  )
}

const FOR: [Key, Key, ComponentType<{ "aria-hidden"?: boolean; className?: string }>][] = [
  ["home.for1t", "home.for1p", LanguagesIcon],
  ["home.for2t", "home.for2p", EyeIcon],
  ["home.for3t", "home.for3p", WifiOffIcon],
]
const LEVELS: [Key, Key, ComponentType<{ "aria-hidden"?: boolean; className?: string }>][] = [
  ["home.lv1t", "home.lv1p", CodeIcon],
  ["home.lv2t", "home.lv2p", ServerIcon],
  ["home.lv3t", "home.lv3p", BriefcaseIcon],
]

export function HomePage(): ReactNode {
  const t = useT()
  useDocumentTitle(t("home.pageTitle"))
  const cta = buttonVariants({ size: "lg" })
  return (
    <>
      <Hero
        eyebrow={
          <>
            <SparklesIcon aria-hidden="true" className="size-4 text-[#F5A300]" />
            {t("home.eyebrow")}
          </>
        }
        title={t("home.h1")}
        lead={t("home.lead")}
      >
        <div className="mt-7 flex flex-wrap gap-3">
          <Link to="/documentation" className={cn(cta, "shine bg-gradient-to-r from-[#F5A300] to-[#FFC04D] text-[#111111] shadow-lg shadow-[#F5A300]/30 hover:from-[#FFB72A] hover:to-[#FFD27A]")}>{t("home.ctaDocs")}</Link>
          <a href="/demo/install.html" className={cn(cta, "glass text-white hover:bg-white/20")}>{t("home.ctaInstall")}</a>
          <Link to="/signin" className={cn(cta, "glass text-white hover:bg-white/20")}>{t("home.ctaSignin")}</Link>
        </div>
      </Hero>

      <Section id="for-h" title={t("home.forH")} sub={t("home.forSub")}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FOR.map(([a, b, icon], i) => <Reveal key={a} delay={i * 0.1}><Feature icon={icon} title={t(a)} text={t(b)} /></Reveal>)}
        </div>
      </Section>

      <Section id="levels-h" title={t("home.levelsH")} sub={t("home.levelsSub")} alt>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LEVELS.map(([a, b, icon], i) => <Reveal key={a} delay={i * 0.1}><Feature icon={icon} title={t(a)} text={t(b)} /></Reveal>)}
        </div>
      </Section>

      <Section id="how-h" title={t("home.howH")}>
        <ol className="grid max-w-3xl gap-3">
          {(["home.how1", "home.how2", "home.how3", "home.how4"] as Key[]).map((k, i) => (
            <li key={k}>
              <Reveal delay={i * 0.08} y={20} className="card-lift flex items-center gap-4 rounded-2xl border bg-card p-5 shadow-sm">
                <span aria-hidden="true" className="grid size-9 flex-none place-items-center rounded-full bg-gradient-to-br from-[#F5A300] to-[#FFC04D] font-extrabold text-[#111111] shadow-md">{i + 1}</span>
                <span>{t(k)}</span>
              </Reveal>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="demo-h" title={t("home.demoH")} sub={t("home.demoP")} alt>
        <div className="min-h-32 rounded-3xl border bg-background p-5 shadow-2xl shadow-[#002B56]/15 ring-1 ring-[#F5A300]/30" role="group" aria-label={t("home.demoLabel")}>
          <InlineAssistant content="/data/content.json" />
        </div>
      </Section>

      <Section id="dev-h" title={t("home.devH")} sub={t("home.devP")}>
        <div className="flex flex-wrap gap-3">
          <Link to="/documentation" className={buttonVariants({ size: "lg" })}>{t("home.devDocs")}</Link>
          <Link to="/signin" className={buttonVariants({ size: "lg", variant: "outline" })}>{t("home.devSignin")}</Link>
        </div>
      </Section>

      <Section id="team-h" title={t("home.teamH")} sub={t("home.teamP")} alt>
        <span />
      </Section>
    </>
  )
}
