// The developer's sites. A real table (TanStack Table: sortable by name and date) from medium screens up,
// and a list of cards on phones, so nothing needs sideways scrolling at 320 px.
import { useMemo, useState } from "react"
import { createColumnHelper, flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type SortingState } from "@tanstack/react-table"
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { NativeSelect } from "@/components/native-select"
import { useT } from "@/i18n"
import type { Site } from "@/lib/schemas"
import { useLang } from "@/store/lang"

interface Actions {
  onCode: (site: Site) => void
  onEdit: (site: Site) => void
  onDelete: (site: Site) => void
}

const col = createColumnHelper<Site>()

export function SitesTable({ sites, onCode, onEdit, onDelete }: { sites: Site[] } & Actions) {
  const t = useT()
  const lang = useLang((s) => s.lang)
  const [sorting, setSorting] = useState<SortingState>([{ id: "created", desc: true }])
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(lang === "am" ? "am-ET" : "en-GB")

  const columns = useMemo(
    () => [
      col.accessor("name", { id: "name", header: () => t("dashboard.colName"), cell: (c) => <span className="flex items-center gap-2 font-bold text-foreground"><span aria-hidden="true" className="size-2 rounded-full bg-[#F5A300]" />{c.getValue()}</span> }),
      col.accessor("public_key", { id: "key", header: () => t("dashboard.colKey"), enableSorting: false, cell: (c) => <code className="break-all rounded-md bg-muted px-1.5 py-0.5 text-[0.85em]">{c.getValue()}</code> }),
      col.accessor((s) => s.allowed_origins.join("\n"), {
        id: "origins",
        header: () => t("dashboard.colOrigins"),
        enableSorting: false,
        cell: (c) => (
          <ul className="list-none space-y-1">
            {c.row.original.allowed_origins.map((o) => <li key={o} className="w-fit rounded-full border bg-muted/50 px-2.5 py-0.5 text-sm break-all">{o}</li>)}
          </ul>
        ),
      }),
      col.accessor("created_at", { id: "created", header: () => t("dashboard.colCreated"), sortingFn: "datetime", cell: (c) => fmt(c.getValue()) }),
    ],
    // fmt depends on the language, which t already tracks
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t]
  )

  // TanStack Table's hook returns functions the React Compiler cannot memoize; it skips this component, which is fine here.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: sites, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() })
  const rows = table.getRowModel().rows

  const actions = (site: Site) => (
    <div className="flex flex-wrap gap-2">
      <Button type="button" onClick={() => onCode(site)} aria-label={`${t("dashboard.getCode")}: ${site.name}`}>{t("dashboard.getCode")}</Button>
      <Button type="button" variant="outline" onClick={() => onEdit(site)} aria-label={`${t("dashboard.edit")}: ${site.name}`}>{t("dashboard.edit")}</Button>
      <Button type="button" variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={() => onDelete(site)} aria-label={`${t("dashboard.delete")}: ${site.name}`}>{t("dashboard.delete")}</Button>
    </div>
  )

  const sortLabel = (id: string, sorted: false | "asc" | "desc") =>
    `${t("dashboard.sortBy", { col: t(id === "name" ? "dashboard.colName" : "dashboard.colCreated") })}${sorted ? ", " + t(sorted === "asc" ? "dashboard.sortedAsc" : "dashboard.sortedDesc") : ""}`

  return (
    <>
      {/* medium screens and up: a table */}
      <div className="hidden overflow-hidden rounded-2xl border md:block">
        <Table>
          <TableCaption className="mb-2 text-start font-bold text-foreground">{t("dashboard.tableCaption")}</TableCaption>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => {
                  const sorted = h.column.getIsSorted()
                  return (
                    <TableHead key={h.id} aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}>
                      {h.column.getCanSort() ? (
                        <button type="button" onClick={h.column.getToggleSortingHandler()} aria-label={sortLabel(h.column.id, sorted)} className="inline-flex min-h-11 items-center gap-1.5 font-bold">
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === "asc" ? <ArrowUpIcon aria-hidden="true" className="size-4" /> : sorted === "desc" ? <ArrowDownIcon aria-hidden="true" className="size-4" /> : <ArrowUpDownIcon aria-hidden="true" className="size-4" />}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </TableHead>
                  )
                })}
                <TableHead>{t("dashboard.colActions")}</TableHead>
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className="transition-colors hover:bg-[#F5A300]/5">
                {r.getVisibleCells().map((c, i) =>
                  i === 0 ? (
                    <TableHead key={c.id} scope="row" className="whitespace-normal">{flexRender(c.column.columnDef.cell, c.getContext())}</TableHead>
                  ) : (
                    <TableCell key={c.id} className="align-top whitespace-normal">{flexRender(c.column.columnDef.cell, c.getContext())}</TableCell>
                  )
                )}
                <TableCell className="align-top whitespace-normal">{actions(r.original)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* phones: cards, with a sort choice */}
      <div className="md:hidden">
        <div className="mb-3">
          <label htmlFor="sites-sort" className="mb-1 block font-bold text-foreground">{t("dashboard.sortBy", { col: "" }).trim()}</label>
          <NativeSelect
            id="sites-sort"
            value={sorting[0] ? `${sorting[0].id}:${sorting[0].desc ? "desc" : "asc"}` : "created:desc"}
            onChange={(e) => {
              const [id, dir] = e.target.value.split(":")
              setSorting([{ id, desc: dir === "desc" }])
            }}
          >
            <option value="created:desc">{t("dashboard.colCreated")} ↓</option>
            <option value="created:asc">{t("dashboard.colCreated")} ↑</option>
            <option value="name:asc">{t("dashboard.colName")} ↑</option>
            <option value="name:desc">{t("dashboard.colName")} ↓</option>
          </NativeSelect>
        </div>
        <ul className="grid gap-3">
          {rows.map((r) => {
            const s = r.original
            return (
              <li key={r.id} className="card-lift grid gap-2 rounded-2xl border bg-card p-4">
                <h3 className="text-lg font-bold text-foreground">{s.name}</h3>
                <p className="text-sm text-muted-foreground">{t("dashboard.created", { date: fmt(s.created_at) })}</p>
                <p className="text-sm">{t("dashboard.siteKey")}: <code className="break-all">{s.public_key}</code></p>
                <p className="text-sm">{t("dashboard.origins")}:</p>
                <ul className="ms-5 list-disc text-sm">{s.allowed_origins.map((o) => <li key={o} className="break-all">{o}</li>)}</ul>
                {actions(s)}
              </li>
            )
          })}
        </ul>
      </div>
    </>
  )
}

