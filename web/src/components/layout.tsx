// The frame of every page: skip link, header (navigation, page language, theme), main, footer, live region.
// After a route change, focus moves to <main> and the new page name is announced (a single-page app does not reload).
import { useEffect, useRef } from "react"
import { Link, NavLink, Outlet, useLocation } from "react-router"
import type { ComponentType } from "react"
import { AccessibilityIcon, ArrowUpIcon, BookOpenIcon, DownloadIcon, CodeIcon, LanguagesIcon, MoonIcon, RocketIcon, SendIcon, ShieldCheckIcon, SunIcon } from "lucide-react"
import { LiveRegion } from "@/components/live-region"
import { ScrollProgress } from "@/components/motion"
import { NativeSelect } from "@/components/native-select"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme-provider"
import { useAuthConfig, useMe } from "@/hooks/use-portal"
import { useT } from "@/i18n"
import { useAnnounce } from "@/store/announce"
import { useLang, type Lang } from "@/store/lang"

const REPO = "https://github.com/yamneg96/SYLY"

function Logo() {
  // The logo is decoration next to the word SYLY, so it has no text alternative.
  return <img src="/demo/assets/syly-logo.svg" alt="" width={36} height={36} className="size-9 rounded-md bg-white p-0.5" />
}

function ThemeToggle() {
  const t = useT()
  const { theme, setTheme } = useTheme()
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  return (
    <Button type="button" variant="outline" size="icon" className="border-white/60 bg-transparent text-white hover:bg-white/15 hover:text-white" aria-label={t(dark ? "common.themeToLight" : "common.themeToDark")} onClick={() => setTheme(dark ? "light" : "dark")}>
      {dark ? <SunIcon aria-hidden="true" /> : <MoonIcon aria-hidden="true" />}
    </Button>
  )
}

function Header() {
  const t = useT()
  const { lang, setLang } = useLang()
  const cfg = useAuthConfig()
  const me = useMe(cfg.data?.enabled === true)
  const signedIn = cfg.data?.enabled === true && !!me.data
  const link = ({ isActive }: { isActive: boolean }) =>
    `inline-flex min-h-11 items-center rounded-lg px-3 text-[0.9375rem] font-semibold text-[#E6EEF8] transition-colors hover:bg-white/15 hover:text-white ${isActive ? "bg-white/15 text-white shadow-[inset_0_-3px_0_#F5A300]" : ""}`
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#061A33]/85 text-white shadow-lg shadow-black/20 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2">
        <Link to="/" className="inline-flex min-h-11 items-center gap-2.5 text-lg font-extrabold text-white no-underline">
          <Logo />
          <span className="tracking-wide">SYLY</span>
        </Link>
        <nav aria-label={t("common.navLabel")} className="flex flex-wrap gap-1 ms-auto">
          <NavLink to="/" end className={link}>{t("common.navHome")}</NavLink>
          <NavLink to="/documentation" className={link}>{t("common.navDocs")}</NavLink>
          <a href="/demo/install.html" className={link({ isActive: false })}>{t("common.navInstall")}</a>
          {signedIn ? (
            <NavLink to="/dashboard" className={link}>{t("common.navDashboard")}</NavLink>
          ) : (
            <NavLink to="/signin" className={link}>{t("common.navSignin")}</NavLink>
          )}
        </nav>
        <div className="flex items-center gap-2">
          <label htmlFor="page-lang" className="inline-flex items-center gap-1.5 text-[0.9375rem] font-semibold text-white">
            <LanguagesIcon aria-hidden="true" className="size-5" />
            <span>{t("common.pageLang")}</span>
          </label>
          <NativeSelect id="page-lang" value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="w-auto bg-white text-[#111111]">
            <option value="en" lang="en">English</option>
            <option value="am" lang="am">አማርኛ</option>
          </NativeSelect>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

function Footer() {
  const t = useT()
  const a = "group inline-flex min-h-11 items-center gap-2 text-[#E6EEF8] underline-offset-4 transition hover:translate-x-0.5 hover:text-white hover:underline"
  const links: { icon: ComponentType<{ "aria-hidden"?: boolean; className?: string }>; label: string; to?: string; href?: string }[] = [
    { icon: BookOpenIcon, label: t("common.footDocs"), to: "/documentation" },
    { icon: DownloadIcon, label: t("common.footInstall"), href: "/demo/install.html" },
    { icon: ShieldCheckIcon, label: t("common.footPrivacy"), to: "/privacy" },
    { icon: AccessibilityIcon, label: t("common.footAccess"), href: `${REPO}/blob/main/CONFORMANCE.md` },
    { icon: CodeIcon, label: t("common.footRepo"), href: REPO },
    { icon: RocketIcon, label: t("common.footStarter"), href: "/starter" },
    { icon: SendIcon, label: t("common.footBot"), href: "https://t.me/syly_assistant_bot" },
  ]
  return (
    <footer className="relative isolate mt-16 overflow-hidden bg-[linear-gradient(180deg,#061A33,#030D1E)] pt-14 pb-8 text-[#DCE6F2]">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#F5A300]/80 to-transparent" />
      <div aria-hidden="true" className="orb pointer-events-none absolute -top-24 -right-20 -z-10 size-72 bg-[#3B8DFF]/20" />
      <div aria-hidden="true" className="orb pointer-events-none absolute -bottom-32 -left-16 -z-10 size-64 bg-[#F5A300]/15 [animation-delay:-5s]" />
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr]">
          <div>
            <Link to="/" className="inline-flex min-h-11 items-center gap-3 text-2xl font-extrabold tracking-wide text-white no-underline">
              <Logo />
              <span>SYLY</span>
            </Link>
            <div aria-hidden="true" className="amber-bar my-4" />
            <p className="max-w-md leading-relaxed">{t("common.footTeam")}</p>
          </div>
          <nav aria-label={t("common.footNavLabel")}>
            <ul className="grid gap-x-6 sm:grid-cols-2">
              {links.map(({ icon: Icon, label, to, href }) => (
                <li key={label}>
                  {to ? (
                    <Link to={to} className={a}><Icon aria-hidden={true} className="size-4 text-[#F5A300]" />{label}</Link>
                  ) : (
                    <a href={href} className={a}><Icon aria-hidden={true} className="size-4 text-[#F5A300]" />{label}</a>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/10 pt-6 text-sm">
          <p className="glass rounded-full px-3.5 py-1.5">{t("common.footLicence")}</p>
          <p className="glass rounded-full px-3.5 py-1.5">{t("common.footDraft")}</p>
          <a
            href="#main"
            onClick={(e) => {
              e.preventDefault()
              window.scrollTo({ top: 0, behavior: "smooth" })
            }}
            className="ms-auto inline-flex min-h-11 items-center gap-2 rounded-full border border-[#F5A300]/60 px-4 font-semibold text-white transition hover:bg-[#F5A300] hover:text-[#111111]"
          >
            <ArrowUpIcon aria-hidden="true" className="size-4" />
            {t("common.toTop")}
          </a>
        </div>
      </div>
    </footer>
  )
}

export function Layout() {
  const t = useT()
  const lang = useLang((s) => s.lang)
  const { pathname } = useLocation()
  const announce = useAnnounce((s) => s.announce)
  const main = useRef<HTMLElement>(null)
  const first = useRef(true)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    window.scrollTo(0, 0)
    main.current?.focus()
    announce(t("common.routeAnnounce", { title: document.title }))
    // only on navigation, not when the language changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return (
    <div className="flex min-h-svh flex-col">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault()
          main.current?.focus()
        }}
        className="absolute start-3 -top-40 z-50 rounded-lg bg-[#F5A300] px-4 py-3 font-bold text-[#111111] focus:top-3"
      >
        {t("common.skip")}
      </a>
      <ScrollProgress />
      <Header />
      <main id="main" ref={main} tabIndex={-1} className="flex-1 outline-none">
        <div key={pathname} className="rise"><Outlet /></div>
      </main>
      <Footer />
      <LiveRegion />
    </div>
  )
}
