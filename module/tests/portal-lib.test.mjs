// Developer portal: the install code the dashboard generates, the colour rule, the bot link (site/portal-lib.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const lib = createRequire(import.meta.url)('../../site/portal-lib.js');
const SITE = { public_key: 'pk_0123456789abcdef01234567', bot_username: null,
  settings: { lang: 'am', mode: 'panel', position: 'end', theme: 'auto', primary: '', content_source: 'api', content_url: '', content_selector: '', read_page: 'auto' } };
const ORIGIN = 'https://syly.example.org';

test('the short code carries only the site key and the api address', () => {
  const s = lib.buildSnippets(SITE, ORIGIN + '/');
  assert.equal(s.short, '<script src="https://syly.example.org/module/db-assistant.js" defer></script>\n' +
    '<db-assistant site="pk_0123456789abcdef01234567" api="https://syly.example.org/api"></db-assistant>');
});

test('the explicit code writes the chosen attributes and leaves out the defaults', () => {
  const site = { ...SITE, settings: { ...SITE.settings, lang: 'en', mode: 'inline', theme: 'dark', primary: '#1A5FB4', content_source: 'page', content_selector: 'main', read_page: 'always' } };
  const tag = lib.buildSnippets(site, ORIGIN).full.split('\n')[1];
  assert.equal(tag, '<db-assistant site="pk_0123456789abcdef01234567" api="https://syly.example.org/api" lang="en" mode="inline" theme="dark" primary="#1A5FB4" content-selector="main" read-page="always"></db-assistant>');
  const plain = lib.buildSnippets(SITE, ORIGIN).full.split('\n')[1];
  assert.ok(!/mode=|position=|theme=|primary=|content=|read-page=/.test(plain), 'defaults are not written');
  const start = lib.buildSnippets({ ...SITE, settings: { ...SITE.settings, position: 'start' } }, ORIGIN).full;
  assert.match(start, /position="start"/);
  const file = lib.buildSnippets({ ...SITE, settings: { ...SITE.settings, content_source: 'file', content_url: 'https://c.example/l.json' } }, ORIGIN).full;
  assert.match(file, /content="https:\/\/c\.example\/l\.json"/);
});

test('the CDN code is pinned to a version and uses full https addresses', () => {
  const s = lib.buildSnippets(SITE, ORIGIN);
  assert.match(s.cdn, /^<script src="https:\/\/cdn\.jsdelivr\.net\/gh\/yamneg96\/SYLY@v1\.0\.0\/module\/db-assistant\.js" defer><\/script>/);
  assert.match(s.cdn, /api="https:\/\/syly\.example\.org\/api"/);
  assert.equal(s.npm.install, 'npm i syly-db-assistant');
  assert.equal(s.npm.importLine, "import 'syly-db-assistant/db-assistant.js';");
});

test('values are escaped, so a site cannot break out of the generated tag', () => {
  const site = { ...SITE, settings: { ...SITE.settings, content_source: 'file', content_url: 'https://c.example/a"><script>alert(1)</script>' } };
  const out = lib.buildSnippets(site, ORIGIN).full;
  assert.ok(!out.includes('"><script>alert'), out);
  assert.match(out, /&quot;&gt;&lt;script&gt;/);
});

test('colour rule: 4.5:1 against white, same numbers as the server', () => {
  assert.equal(lib.contrastWithWhite('#000000').toFixed(1), '21.0');
  assert.equal(lib.contrastWithWhite('#767676').toFixed(2), '4.54');
  assert.ok(lib.contrastWithWhite('#1A5FB4') >= 4.5);
  assert.ok(lib.contrastWithWhite('#F5A300') < 4.5, 'the amber focus colour is too light for white text');
  assert.equal(lib.validHex('#1A5FB4'), true);
  assert.equal(lib.validHex('1A5FB4'), false);
  assert.equal(lib.validHex('#12345'), false);
});

test('the bot link is built from the public username only', () => {
  assert.equal(lib.botLink({ bot_username: 'MyCollegeHelpBot' }), 'https://t.me/MyCollegeHelpBot');
  assert.equal(lib.botLink({ bot_username: '@MyCollegeHelpBot' }), 'https://t.me/MyCollegeHelpBot');
  assert.equal(lib.botLink({ bot_username: null }), null);
});
