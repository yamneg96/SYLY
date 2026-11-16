// "reply in Amharic", "translate to Arabic", በአማርኛ መልስ ...: the learner names the language of the reply.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './load.mjs';

const load = loadModule();
// objects made inside the module's sandbox have another Object prototype: compare them as plain data
const parseLangRequest = (q) => { const r = load.parseLangRequest(q); return r && JSON.parse(JSON.stringify(r)); };

test('English requests: with a question, and on their own', () => {
  assert.deepEqual(parseLangRequest('What does the Frontend course cover? Reply in Amharic'), { lang: 'am', text: 'What does the Frontend course cover?', only: false });
  assert.deepEqual(parseLangRequest('Please answer in Arabic: what is the price?'), { lang: 'ar', text: 'what is the price?', only: false });
  assert.deepEqual(parseLangRequest('tell me about the internships in Amharic'), { lang: 'am', text: 'tell me about the internships', only: false });
  assert.deepEqual(parseLangRequest('In Amharic, what is cybersecurity?'), { lang: 'am', text: 'what is cybersecurity?', only: false });
  for (const q of ['reply in Amharic', 'translate this to Amharic', 'Translate to amharic please', 'in Amharic', 'Amharic please', 'say it in Amharic']) {
    const r = parseLangRequest(q);
    assert.equal(r && r.lang, 'am', q);
    assert.equal(r.only, true, q);
  }
  assert.equal(parseLangRequest('translate to Afaan Oromo').lang, 'om');
  assert.equal(parseLangRequest('answer in Tigrinya').lang, 'ti');
  assert.equal(parseLangRequest('reply in Somali').lang, 'so');
  assert.equal(parseLangRequest('please answer in english').lang, 'en');
});

test('ordinary questions are left alone', () => {
  for (const q of ['What is the Amharic course about?', 'How much is the Frontend course?', 'Do you teach Arabic?', 'Will AI replace virtual assistants?', 'I am in Addis Ababa and want to join', '']) {
    assert.equal(parseLangRequest(q), null, q);
  }
});

test('Amharic and Arabic requests', () => {
  const am = parseLangRequest('ስለ ፊት ለፊት ኮርስ በአማርኛ መልስ');
  assert.equal(am.lang, 'am');
  assert.equal(am.only, false);
  assert.equal(am.text, 'ስለ ፊት ለፊት ኮርስ');
  const en = parseLangRequest('ወደ እንግሊዝኛ ተርጉም');
  assert.equal(en.lang, 'en');
  assert.equal(en.only, true);
  const ar = parseLangRequest('ما هي الدورات؟ أجب بالعربية');
  assert.equal(ar.lang, 'ar');
  assert.equal(ar.only, false);
  assert.equal(ar.text, 'ما هي الدورات؟');
  const tr = parseLangRequest('ترجم إلى الأمهرية');
  assert.equal(tr.lang, 'am');
  assert.equal(tr.only, true);
});
