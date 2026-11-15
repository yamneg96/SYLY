/* Portal pages: text in site/i18n/<page>.<lang>.json (+ common.<lang>.json). Elements use data-t="key" (text),
 * data-t-label="key" (aria-label). Page language is remembered in this browser only. Exposes window.SYLYSite. */
(function () {
  'use strict';
  var dict = {}, current = 'en', KEY = 'syly-site-lang';

  function t(key, vars) {
    var s = dict[key] !== undefined ? dict[key] : key;
    return String(s).replace(/\{(\w+)\}/g, function (m, k) { return vars && k in vars ? vars[k] : m; });
  }
  function apply(root) {
    (root || document).querySelectorAll('[data-t]').forEach(function (el) {
      var v = dict[el.getAttribute('data-t')];
      if (v !== undefined) el.textContent = v;
    });
    (root || document).querySelectorAll('[data-t-label]').forEach(function (el) {
      var v = dict[el.getAttribute('data-t-label')];
      if (v !== undefined) el.setAttribute('aria-label', v);
    });
  }
  function get(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function one(page, lang) {
    return get('/i18n/' + page + '.' + lang + '.json').catch(function () { return get('/i18n/' + page + '.en.json'); });
  }
  function load(page, lang) {
    return Promise.all([one('common', lang), one(page, lang)]).then(function (d) {
      dict = Object.assign({}, d[0], d[1]);
      current = lang;
      document.documentElement.lang = lang;
      if (dict.pageTitle) document.title = dict.pageTitle;
      apply();
      // Our own assistant on the page follows the page language (en and am; others show English).
      document.querySelectorAll('db-assistant').forEach(function (el) { el.setAttribute('lang', lang); });
      var sel = document.getElementById('page-lang');
      if (sel) sel.value = lang;
      try { localStorage.setItem(KEY, lang); } catch (e) { /* private mode */ }
      document.dispatchEvent(new CustomEvent('site:language', { detail: { language: lang } }));
      return t;
    });
  }
  function initial() {
    var l = null;
    try { l = localStorage.getItem(KEY); } catch (e) { l = null; }
    if (!l) l = /^am/i.test(navigator.language || '') ? 'am' : 'en';
    return l === 'am' ? 'am' : 'en';
  }
  function init(page) {
    var sel = document.getElementById('page-lang');
    if (sel) sel.addEventListener('change', function (e) { load(page, e.target.value); });
    return load(page, initial());
  }
  window.SYLYSite = { t: t, load: load, init: init, apply: apply, lang: function () { return current; } };
})();
