// A real <select>: the most dependable control for screen readers and phones. Styled like the other fields.
import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}
