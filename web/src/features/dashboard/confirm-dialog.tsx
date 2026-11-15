// "Are you sure?" for deletes. The safe answer ("No, keep it") has focus when it opens; Escape cancels;
// focus goes back to the button that opened it.
import { useRef } from "react"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

export interface ConfirmState {
  title: string
  text: string
  yes: string
  no: string
  onConfirm: () => void
}

export function ConfirmDialog({ state, onClose }: { state: ConfirmState | null; onClose: () => void }) {
  const cancel = useRef<HTMLButtonElement>(null)
  return (
    <AlertDialog open={state !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent initialFocus={cancel} className="max-w-md data-[size=default]:max-w-md data-[size=default]:sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-bold">{state?.title}</AlertDialogTitle>
          <AlertDialogDescription className="text-base text-foreground">{state?.text}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel ref={cancel}>{state?.no}</AlertDialogCancel>
          <AlertDialogAction
            variant="outline"
            className="border-destructive text-destructive hover:bg-destructive/10"
            onClick={() => {
              const run = state?.onConfirm
              onClose()
              run?.()
            }}
          >
            {state?.yes}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
