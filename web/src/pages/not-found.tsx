import { Link, useRouteError } from "react-router"
import { Hero, useDocumentTitle } from "@/components/page-hero"
import { buttonVariants } from "@/components/ui/button"
import { useT } from "@/i18n"

export function NotFoundPage() {
  const t = useT()
  useDocumentTitle(t("common.notFoundH"))
  return (
    <>
      <Hero small title={t("common.notFoundH")} lead={t("common.notFoundP")} />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link to="/" className={buttonVariants({ size: "lg" })}>{t("common.navHome")}</Link>
      </div>
    </>
  )
}

/** Shown by the router when a page crashes: words, not a blank screen. */
export function ErrorPage() {
  const t = useT()
  const error = useRouteError()
  if (error) console.error("[syly portal]", error)
  useDocumentTitle(t("common.errorH"))
  return (
    <div className="mx-auto max-w-3xl px-4 py-16" role="alert">
      <h1 className="mb-3 text-3xl font-bold">{t("common.errorH")}</h1>
      <p className="mb-6 text-lg">{t("common.errorP")}</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={buttonVariants({ size: "lg" })} onClick={() => window.location.reload()}>{t("common.reload")}</button>
        <a href="/" className={buttonVariants({ size: "lg", variant: "outline" })}>{t("common.navHome")}</a>
      </div>
    </div>
  )
}
