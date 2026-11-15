/* Pure helpers for the dashboard (no DOM): colour contrast, the install code for a site, the bot link.
   Also loadable in Node for tests: module.exports. The rules match api/services/sites.py. */
(function (root) {
  'use strict';
  var CDN = 'https://cdn.jsdelivr.net/gh/yamneg96/SYLY@v1.0.0/module/db-assistant.js';

  function lum(hex) {
    var c = [1, 3, 5].map(function (i) { var v = parseInt(hex.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function validHex(v) { return /^#[0-9a-fA-F]{6}$/.test(String(v || '').trim()); }
  function contrastWithWhite(hex) { return 1.05 / (lum(hex) + 0.05); }

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function tag(attrs) {
    return '<db-assistant' + attrs.map(function (a) { return ' ' + a[0] + '="' + esc(a[1]) + '"'; }).join('') + '></db-assistant>';
  }
  function script(src) { return '<script src="' + esc(src) + '" defer></script>'; }

  // Attributes written on the tag for the "explicit" variant: only what differs from the widget's defaults.
  function explicitAttrs(site, origin) {
    var s = site.settings || {};
    var a = [['site', site.public_key], ['api', origin + '/api'], ['lang', s.lang || 'en']];
    if (s.mode === 'inline') a.push(['mode', 'inline']);
    else if (s.position === 'start') a.push(['position', 'start']);
    if (s.theme && s.theme !== 'auto') a.push(['theme', s.theme]);
    if (s.primary) a.push(['primary', s.primary]);
    if (s.content_source === 'file' && s.content_url) a.push(['content', s.content_url]);
    if (s.content_source === 'page') {
      if (s.content_selector) a.push(['content-selector', s.content_selector]);
      if (s.read_page && s.read_page !== 'auto') a.push(['read-page', s.read_page]);
    }
    return a;
  }

  // origin: the address of the server that runs SYLY (no trailing slash), for example https://syly.example.org
  function buildSnippets(site, origin) {
    origin = String(origin || '').replace(/\/+$/, '');
    var shortTag = tag([['site', site.public_key], ['api', origin + '/api']]);
    var fullTag = tag(explicitAttrs(site, origin));
    var own = origin + '/module/db-assistant.js';
    return {
      short: script(own) + '\n' + shortTag,
      full: script(own) + '\n' + fullTag,
      cdn: script(CDN) + '\n' + shortTag,
      npm: { install: 'npm i syly-db-assistant', importLine: "import 'syly-db-assistant/db-assistant.js';", tag: shortTag }
    };
  }

  function botLink(site) {
    var n = String(site.bot_username || '').replace(/^@/, '').trim();
    return n ? 'https://t.me/' + n : null;
  }

  var lib = { contrastWithWhite: contrastWithWhite, validHex: validHex, buildSnippets: buildSnippets, botLink: botLink, CDN: CDN };
  if (typeof module !== 'undefined' && module.exports) module.exports = lib;
  else root.SYLYPortal = lib;
})(typeof window !== 'undefined' ? window : globalThis);
