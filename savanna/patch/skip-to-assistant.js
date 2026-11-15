/*
 * Starter patch (guide section 12, SDS 1.7, FR-L8). NOT part of the module.
 * The Savanna starter has no skip link, and our <db-assistant> sits after 50+
 * sidebar links. This separate file adds one "Skip to assistant" link as the
 * first focusable element of <body>. It edits no starter file: the starter
 * pages only gained a <script> tag. Its label comes from the module's own
 * i18n dictionary (getText), so no sentence lives here.
 */
(function () {
  'use strict';
  if (!window.customElements) return;

  var HIDDEN = 'position:absolute;inset-inline-start:0;top:0;width:1px;height:1px;overflow:hidden;' +
    'clip-path:inset(50%);white-space:nowrap;';
  var SHOWN = 'position:fixed;inset-inline-start:0.5rem;top:0.5rem;z-index:2147483647;padding:0.75rem 1rem;' +
    'min-height:2.75rem;background:#002B56;color:#FFFFFF;font:inherit;font-size:1rem;font-weight:600;' +
    'text-decoration:underline;border-radius:0.375rem;outline:3px solid #F5A300;outline-offset:2px;' +
    'box-shadow:0 0 0 2px #111111;';

  function add() {
    var el = document.querySelector('db-assistant');
    if (!el || document.getElementById('db-assistant-skip')) return;
    customElements.whenDefined('db-assistant').then(function () {
      var a = document.createElement('a');
      a.id = 'db-assistant-skip';
      a.href = '#db-assistant';
      a.setAttribute('style', HIDDEN);
      var label = function () {
        var lang = el.getAttribute('lang') || 'en';
        var main = el.getText('skipLink');
        var am = el.getText('skipLink', 'am');
        a.textContent = main;
        a.lang = lang;
        if (lang !== 'am' && main !== am) {
          var s = document.createElement('span');
          s.lang = 'am';
          s.textContent = ' / ' + am;
          a.appendChild(s);
        }
      };
      label();
      el.addEventListener('db-assistant:language', label);
      a.addEventListener('focus', function () { a.setAttribute('style', SHOWN); });
      a.addEventListener('blur', function () { a.setAttribute('style', HIDDEN); });
      a.addEventListener('click', function (e) { e.preventDefault(); el.open(); });
      document.body.insertBefore(a, document.body.firstChild);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add);
  else add();
})();
