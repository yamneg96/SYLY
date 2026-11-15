// Documentation (developer-portal.md section A). Our own assistant is on this page and reads it (page reading).
import { Link } from "react-router"
import type { ReactNode } from "react"
import { PageReadingAssistant } from "@/components/assistant-embed"
import { CodeBlock } from "@/components/code-block"
import { Hero, useDocumentTitle } from "@/components/page-hero"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useT, type Key } from "@/i18n"

const REPO = "https://github.com/yamneg96/SYLY"

const SERVER_CODE = `<script src="https://YOUR-SERVER/module/db-assistant.js" defer></script>
<db-assistant lang="en" api="https://YOUR-SERVER/api" content="https://YOUR-SERVER/data/content.json"></db-assistant>`
const CDN_CODE = `<script src="https://cdn.jsdelivr.net/gh/yamneg96/SYLY@v1.0.0/module/db-assistant.js" defer></script>
<db-assistant lang="en" api="https://YOUR-SERVER/api" content="https://YOUR-SERVER/data/content.json"></db-assistant>`
const NPM_CODE = "npm i syly-db-assistant"
const NPM_IMPORT = `import 'syly-db-assistant/db-assistant.js';
// or, in HTML:
// <script src="/node_modules/syly-db-assistant/db-assistant.js" defer></script>`
const EVENTS_CODE = `document.addEventListener('db-assistant:question',  e => console.log(e.detail)); // {text, language}
document.addEventListener('db-assistant:escalated', e => console.log(e.detail)); // {ticketId}
document.addEventListener('db-assistant:language',  e => console.log(e.detail)); // {language}`

const ATTRS: [string, string, string, Key][] = [
  ["lang", "am, en, ar, CODE", "en", "docs.a_lang"],
  ["api", "https://…/api", "", "docs.a_api"],
  ["content", "https://…/content.json", "", "docs.a_content"],
  ["site", "pk_…", "", "docs.a_site"],
  ["theme", "auto, light, dark", "auto", "docs.a_theme"],
  ["mode", "panel, inline", "panel", "docs.a_mode"],
  ["position", "end, start", "end", "docs.a_position"],
  ["primary", "#RRGGBB", "", "docs.a_primary"],
  ["content-selector", "CSS selector", "main, article, [role=main], body", "docs.a_selector"],
  ["read-page", "always, off", "", "docs.a_readpage"],
]
const ROUTES: [string, Key][] = [
  ["POST /api/v1/ask", "docs.r_ask"],
  ["GET, POST /api/v1/content", "docs.r_content"],
  ["GET /api/v1/config", "docs.r_config"],
  ["/api/v1/escalations", "docs.r_esc"],
  ["POST /api/v1/voice/speak, /transcribe", "docs.r_voice"],
  ["GET /api/v1/jobs, /alerts, POST /accommodations", "docs.r_jobs"],
  ["GET /api/v1/sites/{key}/config", "docs.r_sites"],
]
const CMDS = ["start", "help", "ask", "lesson", "person", "status", "jobs", "alerts", "myalerts", "stop", "accommodate", "lang", "simple", "voice", "consent", "mydata", "delete"] as const
const LANGS: [string, string, Key][] = [
  ["English", "en", "docs.l_en"], ["አማርኛ", "am", "docs.l_am"], ["Afaan Oromoo", "om", "docs.l_om"],
  ["ትግርኛ", "ti", "docs.l_ti"], ["Soomaali", "so", "docs.l_so"], ["العربية", "ar", "docs.l_ar"],
]
const TOC: [string, Key][] = [
  ["install", "docs.tocInstall"], ["attributes", "docs.tocAttrs"], ["events", "docs.tocEvents"], ["api", "docs.tocApi"], ["content", "docs.tocContent"],
  ["bot", "docs.tocBot"], ["byob", "docs.tocByob"], ["accessibility", "docs.tocA11y"], ["privacy", "docs.tocPrivacy"],
]

function H2({ id, children }: { id: string; children: ReactNode }) {
  return <h2 id={id} className="mt-14 mb-3 scroll-mt-24 border-s-4 border-[#F5A300] ps-3 text-3xl font-extrabold tracking-tight text-foreground">{children}</h2>
}
function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-6 mb-2 text-xl font-bold text-foreground">{children}</h3>
}

export function DocsPage() {
  const t = useT()
  useDocumentTitle(t("docs.pageTitle"))
  const a = "font-semibold text-primary underline underline-offset-4"
  return (
    <>
      <Hero small title={t("docs.h1")} lead={t("docs.lead")} />
      <div className="mx-auto max-w-4xl px-4 py-8">
        <nav aria-label={t("docs.tocLabel")}>
          <ul className="mb-4 flex flex-wrap gap-2">
            {TOC.map(([id, k]) => (
              <li key={id}>
                <a href={`#${id}`} className="inline-flex min-h-11 items-center rounded-full border bg-card px-4 font-semibold no-underline transition hover:-translate-y-0.5 hover:border-[#F5A300] hover:bg-secondary hover:shadow-md">{t(k)}</a>
              </li>
            ))}
          </ul>
        </nav>

        <H2 id="install">{t("docs.instH")}</H2>
        <p>{t("docs.instP")}</p>
        <H3>{t("docs.inst1H")}</H3><p>{t("docs.inst1P")}</p><CodeBlock code={SERVER_CODE} label={t("docs.inst1H")} />
        <H3>{t("docs.inst2H")}</H3><p>{t("docs.inst2P")}</p><CodeBlock code={CDN_CODE} label={t("docs.inst2H")} />
        <H3>{t("docs.inst3H")}</H3><p>{t("docs.inst3P")}</p>
        <CodeBlock code={NPM_CODE} label={t("docs.inst3H")} />
        <CodeBlock code={NPM_IMPORT} label={`${t("docs.inst3H")} (import)`} />
        <p className="my-3 rounded-xl border border-[#F0C95C] bg-[#FFF8E6] p-4 text-[#3D2B00] dark:border-[#8A6A12] dark:bg-[#2A2208] dark:text-[#FBE7A6]">{t("docs.inst3Note")}</p>
        <p>{t("docs.instGen")} <a href="/demo/install.html" className={a}>{t("docs.instGenLink")}</a></p>

        <H2 id="attributes">{t("docs.attrsH")}</H2>
        <Table>
          <TableCaption className="mb-2 text-start font-bold text-foreground">{t("docs.attrsCap")}</TableCaption>
          <TableHeader>
            <TableRow><TableHead>{t("docs.thAttr")}</TableHead><TableHead>{t("docs.thValues")}</TableHead><TableHead>{t("docs.thDefault")}</TableHead><TableHead>{t("docs.thWhat")}</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {ATTRS.map(([name, values, def, desc]) => (
              <TableRow key={name}>
                <TableHead scope="row"><code>{name}</code></TableHead><TableCell>{values}</TableCell><TableCell>{def || "–"}</TableCell><TableCell className="whitespace-normal">{t(desc)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <H2 id="events">{t("docs.evH")}</H2>
        <p>{t("docs.evP")}</p>
        <CodeBlock code={EVENTS_CODE} label={t("docs.evH")} />
        <p>{t("docs.evMethods")}</p>

        <H2 id="api">{t("docs.apiH")}</H2>
        <p>{t("docs.apiP")}</p>
        <p className="my-3"><a href="/docs" className={a}>{t("docs.apiDocs")}</a> · <a href={`${REPO}/blob/main/openapi.yaml`} className={a}>{t("docs.apiSpec")}</a></p>
        <Table>
          <TableHeader><TableRow><TableHead>{t("docs.thRoute")}</TableHead><TableHead>{t("docs.thWhat")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {ROUTES.map(([route, k]) => (
              <TableRow key={route}><TableHead scope="row"><code>{route}</code></TableHead><TableCell className="whitespace-normal">{t(k)}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>

        <H2 id="content">{t("docs.contentH")}</H2>
        <p>{t("docs.contentP")}</p>
        <ol className="list-decimal space-y-2 ps-6 pt-2"><li>{t("docs.c1")}</li><li>{t("docs.c2")}</li><li>{t("docs.c3")}</li></ol>

        <H2 id="bot">{t("docs.botH")}</H2>
        <p>{t("docs.botP")}</p>
        <Table>
          <TableHeader><TableRow><TableHead>{t("docs.thCmd")}</TableHead><TableHead>{t("docs.thDesc")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {CMDS.map((c) => (
              <TableRow key={c}><TableHead scope="row"><code>/{c}</code></TableHead><TableCell className="whitespace-normal">{t(`docs.cmd_${c}`)}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
        <H3>{t("docs.botLangH")}</H3>
        <p>{t("docs.botLangP")}</p>
        <Table>
          <TableHeader><TableRow><TableHead>{t("docs.thLang")}</TableHead><TableHead>{t("docs.thStatus")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {LANGS.map(([name, code, k]) => (
              <TableRow key={code}><TableHead scope="row" lang={code}>{name}</TableHead><TableCell className="whitespace-normal">{t(k)}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>

        <H2 id="byob">{t("docs.byobH")}</H2>
        <p>{t("docs.byobP")}</p>
        <ol className="my-3 list-decimal space-y-2 ps-6">
          {(["docs.byob1", "docs.byob2", "docs.byob3", "docs.byob4", "docs.byob5", "docs.byob6"] as Key[]).map((k) => <li key={k}>{t(k)}</li>)}
        </ol>
        <p className="my-3 rounded-xl border border-[#F2B8C0] bg-[#FFF1F3] p-4 font-bold text-[#5C0012] dark:border-[#7A2A38] dark:bg-[#2A0A12] dark:text-[#FFC6CF]">{t("docs.byobWarn")}</p>
        <p>{t("docs.byobUser")}</p>

        <H2 id="accessibility">{t("docs.a11yH")}</H2>
        <p>{t("docs.a11yP")}</p>
        <p className="my-3"><a href={`${REPO}/blob/main/CONFORMANCE.md`} className={a}>{t("docs.a11yLink")}</a></p>
        <p className="text-muted-foreground">{t("docs.a11yGoogle")}</p>

        <H2 id="privacy">{t("docs.privH")}</H2>
        <p>{t("docs.privP")}</p>
        <p className="my-3"><Link to="/privacy" className={a}>{t("docs.privLink")}</Link></p>
      </div>
      <PageReadingAssistant selector="main" />
    </>
  )
}
