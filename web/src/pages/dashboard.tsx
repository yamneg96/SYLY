// Developer dashboard (developer-portal.md section E): sites, settings, site keys, install code, account.
import { useEffect, useRef, useState } from "react"
import { Link } from "react-router"
import { DownloadIcon, GlobeIcon, KeyRoundIcon, LogOutIcon, PlusIcon, ShieldAlertIcon, SparklesIcon, Trash2Icon } from "lucide-react"
import { Reveal } from "@/components/motion"
import { Hero, useDocumentTitle } from "@/components/page-hero"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { CodePanel } from "@/features/dashboard/code-panel"
import { ConfirmDialog, type ConfirmState } from "@/features/dashboard/confirm-dialog"
import { SiteForm } from "@/features/dashboard/site-form"
import { SitesTable } from "@/features/dashboard/sites-table"
import { downloadMyData, useAuthConfig, useDeleteAccount, useDeleteSite, useLogout, useMe, useSites } from "@/hooks/use-portal"
import { useT } from "@/i18n"
import { ApiError } from "@/lib/api"
import type { Account, Site } from "@/lib/schemas"
import { useAnnounce } from "@/store/announce"

type View = { kind: "list" } | { kind: "form"; site?: Site } | { kind: "code"; site: Site }

function Signed({ account }: { account: Account }) {
  const t = useT()
  const announce = useAnnounce((s) => s.announce)
  const sites = useSites(true)
  const logout = useLogout()
  const delSite = useDeleteSite()
  const delAccount = useDeleteAccount()
  const [view, setView] = useState<View>({ kind: "list" })
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [error, setError] = useState("")
  const heading = useRef<HTMLHeadingElement>(null)
  const first = useRef(true)

  // A new view starts at its top, with focus on its heading.
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    window.scrollTo(0, 0)
    heading.current?.focus()
  }, [view])

  const problem = (e: unknown) => setError(e instanceof ApiError && e.status ? t("dashboard.errGeneric", { why: e.message }) : t("dashboard.errLoad"))

  const list = sites.data ?? []
  const origins = list.reduce((n, x) => n + x.allowed_origins.length, 0)
  const latest = list.length ? [...list].sort((a, b) => b.created_at.localeCompare(a.created_at))[0].name : t("dashboard.statNone")
  const who = account.name || account.email
  const stats = [
    { icon: GlobeIcon, label: t("dashboard.statSites"), value: String(list.length) },
    { icon: KeyRoundIcon, label: t("dashboard.statOrigins"), value: String(origins) },
    { icon: SparklesIcon, label: t("dashboard.statLatest"), value: latest },
  ]

  return (
    <div className="dash-bg">
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
          <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-[#3B8DFF]/15 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-10 size-56 rounded-full bg-[#F5A300]/15 blur-3xl" />
          <div className="relative flex flex-wrap items-center gap-4">
            <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#0A2547] to-[#1A5FB4] text-2xl font-extrabold text-white shadow-lg ring-2 ring-[#F5A300]/70">
              {who.trim().charAt(0).toUpperCase()}
            </span>
            <p id="hello" className="min-w-0 flex-1 text-lg font-semibold break-words text-foreground">{t("dashboard.hello", { name: account.name || account.email, email: account.email })}</p>
            <Button type="button" variant="outline" onClick={() => logout.mutate(undefined, { onError: problem })}><LogOutIcon aria-hidden="true" />{t("dashboard.signout")}</Button>
          </div>
          <ul aria-label={t("dashboard.statsLabel")} className="relative mt-6 grid list-none gap-3 sm:grid-cols-3">
            {stats.map((x) => (
              <li key={x.label} className="rounded-2xl border bg-background/70 p-4 backdrop-blur-sm">
                <span className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><x.icon aria-hidden="true" className="size-4 text-[#F5A300]" />{x.label}</span>
                <span className="mt-1 block truncate text-2xl font-extrabold tracking-tight text-foreground">{x.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
      <p id="error" className="mt-3 font-bold text-destructive empty:hidden" role="alert">{error}</p>

      {view.kind === "list" ? (
        <div className="mt-8">
          <Reveal delay={0.08}>
          <section className="rounded-3xl border bg-card p-5 shadow-sm sm:p-7" aria-labelledby="sites-h">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div aria-hidden="true" className="amber-bar mb-3" />
              <h2 id="sites-h" ref={heading} tabIndex={-1} className="text-2xl font-extrabold tracking-tight text-foreground">{t("dashboard.sitesH")}</h2>
            </div>
            <Button type="button" size="lg" className="shine" onClick={() => setView({ kind: "form" })}><PlusIcon aria-hidden="true" />{t("dashboard.addSite")}</Button>
          </div>
          {sites.isPending ? (
            <div role="status"><Skeleton className="h-24 w-full rounded-2xl" /><p className="mt-2">{t("common.loading")}</p></div>
          ) : sites.isError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>
                {t("dashboard.errLoad")} <Button type="button" variant="outline" onClick={() => sites.refetch()}>{t("dashboard.retry")}</Button>
              </AlertDescription>
            </Alert>
          ) : sites.data.length === 0 ? (
            <div className="grid place-items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-12 text-center">
              <span aria-hidden="true" className="grid size-14 place-items-center rounded-2xl bg-[#F5A300]/15 text-[#B87A00] dark:text-[#FFD27A]"><GlobeIcon className="size-7" /></span>
              <p className="max-w-sm text-lg text-muted-foreground">{t("dashboard.noSites")}</p>
            </div>
          ) : (
            <SitesTable
              sites={sites.data}
              onCode={(site) => setView({ kind: "code", site })}
              onEdit={(site) => setView({ kind: "form", site })}
              onDelete={(site) =>
                setConfirm({
                  title: t("dashboard.delConfirmH"),
                  text: t("dashboard.delConfirmP"),
                  yes: t("dashboard.delYes"),
                  no: t("dashboard.delNo"),
                  onConfirm: () => delSite.mutate(site.id, { onSuccess: () => announce(t("dashboard.deleted")), onError: problem }),
                })
              }
            />
          )}
          </section>
          </Reveal>

          <Reveal delay={0.12}>
          <h2 className="mt-12 mb-1 text-2xl font-extrabold tracking-tight text-foreground">{t("dashboard.accountH")}</h2>
          <p className="mb-4 text-muted-foreground">{t("dashboard.usage")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card-lift flex flex-col items-start gap-3 rounded-2xl border bg-card p-5">
              <span aria-hidden="true" className="grid size-10 place-items-center rounded-xl bg-[#1A5FB4]/10 text-[#1A5FB4] dark:text-[#8FC0FF]"><DownloadIcon className="size-5" /></span>
              <h3 className="text-lg font-bold text-foreground">{t("dashboard.yourData")}</h3>
              <Button type="button" variant="outline" className="mt-auto" onClick={() => downloadMyData().catch(problem)}><DownloadIcon aria-hidden="true" />{t("dashboard.download")}</Button>
            </div>
            <div className="flex flex-col items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
              <span aria-hidden="true" className="grid size-10 place-items-center rounded-xl bg-destructive/10 text-destructive"><ShieldAlertIcon className="size-5" /></span>
              <h3 className="text-lg font-bold text-foreground">{t("dashboard.dangerH")}</h3>
              <Button
                type="button"
                variant="outline"
                className="mt-auto border-destructive text-destructive hover:bg-destructive/10"
                onClick={() =>
                  setConfirm({
                    title: t("dashboard.delAccH"),
                    text: t("dashboard.delAccP"),
                    yes: t("dashboard.delAccYes"),
                    no: t("dashboard.delNo"),
                    onConfirm: () => delAccount.mutate(undefined, { onSuccess: () => announce(t("dashboard.delAccDone")), onError: problem }),
                  })
                }
              >
                <Trash2Icon aria-hidden="true" />{t("dashboard.delAccount")}
              </Button>
            </div>
          </div>
          </Reveal>
        </div>
      ) : null}

      {view.kind === "form" ? (
        <SiteForm
          key={view.site?.id ?? "new"}
          site={view.site}
          headingRef={heading}
          onCancel={() => setView({ kind: "list" })}
          onSaved={(site) => {
            if (view.site) {
              announce(t("dashboard.saved"))
              setView({ kind: "list" })
            } else {
              announce(t("dashboard.created_ok"))
              setView({ kind: "code", site })
            }
          }}
        />
      ) : null}

      {view.kind === "code" ? <CodePanel site={view.site} headingRef={heading} onBack={() => setView({ kind: "list" })} /> : null}

      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </div>
    </div>
  )
}

export function DashboardPage() {
  const t = useT()
  useDocumentTitle(t("dashboard.pageTitle"))
  const cfg = useAuthConfig()
  const enabled = cfg.data?.enabled === true
  const me = useMe(enabled)

  let body
  if (cfg.isPending || (enabled && me.isPending)) {
    body = (
      <div className="mx-auto max-w-5xl px-4 py-8" role="status">
        <Skeleton className="mb-3 h-8 w-1/2" />
        <p id="status">{t("dashboard.loading")}</p>
      </div>
    )
  } else if (cfg.isError || me.isError) {
    body = (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Alert variant="destructive" role="alert"><AlertDescription>{t("dashboard.errLoad")}</AlertDescription></Alert>
      </div>
    )
  } else if (!enabled) {
    body = (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Alert id="not-configured"><AlertDescription>{t("dashboard.notConfigured")}</AlertDescription></Alert>
      </div>
    )
  } else if (!me.data) {
    body = (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p id="signed-out">{t("dashboard.signedOut")} <Link to="/signin" className="font-semibold underline underline-offset-4">{t("dashboard.signinLink")}</Link></p>
      </div>
    )
  } else {
    body = <Signed account={me.data} />
  }

  return (
    <>
      <Hero small title={t("dashboard.h1")} />
      {body}
    </>
  )
}
