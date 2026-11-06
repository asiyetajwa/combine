// Business model tabs behind the horizon: click or arrow keys move between them.
(function () {
  'use strict';
  var tabs = [].slice.call(document.querySelectorAll('.bm-tabs [role="tab"]')); if (!tabs.length) return;
  function go(i) {
    tabs.forEach(function (t, j) { var on = j === i; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; document.getElementById(t.getAttribute('aria-controls')).hidden = !on; });
    var c = document.getElementById('rv-content'); if (c) c.scrollTop = 0;
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { go(i); });
    t.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); var k = (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length; go(k); tabs[k].focus(); } });
  });
})();
