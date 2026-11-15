// SDS 1.2 / 6: inlined dictionaries equal the JSON files; every en key is
// present and non-empty in am and ar; placeholders match.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadModule, readJson, MODULE_DIR } from './load.mjs';

const { I18N } = loadModule();
const en = readJson('module', 'i18n', 'en.json');

test('inlined dictionaries equal module/i18n/*.json', () => {
  for (const lang of ['en', 'am', 'ar']) {
    assert.deepEqual(JSON.parse(JSON.stringify(I18N[lang])), readJson('module', 'i18n', `${lang}.json`), `${lang} differs: run npm --prefix module run i18n`);
  }
});

for (const file of readdirSync(join(MODULE_DIR, 'i18n')).filter((f) => f.endsWith('.json'))) {
  const lang = file.replace('.json', '');
  if (lang === 'en') continue;
  test(`${lang}.json has every en key, non-empty, same placeholders`, () => {
    const dict = readJson('module', 'i18n', file);
    for (const key of Object.keys(en)) {
      assert.ok(typeof dict[key] === 'string' && dict[key].trim(), `${lang}.${key} missing or empty`);
      const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
      assert.equal(ph(dict[key]), ph(en[key]), `${lang}.${key} placeholders`);
    }
    for (const key of Object.keys(dict)) assert.ok(key in en, `${lang}.${key} is not in en.json`);
  });
}

test('Amharic strings are not English copies (except names and codes)', () => {
  const am = readJson('module', 'i18n', 'am.json');
  const same = ['assistant', 'langName_am', 'langName_en', 'langName_ar', 'dir'];
  for (const key of Object.keys(en)) {
    if (same.includes(key) || key === 'speechLang') continue;
    assert.notEqual(am[key], en[key], `am.${key} is untranslated`);
  }
});
