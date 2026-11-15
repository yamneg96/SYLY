// Server state with TanStack Query: sign-in status, the account, the sites and the changes to them.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api, ApiError } from "@/lib/api"
import { authConfigSchema, exportSchema, meSchema, oneSiteSchema, sitesSchema, type SiteFormValues, toPayload } from "@/lib/schemas"

export const keys = { auth: ["auth", "config"] as const, me: ["me"] as const, sites: ["sites"] as const }

export function useAuthConfig() {
  return useQuery({ queryKey: keys.auth, queryFn: () => api.get("/api/v1/auth/config", authConfigSchema), staleTime: 5 * 60_000, retry: 1 })
}

/** The signed-in account, or null when nobody is signed in (a 401 is an answer, not an error). */
export function useMe(enabled = true) {
  return useQuery({
    queryKey: keys.me,
    enabled,
    retry: false,
    queryFn: async () => {
      try {
        return (await api.get("/api/v1/me", meSchema)).account
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null
        throw e
      }
    },
  })
}

export function useSites(enabled: boolean) {
  return useQuery({ queryKey: keys.sites, enabled, queryFn: async () => (await api.get("/api/v1/sites", sitesSchema)).sites })
}

export function useGoogleSignIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (credential: string) => api.post("/api/v1/auth/google", meSchema, { credential }),
    onSuccess: (data) => qc.setQueryData(keys.me, data.account),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post("/api/v1/auth/logout", undefined),
    onSuccess: () => {
      qc.setQueryData(keys.me, null)
      qc.removeQueries({ queryKey: keys.sites })
    },
  })
}

export function useSaveSite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id?: number; values: SiteFormValues }) =>
      id === undefined ? api.post("/api/v1/sites", oneSiteSchema, toPayload(values)) : api.patch(`/api/v1/sites/${id}`, oneSiteSchema, toPayload(values)),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.sites }),
  })
}

export function useDeleteSite() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: number) => api.del(`/api/v1/sites/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: keys.sites }) })
}

export function useDeleteAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.del("/api/v1/account"),
    onSuccess: () => {
      qc.setQueryData(keys.me, null)
      qc.removeQueries({ queryKey: keys.sites })
    },
  })
}

export async function downloadMyData(): Promise<void> {
  const data = await api.get("/api/v1/account/export", exportSchema)
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }))
  const a = document.createElement("a")
  a.href = url
  a.download = "syly-my-data.json"
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
