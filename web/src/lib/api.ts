// The only place that talks to the SYLY API. Every response is checked with a Zod schema.
// State-changing calls send X-Requested-With: syly (the server refuses them without it) and the session cookie.
import type { z } from "zod"

export class ApiError extends Error {
  status: number
  fields?: Record<string, string>
  constructor(status: number, message: string, fields?: Record<string, string>) {
    super(message)
    this.status = status
    this.fields = fields
  }
}

async function request<S extends z.ZodType>(method: string, path: string, schema?: S, body?: unknown): Promise<S extends z.ZodType ? z.infer<S> : null> {
  const init: RequestInit = { method, credentials: "same-origin" }
  if (method !== "GET") init.headers = { "Content-Type": "application/json", "X-Requested-With": "syly" }
  if (body !== undefined) init.body = JSON.stringify(body)
  let res: Response
  try {
    res = await fetch(path, init)
  } catch {
    throw new ApiError(0, "network")
  }
  if (res.status === 204) return null as never
  const data: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    const d = data as { detail?: string; fields?: Record<string, string> }
    throw new ApiError(res.status, typeof d.detail === "string" ? d.detail : String(res.status), d.fields)
  }
  if (!schema) return null as never
  const parsed = schema.safeParse(data)
  if (!parsed.success) throw new ApiError(502, "The server sent something unexpected.")
  return parsed.data as never
}

export const api = {
  get: <S extends z.ZodType>(path: string, schema: S) => request("GET", path, schema),
  post: <S extends z.ZodType>(path: string, schema: S | undefined, body?: unknown) => request("POST", path, schema, body),
  patch: <S extends z.ZodType>(path: string, schema: S, body: unknown) => request("PATCH", path, schema, body),
  del: (path: string) => request("DELETE", path),
}
