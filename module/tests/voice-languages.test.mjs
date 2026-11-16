// Voice input for every language: which route the mic takes, the server recording path (Oromo, Tigrinya, and any
// language the browser cannot recognise), consent, and the language list with its beta labels.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { loadModule, MODULE_DIR } from './load.mjs';

const { micRoute, browserCannot, BROWSER_STT } = loadModule();
const SOURCE = readFileSync(join(MODULE_DIR, 'db-assistant.js'), 'utf8');

test('micRoute: the browser handles en, am, ar, so; the server handles the rest and any language the browser cannot', () => {
  for (const lang of ['en', 'am', 'ar', 'so']) assert.equal(micRoute(lang, true, true, true), 'browser', lang);
  for (const lang of ['om', 'ti']) assert.equal(micRoute(lang, true, true, true), 'server', `${lang}: the browser has no recognition for it`);
  assert.equal(micRoute('ar', false, true, true), 'server', 'no browser recognition (Firefox, Safari): record instead');
  assert.equal(micRoute('om', true, false, true), 'none', 'cannot record');
  assert.equal(micRoute('om', true, true, false), 'none', 'no server to send to (the widget works alone): say so in words');
  assert.equal(micRoute('en', true, false, false), 'browser');
  assert.deepEqual(Object.keys(BROWSER_STT).sort(), ['am', 'ar', 'en', 'so']);
});

test('browserCannot: errors that send the learner to the server', () => {
  for (const e of ['language-not-supported', 'network', 'service-not-allowed']) assert.equal(browserCannot(e), true, e);
  for (const e of ['no-speech', 'aborted', 'not-allowed', undefined]) assert.equal(browserCannot(e), false, String(e));
});

// ---- the real widget in jsdom, with a fake microphone and a fake server
async function mount({ lang, consent = 'yes', recognition = null, transcribe }) {
  const dom = new JSDOM('<!doctype html><html lang="en"><body></body></html>', { url: 'https://college.example/lesson.html', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  const calls = { fetch: [], getUserMedia: 0, recorderStarted: 0 };
  w.fetch = (url, opts) => {
    calls.fetch.push({ url: String(url), opts: opts || {} });
    if (String(url).endsWith('/v1/voice/transcribe')) return transcribe(opts);
    const dict = String(url).match(/\/i18n\/(\w+)\.json$/); // the real dictionary files, as next to the script on a server
    if (dict) return json(JSON.parse(readFileSync(join(MODULE_DIR, 'i18n', `${dict[1]}.json`), 'utf8')));
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
  };
  w.HTMLDialogElement.prototype.showModal ||= function () { this.open = true; };
  w.HTMLDialogElement.prototype.close ||= function () { this.open = false; };
  w.matchMedia ||= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  Object.defineProperty(w.navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: () => { calls.getUserMedia++; return Promise.resolve({ getTracks: () => [{ stop() {} }] }); } },
  });
  w.MediaRecorder = class {
    constructor() { this.state = 'inactive'; this.mimeType = 'audio/webm;codecs=opus'; }
    start() { this.state = 'recording'; calls.recorderStarted++; }
    stop() {
      this.state = 'inactive';
      this.ondataavailable({ data: new w.Blob(['fake opus bytes'], { type: 'audio/webm' }) });
      this.onstop();
    }
  };
  if (recognition) w.webkitSpeechRecognition = recognition(w);
  w.eval(SOURCE);
  const el = w.document.createElement('db-assistant');
  el.setAttribute('lang', lang);
  el.setAttribute('api', 'https://api.example/api');
  w.document.body.appendChild(el);
  await new Promise((r) => setTimeout(r, 120)); // the dictionary of a beta language is fetched
  el._consent = consent;
  return { w, el, calls };
}
function json(body) { return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) }); }
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));

// Oromo, Tigrinya and Somali dictionaries are not inlined: the widget fetches them next to the script (served here from the real files).
for (const lang of ['om', 'ti']) {
  test(`${lang}: the mic records, sends the audio to the server in that language, and puts the text in the box`, async () => {
    const { el, calls } = await mount({ lang, transcribe: () => json({ text: 'nama waliin dubbadhu', language: lang, engine: 'gemini', beta: true }) });
    el.$mic.click(); // start
    await tick();
    assert.equal(calls.getUserMedia, 1);
    assert.equal(calls.recorderStarted, 1);
    assert.equal(el.$mic.getAttribute('aria-pressed'), 'true');
    el.$mic.click(); // stop: this sends the recording
    await tick(60);
    const sent = calls.fetch.find((c) => c.url.endsWith('/v1/voice/transcribe'));
    assert.ok(sent, 'the recording was sent');
    assert.equal(sent.opts.method, 'POST');
    assert.equal(el._lang, lang, 'the widget really switched to the language (its dictionary loaded)');
    assert.equal(sent.opts.body.get('language'), lang, 'the recording is sent for that language');
    assert.ok(sent.opts.body.get('file') && sent.opts.body.get('file').size > 0);
    assert.equal(el.$q.value, 'nama waliin dubbadhu', 'the text waits in the box: nothing is sent until the learner presses Send');
    assert.equal(el.$mic.getAttribute('aria-pressed'), 'false');
    assert.ok(!calls.fetch.some((c) => c.url.endsWith('/v1/ask')), 'not sent as a question');
  });
}

test('without consent nothing is recorded: the learner is told why, in words', async () => {
  const { el, calls } = await mount({ lang: 'om', consent: null, transcribe: () => json({ text: 'x' }) });
  el.$mic.click();
  await tick();
  assert.equal(calls.getUserMedia, 0, 'the microphone is not even opened');
  assert.match(el.$status.textContent, /online|Online|interneet/i);
  assert.ok(!calls.fetch.some((c) => c.url.endsWith('/v1/voice/transcribe')));
});

test('a server that cannot transcribe: the box stays as it was and the learner is told in words', async () => {
  const { el, calls } = await mount({ lang: 'om', transcribe: () => Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({}) }) });
  el.$q.value = 'my own words';
  el.$mic.click(); await tick(); el.$mic.click(); await tick(60);
  assert.ok(calls.fetch.some((c) => c.url.endsWith('/v1/voice/transcribe')));
  assert.equal(el.$q.value, 'my own words');
  assert.notEqual(el.$status.textContent, '');
});

test('an empty transcript is a failure in words, not an empty success', async () => {
  const { el } = await mount({ lang: 'ti', transcribe: () => json({ text: '', language: 'ti', engine: 'none', beta: true }) });
  el.$mic.click(); await tick(); el.$mic.click(); await tick(60);
  assert.equal(el.$q.value, '');
  assert.notEqual(el.$status.textContent, '');
});

test('Arabic: when the browser refuses the language, the same press falls back to recording', async () => {
  const recognition = (w) => class {
    start() { setTimeout(() => { this.onerror({ error: 'language-not-supported' }); this.onend(); }, 5); }
    stop() {}
  };
  const { el, calls } = await mount({ lang: 'ar', recognition, transcribe: () => json({ text: 'تحدث مع شخص', language: 'ar', engine: 'groq', beta: true }) });
  el.$mic.click();
  await tick(80);
  assert.equal(calls.recorderStarted, 1, 'it moved to the recorder by itself');
  el.$mic.click(); await tick(60);
  assert.equal(el.$q.value, 'تحدث مع شخص');
});

test('English keeps using the browser recognition and sends no audio to the server', async () => {
  let language = null;
  const recognition = () => class {
    start() { language = this.lang; }
    stop() {}
  };
  const { el, calls } = await mount({ lang: 'en', recognition, transcribe: () => json({ text: 'x' }) });
  el.$mic.click();
  await tick();
  assert.equal(language, 'en-US');
  assert.equal(calls.getUserMedia, 0);
  assert.equal(calls.fetch.filter((c) => c.url.includes('/voice/')).length, 0);
});

test('the language list has all six, in their own names, and the three drafts are labelled', async () => {
  const { el } = await mount({ lang: 'en', transcribe: () => json({}) });
  const options = Array.from(el.$langSel.options).map((o) => [o.value, o.textContent]);
  assert.deepEqual(options.map((o) => o[0]), ['en', 'am', 'ar', 'om', 'ti', 'so']);
  for (const [v, text] of options) {
    if (['om', 'ti', 'so'].includes(v)) assert.match(text, /\(beta\)/, v);
    else assert.doesNotMatch(text, /beta/, v);
  }
  assert.match(options.find((o) => o[0] === 'ti')[1], /ትግርኛ/);
});
