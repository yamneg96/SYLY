// Developer dashboard (developer-portal.md section E): sites, settings, site keys, install code, account.
import { useEffect, useRef, useState } from "react"
import { Link } from "react-router"
import { PlusIcon } from "lucide-react"
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <p id="hello" className="font-semibold">{t("dashboard.hello", { name: account.name || account.email, email: account.email })}</p>
        <Button type="button" variant="outline" onClick={() => logout.mutate(undefined, { onError: problem })}>{t("dashboard.signout")}</Button>
      </div>
      <p id="error" className="mb-3 font-bold text-destructive" role="alert">{error}</p>

      {view.kind === "list" ? (
        <div>
          <h2 id="sites-h" ref={heading} tabIndex={-1} className="mb-4 text-2xl font-bold text-foreground">{t("dashboard.sitesH")}</h2>
          {sites.isPending ? (
            <div role="status"><Skeleton className="h-24 w-full" /><p className="mt-2">{t("common.loading")}</p></div>
          ) : sites.isError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>
                {t("dashboard.errLoad")} <Button type="button" variant="outline" onClick={() => sites.refetch()}>{t("dashboard.retry")}</Button>
              </AlertDescription>
            </Alert>
          ) : sites.data.length === 0 ? (
            <p className="mb-4">{t("dashboard.noSites")}</p>
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
          <p className="my-5">
            <Button type="button" size="lg" onClick={() => setView({ kind: "form" })}><PlusIcon aria-hidden="true" />{t("dashboard.addSite")}</Button>
          </p>

          <h2 className="mt-10 mb-2 text-2xl font-bold text-foreground">{t("dashboard.accountH")}</h2>
          <p className="mb-3 text-muted-foreground">{t("dashboard.usage")}</p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => downloadMyData().catch(problem)}>{t("dashboard.download")}</Button>
            <Button
              type="button"
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive/10"
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
              {t("dashboard.delAccount")}
            </Button>
          </div>
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
