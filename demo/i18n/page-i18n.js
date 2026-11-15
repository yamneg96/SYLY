/* Tiny i18n for our own demo pages (helper, install). Text lives in demo/i18n/<page>.<lang>.json.
 * Elements use data-t="key" (text), data-t-label="key" (aria-label), data-t-placeholder is not used
 * (placeholders are not labels). Exposes one function on a namespaced object: SYLYPage. */
(function () {
  'use strict';
  var dict = {};
  function apply(root) {
    (root || document).querySelectorAll('[data-t]').forEach(function (el) {
      var v = dict[el.getAttribute('data-t')];
      if (v !== undefined) el.textContent = v;
    });
  }
  function t(key, vars) {
    var s = dict[key] !== undefined ? dict[key] : key;
    return String(s).replace(/\{(\w+)\}/g, function (m, k) { return vars && k in vars ? vars[k] : m; });
  }
  function load(page, lang) {
    return fetch('/demo/i18n/' + page + '.' + lang + '.json')
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(function () { return fetch('/demo/i18n/' + page + '.en.json').then(function (r) { lang = 'en'; return r.json(); }); })
      .then(function (d) {
        dict = d;
        document.documentElement.lang = lang;
        if (d.pageTitle) document.title = d.pageTitle;
        apply();
        return t;
      });
  }
  window.SYLYPage = { load: load, t: t, apply: apply };
})();
