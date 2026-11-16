// "Get code" for a site: the tag with its site key (short and explicit variants), the CDN and npm versions,
// the bring-your-own-bot guide and the bot's public link.
import { Link } from "react-router"
import { ArrowLeftIcon, BotIcon } from "lucide-react"
import { Reveal } from "@/components/motion"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CodeBlock } from "@/components/code-block"
import { useT } from "@/i18n"
import { botLink, buildSnippets } from "@/lib/snippets"
import type { Site } from "@/lib/schemas"

export function CodePanel({ site, headingRef, onBack }: { site: Site; headingRef: React.Ref<HTMLHeadingElement>; onBack: () => void }) {
  const t = useT()
  const sn = buildSnippets(site, window.location.origin)
  const link = botLink(site)
  return (
    <Reveal>
    <div className="mt-8 rounded-3xl border bg-card p-5 shadow-sm sm:p-8">
      <div aria-hidden="true" className="amber-bar mb-3" />
      <h2 id="code-h" ref={headingRef} tabIndex={-1} className="mb-2 text-2xl font-extrabold tracking-tight text-foreground">{t("dashboard.codeH", { name: site.name })}</h2>
      <p className="mb-4">{t("dashboard.codeIntro")}</p>

      <Tabs defaultValue="short">
        <TabsList className="mb-3 h-auto flex-wrap gap-1 rounded-2xl p-1.5">
          <TabsTrigger value="short" className="min-h-11 px-4">{t("dashboard.tabShort")}</TabsTrigger>
          <TabsTrigger value="full" className="min-h-11 px-4">{t("dashboard.tabFull")}</TabsTrigger>
          <TabsTrigger value="cdn" className="min-h-11 px-4">{t("dashboard.tabCdn")}</TabsTrigger>
          <TabsTrigger value="npm" className="min-h-11 px-4">{t("dashboard.tabNpm")}</TabsTrigger>
        </TabsList>
        <TabsContent value="short">
          <h3 className="font-bold text-foreground">{t("dashboard.codeShort")}</h3>
          <p className="text-sm text-muted-foreground">{t("dashboard.codeShortHint")}</p>
          <CodeBlock code={sn.short} label={t("dashboard.codeShort")} />
        </TabsContent>
        <TabsContent value="full">
          <h3 className="font-bold text-foreground">{t("dashboard.codeFull")}</h3>
          <p className="text-sm text-muted-foreground">{t("dashboard.codeFullHint")}</p>
          <CodeBlock code={sn.full} label={t("dashboard.codeFull")} />
        </TabsContent>
        <TabsContent value="cdn">
          <h3 className="font-bold text-foreground">{t("dashboard.codeCdn")}</h3>
          <CodeBlock code={sn.cdn} label={t("dashboard.codeCdn")} />
        </TabsContent>
        <TabsContent value="npm">
          <h3 className="font-bold text-foreground">{t("dashboard.codeNpm")}</h3>
          <CodeBlock code={`${sn.npm.install}\n\n${sn.npm.importLine}\n\n${sn.npm.tag}`} label={t("dashboard.codeNpm")} />
          <p className="rounded-xl border border-[#F0C95C] bg-[#FFF8E6] p-3 text-[#3D2B00] dark:border-[#8A6A12] dark:bg-[#2A2208] dark:text-[#FBE7A6]">{t("dashboard.codeNpmNote")}</p>
        </TabsContent>
      </Tabs>

      <h3 className="mt-8 mb-2 flex items-center gap-2 text-xl font-bold text-foreground"><BotIcon aria-hidden="true" className="size-5 text-[#F5A300]" />{t("dashboard.botGuideH")}</h3>
      <p className="mb-3 rounded-xl border border-[#F2B8C0] bg-[#FFF1F3] p-3 font-bold text-[#5C0012] dark:border-[#7A2A38] dark:bg-[#2A0A12] dark:text-[#FFC6CF]">{t("dashboard.botGuideP")}</p>
      <p className="mb-2">
        {link ? (
          <>
            {t("dashboard.botLinkP")} <a href={link} className="font-semibold underline underline-offset-4">{link}</a>
          </>
        ) : (
          t("dashboard.botNone")
        )}
      </p>
      <p className="mb-6"><Link to="/documentation#byob" className="font-semibold underline underline-offset-4">{t("dashboard.docsLink")}</Link></p>
      <Button type="button" variant="outline" size="lg" onClick={onBack}><ArrowLeftIcon aria-hidden="true" />{t("dashboard.back")}</Button>
    </div>
    </Reveal>
  )
}
