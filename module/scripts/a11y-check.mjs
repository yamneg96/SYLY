// Browser check of the main task flow + axe in each state (NFR-A2, SRS 6).
//   node scripts/a11y-check.mjs                       (needs a server on :8080)
//   BASE=http://localhost:8080 CHROME=path node scripts/a11y-check.mjs
// Uses the installed Chrome through puppeteer-core (dev dependency only).
import puppeteer from 'puppeteer-core';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const BASE = (process.env.BASE || 'http://localhost:8080').replace(/\/$/, '');
const CHROME = process.env.CHROME || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((p) => existsSync(p));

const STARTER = ['/pages/concept-with-navigation.html', '/pages/homepage-v1-paced.html', '/pages/homepage-v1-self-paced.html'];
const PAGES = [...STARTER, '/demo/blank.html'];
const AM_Q = 'AI ምናባዊ ረዳቶችን ይተካል?';
const OUT_Q = 'What is the capital of France?';
let failures = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures++; };

async function axe(page, label) {
  await page.addScriptTag({ content: AXE });
  const res = await page.evaluate(async () => {
    const r = await window.axe.run({ include: [['db-assistant'], ['#db-assistant-skip']] },
      { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, target: v.nodes[0] && v.nodes[0].target.join(' ') }));
  });
  const bad = res.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  ok(bad.length === 0, `axe ${label}: ${bad.length} critical/serious` + (res.length ? ` (all: ${res.map((v) => `${v.id}[${v.impact}]x${v.n} ${v.target}`).join('; ')})` : ''));
}

const shadowActive = (page) => page.evaluate(() => {
  const el = document.querySelector('db-assistant');
  const a = el.shadowRoot.activeElement;
  return a ? (a.id || a.className || a.tagName) : null;
});

async function waitMsgs(page, n) {
  await page.waitForFunction((n) => window.__a.shadowRoot.querySelectorAll('.log > li').length >= n, { timeout: 8000 }, n);
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--lang=en-US'] });
try {
  for (const path of PAGES) {
    console.log(`\n${path}`);
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(BASE + path, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => customElements.get('db-assistant'));

    await axe(page, 'closed');

    // Keyboard: first Tab reaches the skip link on starter pages (FR-L8).
    if (STARTER.includes(path)) {
      await page.keyboard.press('Tab');
      const first = await page.evaluate(() => document.activeElement && document.activeElement.id);
      ok(first === 'db-assistant-skip', `first Tab is the skip link (got "${first}")`);
      await page.keyboard.press('Enter');
    } else {
      await page.evaluate(() => document.querySelectorAll('db-assistant')[1].shadowRoot.querySelector('.launcher').focus());
      await page.keyboard.press('Enter');
    }
    const panelEl = STARTER.includes(path) ? 'db-assistant' : 'db-assistant:not([mode])';
    await page.evaluate((sel) => { window.__a = document.querySelector(sel); }, panelEl);
    const opened = await page.evaluate(() => window.__a.shadowRoot.querySelector('dialog').open);
    ok(opened, 'panel opens from the keyboard');
    let focusQ = await page.evaluate(() => window.__a.shadowRoot.activeElement && window.__a.shadowRoot.activeElement.id);
    if (focusQ === 'consent-title') {
      // AI configured on the server: the consent card comes first (NFR-S2). Choose "this page only".
      ok(true, 'consent card shown first and focused');
      await page.evaluate(() => [...window.__a.shadowRoot.querySelectorAll('.consent .actions button')][1].click());
      focusQ = await page.evaluate(() => window.__a.shadowRoot.activeElement && window.__a.shadowRoot.activeElement.id);
    }
    ok(focusQ === 'q', `focus moves into the question box (got "${focusQ}")`);
    const launcherHidden = await page.evaluate(() => window.__a.shadowRoot.querySelector('.launcher').hidden);
    ok(launcherHidden, 'launcher hidden while open');

    // Ask in Amharic, Enter sends (FR-C3).
    await page.keyboard.type(AM_Q);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__a.shadowRoot.querySelectorAll('.log > li.bot').length >= 1, { timeout: 8000 });
    const ans = await page.evaluate(() => {
      const li = window.__a.shadowRoot.querySelector('.log > li.bot');
      const a = li.querySelector('.sources a');
      return { lang: li.lang, dir: li.dir, href: a && a.getAttribute('href'), text: li.textContent.slice(0, 120), listen: !!li.querySelector('.actions button') };
    });
    ok(ans.lang === 'am' && ans.dir === 'auto', `answer has lang="am" dir="auto" (${ans.lang}/${ans.dir})`);
    ok(/#artificial-intelligence-and-the-future-of-va-work|#what-is-shaping/.test(ans.href || ''), `answer cites the AI section: ${ans.href}`);
    ok(ans.listen, 'answer has a Listen button');
    const logRole = await page.evaluate(() => { const l = window.__a.shadowRoot.querySelector('[role=log]'); return l.getAttribute('role') + '/' + l.getAttribute('aria-live'); });
    ok(logRole === 'log/polite', 'message list is role=log aria-live=polite');

    // Out of scope: "could not find" + Talk to a person (FR-T4).
    await page.evaluate(() => window.__a.shadowRoot.querySelector('#q').focus());
    await page.keyboard.type(OUT_Q);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__a.shadowRoot.querySelectorAll('.log > li.bot').length >= 2, { timeout: 8000 });
    const nf = await page.evaluate(() => {
      const li = [...window.__a.shadowRoot.querySelectorAll('.log > li.bot')].pop();
      return { sources: li.querySelectorAll('.sources a').length, buttons: [...li.querySelectorAll('button')].map((b) => b.textContent) };
    });
    ok(nf.sources === 0 && nf.buttons.length === 2, `out-of-scope: not found + Talk to a person (${nf.buttons.join(', ')})`);

    await axe(page, 'open with answers');

    // Reflow: 200% zoom on a 1280px screen (= 640 CSS px) and 320px (WCAG 1.4.10).
    for (const width of [640, 320]) {
      await page.setViewport({ width, height: 640 });
      const overflow = await page.evaluate(() => {
        const d = window.__a.shadowRoot.querySelector('dialog');
        const r = d.getBoundingClientRect();
        let wide = 0;
        d.querySelectorAll('*').forEach((el) => { const b = el.getBoundingClientRect(); if (b.right > r.right + 1 || b.left < r.left - 1) wide++; });
        return { wide, sw: d.scrollWidth, cw: d.clientWidth, w: Math.round(r.width) };
      });
      ok(overflow.wide === 0 && overflow.sw <= overflow.cw + 1, `no sideways scroll at ${width}px (panel ${overflow.w}px, overflowing ${overflow.wide})`);
    }
    await page.setViewport({ width: 1280, height: 800 });

    // Source link moves focus to the host heading (FR-T5, SDS 1.4) on the concept page.
    if (path === '/pages/concept-with-navigation.html') {
      await page.evaluate(() => window.__a.shadowRoot.querySelector('.log > li.bot .sources a').focus());
      await page.keyboard.press('Enter');
      await new Promise((r) => setTimeout(r, 300));
      const landed = await page.evaluate(() => {
        const a = document.activeElement;
        return { tag: a.tagName, text: a.textContent.trim().slice(0, 60), dialog: window.__a.shadowRoot.querySelector('dialog').open };
      });
      ok(landed.tag === 'H4' && !landed.dialog, `source link focuses heading: <${landed.tag}> "${landed.text}"`);
      await page.evaluate(() => window.__a.open());
    }

    // Escape closes and returns focus to the launcher (FR-C3).
    await page.keyboard.press('Escape');
    const after = await page.evaluate(() => ({ open: window.__a.shadowRoot.querySelector('dialog').open, focus: window.__a.shadowRoot.activeElement && window.__a.shadowRoot.activeElement.className }));
    ok(!after.open && /launcher/.test(after.focus || ''), `Escape closes, focus on launcher (${after.focus})`);

    // Talk to a person without a server: honest queued message (FR-H1, FR-C5).
    await page.evaluate(() => window.__a.open());
    const before = await page.evaluate(() => window.__a.shadowRoot.querySelectorAll('.log > li').length);
    await page.evaluate(() => window.__a.shadowRoot.querySelector('.composer > button').click());
    await waitMsgs(page, before + 1);
    const help = await page.evaluate(() => [...window.__a.shadowRoot.querySelectorAll('.log > li')].pop().textContent);
    ok(help.length > 10, `Talk to a person replies in words: "${help.slice(0, 80)}…"`);
    await page.close();
  }

  // Inline mode on the blank page.
  console.log('\n/demo/blank.html inline');
  const page = await browser.newPage();
  await page.goto(BASE + '/demo/blank.html', { waitUntil: 'load', timeout: 60000 });
  const inline = await page.evaluate(() => {
    const el = document.querySelector('db-assistant[mode="inline"]');
    return { dialog: !!el.shadowRoot.querySelector('dialog'), label: el.shadowRoot.querySelector('label[for="q"]').textContent };
  });
  ok(!inline.dialog && inline.label, `inline renders without dialog, label "${inline.label}"`);
  await page.evaluate(() => document.querySelector('db-assistant[mode="inline"]').shadowRoot.querySelector('#q').focus());
  await page.keyboard.type('What skills will clients value?');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('db-assistant[mode="inline"]').shadowRoot.querySelectorAll('.log > li.bot').length >= 1, { timeout: 8000 });
  const ev = await page.evaluate(() => document.getElementById('events').textContent);
  ok(/db-assistant:question/.test(ev), 'host received db-assistant:question');
  await axe(page, 'inline with answer');

  // Arabic: right-to-left (FR-C2).
  await page.evaluate(() => document.querySelector('db-assistant[mode="inline"]').setAttribute('lang', 'ar'));
  await new Promise((r) => setTimeout(r, 200));
  const dir = await page.evaluate(() => document.querySelector('db-assistant[mode="inline"]').shadowRoot.querySelector('.root').dir);
  ok(dir === 'rtl', `Arabic switches the module to dir="rtl" (${dir})`);
  await axe(page, 'inline Arabic');
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
