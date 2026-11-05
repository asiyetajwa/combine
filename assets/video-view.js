// Demo video behind the horizon. The thumbnail and the film wait until someone pulls or the page is idle,
// so the cover paints first; the film pauses when the horizon closes.
(function () {
  'use strict';
  var stage = document.getElementById('rv-stage'), v = document.getElementById('demo-video');
  if (!stage || !v) return;
  function poster() { if (!v.poster && v.dataset.poster) v.poster = v.dataset.poster; }
  var grab = document.getElementById('rv-grab');
  if (grab) grab.addEventListener('pointerdown', poster, { once: true });
  stage.addEventListener('rv-open', poster);
  window.addEventListener('load', function () { (window.requestIdleCallback || function (f) { setTimeout(f, 1200); })(poster); });
  stage.addEventListener('rv-close', function () { v.pause(); });
})();
