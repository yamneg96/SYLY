# SYLY developer portal (`web/`)

React 19 + Vite + TypeScript + Tailwind 4 + shadcn/ui (preset `b0`), with TanStack Query and Table, Zod, Zustand, React Hook Form and React Router. Tests: Vitest, Testing Library, axe.

```bash
npm install
npm run dev        # http://localhost:5173, forwards /api, /module, /demo to the stack on :8080 (docker compose up --build -d web api)
npm test           # Windows: run in PowerShell, not Git Bash
npm run lint
npm run build      # into dist/ (docker compose builds it into the web image)
```

Page text is in `src/i18n/en.json` and `am.json` (same keys, a test checks it; the Amharic is a draft). The full guide is in the repository README, "Developer portal".
