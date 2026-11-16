// Voice in every language, in a real Chrome: reading aloud (POST /v1/voice/speak) and the microphone (record in the widget,
// send to the server, text in the box). Chrome's fake microphone plays a WAV file, so no person has to speak.
//   node scripts/voice-check.mjs            (needs the stack on :8080 with GROQ_API_KEY; GEMINI_API_KEY for Oromo and Tigrinya)
//   CLIP=path.wav CLIP_TEXT="..." CLIP_LANG=ar node scripts/voice-check.mjs
// The default clip is data/stt-clips/ar/02.wav ("تحدث مع شخص"), made by: python scripts/stt_check.py --make-clips ar, then converted:
//   docker compose exec api ffmpeg -y -i /app/data/stt-clips/ar/02.mp3 -ar 48000 -ac 1 /app/data/stt-clips/ar/02.wav
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = (process.env.BASE || 'http://localhost:8080').replace(/\/$/, '');
const CLIP = resolve(process.env.CLIP || '../data/stt-clips/ar/02.wav');
const CLIP_TEXT = process.env.CLIP_TEXT || 'تحدث مع شخص';
const CLIP_LANG = process.env.CLIP_LANG || 'ar';
const CHROME = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => existsSync(p));
let failures = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures++; };
const note = (msg) => console.log(`  NOTE  ${msg}`);
const words = (s) => (String(s).normalize('NFC').toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
const accuracy = (a, b) => { const x = words(a), y = new Set(words(b)); return x.length ? x.filter((w) => y.has(w)).length / x.length : 0; };

console.log('\nReading aloud: POST /api/v1/voice/speak');
const SENT = { en: 'Talk to a person', am: 'ሰላም', ar: 'تحدث مع شخص', so: 'La hadal qof', om: 'Nama waliin dubbadhu', ti: 'ምስ ሰብ ተዛረብ' };
for (const [lang, text] of Object.entries(SENT)) {
  const r = await fetch(`${BASE}/api/v1/voice/speak`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, language: lang }) });
  const type = r.headers.get('content-type') || '';
  const size = r.ok ? (await r.arrayBuffer()).byteLength : 0;
  if (['om', 'ti'].includes(lang)) {
    // these two depend on the Gemini voice (free quota) or Addis AI (credit): a 503 in words is an honest answer, not a crash
    if (r.ok) ok(size > 1000 && /audio/.test(type), `${lang}: read aloud (${type}, ${size} bytes) by the Gemini voice`);
    else { const d = (await r.json().catch(() => ({}))).detail || ''; ok(r.status === 503 && /No voice/.test(d), `${lang}: no voice right now, said in words (503: "${d.slice(0, 60)}")`); note(`${lang} has no reading-aloud voice unless GEMINI_API_KEY has TTS quota or Addis AI has credit`); }
  } else ok(r.ok && size > 1000 && /audio/.test(type), `${lang}: read aloud (${type}, ${size} bytes)`);
}

console.log(`\nMicrophone in the widget (${CLIP_LANG}, a real recording sent to the server)`);
if (!existsSync(CLIP)) { console.log(`  SKIP  clip not found: ${CLIP}`); process.exit(failures ? 1 : 0); }
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${CLIP}`, '--autoplay-policy=no-user-gesture-required'],
});
try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('db-assistant:consent', JSON.stringify('yes')); } catch (e) { /* none */ } });
  const requests = [];
  page.on('request', (r) => { if (r.url().includes('/voice/transcribe')) requests.push(r); });
  await page.goto(`${BASE}/demo/blank.html`, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => customElements.get('db-assistant') && document.querySelector('db-assistant').shadowRoot);
  await page.evaluate((lang) => {
    const el = document.querySelector('db-assistant');
    delete window.SpeechRecognition; delete window.webkitSpeechRecognition; // like Firefox and Safari: no browser recognition
    el._consent = 'yes';
    el.setAttribute('lang', lang);
  }, CLIP_LANG);
  await new Promise((r) => setTimeout(r, 800));
  ok(await page.evaluate((l) => document.querySelector('db-assistant')._lang === l, CLIP_LANG), `the widget switched to ${CLIP_LANG}`);
  await page.evaluate(() => { const e = document.querySelector('db-assistant'); if (e.$dialog && e.open) e.open(); e.$mic.click(); });
  await new Promise((r) => setTimeout(r, 1500));
  ok(await page.evaluate(() => document.querySelector('db-assistant').$mic.getAttribute('aria-pressed') === 'true'), 'recording started (the button says Stop)');
  await new Promise((r) => setTimeout(r, 3500));
  await page.evaluate(() => document.querySelector('db-assistant').$mic.click());
  await page.waitForFunction(() => document.querySelector('db-assistant').$q.value.trim() !== '' || /\S/.test(document.querySelector('db-assistant').$status.textContent) && !/\.\.\.|…/.test(document.querySelector('db-assistant').$status.textContent), { timeout: 40000 }).catch(() => {});
  const result = await page.evaluate(() => { const e = document.querySelector('db-assistant'); return { text: e.$q.value, status: e.$status.textContent }; });
  ok(requests.length === 1, 'exactly one recording was sent to /v1/voice/transcribe');
  const resp = requests[0] && (await requests[0].response());
  ok(resp && resp.status() === 200, `the server answered 200 (got ${resp && resp.status()})`);
  const acc = accuracy(CLIP_TEXT, result.text);
  console.log(`  heard: ${JSON.stringify(result.text)}  expected: ${JSON.stringify(CLIP_TEXT)}  (status: ${result.status})`);
  ok(result.text.trim() !== '', 'the text is in the question box, waiting for the learner to press Send');
  ok(acc >= 0.5, `word accuracy ${(acc * 100).toFixed(0)}% (at least 50% of the words)`);
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
