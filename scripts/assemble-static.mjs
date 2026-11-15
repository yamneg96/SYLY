// Puts everything the portal needs next to its build, so ANY static host can serve it (Vercel, Cloudflare Pages, Netlify ...).
//   npm --prefix web ci && npm --prefix web run build && node scripts/assemble-static.mjs [--target cloudflare|vercel]
// Result: web/dist/ = the React portal + /module (the widget, its dictionaries and audio) + /demo (install page, helper page, demo data)
//                      + the Savanna starter pages (/pages, /assets, and its index at /starter) + the host's header rules.
// The API is NOT here: it runs on a server (docs/deployment.md, option D) and the host forwards /api, /sms and /docs to it.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'web', 'dist');
const target = process.argv.includes('--target') ? process.argv[process.argv.indexOf('--target') + 1] : '';

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('web/dist/index.html is missing: run "npm --prefix web run build" first.');
  process.exit(1);
}
const copy = (from, to) => cpSync(join(ROOT, from), join(DIST, to), { recursive: true });

mkdirSync(join(DIST, 'module'), { recursive: true });
copy('module/db-assistant.js', 'module/db-assistant.js');
copy('module/i18n', 'module/i18n');
copy('module/audio', 'module/audio');
copy('demo', 'demo');
copy('savanna/pages', 'pages');
copy('savanna/assets', 'assets');
copy('savanna/patch', 'patch');
// The starter's own index uses relative links: serve it with a <base> so it works at /starter.
const index = readFileSync(join(ROOT, 'savanna', 'index.html'), 'utf8').replace('<head>', '<head>\n    <base href="/">');
writeFileSync(join(DIST, 'starter.html'), index);

// Cloudflare Pages and Netlify read _headers. The widget and the demo data must be readable from other sites (CORS).
const headers = `/module/*
  Access-Control-Allow-Origin: *
/demo/*
  Access-Control-Allow-Origin: *
/data/*
  Access-Control-Allow-Origin: *
/portal-assets/*
  Cache-Control: public, max-age=31536000, immutable
`;
if (target !== 'vercel') writeFileSync(join(DIST, '_headers'), headers); // Vercel gets the same rules from vercel.json
if (target === 'cloudflare') writeFileSync(join(DIST, '_redirects'), '/starter /starter.html 200\n');

console.log(`assembled ${DIST}${target ? ` for ${target}` : ''}`);
