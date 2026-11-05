// Pitch deck viewer behind the horizon: arrows, keys and swipe move between slides.
(function () {
  'use strict';
  var frame = document.getElementById('deck-frame'); if (!frame) return;
  var slides = frame.querySelectorAll('img'), n = slides.length, i = 0;
  var prev = document.getElementById('deck-prev'), next = document.getElementById('deck-next'), count = document.getElementById('deck-count');
  var stage = document.getElementById('rv-stage');
  function show(k) {
    i = Math.max(0, Math.min(n - 1, k));
    slides.forEach(function (s, j) { s.hidden = j !== i; });
    if (slides[i + 1] && slides[i + 1].dataset.src && !slides[i + 1].src) slides[i + 1].src = slides[i + 1].dataset.src;
    count.textContent = (i + 1) + ' of ' + n; prev.disabled = i === 0; next.disabled = i === n - 1;
  }
  prev.addEventListener('click', function () { show(i - 1); });
  next.addEventListener('click', function () { show(i + 1); });
  document.addEventListener('keydown', function (e) {
    if (!stage.classList.contains('open')) return;
    if (e.key === 'ArrowRight') show(i + 1); else if (e.key === 'ArrowLeft') show(i - 1);
  });
  var sx = null;
  frame.addEventListener('pointerdown', function (e) { sx = e.clientX; });
  frame.addEventListener('pointerup', function (e) { if (sx === null) return; var dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 40) show(i + (dx < 0 ? 1 : -1)); });
  // slides wait behind the horizon: fetch them once someone starts to pull, or when the page is idle, so the cover paints first
  var loaded = false;
  function load(all) { slides.forEach(function (s, j) { if ((all || j < 2) && s.dataset.src && !s.src) s.src = s.dataset.src; }); if (all) loaded = true; }
  var grab = document.getElementById('rv-grab');
  if (grab) grab.addEventListener('pointerdown', function () { load(false); }, { once: true });
  stage.addEventListener('rv-open', function () { if (!loaded) load(true); });
  window.addEventListener('load', function () { (window.requestIdleCallback || function (f) { setTimeout(f, 1200); })(function () { load(false); setTimeout(function () { load(true); }, 1500); }); });
  show(0);
})();
