// Add or edit a site. React Hook Form + Zod: one labelled field per row, errors in words next to the field,
// the first field with an error gets focus, no time-outs. The server's own checks are shown the same way.
import { useId } from "react"
import { SaveIcon } from "lucide-react"
import { Reveal } from "@/components/motion"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, type Control } from "react-hook-form"
import { NativeSelect } from "@/components/native-select"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { useSaveSite } from "@/hooks/use-portal"
import { useT, type TFunction } from "@/i18n"
import { ApiError } from "@/lib/api"
import { contrastWithWhite, isHex, MIN_CONTRAST } from "@/lib/contrast"
import { BETA_LANGS, emptySiteForm, formFromSite, renderIssue, SERVER_FIELD, siteFormSchema, type Site, type SiteFormValues } from "@/lib/schemas"

const LANG_NAMES: Record<string, string> = { am: "አማርኛ", en: "English", ar: "العربية", om: "Afaan Oromoo", ti: "ትግርኛ", so: "Soomaali" }

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <Label htmlFor={id} className="mb-1.5 block text-base font-bold text-foreground">{label}</Label>
      {children}
      {hint ? <p id={`${id}-hint`} className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
      <p id={`${id}-error`} className={`mt-1 font-bold ${error ? "text-destructive" : ""}`}>{error ?? ""}</p>
    </div>
  )
}
const describedBy = (id: string, hint?: boolean) => (hint ? `${id}-hint ${id}-error` : `${id}-error`)

function Choice({ legend, name, control, options }: { legend: string; name: "mode" | "position" | "theme" | "source"; control: Control<SiteFormValues>; options: [string, string][] }) {
  const uid = useId()
  return (
    <fieldset className="mb-5 rounded-2xl border bg-muted/30 px-4 py-3">
      <legend id={`${uid}-legend`} className="mb-1.5 text-base font-bold text-foreground">{legend}</legend>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <RadioGroup value={field.value} onValueChange={field.onChange} aria-labelledby={`${uid}-legend`} className="flex flex-wrap gap-x-6 gap-y-1">
            {options.map(([value, text]) => (
              <div key={value} className="flex min-h-11 items-center gap-2.5">
                <RadioGroupItem id={`${uid}-${value}`} value={value} />
                <Label htmlFor={`${uid}-${value}`} className="text-base font-semibold">{text}</Label>
              </div>
            ))}
          </RadioGroup>
        )}
      />
    </fieldset>
  )
}

function CheckField({ name, label, hint, control }: { name: "voice" | "simple"; label: string; hint?: string; control: Control<SiteFormValues> }) {
  const uid = useId()
  return (
    <div className="mb-5">
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <div className="flex min-h-11 items-center gap-2.5">
            <Checkbox id={uid} checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} aria-describedby={hint ? `${uid}-hint` : undefined} />
            <Label htmlFor={uid} className="text-base font-semibold">{label}</Label>
          </div>
        )}
      />
      {hint ? <p id={`${uid}-hint`} className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function colourFeedback(t: TFunction, value: string): { text: string; good: boolean } | null {
  const v = value.trim()
  if (!v) return null
  if (!isHex(v)) return { text: t("dashboard.colourInvalid"), good: false }
  const ratio = contrastWithWhite(v)
  const good = ratio >= MIN_CONTRAST
  return { text: `${good ? "✓" : "✕"} ${t(good ? "dashboard.colourOk" : "dashboard.colourBad", { ratio: ratio.toFixed(1) })}`, good }
}

export function SiteForm({ site, headingRef, onSaved, onCancel }: { site?: Site; headingRef: React.Ref<HTMLHeadingElement>; onSaved: (site: Site) => void; onCancel: () => void }) {
  const t = useT()
  const save = useSaveSite()
  const form = useForm<SiteFormValues>({
    resolver: zodResolver(siteFormSchema),
    defaultValues: site ? formFromSite(site) : emptySiteForm,
    shouldFocusError: true,
  })
  const { register, control, handleSubmit, watch, setError, formState } = form
  const err = (name: keyof SiteFormValues) => {
    const m = formState.errors[name]?.message
    return m ? renderIssue(t, String(m)) : undefined
  }
  // watch() is what lets the form react to the chosen content source and colour as you type; the React Compiler skips this component.
  // eslint-disable-next-line react-hooks/incompatible-library
  const source = watch("source")
  const colour = colourFeedback(t, watch("primary") ?? "")

  const submit = handleSubmit(
    (values) =>
      save.mutate(
        { id: site?.id, values },
        {
          onSuccess: (data) => onSaved(data.site),
          onError: (e) => {
            if (e instanceof ApiError && e.status === 400 && e.fields) {
              for (const [k, message] of Object.entries(e.fields)) {
                const field = SERVER_FIELD[k]
                if (field) setError(field, { type: "server", message }, { shouldFocus: true })
              }
            } else setError("root", { type: "server", message: e instanceof ApiError && e.status ? t("dashboard.errGeneric", { why: e.message }) : t("dashboard.errLoad") })
          },
        }
      ),
    () => undefined
  )

  const invalid = Object.keys(formState.errors).length > 0
  const rootMessage = formState.errors.root?.message

  return (
    <Reveal>
    <form onSubmit={submit} noValidate aria-labelledby="form-h" className="mt-8 rounded-3xl border bg-card p-5 shadow-sm sm:p-8">
      <div aria-hidden="true" className="amber-bar mb-3" />
      <h2 id="form-h" ref={headingRef} tabIndex={-1} className="mb-4 text-2xl font-extrabold tracking-tight text-foreground">{t(site ? "dashboard.editH" : "dashboard.newH")}</h2>
      <p className="mb-3 font-bold text-destructive empty:hidden" role="alert">{rootMessage ?? (invalid ? t("dashboard.fixFields") : "")}</p>

      <Field id="f-name" label={t("dashboard.fName")} hint={t("dashboard.fNameHint")} error={err("name")}>
        <Input id="f-name" maxLength={80} autoComplete="off" aria-invalid={!!err("name")} aria-describedby={describedBy("f-name", true)} {...register("name")} />
      </Field>
      <Field id="f-origins" label={t("dashboard.fOrigins")} hint={t("dashboard.fOriginsHint")} error={err("origins")}>
        <Textarea id="f-origins" spellCheck={false} autoComplete="off" aria-invalid={!!err("origins")} aria-describedby={describedBy("f-origins", true)} {...register("origins")} />
      </Field>

      <div className="grid gap-x-5 sm:grid-cols-2">
        <Field id="f-lang" label={t("dashboard.fLang")} error={err("lang")}>
          <NativeSelect id="f-lang" aria-describedby={describedBy("f-lang")} {...register("lang")}>
            {(["am", "en", "ar", "om", "ti", "so"] as const).map((l) => (
              <option key={l} value={l}>{LANG_NAMES[l]}{(BETA_LANGS as readonly string[]).includes(l) ? ` (${t("dashboard.betaTag")})` : ""}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="f-bot" label={t("dashboard.fBot")} hint={t("dashboard.fBotHint")} error={err("bot")}>
          <Input id="f-bot" autoComplete="off" spellCheck={false} aria-invalid={!!err("bot")} aria-describedby={describedBy("f-bot", true)} {...register("bot")} />
        </Field>
      </div>
      <Field id="f-tutor" label={t("dashboard.fTutor")} hint={t("dashboard.fTutorHint")} error={err("tutorEmails")}>
        <Textarea id="f-tutor" spellCheck={false} autoComplete="off" aria-invalid={!!err("tutorEmails")} aria-describedby={describedBy("f-tutor", true)} {...register("tutorEmails")} />
      </Field>

      <Choice legend={t("dashboard.fMode")} name="mode" control={control} options={[["panel", t("dashboard.modePanel")], ["inline", t("dashboard.modeInline")]]} />
      <Choice legend={t("dashboard.fPosition")} name="position" control={control} options={[["end", t("dashboard.posEnd")], ["start", t("dashboard.posStart")]]} />
      <Choice legend={t("dashboard.fTheme")} name="theme" control={control} options={[["auto", t("dashboard.themeAuto")], ["light", t("dashboard.themeLight")], ["dark", t("dashboard.themeDark")]]} />

      <div className="mb-5">
        <Label htmlFor="f-primary" className="mb-1.5 block text-base font-bold text-foreground">{t("dashboard.fPrimary")}</Label>
        <Input id="f-primary" maxLength={7} autoComplete="off" spellCheck={false} aria-invalid={!!err("primary") || (colour ? !colour.good : false)} aria-describedby="f-primary-hint f-primary-error" {...register("primary")} />
        <p id="f-primary-hint" className="mt-1 text-sm text-muted-foreground">{t("dashboard.fPrimaryHint")}</p>
        <p id="f-primary-error" className={`mt-1 font-bold ${colour?.good ? "text-success" : "text-destructive"}`}>{err("primary") ?? colour?.text ?? ""}</p>
      </div>

      <Choice legend={t("dashboard.fSource")} name="source" control={control} options={[["api", t("dashboard.srcApi")], ["file", t("dashboard.srcFile")], ["page", t("dashboard.srcPage")]]} />
      {source === "file" ? (
        <Field id="f-content-url" label={t("dashboard.fContentUrl")} hint={t("dashboard.fContentUrlHint")} error={err("contentUrl")}>
          <Input id="f-content-url" type="url" autoComplete="off" aria-invalid={!!err("contentUrl")} aria-describedby={describedBy("f-content-url", true)} {...register("contentUrl")} />
        </Field>
      ) : null}
      {source === "page" ? (
        <>
          <Field id="f-selector" label={t("dashboard.fSelector")} hint={t("dashboard.fSelectorHint")} error={err("selector")}>
            <Input id="f-selector" autoComplete="off" spellCheck={false} aria-invalid={!!err("selector")} aria-describedby={describedBy("f-selector", true)} {...register("selector")} />
          </Field>
          <Field id="f-readpage" label={t("dashboard.fReadPage")} error={err("readPage")}>
            <NativeSelect id="f-readpage" aria-describedby={describedBy("f-readpage")} {...register("readPage")}>
              <option value="auto">{t("dashboard.rpAuto")}</option>
              <option value="always">{t("dashboard.rpAlways")}</option>
              <option value="off">{t("dashboard.rpOff")}</option>
            </NativeSelect>
          </Field>
        </>
      ) : null}

      <CheckField name="voice" label={t("dashboard.fVoice")} hint={t("dashboard.fVoiceHint")} control={control} />
      <CheckField name="simple" label={t("dashboard.fSimple")} control={control} />

      <div className="mt-2 flex flex-wrap gap-3 border-t pt-5">
        <Button type="submit" size="lg" className="shine" disabled={save.isPending}><SaveIcon aria-hidden="true" />{t("dashboard.save")}</Button>
        <Button type="button" size="lg" variant="outline" onClick={onCancel}>{t("dashboard.cancel")}</Button>
      </div>
    </form>
    </Reveal>
  )
}

