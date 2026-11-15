import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "react-router"

import "./index.css"
import { ThemeProvider } from "@/components/theme-provider"
import { router } from "@/router"

// A failed call is tried once more, never in a loop; data stays fresh for a minute (the dashboard changes rarely).
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 60_000, refetchOnWindowFocus: false } } })

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>
)
