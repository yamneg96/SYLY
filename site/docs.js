/* Docs page: Copy buttons for the code blocks. The status line is announced; the words stay (not colour only). */
(function () {
  'use strict';
  var status = document.getElementById('copy-status'), timer = null;
  function t(key) { return window.SYLYSite ? window.SYLYSite.t(key) : key; }
  document.querySelectorAll('button[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var pre = document.getElementById(btn.getAttribute('data-copy'));
      status.textContent = '';
      var done = function (ok) {
        status.textContent = t(ok ? 'copied' : 'copyFailed');
        clearTimeout(timer);
        timer = setTimeout(function () { status.textContent = ''; }, 4000);
      };
      var slow = new Promise(function (_, no) { setTimeout(no, 2000); }); // a clipboard promise that never settles still ends in a message
      Promise.race([navigator.clipboard ? navigator.clipboard.writeText(pre.textContent) : Promise.reject(), slow])
        .then(function () { done(true); }, function () { done(false); });
    });
  });
})();
