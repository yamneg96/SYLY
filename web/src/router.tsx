// Routes. Pages other than Home are loaded when first visited (the forms, table and schemas are not needed on Home).
import { createBrowserRouter, createMemoryRouter, type RouteObject } from "react-router"
import { Layout } from "@/components/layout"
import { HomePage } from "@/pages/home"
import { ErrorPage, NotFoundPage } from "@/pages/not-found"

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      {
        // a crash in one page shows words inside the normal frame (header, footer) instead of a blank screen
        errorElement: <ErrorPage />,
        children: [
          { index: true, element: <HomePage /> },
          { path: "documentation", lazy: async () => ({ Component: (await import("@/pages/docs")).DocsPage }) },
          { path: "privacy", lazy: async () => ({ Component: (await import("@/pages/privacy")).PrivacyPage }) },
          { path: "signin", lazy: async () => ({ Component: (await import("@/pages/signin")).SignInPage }) },
          { path: "dashboard", lazy: async () => ({ Component: (await import("@/pages/dashboard")).DashboardPage }) },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
]

export const router = createBrowserRouter(routes)
export const memoryRouter = (path: string) => createMemoryRouter(routes, { initialEntries: [path] })
