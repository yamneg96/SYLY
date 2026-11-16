// FR-AD4 / SDS 1.8: page reading fallback (new-feature.md section 4, unit tests).
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { loadModule, readJson } from './load.mjs';

const { readPage, pageRoot, decidePageReading, pageToIndex, textFragment, Index } = loadModule();

function page(body, { htmlLang = 'en', title = 'Test page', path = '/lesson.html' } = {}) {
  const dom = new JSDOM(`<!doctype html><html lang="${htmlLang}"><head><title>${title}</title></head><body>${body}</body></html>`,
    { url: 'https://host.example' + path });
  const { document } = dom.window;
  return { dom, document, ctx: { doc: document, win: dom.window, loc: dom.window.location } };
}
const LONG = 'This paragraph has more than forty characters of useful lesson text in it.';

test('splits by h2/h3; text before the first heading is titled by the h1', () => {
  const { document, ctx } = page(`<main><h1>Battery care</h1><p>${LONG}</p>
    <h2 id="a">Charge level</h2><p>${LONG}</p><h3>Heat</h3><p>${LONG}</p></main>`);
  const s = readPage(pageRoot(document), ctx);
  assert.deepEqual(Array.from(s, (x) => x.title), ['Battery care', 'Charge level', 'Heat']);
  assert.ok(s.every((x) => x.source === 'page' && x.text.length >= 40));
  assert.ok(!s[0].text.includes('Battery care'), 'the h1 is the title, not body text');
});

test('no h2/h3: one section for the whole root, titled by document.title', () => {
  const { document, ctx } = page(`<main><p>${LONG}</p><p>${LONG}</p></main>`, { title: 'Only text' });
  const s = readPage(pageRoot(document), ctx);
  assert.equal(s.length, 1);
  assert.equal(s[0].title, 'Only text');
  assert.equal(s[0].url, '/lesson.html');
});

test('skip rules: nav, header, footer, aside, script, style, form, hidden, aria-hidden, display:none, db-assistant, skip link', () => {
  const { document, ctx } = page(`<a id="db-assistant-skip" href="#x">Skip to assistant link text that is long enough here</a>
    <header><h2>Header heading</h2><p>${LONG} HEADER</p></header>
    <nav><p>${LONG} NAV</p></nav>
    <div class="body"><h2 id="ok">Kept section</h2><p>${LONG} KEPT</p>
      <aside><h2>Aside</h2><p>${LONG} ASIDE</p></aside>
      <form><p>${LONG} FORM</p></form>
      <script>var x = "${LONG} SCRIPT";</script><style>.a{color:red}</style>
      <div hidden><h2>Hidden</h2><p>${LONG} HIDDEN</p></div>
      <div aria-hidden="true"><p>${LONG} ARIAHIDDEN</p></div>
      <div style="display:none"><p>${LONG} NONE</p></div>
      <db-assistant><p>${LONG} WIDGET</p></db-assistant>
    </div>
    <footer><p>${LONG} FOOTER</p></footer>`);
  const all = readPage(document.body, ctx).map((x) => x.title + ' ' + x.text).join(' | ');
  assert.match(all, /KEPT/);
  for (const bad of ['HEADER', 'NAV', 'ASIDE', 'FORM', 'SCRIPT', 'HIDDEN', 'ARIAHIDDEN', 'NONE', 'WIDGET', 'FOOTER', 'Skip to assistant']) {
    assert.ok(!all.includes(bad), `${bad} must be skipped`);
  }
});

test('caps: at most 50 sections, 4,000 characters each, sections under 40 characters dropped', () => {
  const many = Array.from({ length: 60 }, (_, i) => `<h2>Section ${i}</h2><p>${LONG}</p>`).join('');
  const { document, ctx } = page(`<main>${many}<h2>Tiny</h2><p>too short</p></main>`);
  const s = readPage(pageRoot(document), ctx);
  assert.equal(s.length, 50);
  const big = page(`<main><h2>Big</h2><p>${'word '.repeat(2000)}</p></main>`);
  assert.equal(readPage(pageRoot(big.document), big.ctx)[0].text.length, 4000);
  const tiny = page(`<main><h2>Tiny</h2><p>too short</p></main>`);
  assert.equal(readPage(pageRoot(tiny.document), tiny.ctx).length, 0);
});

test('lang: nearest lang attribute on the heading, else <html lang>', () => {
  const { document, ctx } = page(`<main><h2>English</h2><p>${LONG}</p>
    <section lang="am"><h2>ስለ ባትሪ</h2><p>${LONG}</p></section></main>`, { htmlLang: 'en' });
  const s = readPage(pageRoot(document), ctx);
  assert.deepEqual(Array.from(s, (x) => x.lang), ['en', 'am']);
  assert.equal(pageToIndex(s[1]).text_am, s[1].text);
  assert.equal(pageToIndex(s[0]).text_en, s[0].text);
});

test('URLs: heading id -> #id; no id -> text fragment, nothing added to the DOM', () => {
  const { document, ctx } = page(`<main><h2 id="charge">Charge level</h2><p>${LONG}</p>
    <h2>Avoid heat, while charging - always</h2><p>${LONG}</p></main>`);
  const s = readPage(pageRoot(document), ctx);
  assert.equal(s[0].url, '/lesson.html#charge');
  assert.equal(s[1].url, '/lesson.html#:~:text=Avoid%20heat%2C%20while%20charging%20%2D%20always');
  assert.equal(textFragment('a'.repeat(30) + ' ' + 'b'.repeat(40)), 'a'.repeat(30));
});

test('read-only: the root outerHTML is identical before and after reading', () => {
  const { document, ctx } = page(`<main><h1>T</h1><h2>No id</h2><p>${LONG}</p><h2 id="x">Id</h2><p>${LONG}</p></main>`);
  const root = pageRoot(document);
  const before = root.outerHTML;
  readPage(root, ctx);
  readPage(root, ctx);
  assert.equal(root.outerHTML, before);
});

test('root: content-selector, else main, article, [role=main], else body', () => {
  const { document } = page(`<div id="lesson"></div><article></article><main></main>`);
  assert.equal(pageRoot(document, '#lesson').id, 'lesson');
  assert.equal(pageRoot(document, 'not a [valid selector').tagName, 'MAIN');
  assert.equal(pageRoot(document).tagName, 'MAIN');
  assert.equal(pageRoot(page('<article></article>').document).tagName, 'ARTICLE');
  assert.equal(pageRoot(page('<div role="main"></div>').document).getAttribute('role'), 'main');
  assert.equal(pageRoot(page('<p>x</p>').document).tagName, 'BODY');
});

test('fallback order (2.1): file, then server sections for this page, then page reading', () => {
  // default (no read-page attribute)
  assert.equal(decidePageReading('fallback', true, 'unreachable'), false, 'fallback, file loaded: no page reading');
  assert.equal(decidePageReading('fallback', false, 'hasSections'), false, 'fallback, server has this page: no page reading');
  assert.equal(decidePageReading('fallback', false, 'noSections'), true);
  assert.equal(decidePageReading('fallback', false, 'unreachable'), true);
  assert.equal(decidePageReading('fallback', false, 'none'), true);
  // the default (no attribute, or "auto" from the portal) reads the page whatever else exists
  for (const m of ['', 'auto']) for (const f of [true, false]) for (const sv of ['none', 'unreachable', 'hasSections', 'noSections']) assert.equal(decidePageReading(m, f, sv), true, `default ${m}/${f}/${sv}`);
  // read-page="off" never; read-page="always" always (alongside the file)
  for (const f of [true, false]) for (const sv of ['none', 'unreachable', 'hasSections', 'noSections']) {
    assert.equal(decidePageReading('off', f, sv), false);
    assert.equal(decidePageReading('always', f, sv), true);
  }
});

test('page sections are searchable with the same index, and cite the page section', () => {
  const { document, ctx } = page(`<main><h2 id="heat">Avoid heat while charging</h2>
    <p>Heat is the biggest enemy of a battery. Do not charge the laptop on a bed or a pillow.</p>
    <h2>Storage</h2><p>Charge the battery to about half and keep it in a cool, dry place for weeks.</p></main>`);
  const ix = new Index(readPage(pageRoot(document), ctx).map(pageToIndex));
  const r = ix.search('Why should I not charge my laptop on a bed?');
  assert.ok(r.found && r.best.section.url === '/lesson.html#heat');
  assert.ok(!ix.search('ባትሪዬን እንዴት እጠብቃለሁ?').found, 'known limit: Amharic question, English page, offline');
});

test('regression: the lesson eval on content.json is unchanged', () => {
  const ix = new Index(readJson('demo', 'data', 'content.json').sections);
  const ev = readJson('api', 'scripts', 'eval_questions.json');
  const ins = ev.in_scope.filter((x) => (r => r.found && x.expect.includes(r.best.section.id))(ix.search(x.q))).length;
  const outs = ev.out_of_scope.filter((x) => !ix.search(x.q).found).length;
  assert.equal(ins, ev.in_scope.length);
  assert.equal(outs, ev.out_of_scope.length);
});
