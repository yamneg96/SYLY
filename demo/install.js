/* Install page logic (demo/install.html). In its own file so no HTML viewer can end an inline
   <script> early at the HTML strings used to build the preview page. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var form = $('opts'), t = SYLYPage.t;
  var SRC = location.origin + '/module/db-assistant.js';

  function lum(hex) {
    var c = [1, 3, 5].map(function (i) { var v = parseInt(hex.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function radio(name) { return form.querySelector('input[name="' + name + '"]:checked').value; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // Custom colour: refused in words below 4.5:1 with white text.
  function colour() {
    var msg = $('colour-msg'), input = $('o-colour'), v = input.value.trim(), sw = $('swatch');
    $('colour-wrap').hidden = radio('theme') !== 'custom';
    if (radio('theme') !== 'custom') return null;
    if (!/^#[0-9a-fA-F]{6}$/.test(v)) {
      msg.textContent = t('colourInvalid'); msg.className = 'warn bad'; input.setAttribute('aria-invalid', 'true');
      sw.style.background = '#FFFFFF'; sw.style.color = '#111111';
      return null;
    }
    var ratio = (1.05 / (lum(v) + 0.05)).toFixed(2), good = ratio >= 4.5;
    sw.style.background = v; sw.style.color = '#FFFFFF';
    msg.textContent = (good ? '✓ ' : '✕ ') + t(good ? 'colourOk' : 'colourBad', { ratio: ratio });
    msg.className = 'warn ' + (good ? 'good' : 'bad');
    input.setAttribute('aria-invalid', good ? 'false' : 'true');
    return good ? v.toUpperCase() : null;
  }

  function attrs() {
    var a = { lang: $('o-lang').value }, theme = radio('theme'), c = colour();
    if ($('o-api').value.trim()) a.api = $('o-api').value.trim();
    if ($('o-content').value.trim()) a.content = $('o-content').value.trim();
  // Page reading (FR-AD4): the install page defaults to "always", which differs from the widget's own default
  // ("fallback"), so "always" IS written into the tag; only the widget default is left out.
  if ($('o-selector').value.trim()) a['content-selector'] = $('o-selector').value.trim();
  if ($('o-readpage').value !== 'fallback') a['read-page'] = $('o-readpage').value;
    if (theme !== 'auto' && theme !== 'custom') a.theme = theme;
    if (radio('mode') === 'inline') a.mode = 'inline';
    else if (radio('position') === 'start') a.position = 'start';
    $('position-set').hidden = radio('mode') === 'inline';
    // A custom colour is passed as the --bs-primary the module already reads, and only if it is readable.
    if (c) a.style = '--bs-primary: ' + c;
    return a;
  }

  // Colours are <span>s around the text; textContent (what Copy copies) stays the plain code.
  function highlight(a) {
    var open = function (name) { return '<span class="tk-p">&lt;</span><span class="tk-tag">' + name + '</span>'; };
    var close = function (name) { return '<span class="tk-p">&gt;&lt;/</span><span class="tk-tag">' + name + '</span><span class="tk-p">&gt;</span>'; };
    var attr = function (k, v) { return ' <span class="tk-attr">' + esc(k) + '</span><span class="tk-p">="</span><span class="tk-val">' + esc(v) + '</span><span class="tk-p">"</span>'; };
    return open('script') + attr('src', SRC) + ' <span class="tk-attr">defer</span>' + close('script') + '\n' +
      open('db-assistant') + Object.keys(a).map(function (k) { return attr(k, a[k]); }).join('') + close('db-assistant');
  }

  function render() {
    var a = attrs();
    var tag = '<db-assistant' + Object.keys(a).map(function (k) { return ' ' + k + '="' + esc(a[k]) + '"'; }).join('') + '></db-assistant>';
    $('code').innerHTML = highlight(a);
    preview(a, tag);
  }

  // Live preview: the real module in a sample host page inside an iframe, so the side button and the
  // panel stay inside the box, as on a real site. Rebuilt on every change (mode is read once at start).
  function preview(a, tag) {
    var dir = a.lang === 'ar' ? 'rtl' : 'ltr';
    var doc = '<!doctype html><html lang="' + esc(a.lang) + '" dir="' + dir + '"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1"><title>' + esc(t('previewFrameTitle')) + '</title>' +
      '<style>body{margin:0;padding:1.5rem 1.5rem 3rem;font:1rem/1.6 system-ui,"Noto Sans Ethiopic",sans-serif;color:#111111;background:#FFFFFF;}' +
      '[lang|="am"]{line-height:1.75}h1{font-size:1.375rem;margin:0 0 .5rem}p{margin:0 0 1.25rem;max-width:36rem;color:#333333}' +
      '.ph{height:.6rem;border-radius:99px;background:#E7ECF3;margin:.6rem 0;max-width:36rem}</style></head><body>' +
      '<h1>' + esc(t('previewHostTitle')) + '</h1><p>' + esc(t('previewHost')) + '</p>' +
      '<div class="ph" style="width:92%"></div><div class="ph" style="width:80%"></div><div class="ph" style="width:86%"></div>' +
      tag + '<script src="' + SRC + '" defer><\/script></body></html>';
    var box = $('preview');
    var frame = box.querySelector('iframe');
    if (!frame) { frame = document.createElement('iframe'); box.appendChild(frame); }
    frame.title = t('previewFrameTitle');
    frame.srcdoc = doc;
  }

  // Typing in a text field rebuilds after a short pause; radio and select changes rebuild at once.
  var typing = null;
  form.addEventListener('input', function (e) {
    clearTimeout(typing);
    if (e.target.type === 'text' || e.target.type === 'url') typing = setTimeout(render, 400);
    else render();
  });
  form.addEventListener('change', render);

  var copyBtn = $('copy'), resetCopy = null;
  copyBtn.addEventListener('click', function () {
    var text = $('code').textContent, status = $('copy-status');
    status.textContent = '';
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
      .then(function () {
        status.textContent = t('copied');
        copyBtn.setAttribute('data-state', 'done');
        clearTimeout(resetCopy);
        resetCopy = setTimeout(function () { copyBtn.removeAttribute('data-state'); }, 2500); // colour only; the words stay
      })
      .catch(function () { status.textContent = t('copyFailed'); });
  });
  $('page-lang').addEventListener('change', function (e) { SYLYPage.load('install', e.target.value).then(render); });
  SYLYPage.load('install', 'en').then(render);
})();
