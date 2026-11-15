/* Developer sign in (Sign in with Google). Developers only, never learners. Nothing secret is in this file:
   the client id comes from the server, the ID token goes straight to POST /api/v1/auth/google. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var t = function (k, v) { return window.SYLYSite.t(k, v); };
  var HEADERS = { 'Content-Type': 'application/json', 'X-Requested-With': 'syly' };

  function call(path, opts) {
    return fetch(path, Object.assign({ credentials: 'same-origin', headers: HEADERS }, opts || {})).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (body) { return { ok: r.ok, status: r.status, body: body }; });
    });
  }
  function done() { var s = $('status'); s.removeAttribute('data-t'); s.textContent = ''; }
  function fail(why) { $('error').textContent = t('failed', { why: why }); }

  function onCredential(resp) {
    $('error').textContent = '';
    var s = $('status'); s.removeAttribute('data-t'); s.textContent = t('working');
    call('/api/v1/auth/google', { method: 'POST', body: JSON.stringify({ credential: resp.credential }) }).then(function (r) {
      if (r.ok) { location.href = '/dashboard.html'; return; }
      s.textContent = '';
      fail(r.body && r.body.detail ? r.body.detail : String(r.status));
    }).catch(function () { s.textContent = ''; fail(t('gisFail')); });
  }

  function loadGoogle(clientId) {
    var s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true;
    s.onload = function () {
      var g = window.google && window.google.accounts && window.google.accounts.id;
      if (!g) { fail(t('gisFail')); return; }
      g.initialize({ client_id: clientId, callback: onCredential, auto_select: false, cancel_on_tap_outside: false });
      g.renderButton($('g-button'), { theme: 'filled_blue', size: 'large', text: 'signin_with', shape: 'rectangular', locale: window.SYLYSite.lang() });
      $('g-prompt').addEventListener('click', function () { g.prompt(); });
    };
    s.onerror = function () { fail(t('gisFail')); };
    document.head.appendChild(s);
  }

  function start() {
    call('/api/v1/auth/config').then(function (r) {
      done();
      if (!r.body.enabled) { $('not-configured').hidden = false; return null; }
      return call('/api/v1/me').then(function (me) {
        if (me.ok) { $('already').hidden = false; }
        $('signin-box').hidden = false;
        loadGoogle(r.body.client_id);
      });
    }).catch(function () { done(); fail(t('gisFail')); });
  }
  // wait for the page texts so error messages are in the right language
  var wait = setInterval(function () {
    if (window.SYLYSite && document.documentElement.getAttribute('lang') && $('status')) { clearInterval(wait); start(); }
  }, 50);
})();
