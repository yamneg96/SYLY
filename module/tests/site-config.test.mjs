// Developer portal: <db-assistant site="pk_..."> settings, override order, failure fallback (developer-portal.md section G).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { loadModule, MODULE_DIR } from './load.mjs';
import { join } from 'node:path';

const { applySite } = loadModule();
const SOURCE = readFileSync(join(MODULE_DIR, 'db-assistant.js'), 'utf8');

test('applySite fills only the attributes the tag does not have', () => {
  const cfg = { lang: 'am', mode: 'inline', theme: 'dark', content_selector: 'main', read_page: 'always', primary: '#1A5FB4', simple: true, key: 'pk_x' };
  const has = (a) => a === 'lang';
  const out = Object.fromEntries(applySite(cfg, has));
  assert.deepEqual(out, { mode: 'inline', theme: 'dark', primary: '#1A5FB4', 'content-selector': 'main', 'read-page': 'always' });
  assert.ok(!('lang' in out), 'attributes written on the tag win');
});

test('applySite ignores anything that is not a non-empty string, and a missing config', () => {
  assert.equal(applySite(null, () => false).length, 0);
  assert.equal(applySite({ lang: 5, mode: '', theme: null, content: {} }, () => false).length, 0);
});

// ---- the real element in jsdom
async function mount(attrs, fetchImpl) {
  const dom = new JSDOM('<!doctype html><html lang="en"><body></body></html>', { url: 'https://college.example/lesson.html', runScripts: 'outside-only', pretendToBeVisual: true });
  const calls = [];
  dom.window.fetch = (url, opts) => { calls.push({ url: String(url), opts: opts || {} }); return fetchImpl(String(url), opts); };
  dom.window.HTMLDialogElement.prototype.showModal ||= function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close ||= function () { this.open = false; };
  dom.window.matchMedia ||= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  dom.window.eval(SOURCE);
  const el = dom.window.document.createElement('db-assistant');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  dom.window.document.body.appendChild(el);
  await new Promise((r) => setTimeout(r, 60));
  return { dom, el, calls };
}
const json = (body, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 404, json: () => Promise.resolve(body) });
const CONFIG = { key: 'pk_abc', lang: 'am', mode: 'panel', position: 'start', theme: 'light', simple: true, primary: '#1A5FB4' };
const api = (url) => {
  if (url.endsWith('/v1/sites/pk_abc/config')) return json(CONFIG);
  if (url.includes('/v1/config')) return json({ page_sections: 0 });
  return json({}, false);
};

test('with a site key the module applies the site settings, and the tag wins on conflicts', async () => {
  const { el, calls } = await mount({ site: 'pk_abc', api: 'https://api.example/api', lang: 'en' }, api);
  assert.ok(calls[0].url === 'https://api.example/api/v1/sites/pk_abc/config', 'config is fetched first');
  assert.equal(el.getAttribute('lang'), 'en', 'the tag says en, the site says am: the tag wins');
  assert.equal(el.getAttribute('position'), 'start');
  assert.equal(el.getAttribute('theme'), 'light');
  assert.equal(el.getAttribute('primary'), '#1A5FB4');
  assert.ok(el.shadowRoot, 'the widget started');
  assert.equal(el._simple, true, 'simple answers default comes from the site');
  assert.equal(el._keyed({ A: 1 })['X-Site-Key'], 'pk_abc', 'the key travels with API calls');
  assert.equal(el.shadowRoot.querySelector('.root').style.getPropertyValue('--c-btn'), '#1A5FB4');
});

test('the site language is used when the tag has none', async () => {
  const { el } = await mount({ site: 'pk_abc', api: 'https://api.example/api' }, api);
  assert.equal(el.getAttribute('lang'), 'am');
});

test('a primary colour below 4.5:1 against white is ignored', async () => {
  const { el } = await mount({ site: 'pk_abc', api: 'https://api.example/api', primary: '#FFFF00' }, api);
  assert.notEqual(el.shadowRoot.querySelector('.root').style.getPropertyValue('--c-btn'), '#FFFF00');
});

test('config fetch fails (404, network error, no api attribute): the widget still starts from its attributes', async () => {
  for (const [attrs, impl] of [
    [{ site: 'pk_gone', api: 'https://api.example/api', lang: 'en' }, (u) => (u.includes('/v1/config') ? json({}) : json({}, false))],
    [{ site: 'pk_abc', api: 'https://api.example/api', lang: 'en' }, (u) => (u.includes('/sites/') ? Promise.reject(new Error('offline')) : json({}))],
    [{ site: 'pk_abc', lang: 'en' }, () => json({}, false)],
  ]) {
    const { el } = await mount(attrs, impl);
    assert.ok(el.shadowRoot, 'started');
    assert.equal(el.getAttribute('lang'), 'en');
    assert.equal(el._keyed({ A: 1 })['X-Site-Key'], undefined, 'no key header when the config could not be loaded');
  }
});

test('without a site attribute nothing about sites is fetched', async () => {
  const { el, calls } = await mount({ api: 'https://api.example/api', lang: 'en' }, () => json({}));
  assert.ok(el.shadowRoot);
  assert.ok(!calls.some((c) => c.url.includes('/sites/')));
});
