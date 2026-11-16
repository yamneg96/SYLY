// "Talk to a person" when a tutor may be offline: live screen sharing only when a tutor can watch, the screenshot always,
// a clear "you can leave" note, and the request is remembered on the phone and resumed on return.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { MODULE_DIR } from './load.mjs';

const SOURCE = readFileSync(join(MODULE_DIR, 'db-assistant.js'), 'utf8');
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const ok = (body, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

const windows = [];
// the widget polls on a timer: close every window at the end, or Node never exits
after(() => windows.forEach((w) => w.close()));

function newWindow(handler) {
  const dom = new JSDOM('<!doctype html><html lang="en"><body></body></html>', { url: 'https://college.example/lesson.html', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  windows.push(w);
  w.calls = [];
  w.fetch = (url, opts) => { w.calls.push({ url: String(url), opts: opts || {} }); return handler(String(url), opts || {}); };
  w.HTMLDialogElement.prototype.showModal ||= function () { this.open = true; };
  w.HTMLDialogElement.prototype.close ||= function () { this.open = false; };
  w.Element.prototype.scrollTo ||= function () {}; // jsdom has no scrolling
  w.matchMedia ||= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  Object.defineProperty(w.navigator, 'mediaDevices', { configurable: true, value: { getDisplayMedia: () => Promise.resolve({}) } }); // a desktop browser
  w.eval(SOURCE);
  return w;
}
async function mount(w, attrs = { lang: 'en', api: 'https://api.example/api' }) {
  const el = w.document.createElement('db-assistant');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  w.document.body.appendChild(el);
  await tick(80);
  return el;
}
const quiet = (url) => ok(url.includes('/config') ? { page_sections: 0 } : [], 200);
const logText = (el) => el.shadowRoot.querySelector('.log').textContent;
const buttons = (el) => Array.from(el.shadowRoot.querySelectorAll('.log button, .log label')).map((b) => b.textContent.trim());

test('nobody online: no live screen sharing, but the screenshot is offered, and the learner is told they may leave', async () => {
  const el = await mount(newWindow(quiet));
  el._ticketOpened({ ticketId: 12, token: 'tok', helper_online: false });
  const b = buttons(el);
  assert.ok(!b.some((x) => /Share my screen/.test(x)), 'sharing a screen that nobody watches is pointless: not offered');
  assert.ok(b.some((x) => /Send a screenshot/.test(x)), 'a screenshot stays on the request: offered');
  const text = logText(el);
  assert.match(text, /A tutor will answer here/);
  assert.match(text, /You can close this page/);
  assert.match(text, /Request number: 12/);
});

test('a tutor is online: live screen sharing and the screenshot are both offered', async () => {
  const el = await mount(newWindow(quiet));
  el._ticketOpened({ ticketId: 13, token: 'tok', helper_online: true });
  const b = buttons(el);
  assert.ok(b.some((x) => /Share my screen/.test(x)) && b.some((x) => /Send a screenshot/.test(x)));
  assert.doesNotMatch(logText(el), /You can close this page/);
});

test('a tutor who comes online later and asks to see the screen brings the share button', async () => {
  const w = newWindow((url) => (url.includes('/escalations/14/messages') ? ok([{ id: 1, author: 'system', text: 'screen_request' }]) : quiet(url)));
  const el = await mount(w);
  el._ticketOpened({ ticketId: 14, token: 'tok', helper_online: false });
  assert.ok(!buttons(el).some((x) => /Share my screen/.test(x)));
  el._pollTicket();
  await tick(50);
  assert.ok(buttons(el).some((x) => /Share my screen/.test(x)), 'now someone is watching: share is offered');
});

test('after ten minutes with no tutor, the learner is told honestly that nobody has picked it up', async () => {
  const w = newWindow((url) => (url.includes('/escalations/16/messages') ? ok([{ id: 1, author: 'system', text: 'no_tutor_yet' }]) : quiet(url)));
  const el = await mount(w);
  el._ticketOpened({ ticketId: 16, token: 'tok', helper_online: false });
  el._pollTicket();
  await tick(50);
  assert.match(logText(el), /No tutor has picked this up yet/);
});

test('the request is kept on the phone, and a new visit shows it again and fetches the reply', async () => {
  const w = newWindow((url) => (url.includes('/escalations/15/messages') ? ok([{ id: 7, author: 'helper', name: 'Selam', text: 'Here is the answer', lang: 'en' }]) : quiet(url)));
  const first = await mount(w);
  first._ticketOpened({ ticketId: 15, token: 'tok15', helper_online: false });
  const saved = JSON.parse(w.localStorage.getItem('db-assistant:ticket'));
  assert.deepEqual([saved.id, saved.token], [15, 'tok15']);
  first.remove(); // the learner closes the page

  const back = await mount(w); // ... and opens it again on the same phone
  assert.match(logText(back), /Your request 15 is still open/);
  await tick(60);
  assert.match(logText(back), /Here is the answer/, 'the tutor reply arrives on return');
  const asked = w.calls.filter((c) => c.url.includes('/escalations/15/messages')).pop().url;
  assert.match(asked, /token=tok15/);
});

test('what was already read is not shown again', async () => {
  const w = newWindow((url) => (url.includes('/escalations/16/messages') ? ok([]) : quiet(url)));
  const first = await mount(w);
  first._ticketOpened({ ticketId: 16, token: 't', helper_online: false });
  first._afterId = 9;
  first._rememberTicket();
  first.remove();
  await mount(w);
  assert.ok(w.calls.some((c) => c.url.includes('/escalations/16/messages?after=9')), 'asks only for messages after the last one seen');
});

test('a request older than 14 days, or deleted on the server, is forgotten', async () => {
  const old = newWindow(quiet);
  old.localStorage.setItem('db-assistant:ticket', JSON.stringify({ id: 17, token: 't', after: 0, at: Date.now() - 15 * 24 * 3600 * 1000 }));
  const el = await mount(old);
  assert.equal(el._ticket, null);
  assert.equal(old.localStorage.getItem('db-assistant:ticket'), 'null');

  const gone = newWindow((url) => (url.includes('/escalations/18/messages') ? ok({ detail: 'Ticket 18 not found.' }, 404) : quiet(url)));
  gone.localStorage.setItem('db-assistant:ticket', JSON.stringify({ id: 18, token: 't', after: 0, at: Date.now() }));
  const el2 = await mount(gone);
  await tick(80);
  assert.equal(el2._ticket, null, 'the server says it does not exist: stop asking');
  assert.equal(gone.localStorage.getItem('db-assistant:ticket'), 'null');
});

test('without an api the widget has nothing to resume and stays quiet', async () => {
  const w = newWindow(quiet);
  w.localStorage.setItem('db-assistant:ticket', JSON.stringify({ id: 19, token: 't', after: 0, at: Date.now() }));
  const el = await mount(w, { lang: 'en' });
  assert.equal(el._ticket, null);
});

test('the texts exist in all six languages', () => {
  for (const lang of ['en', 'am', 'ar', 'om', 'ti', 'so']) {
    const d = JSON.parse(readFileSync(join(MODULE_DIR, 'i18n', `${lang}.json`), 'utf8'));
    assert.ok(d.comeBackNote.trim() && /\{id\}/.test(d.ticketResumed), lang);
  }
});
