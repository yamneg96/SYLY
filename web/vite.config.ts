import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

// The portal is served by the same nginx as the module and the API (docker-compose.yml): /module, /demo, /api,
// /sms and /docs are not part of this app. In `npm run dev` they are forwarded to the running stack on :8080.
const STACK = process.env.STACK_URL ?? "http://localhost:8080"

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
      "/api": STACK,
      "/sms": STACK,
      "/module": STACK,
      "/demo": STACK,
      "/pages": STACK,
      "/assets": STACK,
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
