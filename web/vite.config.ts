import { createReadStream, existsSync, statSync } from "node:fs"
import { extname, join, normalize, resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vitest/config"

// In production one nginx serves the portal, /module, /demo and proxies /api (docker-compose.yml). In `npm run dev`
// the module and demo files are served straight from this repository, so the portal works without Docker.
// Only /api and /sms need a running API: `cd api; python -m uvicorn main:app --port 8000` (or STACK_URL=... for a stack).
const API = process.env.STACK_URL ?? "http://localhost:8000"
const TYPES: Record<string, string> = {
  ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".html": "text/html; charset=utf-8", ".css": "text/css",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".mp3": "audio/mpeg", ".txt": "text/plain",
}
function repoStatic(): Plugin {
  const root = resolve(import.meta.dirname, "..")
  return {
    name: "syly-repo-static",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent((req.url ?? "").split("?")[0])
        const m = /^\/(module|demo)\//.exec(url)
        if (!m || /^\/module\/(node_modules|tests|scripts|package)/.test(url)) return next()
        const file = normalize(join(root, url))
        if (!file.startsWith(join(root, m[1])) || !existsSync(file) || !statSync(file).isFile()) return next()
        res.setHeader("Content-Type", TYPES[extname(file).toLowerCase()] ?? "application/octet-stream")
        res.setHeader("Access-Control-Allow-Origin", "*")
        createReadStream(file).pipe(res)
      })
    },
  }
}

export default defineConfig({
  plugins: [repoStatic(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    // not "assets": the Savanna starter already owns /assets
    assetsDir: "portal-assets",
  },
  server: {
    proxy: {
      "/api": API,
      "/sms": API,
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    testTimeout: 20000,
  },
})
