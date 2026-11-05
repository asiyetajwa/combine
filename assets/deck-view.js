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
    if (slides[i + 1]) slides[i + 1].loading = 'eager';
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
  show(0);
})();
