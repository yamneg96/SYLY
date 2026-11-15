// Browser check of the developer portal pages (developer-portal.md section G): axe in en and am, skip link,
// 320 px reflow, our own assistant on Home and Docs, and the dashboard (signed out, and signed in with a seeded cookie).
//   node scripts/site-check.mjs                       (needs the stack on :8080)
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
const PAGES = ['/', '/docs.html', '/privacy.html', '/signin.html', '/dashboard.html'];
let failures = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function axe(page, label) {
  if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ content: AXE });
  const res = await page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, target: v.nodes[0] && v.nodes[0].target.join(' ') }));
  });
  const bad = res.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  ok(bad.length === 0, `axe ${label}: ${bad.length} critical/serious` + (res.length ? ` (all: ${res.map((v) => `${v.id}[${v.impact}]x${v.n} ${v.target}`).join('; ')})` : ''));
}
const texts = (page) => page.evaluate(() => document.body.innerText);
const active = (page) => page.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.tagName) : null; });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--lang=en-US'] });
try {
  for (const lang of ['en', 'am']) {
    for (const path of PAGES) {
      console.log(`\n${path} (${lang})`);
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.evaluateOnNewDocument((l) => { try { localStorage.setItem('syly-site-lang', l); } catch (e) { /* none */ } }, lang);
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 60000 });
      await sleep(600);
      ok(await page.evaluate((l) => document.documentElement.lang === l, lang), `page language is ${lang}`);
      ok(errors.length === 0, `no script errors${errors.length ? ': ' + errors[0] : ''}`);
      await axe(page, path);

      // skip link is the first Tab stop and moves focus to main
      await page.keyboard.press('Tab');
      ok((await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('skip'))), 'first Tab reaches the skip link');
      await page.keyboard.press('Enter');
      ok((await active(page)) === 'main', 'skip link moves focus to main');

      // 320 px: no sideways scrolling
      await page.setViewport({ width: 320, height: 700 });
      ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), '320 px: no horizontal scroll');
      await page.setViewport({ width: 1280, height: 800 });

      if (path === '/' && lang === 'en') {
        const q = await page.evaluateHandle(() => document.querySelector('db-assistant').shadowRoot.querySelector('textarea, input[type=text]'));
        await q.type('What is SYLY?');
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => document.querySelector('db-assistant').shadowRoot.querySelectorAll('.log > li').length >= 2, { timeout: 8000 });
        const out = await page.evaluate(() => document.querySelector('db-assistant').shadowRoot.querySelector('.log').innerText);
        ok(/assistant|course|SYLY/i.test(out) && /Source|ምንጭ/i.test(out), 'Home: our own assistant answers about SYLY, with a source');
        await axe(page, '/ with an answer');
      }
      if (path === '/docs.html' && lang === 'en') {
        const n = await page.evaluate(() => !!document.querySelector('db-assistant'));
        ok(n, 'Docs: the assistant is on the page (page reading)');
        const copied = await page.evaluate(() => { document.querySelector('button[data-copy]').click(); return true; });
        ok(copied, 'Docs: copy button clickable');
      }
      if (path === '/dashboard.html' && !COOKIE) {
        const body = await texts(page);
        ok(/not configured|Please sign in/i.test(body) || lang === 'am', 'Dashboard signed out: says why in words');
      }
      await page.close();
    }
  }

  if (COOKIE) {
    console.log('\n/dashboard.html signed in (seeded session)');
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.evaluateOnNewDocument(() => { try { localStorage.setItem('syly-site-lang', 'en'); } catch (e) { /* none */ } });
    await page.setCookie({ name: 'syly_session', value: COOKIE, url: BASE, httpOnly: true });
    await page.goto(BASE + '/dashboard.html', { waitUntil: 'networkidle2' });
    await page.waitForSelector('#app:not([hidden])', { timeout: 8000 });
    ok(await page.evaluate(() => document.getElementById('hello').textContent.includes('@')), 'signed in: shows the account');
    await axe(page, 'dashboard list');

    await page.click('#add');
    ok((await active(page)) === 'form-h', 'Add a site: focus moves to the form heading');
    await axe(page, 'dashboard form');
    await page.type('#f-name', 'Check College');
    await page.type('#f-origins', 'http://college.example');
    await page.type('#f-primary', '#FFFF00');
    await page.click('#view-form button[type=submit]');
    await sleep(500);
    const errs = await page.evaluate(() => ['e-origins', 'e-primary'].map((i) => document.getElementById(i).textContent));
    ok(/https/.test(errs[0]) && /4\.5:1/.test(errs[1]), 'errors in words next to the fields (origin, colour)');
    ok((await active(page)) === 'f-origins', 'focus goes to the first field with an error');
    await axe(page, 'dashboard form with errors');

    await page.$eval('#f-origins', (e) => { e.value = ''; });
    await page.type('#f-origins', 'https://college.example\nhttp://localhost:*');
    await page.$eval('#f-primary', (e) => { e.value = ''; });
    await page.type('#f-primary', '#1A5FB4');
    await page.type('#f-bot', '@CheckCollegeBot');
    await page.click('#view-form button[type=submit]');
    await page.waitForSelector('#view-code:not([hidden])', { timeout: 8000 });
    const code = await page.evaluate(() => document.getElementById('code-blocks').innerText);
    ok(/site="pk_[0-9a-f]{24}"/.test(code) && /jsdelivr/.test(code) && /npm i syly-db-assistant/.test(code), 'Get code shows the key, the CDN and npm variants');
    ok(await page.evaluate(() => document.getElementById('bot-link').textContent.includes('https://t.me/CheckCollegeBot')), 'the bot link uses the public username');
    await page.click('#code-blocks .copy');
    await sleep(2600);
    ok(await page.evaluate(() => /Copied|Could not copy/.test(document.getElementById('copy-status').textContent)), 'Copy announces the result in words');
    await axe(page, 'dashboard code');

    await page.click('#back');
    await page.waitForSelector('#sites > li');
    await page.click('#sites .btn-danger');
    ok(await page.evaluate(() => document.getElementById('confirm').open), 'Delete asks first (dialog)');
    ok((await active(page)) === 'c-no', 'the safe answer has focus');
    await axe(page, 'dashboard confirm dialog');
    await page.keyboard.press('Escape');
    ok(await page.evaluate(() => !document.getElementById('confirm').open && document.querySelectorAll('#sites > li').length === 1), 'Escape cancels, nothing deleted');
    await page.click('#sites .btn-danger');
    await page.click('#c-yes');
    await sleep(600);
    ok(await page.evaluate(() => document.querySelectorAll('#sites > li').length === 0), 'Yes deletes the site');
    await page.setViewport({ width: 320, height: 700 });
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'dashboard at 320 px: no horizontal scroll');
    await page.close();
  } else {
    console.log('\n(set SESSION_COOKIE to also check the signed-in dashboard)');
  }
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
