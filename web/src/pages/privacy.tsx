import { Reveal } from "@/components/motion"
import { Hero, useDocumentTitle } from "@/components/page-hero"
import { useT, type Key } from "@/i18n"

function Group({ title, keys }: { title: string; keys: Key[] }) {
  const t = useT()
  return (
    <>
      <h2 className="mt-10 mb-4 border-s-4 border-[#F5A300] ps-3 text-2xl font-extrabold text-foreground">{title}</h2>
      <ul className="space-y-2.5">
        {keys.map((k) => (
          <li key={k}><Reveal y={14} className="rounded-xl border bg-card p-4 shadow-sm">{t(k)}</Reveal></li>
        ))}
      </ul>
    </>
  )
}

export function PrivacyPage() {
  const t = useT()
  useDocumentTitle(t("privacy.pageTitle"))
  return (
    <>
      <Hero small title={t("privacy.h1")} lead={t("privacy.lead")} />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Group title={t("privacy.learnH")} keys={["privacy.learn1", "privacy.learn2", "privacy.learn3", "privacy.learn5", "privacy.learn4"]} />
        <Group title={t("privacy.devH")} keys={["privacy.dev1", "privacy.dev2", "privacy.dev3", "privacy.dev4"]} />
        <Group title={t("privacy.delH")} keys={["privacy.del1", "privacy.del2"]} />
        <h2 className="mt-10 mb-4 border-s-4 border-[#F5A300] ps-3 text-2xl font-extrabold text-foreground">{t("privacy.noteH")}</h2>
        <p className="rounded-2xl border border-[#F0C95C] bg-[#FFF8E6] p-4 text-[#3D2B00] dark:border-[#8A6A12] dark:bg-[#2A2208] dark:text-[#FBE7A6]">{t("privacy.noteP")}</p>
      </div>
    </>
  )
}
