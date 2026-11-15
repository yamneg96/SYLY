// Developer sign in. Learners never sign in. The Google button is Google's own iframe: we add a text explanation,
// a link that skips it, and a real button that opens Google's quick prompt (a second route for keyboard and screen readers).
import { useState } from "react"
import { Link, useNavigate } from "react-router"
import { Hero, useDocumentTitle } from "@/components/page-hero"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuthConfig, useGoogleSignIn, useMe } from "@/hooks/use-portal"
import { useGoogleIdentity } from "@/hooks/use-google"
import { useT } from "@/i18n"
import { ApiError } from "@/lib/api"
import { useLang } from "@/store/lang"

export function SignInPage() {
  const t = useT()
  const lang = useLang((s) => s.lang)
  const navigate = useNavigate()
  useDocumentTitle(t("signin.pageTitle"))

  const cfg = useAuthConfig()
  const enabled = cfg.data?.enabled === true
  const me = useMe(enabled)
  const signIn = useGoogleSignIn()
  const [error, setError] = useState("")

  const { button, status, prompt } = useGoogleIdentity(enabled ? cfg.data?.client_id : null, lang, (credential) => {
    setError("")
    signIn.mutate(credential, {
      onSuccess: () => navigate("/dashboard"),
      onError: (e) => setError(t("signin.failed", { why: e instanceof ApiError && e.status ? e.message : t("signin.gisFail") })),
    })
  })

  return (
    <>
      <Hero small title={t("signin.h1")} lead={t("signin.lead")} />
      <div className="mx-auto my-10 max-w-2xl rounded-3xl border bg-card p-6 shadow-xl shadow-[#002B56]/10 sm:p-9">
        {cfg.isPending ? (
          <div role="status">
            <Skeleton className="mb-3 h-6 w-2/3" />
            <p>{t("signin.checking")}</p>
          </div>
        ) : cfg.isError ? (
          <Alert variant="destructive" role="alert"><AlertDescription>{t("signin.gisFail")}</AlertDescription></Alert>
        ) : !enabled ? (
          <Alert><AlertDescription>{t("signin.notConfigured")}</AlertDescription></Alert>
        ) : (
          <>
            {me.data ? (
              <Alert className="mb-4">
                <AlertDescription>
                  {t("signin.already")}{" "}
                  <Link to="/dashboard" className="font-semibold underline underline-offset-4">{t("signin.toDash")}</Link>
                </AlertDescription>
              </Alert>
            ) : null}
            <p className="mb-6">{t("signin.why")}</p>
            <h2 className="mb-2 text-2xl font-bold text-foreground">{t("signin.btnH")}</h2>
            <p className="mb-3 text-muted-foreground">{t("signin.btnHelp")}</p>
            <p className="mb-3"><a href="#after" className="font-semibold underline underline-offset-4">{t("signin.skipBtn")}</a></p>
            <div ref={button} className="mb-4 min-h-11" />
            <p className="mb-1">
              <Button type="button" variant="outline" className="h-auto min-h-11 max-w-full py-2 text-center whitespace-normal" onClick={prompt}>{t("signin.promptBtn")}</Button>
            </p>
            <p className="mb-6 text-muted-foreground">{t("signin.promptHelp")}</p>
            {status === "failed" ? <p className="mb-3 font-semibold text-destructive" role="alert">{t("signin.gisFail")}</p> : null}
            {signIn.isPending ? <p role="status">{t("signin.working")}</p> : null}
            <p id="after" tabIndex={-1}>{t("signin.after")}</p>
          </>
        )}
        {error ? <p className="mt-4 font-semibold text-destructive" role="alert">{error}</p> : null}
        <p className="mt-8"><Link to="/" className="font-semibold underline underline-offset-4">{t("signin.back")}</Link></p>
      </div>
    </>
  )
}

