// Our own <db-assistant> on our own pages (dogfooding). The module script is loaded once by index.html.
import { useLang } from "@/store/lang"

/** Inline ask box, answering from a content file in the browser (no server needed). */
export function InlineAssistant({ content }: { content: string }) {
  const lang = useLang((s) => s.lang)
  return <db-assistant mode="inline" lang={lang} content={content} />
}

/** Side-panel assistant that reads the page it is on (page reading, FR-AD4). */
export function PageReadingAssistant({ selector = "main" }: { selector?: string }) {
  const lang = useLang((s) => s.lang)
  return <db-assistant lang={lang} read-page="always" content-selector={selector} />
}
