/* Developer dashboard: sites, settings, install code, account. Everything written by a developer (site names,
   origins, notes) goes into the page with textContent, never innerHTML. State-changing calls send X-Requested-With. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var t = function (k, v) { return window.SYLYSite.t(k, v); };
  var P = window.SYLYPortal;
  var HEADERS = { 'Content-Type': 'application/json', 'X-Requested-With': 'syly' };
  var BETA = ['om', 'ti', 'so'];
  var LANG_NAMES = { am: 'አማርኛ', en: 'English', ar: 'العربية', om: 'Afaan Oromoo', ti: 'ትግርኛ', so: 'Soomaali' };
  var FIELD_IDS = { name: 'f-name', allowed_origins: 'f-origins', lang: 'f-lang', bot_username: 'f-bot', primary: 'f-primary', content_url: 'f-content-url',
    content_selector: 'f-selector', read_page: 'f-readpage', mode: null, position: null, theme: null, content_source: null };
  var ERROR_IDS = { name: 'e-name', allowed_origins: 'e-origins', lang: 'e-lang', bot_username: 'e-bot', primary: 'e-primary', content_url: 'e-content_url',
    content_selector: 'e-content_selector', read_page: 'e-read_page', mode: 'e-mode', position: 'e-position', theme: 'e-theme', content_source: 'e-content_source' };
  var S = { account: null, sites: [], editing: null, view: 'list', codeSite: null };

  /* ------------------------------------------------------------ calls */
  function api(method, path, body) {
    var opts = { method: method, credentials: 'same-origin', headers: method === 'GET' ? {} : HEADERS };
    if (body !== undefined) opts.body = JSON.stringify(body);
    return fetch(path, opts).then(function (r) {
      if (r.status === 204) return null;
      return r.json().catch(function () { return {}; }).then(function (b) {
        if (!r.ok) { var e = new Error(b.detail || String(r.status)); e.status = r.status; e.fields = b.fields; throw e; }
        return b;
      });
    });
  }
  function say(text) { var s = $('status'); s.removeAttribute('data-t'); s.textContent = text || ''; }
  function problem(e) {
    if (e && e.status === 401) { $('app').hidden = true; $('signed-out').hidden = false; $('error').textContent = t('errSession'); return; }
    $('error').textContent = e && e.status ? t('errGeneric', { why: e.message }) : t('errLoad');
  }

  /* ------------------------------------------------------------ views */
  function show(view, focusId) {
    S.view = view;
    $('view-list').hidden = view !== 'list';
    $('view-form').hidden = view !== 'form';
    $('view-code').hidden = view !== 'code';
    $('error').textContent = '';
    window.scrollTo(0, 0); // a new view starts at its top, not where the previous one was scrolled to
    var el = $(focusId || { list: 'sites-h', form: 'form-h', code: 'code-h' }[view]);
    if (el) el.focus();
  }
  function fmtDate(iso) { return new Date(iso).toLocaleDateString(window.SYLYSite.lang() === 'am' ? 'am-ET' : 'en-GB'); }
  function el(tag, props, kids) {
    var n = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) { if (k === 'text') n.textContent = props[k]; else n.setAttribute(k, props[k]); });
    (kids || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }

  /* ------------------------------------------------------------ list */
  function renderList() {
    var ul = $('sites'); ul.textContent = '';
    $('no-sites').hidden = S.sites.length > 0;
    $('hello').textContent = S.account ? t('hello', { name: S.account.name || S.account.email, email: S.account.email }) : '';
    S.sites.forEach(function (site) {
      var origins = el('ul', { 'class': 'origin-list' }, site.allowed_origins.map(function (o) { return el('li', { text: o }); }));
      var btn = function (cls, key, fn) {
        var b = el('button', { type: 'button', 'class': 'btn ' + cls, 'aria-label': t(key) + ': ' + site.name, text: t(key) });
        b.addEventListener('click', function () { fn(b); });
        return b;
      };
      var actions = el('div', { 'class': 'actions' }, [
        btn('btn-navy', 'getCode', function () { openCode(site); }),
        btn('btn-line', 'edit', function () { openForm(site); }),
        btn('btn-danger', 'delete', function (b) { confirm({ title: t('delConfirmH'), text: t('delConfirmP'), yes: t('delYes'), no: t('delNo'), opener: b, run: function () { return removeSite(site); } }); })
      ]);
      var li = el('li', { 'class': 'card site' }, [
        el('h3', { text: site.name }),
        el('p', { 'class': 'meta', text: t('created', { date: fmtDate(site.created_at) }) }),
        el('p', { 'class': 'meta' }, [document.createTextNode(t('siteKey') + ': '), el('code', { text: site.public_key })]),
        el('p', { 'class': 'meta', text: t('origins') + ':' }), origins, actions
      ]);
      ul.appendChild(li);
    });
    fillLangLabels();
  }
  function loadSites() { return api('GET', '/api/v1/sites').then(function (b) { S.sites = b.sites; renderList(); }); }

  /* ------------------------------------------------------------ form */
  function fillLangLabels() {
    Array.prototype.forEach.call($('f-lang').options, function (o) {
      o.textContent = LANG_NAMES[o.value] + (BETA.indexOf(o.value) >= 0 ? ' (' + t('betaTag') + ')' : '');
    });
  }
  function radio(name) { var r = document.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : ''; }
  function setRadio(name, value) { var r = document.querySelector('input[name="' + name + '"][value="' + value + '"]'); if (r) r.checked = true; }
  function sourceVisibility() { $('g-file').hidden = radio('source') !== 'file'; $('g-page').hidden = radio('source') !== 'page'; }

  function clearErrors() {
    Object.keys(ERROR_IDS).forEach(function (k) { var e = $(ERROR_IDS[k]); e.textContent = ''; e.className = 'error'; if (FIELD_IDS[k]) $(FIELD_IDS[k]).removeAttribute('aria-invalid'); });
    $('form-error').textContent = '';
  }
  function colourMessage() {
    var v = $('f-primary').value.trim(), e = $('e-primary'), input = $('f-primary');
    e.className = 'error'; e.textContent = ''; input.removeAttribute('aria-invalid');
    if (!v) return true;
    if (!P.validHex(v)) { e.textContent = t('colourInvalid'); input.setAttribute('aria-invalid', 'true'); return false; }
    var ratio = P.contrastWithWhite(v);
    var ok = ratio >= 4.5, r = ratio.toFixed(1);
    e.textContent = (ok ? '✓ ' : '✕ ') + t(ok ? 'colourOk' : 'colourBad', { ratio: r });
    e.className = ok ? 'error good' : 'error';
    if (!ok) input.setAttribute('aria-invalid', 'true');
    return ok;
  }

  function openForm(site) {
    S.editing = site || null;
    clearErrors();
    var s = (site && site.settings) || {};
    $('form-h').textContent = t(site ? 'editH' : 'newH');
    $('f-name').value = site ? site.name : '';
    $('f-origins').value = site ? site.allowed_origins.join('\n') : '';
    $('f-lang').value = s.lang || 'am';
    $('f-bot').value = site && site.bot_username ? '@' + site.bot_username : '';
    setRadio('mode', s.mode || 'panel'); setRadio('position', s.position || 'end'); setRadio('theme', s.theme || 'auto');
    $('f-primary').value = s.primary || '';
    setRadio('source', s.content_source || 'api');
    $('f-content-url').value = s.content_url || '';
    $('f-selector').value = s.content_selector || '';
    $('f-readpage').value = s.read_page || 'auto';
    $('f-voice').checked = !!s.voice; $('f-simple').checked = !!s.simple;
    sourceVisibility(); fillLangLabels(); colourMessage();
    show('form');
  }
  function readForm() {
    return {
      name: $('f-name').value, allowed_origins: $('f-origins').value.split(/\r?\n/), lang: $('f-lang').value, mode: radio('mode'), position: radio('position'),
      theme: radio('theme'), primary: $('f-primary').value.trim(), content_source: radio('source'), content_url: $('f-content-url').value.trim(),
      content_selector: $('f-selector').value.trim(), read_page: $('f-readpage').value, voice: $('f-voice').checked, simple: $('f-simple').checked,
      bot_username: $('f-bot').value.trim()
    };
  }
  function showFieldErrors(fields) {
    var first = null;
    Object.keys(fields || {}).forEach(function (k) {
      var e = $(ERROR_IDS[k]); if (!e) return;
      e.className = 'error'; e.textContent = fields[k];
      if (FIELD_IDS[k]) { $(FIELD_IDS[k]).setAttribute('aria-invalid', 'true'); }
    });
    var order = ['name', 'allowed_origins', 'lang', 'bot_username', 'primary', 'content_url', 'content_selector', 'read_page'];
    order.forEach(function (k) { if (!first && fields && fields[k] && FIELD_IDS[k]) first = $(FIELD_IDS[k]); });
    $('form-error').textContent = t('fixFields');
    (first || $('form-h')).focus();
  }
  function submit(ev) {
    ev.preventDefault();
    clearErrors();
    var editing = S.editing;
    var call = editing ? api('PATCH', '/api/v1/sites/' + editing.id, readForm()) : api('POST', '/api/v1/sites', readForm());
    call.then(function (b) {
      return loadSites().then(function () {
        if (editing) { say(t('saved')); show('list'); } else { say(t('created_ok')); openCode(b.site); }
      });
    }).catch(function (e) { if (e.status === 400 && e.fields) showFieldErrors(e.fields); else problem(e); });
  }

  /* ------------------------------------------------------------ code */
  // A clipboard promise that never settles (locked-down browser) must still end in a message.
  function withTimeout(p) { return Promise.race([p, new Promise(function (_, no) { setTimeout(no, 2000); })]); }
  function codeBlock(titleKey, hintKey, text, noteKey) {
    var pre = el('pre', { tabindex: '0' }, [el('code', { text: text })]);
    var copy = el('button', { type: 'button', 'class': 'btn btn-line copy', 'aria-label': t('copy') + ': ' + t(titleKey), text: t('copy') });
    copy.addEventListener('click', function () {
      var live = $('copy-status'); live.textContent = '';
      withTimeout(navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { live.textContent = t('copied'); }, function () { live.textContent = t('copyFailed'); });
    });
    var kids = [el('h3', { text: t(titleKey) })];
    if (hintKey) kids.push(el('p', { 'class': 'hint', text: t(hintKey) }));
    kids.push(pre, copy);
    if (noteKey) kids.push(el('p', { 'class': 'note', text: t(noteKey) }));
    return el('div', { 'class': 'codebox' }, kids);
  }
  function openCode(site) {
    S.codeSite = site;
    var sn = P.buildSnippets(site, location.origin);
    $('code-h').textContent = t('codeH', { name: site.name });
    var box = $('code-blocks'); box.textContent = '';
    box.appendChild(codeBlock('codeShort', 'codeShortHint', sn.short));
    box.appendChild(codeBlock('codeFull', 'codeFullHint', sn.full));
    box.appendChild(codeBlock('codeCdn', null, sn.cdn));
    box.appendChild(codeBlock('codeNpm', null, sn.npm.install + '\n\n' + sn.npm.importLine + '\n\n' + sn.npm.tag, 'codeNpmNote'));
    var link = P.botLink(site), p = $('bot-link'); p.textContent = '';
    if (link) { p.appendChild(document.createTextNode(t('botLinkP') + ' ')); p.appendChild(el('a', { href: link, text: link })); } else { p.textContent = t('botNone'); }
    show('code');
  }

  /* ------------------------------------------------------------ confirm dialog */
  var pending = null;
  function confirm(o) {
    pending = o;
    $('c-h').textContent = o.title; $('c-p').textContent = o.text; $('c-yes').textContent = o.yes; $('c-no').textContent = o.no;
    $('confirm').showModal();
    $('c-no').focus();
  }
  function closeConfirm() { $('confirm').close(); }
  function removeSite(site) {
    return api('DELETE', '/api/v1/sites/' + site.id).then(loadSites).then(function () { say(t('deleted')); $('sites-h').focus(); });
  }

  /* ------------------------------------------------------------ account */
  function download() {
    api('GET', '/api/v1/account/export').then(function (data) {
      var url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      var a = el('a', { href: url, download: 'syly-my-data.json' });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }).catch(problem);
  }
  function deleteAccount() {
    return api('DELETE', '/api/v1/account').then(function () {
      $('app').hidden = true; say(t('delAccDone')); $('signed-out').hidden = false; $('h1').focus();
    });
  }

  /* ------------------------------------------------------------ start */
  function start() {
    api('GET', '/api/v1/auth/config').then(function (cfg) {
      if (!cfg.enabled) { say(''); $('not-configured').hidden = false; return null; }
      return api('GET', '/api/v1/me').then(function (me) {
        S.account = me.account;
        say(''); $('app').hidden = false;
        return loadSites().then(function () { show('list', 'h1'); });
      }, function (e) { say(''); if (e.status === 401) { $('signed-out').hidden = false; } else { problem(e); } });
    }).catch(function (e) { say(''); problem(e); });
  }

  $('add').addEventListener('click', function () { openForm(null); });
  $('cancel').addEventListener('click', function () { show('list'); });
  $('back').addEventListener('click', function () { show('list'); });
  $('view-form').addEventListener('submit', submit);
  $('f-primary').addEventListener('input', colourMessage);
  Array.prototype.forEach.call(document.querySelectorAll('input[name="source"]'), function (r) { r.addEventListener('change', sourceVisibility); });
  $('signout').addEventListener('click', function () { api('POST', '/api/v1/auth/logout').then(function () { location.href = '/signin.html'; }, problem); });
  $('download').addEventListener('click', download);
  $('del-account').addEventListener('click', function (e) {
    confirm({ title: t('delAccH'), text: t('delAccP'), yes: t('delAccYes'), no: t('delNo'), opener: e.currentTarget, run: deleteAccount });
  });
  $('c-no').addEventListener('click', closeConfirm);
  $('c-yes').addEventListener('click', function () {
    var run = pending && pending.run; closeConfirm();
    if (run) run().catch(problem);
  });
  $('confirm').addEventListener('close', function () {
    var o = pending; pending = null;
    if (o && o.opener && document.body.contains(o.opener)) o.opener.focus();
  });
  document.addEventListener('site:language', function () {
    fillLangLabels();
    if (S.account) renderList();
    if (S.view === 'form') $('form-h').textContent = t(S.editing ? 'editH' : 'newH');
    if (S.view === 'code' && S.codeSite) openCode(S.codeSite);
  });
  // wait for the page texts, so the first messages are in the right language
  var wait = setInterval(function () {
    if (window.SYLYSite && document.documentElement.getAttribute('lang') && window.SYLYSite.t('h1') !== 'h1') { clearInterval(wait); start(); }
  }, 50);
})();
