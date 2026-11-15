// FR-T2 / FR-T4 / SDS 1.5: bilingual keyword search on the VA lesson.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule, readJson } from './load.mjs';

const { Index, parseColor, contrast, detectLang, NO_ADVICE } = loadModule();
const content = readJson('demo', 'data', 'content.json');
const evalSet = readJson('api', 'scripts', 'eval_questions.json');
const index = new Index(content.sections);

test('content.json has the 5 lesson sections, bilingual, with page anchors', () => {
  assert.equal(content.sections.length, 5);
  for (const s of content.sections) {
    for (const f of ['title_en', 'title_am', 'text_en', 'text_am']) assert.ok(s[f], `${s.id}.${f}`);
    assert.ok(s.url.endsWith('#' + s.id));
  }
  assert.match(content.notice, /Amharic DRAFT/);
});

const report = (label, rows) => {
  const ok = rows.filter((r) => r.ok).length;
  console.log(`${label}: ${ok}/${rows.length}`);
  rows.filter((r) => !r.ok).forEach((r) => console.log('   miss:', r.q, '->', r.got, r.score.toFixed(2)));
  return ok / rows.length;
};

test('in-scope questions find the right section (>= 80% per language)', () => {
  for (const lang of ['en', 'am']) {
    const rows = evalSet.in_scope.filter((x) => x.lang === lang).map((x) => {
      const r = index.search(x.q);
      return { q: x.q, ok: r.found && x.expect.includes(r.best.section.id), got: r.found ? r.best.section.id : 'NOT FOUND', score: r.best.score };
    });
    assert.ok(report(`in-scope ${lang}`, rows) >= 0.8);
  }
});

test('out-of-scope questions are not answered (>= 80% per language)', () => {
  for (const lang of ['en', 'am']) {
    const rows = evalSet.out_of_scope.filter((x) => x.lang === lang).map((x) => {
      const r = index.search(x.q);
      return { q: x.q, ok: !r.found, got: r.best.section.id, score: r.best.score };
    });
    assert.ok(report(`out-of-scope ${lang}`, rows) >= 0.8);
  }
});

test('excerpt returns sentences from the section text', () => {
  const s = content.sections[1];
  const ex = index.excerpt('Will AI replace virtual assistants?', s, 'en', 3);
  assert.ok(ex.length > 0 && s.text_en.includes(ex.split('. ')[0]));
});

test('language detection', () => {
  assert.equal(detectLang('AI ምናባዊ ረዳቶችን ይተካል?', 'en'), 'am');
  assert.equal(detectLang('Will AI replace VAs?', 'am'), 'en');
  assert.equal(detectLang('هل سيحل الذكاء الاصطناعي؟', 'en'), 'ar');
});

test('no-advice topics are detected (FR-T6)', () => {
  assert.ok(NO_ADVICE.test('How do I get a work visa?'));
  assert.ok(NO_ADVICE.test('ሐኪም ማየት አለብኝ?'));
  assert.ok(!NO_ADVICE.test('What skills will clients value?'));
});

test('host colour contrast check (NFR-A5)', () => {
  const white = [255, 255, 255];
  assert.ok(contrast(parseColor('#002B56'), white) >= 4.5);
  assert.ok(contrast(parseColor('#6ea8fe'), white) < 4.5); // light blue fails: fallback used
  assert.equal(parseColor('rgb(10, 20, 30)').join(), '10,20,30');
  assert.equal(parseColor('not a colour'), null);
});
