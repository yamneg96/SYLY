// Runs axe-core (via npx @axe-core/cli) on every page with the module (NFR-A2).
//   npm --prefix module run axe                 # against http://localhost:8080
//   BASE=https://xyz.trycloudflare.com npm --prefix module run axe
// Exits non-zero if axe reports any violation.
import { spawnSync } from 'node:child_process';

const BASE = (process.env.BASE || 'http://localhost:8080').replace(/\/$/, '');
const PAGES = (process.env.PAGES || [
  '/pages/concept-with-navigation.html',
  '/pages/homepage-v1-paced.html',
  '/pages/homepage-v1-self-paced.html',
  '/demo/blank.html',
  '/pages/jobs.html',
  '/demo/helper.html',
  '/demo/install.html',
].join(',')).split(',');

// Whole page by default (our pages must be clean). Starter pages carry known starter defects
// (guide section 12): for those, ONLY_MODULE=1 limits axe to the module.
const include = process.env.ONLY_MODULE ? ['--include', 'db-assistant'] : [];
const urls = PAGES.map((p) => BASE + p);
const res = spawnSync('npx', ['--yes', '@axe-core/cli@4.10.1', ...urls, ...include,
  '--tags', 'wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22aa,best-practice', '--exit'],
  { stdio: 'inherit', shell: true });
process.exit(res.status ?? 1);
