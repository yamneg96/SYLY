// <db-assistant> is a web component (module/db-assistant.js). Its attributes, so JSX accepts them.
import "react"

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "db-assistant": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        lang?: string
        mode?: "panel" | "inline"
        api?: string
        content?: string
        site?: string
        theme?: "auto" | "light" | "dark"
        position?: "end" | "start"
        primary?: string
        "content-selector"?: string
        "read-page"?: "always" | "off"
      }
    }
  }
}
