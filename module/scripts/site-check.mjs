// Browser check of the developer portal (web/, a React app): axe in en and am, skip link, 320 px reflow,
// our own assistant on Home and Docs, the dashboard signed out, and signed in with a seeded session cookie.
//   node scripts/site-check.mjs                          (needs the stack on :8080: docker compose up --build)
//   SESSION_COOKIE=<value> node scripts/site-check.mjs   (also checks the signed-in dashboard; see docs/run.md)
import puppeteer from 'puppeteer-core';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const BASE = (process.env.BASE || 'http://localhost:8080').replace(/\/$/, '');
const COOKIE = process.env.SESSION_COOKIE || '';
const CHROME = process.env.CHROME || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((p) => existsSync(p));
const PAGES = ['/', '/documentation', '/privacy', '/signin', '/dashboard'];
let failures = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const store = (lang) => () => { try { localStorage.setItem('syly-site-lang-v2', JSON.stringify({ state: { lang: window.__lang }, version: 0 })); } catch (e) { /* none */ } };

async function axe(page, label) {
  if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ content: AXE });
  const res = await page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, target: v.nodes[0] && v.nodes[0].target.join(' ') }));
  });
  const bad = res.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  ok(bad.length === 0, `axe ${label}: ${bad.length} critical/serious` + (res.length ? ` (all: ${res.map((v) => `${v.id}[${v.impact}]x${v.n} ${v.target}`).join('; ')})` : ''));
}
const body = (page) => page.evaluate(() => document.body.innerText);
const active = (page) => page.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.getAttribute('aria-label') || a.textContent.trim().slice(0, 40) || a.tagName) : null; });

/** The first visible element whose accessible name or text starts with `text`. */
async function find(page, text, selector = 'button, [role=tab], a') {
  const handle = await page.evaluateHandle((text, selector) => {
    const isVisible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    return Array.from(document.querySelectorAll(selector)).find((el) => isVisible(el) && ((el.getAttribute('aria-label') || el.textContent || '').trim().startsWith(text)));
  }, text, selector);
  const el = handle.asElement();
  if (!el) throw new Error(`nothing to click: "${text}"`);
  return el;
}
const click = async (page, text, selector) => (await find(page, text, selector)).click();
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
async function newPage(lang) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.evaluateOnNewDocument((l) => { try { localStorage.setItem('syly-site-lang-v2', JSON.stringify({ state: { lang: l }, version: 0 })); } catch (e) { /* none */ } }, lang);
  return page;
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--lang=en-US'] });
try {
  for (const lang of ['en', 'am']) {
    for (const path of PAGES) {
      console.log(`\n${path} (${lang})`);
      const page = await newPage(lang);
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 60000 });
      await page.waitForSelector('h1', { timeout: 10000 });
      await sleep(500);
      ok(await page.evaluate((l) => document.documentElement.lang === l, lang), `page language is ${lang}`);
      ok(errors.length === 0, `no script errors${errors.length ? ': ' + errors[0] : ''}`);
      await axe(page, path);

      await page.keyboard.press('Tab');
      ok(await page.evaluate(() => { const a = document.activeElement; return a && a.tagName === 'A' && a.getAttribute('href') === '#main'; }), 'first Tab reaches the skip link');
      await page.keyboard.press('Enter');
      ok((await active(page)) === 'main', 'skip link moves focus to main');

      await page.setViewport({ width: 320, height: 700 });
      ok(await noSideScroll(page), '320 px: no horizontal scroll');
      await page.setViewport({ width: 1280, height: 800 });

      if (path === '/' && lang === 'en') {
        const q = await page.evaluateHandle(() => document.querySelector('db-assistant').shadowRoot.querySelector('textarea, input[type=text]'));
        await q.type('What is SYLY?');
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => document.querySelector('db-assistant').shadowRoot.querySelectorAll('.log > li').length >= 2, { timeout: 8000 });
        const out = await page.evaluate(() => document.querySelector('db-assistant').shadowRoot.querySelector('.log').innerText);
        ok(/assistant|course|SYLY/i.test(out) && /Source|ምንጭ/i.test(out) && !/could not find/i.test(out), 'Home: our own assistant answers about SYLY, with a source');
        await axe(page, '/ with an answer');
      }
      if (path === '/documentation' && lang === 'en') {
        ok(await page.evaluate(() => !!document.querySelector('db-assistant[read-page]')), 'Docs: the assistant is on the page (page reading)');
        await click(page, 'Copy code', 'button');
        await sleep(2600);
        ok(/Copied|Could not copy/.test(await body(page)), 'Docs: Copy announces the result in words');
        ok(await page.evaluate(() => Array.from(document.querySelectorAll('pre')).every((p) => p.tabIndex === 0)), 'Docs: every code block can be reached by keyboard');
      }
      if (path === '/dashboard' && !COOKIE) {
        ok(/not configured|Please sign in|አልተዋቀረም|ይግቡ/i.test(await body(page)), 'Dashboard signed out: says why in words');
      }
      await page.close();
    }
  }

  {
    console.log('\nclient-side navigation');
    const page = await newPage('en');
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
    await page.waitForSelector('h1');
    await click(page, 'Docs', 'nav a');
    await page.waitForFunction(() => location.pathname === '/documentation');
    await sleep(300);
    ok((await active(page)) === 'main', 'after a route change focus is on main');
    ok(/Page: /.test(await page.evaluate(() => document.querySelector('[role=status]').textContent)), 'the new page name is announced');
    await page.goto(BASE + '/documentation#byob', { waitUntil: 'networkidle2' });
    ok(await page.evaluate(() => !!document.getElementById('byob')), 'Docs: deep link target exists (bring your own bot)');
    const missing = await page.goto(BASE + '/no/such/page', { waitUntil: 'networkidle2' });
    ok(missing.status() === 200 && /Page not found/.test(await body(page)), 'an unknown address shows the Page not found page inside the normal frame');
    ok((await (await page.goto(BASE + '/starter')).text()).includes('Savanna static pages'), 'the Savanna starter index is still at /starter');
    ok((await page.goto(BASE + '/pages/jobs.html')).status() === 200, 'starter pages are still served (/pages/jobs.html)');
    ok((await page.goto(BASE + '/demo/install.html')).status() === 200, 'the install page is still served (/demo/install.html)');
    ok((await page.goto(BASE + '/docs')).status() === 200, 'the API Swagger page is still at /docs');
    await page.close();
  }

  if (COOKIE) {
    console.log('\n/dashboard signed in (seeded session)');
    const page = await newPage('en');
    await page.setCookie({ name: 'syly_session', value: COOKIE, url: BASE, httpOnly: true });
    await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle2' });
    await page.waitForSelector('#hello', { timeout: 10000 });
    ok(await page.evaluate(() => document.getElementById('hello').textContent.includes('@')), 'signed in: shows the account');
    await axe(page, 'dashboard list (no sites)');

    await click(page, 'Add a site');
    await page.waitForSelector('#form-h');
    await sleep(300);
    ok((await active(page)) === 'form-h', 'Add a site: focus moves to the form heading');
    await axe(page, 'dashboard form');

    await click(page, 'Save site');
    await sleep(400);
    ok((await active(page)) === 'f-name', 'an empty form: focus goes to the first field with an error');
    ok(/Enter a name/.test(await page.evaluate(() => document.getElementById('f-name-error').textContent)), 'the error is in words next to the field');
    await axe(page, 'dashboard form with errors');

    await page.type('#f-name', 'Check College');
    await page.type('#f-origins', 'http://college.example');
    await page.type('#f-primary', '#FFFF00');
    await click(page, 'Save site');
    await sleep(400);
    const errs = await page.evaluate(() => ['f-origins-error', 'f-primary-error'].map((i) => document.getElementById(i).textContent));
    ok(/https/.test(errs[0]) && /4\.5:1/.test(errs[1]), 'errors in words next to the fields (origin, colour)');
    ok((await active(page)) === 'f-origins', 'focus goes to the first field with an error');

    await page.click('#f-origins', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type('#f-origins', 'https://college.example\nhttp://localhost:*');
    await page.click('#f-primary', { clickCount: 3 });
    await page.type('#f-primary', '#1A5FB4');
    await page.type('#f-bot', '@CheckCollegeBot');
    ok(/Contrast with white/.test(await page.evaluate(() => document.getElementById('f-primary-error').textContent)), 'a good colour is confirmed in words');
    await click(page, 'Save site');
    await page.waitForSelector('#code-h', { timeout: 8000 });
    await sleep(400);
    ok((await active(page)) === 'code-h', 'after saving, focus moves to the code heading');
    const panel = () => page.evaluate(() => document.querySelector('[role=tabpanel]:not([hidden])').innerText);
    ok(/site="pk_[0-9a-f]{24}"/.test(await panel()), 'Get code shows the tag with the site key');
    await click(page, 'CDN', '[role=tab]');
    ok(/jsdelivr/.test(await panel()), 'the CDN variant is a tab');
    await click(page, 'npm', '[role=tab]');
    ok(/npm i syly-db-assistant/.test(await panel()), 'the npm variant is a tab');
    ok((await body(page)).includes('https://t.me/CheckCollegeBot'), 'the bot link uses the public username');
    await click(page, 'Copy', 'button');
    await sleep(2600);
    ok(/Copied|Could not copy/.test(await body(page)), 'Copy announces the result in words');
    await axe(page, 'dashboard code');

    await click(page, 'Back to your sites');
    await page.waitForSelector('table');
    await axe(page, 'dashboard list with a site');
    await click(page, 'Delete: Check College');
    await page.waitForSelector('[role=alertdialog]');
    await sleep(300);
    ok((await active(page)) === 'No, keep it', 'the safe answer has focus in the delete dialog');
    await axe(page, 'dashboard confirm dialog');
    await page.keyboard.press('Escape');
    await sleep(400);
    ok(await page.evaluate(() => !document.querySelector('[role=alertdialog]') && document.querySelectorAll('table tbody tr').length === 1), 'Escape cancels, nothing deleted');
    await click(page, 'Delete: Check College');
    await page.waitForSelector('[role=alertdialog]');
    await click(page, 'Yes, delete');
    await sleep(900);
    ok(await page.evaluate(() => !document.querySelector('table')), 'Yes deletes the site');
    await page.setViewport({ width: 320, height: 700 });
    ok(await noSideScroll(page), 'dashboard at 320 px: no horizontal scroll');
    await page.close();
  } else {
    console.log('\n(set SESSION_COOKIE to also check the signed-in dashboard)');
  }
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
