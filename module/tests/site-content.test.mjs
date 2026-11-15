// The Home page's own content file (site/data/content.json): the demo assistant answers questions about SYLY,
// says "not found" for anything else, and English and Amharic parts are complete (developer-portal.md section A).
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule, readJson } from './load.mjs';

const { Index } = loadModule();
const content = readJson('site', 'data', 'content.json');
const idx = new Index(content.sections);

test('4 to 6 sections, each with both languages, a url and keywords', () => {
  assert.ok(content.sections.length >= 4 && content.sections.length <= 6);
  for (const s of content.sections) {
    for (const f of ['id', 'url', 'title_en', 'title_am', 'text_en', 'text_am']) assert.ok(String(s[f] || '').trim(), `${s.id}.${f}`);
    assert.ok(s.keywords_en.length > 0 && s.keywords_am.length > 0, s.id);
  }
  assert.match(content.notice, /Amharic DRAFT/);
});

test('questions about SYLY find the right section', () => {
  for (const [q, want] of [
    ['What is SYLY?', 'what-is-syly'], ['Tell me about SYLY', 'what-is-syly'], ['how does it work', 'how-it-works'],
    ['Is my data private?', 'privacy-and-consent'], ['Is my data safe?', 'privacy-and-consent'], ['What are the three levels?', 'three-levels'],
    ['Does it work with Telegram?', 'telegram-and-text'], ['Which learners is it built for?', 'who-is-it-for'],
  ]) {
    const r = idx.search(q);
    assert.ok(r.found, `found: ${q}`);
    assert.equal(r.best.section.id, want, q);
  }
});

test('a question that is not about SYLY is not found (no guessing)', () => {
  for (const q of ['What is the capital of France?', 'Which medicine should I take?']) assert.equal(idx.search(q).found, false, q);
});

test('every Home page text key exists in English and Amharic', () => {
  for (const page of ['common', 'home', 'privacy', 'signin', 'docs', 'dashboard']) {
    const en = readJson('site', 'i18n', `${page}.en.json`);
    const am = readJson('site', 'i18n', `${page}.am.json`);
    const drop = (d) => Object.keys(d).filter((k) => k !== '_draft').sort();
    assert.deepEqual(drop(am), drop(en), `${page}: am keys equal en keys`);
    assert.match(am._draft, /Amharic DRAFT/);
    for (const [k, v] of Object.entries(am)) if (k !== '_draft') assert.ok(String(v).trim(), `${page}.am.${k} is empty`);
  }
});
